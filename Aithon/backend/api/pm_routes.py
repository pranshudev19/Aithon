"""
PM REST API Routes
──────────────────
Manager-only and developer-only endpoints for the Project Management system.
"""

import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.database import get_db
from models.database_models import (
    User, Project, PMTask, Subtask, CodeCommit,
    ProjectStatus, PipelineStatus, PMTaskStatus, Priority, UserRole
)
from api.auth import get_current_user, require_manager, require_developer
from core.pm_orchestrator import execute_pm_pipeline
from utils.logging_utils import get_logger

logger = get_logger("api.pm_routes")
router = APIRouter(prefix="/pm", tags=["Project Management"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str = "New Project"
    description: str  # NL input from manager


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    status: str
    pipeline_status: str
    pipeline_current_agent: str | None
    pipeline_error: str | None
    completion_percentage: float
    deadline: str | None
    created_at: str

    class Config:
        from_attributes = True


class UpdateTaskStatusRequest(BaseModel):
    status: str  # PENDING | IN_PROGRESS | COMPLETED


class AddCommitRequest(BaseModel):
    message: str
    file_ref: str | None = None


class CompleteSubtaskRequest(BaseModel):
    pass


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _compute_completion(project: Project) -> float:
    """Compute project completion percentage from task statuses."""
    tasks = project.pm_tasks
    if not tasks:
        return 0.0
    completed = sum(1 for t in tasks if t.status == PMTaskStatus.COMPLETED)
    return round((completed / len(tasks)) * 100, 1)


def _project_to_dict(project: Project) -> dict:
    total = len(project.pm_tasks)
    completed = sum(1 for t in project.pm_tasks if t.status == PMTaskStatus.COMPLETED)
    at_risk = sum(1 for t in project.pm_tasks if t.risk_flag)
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status.value if project.status else "ACTIVE",
        "pipeline_status": project.pipeline_status.value if project.pipeline_status else "PENDING",
        "pipeline_current_agent": project.pipeline_current_agent,
        "pipeline_error": project.pipeline_error,
        "completion_percentage": _compute_completion(project),
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "total_tasks": total,
        "completed_tasks": completed,
        "at_risk_tasks": at_risk,
        "constraints": project.constraints or [],
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


def _task_to_dict(task: PMTask, include_subtasks: bool = True) -> dict:
    subtasks = []
    if include_subtasks:
        subtasks = [
            {
                "id": s.id,
                "title": s.title,
                "status": s.status.value,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in (task.subtasks or [])
        ]
    total_sub = len(task.subtasks or [])
    done_sub = sum(1 for s in (task.subtasks or []) if s.status == PMTaskStatus.COMPLETED)

    return {
        "id": task.id,
        "task_ref": task.task_ref,
        "title": task.title,
        "description": task.description,
        "priority": task.priority.value if task.priority else "MEDIUM",
        "priority_score": task.priority_score,
        "status": task.status.value,
        "estimated_effort": task.estimated_effort.value if task.estimated_effort else "medium",
        "assigned_to": task.assigned_to,
        "developer_name": task.assigned_developer.username if task.assigned_developer else "Unassigned",
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "start_date": task.start_date.isoformat() if task.start_date else None,
        "end_date": task.end_date.isoformat() if task.end_date else None,
        "risk_flag": task.risk_flag,
        "subtasks": subtasks,
        "subtask_progress": f"{done_sub}/{total_sub}",
        "subtask_percent": round((done_sub / total_sub * 100) if total_sub else 0, 1),
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ─── Manager Routes ───────────────────────────────────────────────────────────

@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    request: CreateProjectRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Create a new project from natural language description.
    Triggers the full 4-agent pipeline asynchronously.
    """
    project = Project(
        name=request.name,
        description=request.description,
        manager_id=current_user.id,
        status=ProjectStatus.ACTIVE,
        pipeline_status=PipelineStatus.PENDING,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    logger.info(f"Project {project.id} created by {current_user.username}")

    # Run the pipeline in the background so the API returns immediately
    background_tasks.add_task(
        _run_pipeline_background,
        project.id,
        request.description,
    )

    return {
        "id": project.id,
        "name": project.name,
        "pipeline_status": "RUNNING",
        "message": "Project created. Agent pipeline is running...",
    }


def _run_pipeline_background(project_id: str, description: str):
    """Background task runner for the PM pipeline."""
    from models.database import SessionLocal
    db = SessionLocal()
    try:
        result = execute_pm_pipeline(project_id, description, db)
        logger.info(f"Background pipeline completed for project {project_id}: {result['status']}")
    except Exception as e:
        logger.error(f"Background pipeline error for project {project_id}: {e}")
    finally:
        db.close()


@router.get("/projects")
def list_projects(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """List all projects for the manager."""
    projects = (
        db.query(Project)
        .filter(Project.manager_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [_project_to_dict(p) for p in projects]


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Get full project detail including all tasks categorized by status."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.manager_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_dict = _project_to_dict(project)

    # Kanban board data
    kanban = {
        "PENDING": [],
        "IN_PROGRESS": [],
        "COMPLETED": [],
        "BLOCKED": [],
    }
    for task in project.pm_tasks:
        kanban[task.status.value].append(_task_to_dict(task))

    project_dict["kanban"] = kanban
    return project_dict


@router.get("/projects/{project_id}/pipeline-status")
def get_pipeline_status(
    project_id: str,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Get live pipeline agent execution status."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.manager_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build agent step status
    current_agent = project.pipeline_current_agent
    pipeline_order = ["INTENT_PARSER", "TASK_GENERATOR", "PRIORITY_ENGINE", "SCHEDULER"]

    agents = []
    for agent in pipeline_order:
        if project.pipeline_status == PipelineStatus.COMPLETED:
            agent_status = "completed"
        elif project.pipeline_status == PipelineStatus.FAILED:
            if agent == current_agent:
                agent_status = "failed"
            elif pipeline_order.index(agent) < pipeline_order.index(current_agent or "INTENT_PARSER"):
                agent_status = "completed"
            else:
                agent_status = "pending"
        elif current_agent == agent:
            agent_status = "running"
        elif current_agent and pipeline_order.index(agent) < pipeline_order.index(current_agent):
            agent_status = "completed"
        else:
            agent_status = "pending"

        agents.append({"name": agent, "status": agent_status})

    return {
        "project_id": project_id,
        "pipeline_status": project.pipeline_status.value if project.pipeline_status else "PENDING",
        "current_agent": current_agent,
        "pipeline_error": project.pipeline_error,
        "agents": agents,
    }


@router.get("/activity-feed")
def get_activity_feed(
    limit: int = 30,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Recent commits + task status updates across all manager's projects."""
    project_ids = [
        p.id for p in db.query(Project.id)
        .filter(Project.manager_id == current_user.id).all()
    ]

    commits = (
        db.query(CodeCommit)
        .join(PMTask, CodeCommit.pm_task_id == PMTask.id)
        .filter(PMTask.project_id.in_(project_ids))
        .order_by(CodeCommit.timestamp.desc())
        .limit(limit)
        .all()
    )

    feed = []
    for c in commits:
        feed.append({
            "type": "commit",
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "developer": c.developer.username if c.developer else "Unknown",
            "message": c.message,
            "file_ref": c.file_ref,
            "task_ref": c.pm_task.task_ref if c.pm_task else None,
            "task_id": c.pm_task_id,
        })

    return {"feed": feed}


@router.get("/risk-alerts")
def get_risk_alerts(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Return all at-risk tasks across manager's projects."""
    project_ids = [
        p.id for p in db.query(Project.id)
        .filter(Project.manager_id == current_user.id).all()
    ]

    risk_tasks = (
        db.query(PMTask)
        .filter(
            PMTask.project_id.in_(project_ids),
            PMTask.risk_flag == True,
            PMTask.status != PMTaskStatus.COMPLETED,
        )
        .order_by(PMTask.deadline)
        .all()
    )

    return {
        "risk_alerts": [_task_to_dict(t, include_subtasks=False) for t in risk_tasks]
    }


@router.get("/developers")
def list_developers(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """List all developers with current workload info."""
    devs = db.query(User).filter(
        User.role == UserRole.DEVELOPER,
        User.is_active == True,
    ).all()

    result = []
    for dev in devs:
        active = db.query(PMTask).filter(
            PMTask.assigned_to == dev.id,
            PMTask.status.in_([PMTaskStatus.PENDING, PMTaskStatus.IN_PROGRESS])
        ).count()
        result.append({
            "id": dev.id,
            "username": dev.username,
            "email": dev.email,
            "skills": dev.skills or [],
            "active_tasks": active,
        })

    return {"developers": result}


# ─── Developer Routes ─────────────────────────────────────────────────────────

@router.get("/my-tasks")
def get_my_tasks(
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    """Get all tasks assigned to the logged-in developer."""
    tasks = (
        db.query(PMTask)
        .filter(PMTask.assigned_to == current_user.id)
        .order_by(PMTask.priority_score.desc())
        .all()
    )
    return {
        "developer": current_user.username,
        "tasks": [_task_to_dict(t) for t in tasks],
    }


@router.get("/my-tasks/{task_id}")
def get_task_detail(
    task_id: str,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    """Get detail of a single task (developer must be assigned)."""
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.assigned_to == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to you")

    task_dict = _task_to_dict(task)

    # Also return recent commits
    commits = (
        db.query(CodeCommit)
        .filter(CodeCommit.pm_task_id == task_id)
        .order_by(CodeCommit.timestamp.desc())
        .limit(10)
        .all()
    )
    task_dict["commits"] = [
        {
            "id": c.id,
            "message": c.message,
            "file_ref": c.file_ref,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
        }
        for c in commits
    ]

    return task_dict


@router.patch("/tasks/{task_id}/status")
def update_task_status(
    task_id: str,
    request: UpdateTaskStatusRequest,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    """Update a task's status (developer only)."""
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.assigned_to == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to you")

    try:
        new_status = PMTaskStatus(request.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {request.status}")

    old_status = task.status.value
    task.status = new_status

    if new_status == PMTaskStatus.COMPLETED:
        task.completed_at = datetime.now(timezone.utc)
        # Auto-complete all remaining subtasks
        for subtask in task.subtasks:
            if subtask.status != PMTaskStatus.COMPLETED:
                subtask.status = PMTaskStatus.COMPLETED
                subtask.completed_at = datetime.now(timezone.utc)

    db.commit()

    # Update project completion %
    project = task.project
    project.completion_percentage = _compute_completion(project)

    # Update project status based on tasks
    all_tasks = project.pm_tasks
    if all_tasks and all(t.status == PMTaskStatus.COMPLETED for t in all_tasks):
        project.status = ProjectStatus.COMPLETED
    elif any(t.risk_flag for t in all_tasks if t.status != PMTaskStatus.COMPLETED):
        project.status = ProjectStatus.AT_RISK
    else:
        project.status = ProjectStatus.ON_TRACK

    db.commit()

    # Broadcast update
    from api.ws_routes import manager as ws_manager
    import asyncio
    import json
    event = {
        "event": "task_status_updated",
        "task_id": task_id,
        "task_ref": task.task_ref,
        "project_id": task.project_id,
        "developer": current_user.username,
        "old_status": old_status,
        "new_status": new_status.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast(task.project_id, event))
            asyncio.ensure_future(ws_manager.broadcast("__global__", event))
    except Exception:
        pass

    return {"task_id": task_id, "new_status": new_status.value, "message": "Status updated"}


@router.post("/tasks/{task_id}/subtasks/{subtask_id}/complete")
def complete_subtask(
    task_id: str,
    subtask_id: str,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    """Mark a subtask as completed."""
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.assigned_to == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    subtask = db.query(Subtask).filter(
        Subtask.id == subtask_id,
        Subtask.pm_task_id == task_id,
    ).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    subtask.status = PMTaskStatus.COMPLETED
    subtask.completed_at = datetime.now(timezone.utc)

    # Auto-move task to IN_PROGRESS if it's still PENDING
    if task.status == PMTaskStatus.PENDING:
        task.status = PMTaskStatus.IN_PROGRESS

    # Auto-complete task if all subtasks done
    all_done = all(s.status == PMTaskStatus.COMPLETED for s in task.subtasks)
    if all_done:
        task.status = PMTaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)

        # Update project completion
        project = task.project
        project.completion_percentage = _compute_completion(project)
        db.commit()

    db.commit()

    return {
        "subtask_id": subtask_id,
        "status": "COMPLETED",
        "task_auto_completed": all_done,
    }


@router.post("/tasks/{task_id}/commits")
def add_commit(
    task_id: str,
    request: AddCommitRequest,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    """Record a code commit against a task."""
    task = db.query(PMTask).filter(
        PMTask.id == task_id,
        PMTask.assigned_to == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not assigned to you")

    commit = CodeCommit(
        pm_task_id=task_id,
        developer_id=current_user.id,
        message=request.message,
        file_ref=request.file_ref,
    )
    db.add(commit)

    # Auto-move to IN_PROGRESS on first commit
    if task.status == PMTaskStatus.PENDING:
        task.status = PMTaskStatus.IN_PROGRESS

    db.commit()

    # Broadcast commit to manager feed
    from api.ws_routes import manager as ws_manager
    import asyncio
    event = {
        "event": "commit_pushed",
        "task_id": task_id,
        "task_ref": task.task_ref,
        "project_id": task.project_id,
        "developer": current_user.username,
        "message": request.message,
        "file_ref": request.file_ref,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast(task.project_id, event))
            asyncio.ensure_future(ws_manager.broadcast("__global__", event))
    except Exception:
        pass

    return {"commit_id": commit.id, "message": "Commit recorded"}


# ─── Shared PM routes (accessible by both roles) ──────────────────────────────

@router.get("/projects/{project_id}/tasks")
def get_project_tasks(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get tasks for a project (manager sees all, developer sees own tasks)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(PMTask).filter(PMTask.project_id == project_id)

    # Developers only see their own tasks
    if current_user.role == UserRole.DEVELOPER:
        query = query.filter(PMTask.assigned_to == current_user.id)

    tasks = query.order_by(PMTask.priority_score.desc()).all()
    return {"tasks": [_task_to_dict(t) for t in tasks]}
