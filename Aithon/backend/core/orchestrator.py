"""
Orchestrator
─────────────
Coordinates pipeline execution across DAG nodes.
Dispatches agents, handles errors, records lineage.
"""

import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from core.dag_engine import DAGEngine
from core.scheduler import Scheduler
from agents.task_planner import plan_task
from agents.contract_enforcement import enforce_contract
from agents.data_governance import govern_data
from agents.synthetic_generator import generate_synthetic
from models.database_models import Task, DAG, Report, TaskStatus, AgentType
from utils.logging_utils import get_logger, write_audit_log
from utils.lineage import LineageTracker

logger = get_logger("core.orchestrator")

# Agent type to function mapping
AGENT_DISPATCH = {
    AgentType.CONTRACT_ENFORCEMENT.value: enforce_contract,
    AgentType.DATA_GOVERNANCE.value: govern_data,
    AgentType.SYNTHETIC_GENERATOR.value: generate_synthetic,
}


def execute_pipeline(
    task_id: str,
    file_path: str,
    db: Session,
) -> dict:
    """
    Execute a complete pipeline for a task.

    1. Retrieve task and DAG from database
    2. Build DAG engine and scheduler
    3. Execute nodes in topological order
    4. Dispatch correct agent per node type
    5. Record lineage and update statuses
    6. Store reports

    Args:
        task_id: ID of the task to execute
        file_path: Path to the dataset file
        db: Database session

    Returns:
        dict with execution results
    """
    logger.info(f"Starting pipeline execution for task {task_id}")

    # ── Load task ─────────────────────────────────────────────────────────
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")

    dag_record = db.query(DAG).filter(DAG.task_id == task_id).first()
    if not dag_record:
        raise ValueError(f"No DAG found for task {task_id}")

    # ── Build execution components ────────────────────────────────────────
    dag_engine = DAGEngine()
    dag_engine.build_from_plan({"nodes": dag_record.nodes, "edges": dag_record.edges})

    validation = dag_engine.validate()
    if not validation["is_valid"]:
        task.status = TaskStatus.FAILED
        task.error_message = f"Invalid DAG: {validation['issues']}"
        db.commit()
        return {"status": "FAILED", "error": task.error_message}

    scheduler = Scheduler()
    scheduler.schedule_dag({"nodes": dag_record.nodes})

    lineage = LineageTracker(db, task_id)

    # ── Update task status ────────────────────────────────────────────────
    task.status = TaskStatus.RUNNING
    task.started_at = datetime.now(timezone.utc)
    db.commit()

    write_audit_log(
        db=db,
        action="Pipeline execution started",
        task_id=task_id,
        details={"nodes": len(dag_record.nodes)},
    )

    # ── Execute nodes in order ────────────────────────────────────────────
    execution_order = dag_engine.get_execution_order()
    current_file_path = file_path  # Pass output of one agent as input to next
    results = {}
    pipeline_failed = False

    for node_id in execution_order:
        node_data = dag_engine.get_node(node_id)
        agent_type = node_data.get("type")

        logger.info(f"Executing node {node_id} ({agent_type})")

        # Update scheduler and DAG
        scheduler.mark_running(node_id)
        dag_engine.update_node_status(node_id, "RUNNING")

        # Update DAG record in database
        dag_record.nodes = dag_engine.serialize()["nodes"]
        db.commit()

        # Start lineage tracking
        lineage.start(
            agent_type=AgentType(agent_type),
            input_dataset_id=None,
        )

        try:
            # Dispatch to correct agent
            agent_fn = AGENT_DISPATCH.get(agent_type)
            if not agent_fn:
                raise ValueError(f"Unknown agent type: {agent_type}")

            # Execute agent
            start_time = time.time()
            result = agent_fn(
                file_path=current_file_path,
                task_id=task_id,
                db=db,
            )
            duration = time.time() - start_time

            # Update file path for next agent in chain
            if "cleaned_file_path" in result:
                current_file_path = result["cleaned_file_path"]
            elif "synthetic_file_path" in result:
                current_file_path = result["synthetic_file_path"]

            # Success
            scheduler.mark_completed(node_id, result)
            dag_engine.update_node_status(node_id, "COMPLETED")
            results[node_id] = result

            # Record lineage
            lineage.end(
                description=f"{agent_type} completed",
                transformation=agent_type,
            )

            # Store report
            report_type_map = {
                AgentType.CONTRACT_ENFORCEMENT.value: "validation",
                AgentType.DATA_GOVERNANCE.value: "quality",
                AgentType.SYNTHETIC_GENERATOR.value: "synthetic",
            }
            report = Report(
                task_id=task_id,
                report_type=report_type_map.get(agent_type, "general"),
                title=f"{node_data.get('label', agent_type)} Report",
                summary=str(result.get("summary", "")),
                data=result,
                file_path=result.get("cleaned_file_path") or result.get("synthetic_file_path"),
            )
            db.add(report)

            logger.info(f"Node {node_id} completed in {duration:.2f}s")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Node {node_id} failed: {error_msg}")

            scheduler.mark_failed(node_id, error_msg)
            dag_engine.update_node_status(node_id, "FAILED")
            results[node_id] = {"error": error_msg}
            pipeline_failed = True

            lineage.end(
                description=f"{agent_type} failed: {error_msg}",
                transformation=agent_type,
            )

            write_audit_log(
                db=db,
                action=f"Node {node_id} failed",
                task_id=task_id,
                agent_type=AgentType(agent_type),
                details={"error": error_msg},
                severity="ERROR",
            )

            # Stop pipeline on failure
            break

    # ── Update DAG and task status ────────────────────────────────────────
    dag_record.nodes = dag_engine.serialize()["nodes"]

    if pipeline_failed:
        task.status = TaskStatus.FAILED
        task.error_message = f"Pipeline failed at node execution"
    else:
        task.status = TaskStatus.COMPLETED

    task.completed_at = datetime.now(timezone.utc)
    db.commit()

    write_audit_log(
        db=db,
        action=f"Pipeline execution {'completed' if not pipeline_failed else 'failed'}",
        task_id=task_id,
        details=scheduler.get_status_summary(),
    )

    logger.info(f"Pipeline {'completed' if not pipeline_failed else 'failed'} for task {task_id}")

    return {
        "task_id": task_id,
        "status": task.status.value,
        "results": {k: _safe_serialize(v) for k, v in results.items()},
        "scheduler_summary": scheduler.get_status_summary(),
    }


def _safe_serialize(obj):
    """Make results JSON-serializable."""
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_serialize(item) for item in obj]
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj
    return str(obj)
