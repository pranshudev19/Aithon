"""
PM Orchestrator
────────────────
Coordinates the 4-agent PM pipeline:
  Intent Parser → Task Generator → Priority Engine → Scheduler

Broadcasts real-time WebSocket events at each step.
Writes PMAuditLog and PMLineage for every agent execution.
"""

import time
import asyncio
from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from agents.pm.intent_parser import run_intent_parser
from agents.pm.task_generator import run_task_generator
from agents.pm.priority_engine import run_priority_engine
from agents.pm.scheduler import run_scheduler
from models.database_models import (
    Project, PMTask, Subtask, PMAuditLog, PMLineage,
    ProjectStatus, PipelineStatus, PMAGentType,
    PMTaskStatus, Priority, Effort
)
from utils.logging_utils import get_logger

logger = get_logger("core.pm_orchestrator")

# Circular import guard — ws_manager is set by main.py after startup
_ws_manager = None


def set_ws_manager(manager):
    global _ws_manager
    _ws_manager = manager


def _broadcast(project_id: str, event: dict):
    """Fire-and-forget WebSocket broadcast."""
    if _ws_manager:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_ws_manager.broadcast(project_id, event))
            else:
                loop.run_until_complete(_ws_manager.broadcast(project_id, event))
        except Exception as e:
            logger.warning(f"WebSocket broadcast failed: {e}")


def _write_audit(db: Session, project_id: str, action: str, agent: PMAGentType | None = None,
                 details: dict = None, severity: str = "INFO"):
    log = PMAuditLog(
        project_id=project_id,
        agent_type=agent,
        action=action,
        details=details or {},
        severity=severity,
    )
    db.add(log)
    db.flush()


def _start_lineage(db: Session, project_id: str, agent: PMAGentType, input_data: dict) -> PMLineage:
    record = PMLineage(
        project_id=project_id,
        agent_type=agent,
        input_data=input_data,
        started_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.flush()
    return record


def _end_lineage(db: Session, record: PMLineage, output_data: dict, success: bool, duration: float):
    record.output_data = output_data
    record.ended_at = datetime.now(timezone.utc)
    record.duration_seconds = duration
    record.success = success
    db.flush()


def _set_agent_status(db: Session, project: Project, agent_name: str, status: str):
    project.pipeline_current_agent = agent_name
    db.flush()
    _broadcast(project.id, {
        "event": "agent_update",
        "project_id": project.id,
        "agent": agent_name,
        "status": status,
    })


def _save_tasks_to_db(db: Session, schedule: list[dict], project: Project) -> list[PMTask]:
    """Persist scheduled tasks and their subtasks to the database."""
    saved = []
    for task_data in schedule:
        # Map priority
        try:
            priority = Priority(task_data.get("priority", "MEDIUM"))
        except ValueError:
            priority = Priority.MEDIUM

        # Map effort
        effort_str = task_data.get("estimated_effort", "medium")
        try:
            effort = Effort(effort_str)
        except ValueError:
            effort = Effort.MEDIUM

        # Parse dates
        def _to_date(s):
            if not s:
                return None
            try:
                return date.fromisoformat(str(s))
            except Exception:
                return None

        pm_task = PMTask(
            task_ref=task_data.get("task_ref", "TSK-???"),
            project_id=project.id,
            title=task_data.get("title", "")[:500],
            description=task_data.get("description", ""),
            priority=priority,
            priority_score=task_data.get("priority_score", 50.0),
            status=PMTaskStatus.PENDING,
            estimated_effort=effort,
            assigned_to=task_data.get("assigned_to"),
            deadline=_to_date(task_data.get("deadline")),
            start_date=_to_date(task_data.get("start_date")),
            end_date=_to_date(task_data.get("end_date")),
            timeline_slot=task_data.get("timeline_slot"),
            risk_flag=task_data.get("risk_flag", False),
            dependency_task_ids=[],
        )
        db.add(pm_task)
        db.flush()  # Get the ID

        # Save subtasks
        for sub_title in task_data.get("subtasks", []):
            subtask = Subtask(
                pm_task_id=pm_task.id,
                title=sub_title[:500],
                status=PMTaskStatus.PENDING,
            )
            db.add(subtask)

        saved.append(pm_task)

    db.flush()
    return saved


def execute_pm_pipeline(project_id: str, description: str, db: Session) -> dict:
    """
    Execute the full 4-agent PM pipeline for a project.

    Pipeline: Intent Parser → Task Generator → Priority Engine → Scheduler
    Each agent's output becomes the next agent's input.

    Args:
        project_id: The project to run the pipeline for
        description: Natural language input from the manager
        db: Database session

    Returns:
        dict with pipeline results
    """
    logger.info(f"Starting PM pipeline for project {project_id}")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Mark pipeline as running
    project.pipeline_status = PipelineStatus.RUNNING
    db.commit()

    _broadcast(project_id, {"event": "pipeline_started", "project_id": project_id})

    pipeline_failed = False
    pipeline_results = {}

    # ── Agent 1: Intent Parser ────────────────────────────────────────────────
    try:
        _set_agent_status(db, project, "INTENT_PARSER", "RUNNING")
        db.commit()
        _write_audit(db, project_id, "Intent Parser started", PMAGentType.INTENT_PARSER)
        db.commit()

        lineage = _start_lineage(db, project_id, PMAGentType.INTENT_PARSER,
                                  {"description": description})
        db.commit()

        t0 = time.time()
        parsed = run_intent_parser(description)
        duration = time.time() - t0

        _end_lineage(db, lineage, parsed, True, duration)
        _write_audit(db, project_id, "Intent Parser completed",
                     PMAGentType.INTENT_PARSER,
                     {"tasks_found": len(parsed["tasks_raw"]), "duration": duration})
        db.commit()

        _set_agent_status(db, project, "INTENT_PARSER", "COMPLETED")

        # Update project with extracted name/constraints
        if parsed.get("project") and parsed["project"] != "Project":
            project.name = parsed["project"]
        project.constraints = parsed.get("constraints", [])
        db.commit()

        pipeline_results["intent_parser"] = parsed

    except Exception as e:
        _handle_failure(db, project, "INTENT_PARSER", str(e))
        return {"status": "FAILED", "failed_agent": "INTENT_PARSER", "error": str(e)}

    # ── Agent 2: Task Generator ───────────────────────────────────────────────
    try:
        _set_agent_status(db, project, "TASK_GENERATOR", "RUNNING")
        db.commit()
        _write_audit(db, project_id, "Task Generator started", PMAGentType.TASK_GENERATOR)
        db.commit()

        lineage = _start_lineage(db, project_id, PMAGentType.TASK_GENERATOR,
                                  {"tasks_raw": parsed["tasks_raw"]})
        db.commit()

        t0 = time.time()
        structured_tasks = run_task_generator(parsed["tasks_raw"], project_id)
        duration = time.time() - t0

        _end_lineage(db, lineage, {"tasks": structured_tasks}, True, duration)
        _write_audit(db, project_id, "Task Generator completed",
                     PMAGentType.TASK_GENERATOR,
                     {"tasks_generated": len(structured_tasks), "duration": duration})
        db.commit()

        _set_agent_status(db, project, "TASK_GENERATOR", "COMPLETED")
        db.commit()

        pipeline_results["task_generator"] = {"tasks": structured_tasks}

    except Exception as e:
        _handle_failure(db, project, "TASK_GENERATOR", str(e))
        return {"status": "FAILED", "failed_agent": "TASK_GENERATOR", "error": str(e)}

    # ── Agent 3: Priority Engine ──────────────────────────────────────────────
    try:
        _set_agent_status(db, project, "PRIORITY_ENGINE", "RUNNING")
        db.commit()
        _write_audit(db, project_id, "Priority Engine started", PMAGentType.PRIORITY_ENGINE)
        db.commit()

        lineage = _start_lineage(db, project_id, PMAGentType.PRIORITY_ENGINE,
                                  {"tasks": structured_tasks,
                                   "constraints": parsed.get("constraints", [])})
        db.commit()

        t0 = time.time()
        ranked_tasks = run_priority_engine(structured_tasks, parsed.get("constraints", []))
        duration = time.time() - t0

        risk_count = sum(1 for t in ranked_tasks if t.get("risk_flag"))
        _end_lineage(db, lineage, {"ranked_tasks": ranked_tasks}, True, duration)
        _write_audit(db, project_id, "Priority Engine completed",
                     PMAGentType.PRIORITY_ENGINE,
                     {"tasks_ranked": len(ranked_tasks), "risk_flags": risk_count, "duration": duration})
        db.commit()

        _set_agent_status(db, project, "PRIORITY_ENGINE", "COMPLETED")
        db.commit()

        pipeline_results["priority_engine"] = {"ranked_tasks": ranked_tasks}

    except Exception as e:
        _handle_failure(db, project, "PRIORITY_ENGINE", str(e))
        return {"status": "FAILED", "failed_agent": "PRIORITY_ENGINE", "error": str(e)}

    # ── Agent 4: Scheduler ────────────────────────────────────────────────────
    try:
        _set_agent_status(db, project, "SCHEDULER", "RUNNING")
        db.commit()
        _write_audit(db, project_id, "Scheduler started", PMAGentType.SCHEDULER)
        db.commit()

        lineage = _start_lineage(db, project_id, PMAGentType.SCHEDULER,
                                  {"ranked_tasks": ranked_tasks})
        db.commit()

        t0 = time.time()
        schedule = run_scheduler(ranked_tasks, project_id, db)
        duration = time.time() - t0

        # Save tasks to database
        saved_tasks = _save_tasks_to_db(db, schedule, project)
        db.commit()

        _end_lineage(db, lineage, {"schedule": schedule}, True, duration)
        _write_audit(db, project_id, "Scheduler completed",
                     PMAGentType.SCHEDULER,
                     {"tasks_scheduled": len(schedule), "duration": duration})
        db.commit()

        _set_agent_status(db, project, "SCHEDULER", "COMPLETED")

        # Update project status
        project.pipeline_status = PipelineStatus.COMPLETED
        project.status = ProjectStatus.ON_TRACK

        # Check for risk tasks
        if any(t.get("risk_flag") for t in schedule):
            project.status = ProjectStatus.AT_RISK

        db.commit()

        pipeline_results["scheduler"] = {"schedule": schedule}

    except Exception as e:
        _handle_failure(db, project, "SCHEDULER", str(e))
        return {"status": "FAILED", "failed_agent": "SCHEDULER", "error": str(e)}

    # ── Pipeline complete ─────────────────────────────────────────────────────
    _broadcast(project_id, {
        "event": "pipeline_completed",
        "project_id": project_id,
        "tasks_count": len(schedule),
    })

    logger.info(f"PM pipeline completed for project {project_id}")

    return {
        "status": "COMPLETED",
        "project_id": project_id,
        "tasks_count": len(schedule),
        "pipeline_results": {
            "intent_parser": {"tasks_found": len(parsed["tasks_raw"])},
            "task_generator": {"tasks_generated": len(structured_tasks)},
            "priority_engine": {"risk_flags": sum(1 for t in ranked_tasks if t.get("risk_flag"))},
            "scheduler": {"tasks_assigned": len([s for s in schedule if s["assigned_to"]])},
        }
    }


def _handle_failure(db: Session, project: Project, agent_name: str, error: str):
    """Mark pipeline and project as failed, broadcast error."""
    logger.error(f"PM pipeline failed at {agent_name}: {error}")
    project.pipeline_status = PipelineStatus.FAILED
    project.pipeline_current_agent = agent_name
    project.pipeline_error = error
    project.status = ProjectStatus.DELAYED
    try:
        db.commit()
    except Exception:
        db.rollback()

    _broadcast(project.id, {
        "event": "pipeline_failed",
        "project_id": project.id,
        "failed_agent": agent_name,
        "error": error,
    })
