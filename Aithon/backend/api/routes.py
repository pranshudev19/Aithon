"""
REST API Routes
───────────────
All endpoints for the Aithon multi-agent system.
"""

import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from models.database import get_db
from models.database_models import (
    Task, DAG, Dataset, AuditLog, Lineage, Report,
    TaskStatus, AgentType, User
)
from agents.task_planner import plan_task
from core.orchestrator import execute_pipeline
from api.auth import get_current_user
from utils.logging_utils import get_logger, write_audit_log
from config import settings

logger = get_logger("api.routes")
router = APIRouter(tags=["Tasks & Datasets"])


# ─── Request/Response Schemas ─────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    description: str
    dataset_id: str | None = None


class TaskCreateResponse(BaseModel):
    task_id: str
    status: str
    intent: str
    dag: dict
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    description: str
    status: str
    intent: str | None
    error_message: str | None
    dag: dict | None
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None


class DatasetResponse(BaseModel):
    id: str
    name: str
    original_filename: str
    file_type: str | None
    row_count: int | None
    column_count: int | None
    created_at: datetime | None

    class Config:
        from_attributes = True


class DashboardMetrics(BaseModel):
    total_tasks: int
    tasks_by_status: dict
    total_datasets: int
    avg_duration_seconds: float | None
    recent_tasks: list[dict]


# ─── POST /task/create ────────────────────────────────────────────────────────

import threading

@router.post("/task/create", response_model=TaskCreateResponse)
def create_task(
    request: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a natural language task description.
    The Task Planner Agent will classify intent, extract entities,
    and build an executable DAG. If a dataset is provided, the
    pipeline runs in a background thread so the response returns
    immediately — the frontend should poll /task/{id}/status.
    """
    from models.database import SessionLocal

    # Create task record
    task = Task(
        user_id=current_user.id,
        description=request.description,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Run Task Planner Agent (fast — keyword-based, no external calls)
    plan = plan_task(
        description=request.description,
        task_id=task.id,
        db=db,
    )

    # Update task with planner results
    task.intent = plan["intent"]
    task.entities = plan["entities"]

    # Store DAG
    dag = DAG(
        task_id=task.id,
        nodes=plan["dag"]["nodes"],
        edges=plan["dag"]["edges"],
        execution_order=plan["dag"]["execution_order"],
    )
    db.add(dag)
    db.commit()

    write_audit_log(
        db=db,
        action="Task created",
        task_id=task.id,
        details={"intent": plan["intent"], "dataset_id": request.dataset_id},
    )

    # If a dataset is specified, execute the pipeline in a background thread
    # so the HTTP response returns immediately with the plan.
    if request.dataset_id:
        dataset = db.query(Dataset).filter(
            Dataset.id == request.dataset_id,
            Dataset.user_id == current_user.id,
        ).first()

        if dataset:
            task_id_snapshot = task.id
            file_path_snapshot = dataset.file_path

            def _run_pipeline():
                """Background thread: opens its own DB session to avoid conflicts."""
                bg_db = SessionLocal()
                try:
                    execute_pipeline(
                        task_id=task_id_snapshot,
                        file_path=file_path_snapshot,
                        db=bg_db,
                    )
                except Exception as exc:
                    logger.error(f"[background] Pipeline error for task {task_id_snapshot}: {exc}")
                    try:
                        bg_task = bg_db.query(Task).filter(Task.id == task_id_snapshot).first()
                        if bg_task:
                            bg_task.status = TaskStatus.FAILED
                            bg_task.error_message = str(exc)
                            bg_db.commit()
                    except Exception:
                        pass
                finally:
                    bg_db.close()

            t = threading.Thread(target=_run_pipeline, daemon=True)
            t.start()
            logger.info(f"Pipeline started in background thread for task {task.id}")

    return TaskCreateResponse(
        task_id=task.id,
        status=task.status.value,
        intent=plan["intent"],
        dag=plan["dag"],
        message=f"Task created with intent '{plan['intent']}' and {len(plan['dag']['nodes'])} pipeline stages",
    )



# ─── POST /dataset/upload ────────────────────────────────────────────────────

@router.post("/dataset/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a CSV or JSON dataset file."""
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("csv", "json"):
        raise HTTPException(status_code=400, detail="Only CSV and JSON files are supported")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    import uuid
    safe_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Parse dataset metadata
    import pandas as pd
    try:
        if ext == "json":
            df = pd.read_json(file_path)
        else:
            df = pd.read_csv(file_path)

        row_count = len(df)
        column_count = len(df.columns)
        columns_metadata = [
            {"name": col, "dtype": str(df[col].dtype)}
            for col in df.columns
        ]
    except Exception as e:
        row_count = None
        column_count = None
        columns_metadata = None
        logger.warning(f"Could not parse dataset metadata: {e}")

    # Create dataset record
    dataset = Dataset(
        user_id=current_user.id,
        name=name or file.filename.rsplit(".", 1)[0],
        original_filename=file.filename,
        file_path=file_path,
        file_size_bytes=len(content),
        file_type=ext,
        row_count=row_count,
        column_count=column_count,
        columns_metadata=columns_metadata,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    write_audit_log(
        db=db,
        action="Dataset uploaded",
        details={
            "dataset_id": dataset.id,
            "filename": file.filename,
            "rows": row_count,
            "columns": column_count,
        },
    )

    return dataset


# ─── GET /task/{id}/status ────────────────────────────────────────────────────

@router.get("/task/{task_id}/status", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get task status with per-node DAG status."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    dag_record = db.query(DAG).filter(DAG.task_id == task_id).first()
    dag_data = None
    if dag_record:
        dag_data = {
            "nodes": dag_record.nodes,
            "edges": dag_record.edges,
            "execution_order": dag_record.execution_order,
        }

    return TaskStatusResponse(
        task_id=task.id,
        description=task.description,
        status=task.status.value,
        intent=task.intent,
        error_message=task.error_message,
        dag=dag_data,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


# ─── GET /task/{id}/lineage ──────────────────────────────────────────────────

@router.get("/task/{task_id}/lineage")
def get_task_lineage(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get data lineage for a task."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    records = db.query(Lineage).filter(Lineage.task_id == task_id).order_by(Lineage.timestamp).all()

    return {
        "task_id": task_id,
        "lineage": [
            {
                "id": r.id,
                "agent_type": r.agent_type.value if r.agent_type else None,
                "input_hash": r.input_hash,
                "output_hash": r.output_hash,
                "transformation": r.transformation,
                "description": r.output_description,
                "duration_seconds": r.duration_seconds,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in records
        ],
    }


# ─── GET /task/{id}/report ───────────────────────────────────────────────────

@router.get("/task/{task_id}/report")
def get_task_report(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all reports for a task."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    reports = db.query(Report).filter(Report.task_id == task_id).all()

    return {
        "task_id": task_id,
        "reports": [
            {
                "id": r.id,
                "report_type": r.report_type,
                "title": r.title,
                "summary": r.summary,
                "data": r.data,
                "file_path": r.file_path,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ],
    }


# ─── GET /dashboard/metrics ──────────────────────────────────────────────────

@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregate dashboard metrics."""
    # Total tasks
    total_tasks = db.query(func.count(Task.id)).filter(
        Task.user_id == current_user.id
    ).scalar() or 0

    # Tasks by status
    status_counts = (
        db.query(Task.status, func.count(Task.id))
        .filter(Task.user_id == current_user.id)
        .group_by(Task.status)
        .all()
    )
    tasks_by_status = {s.value: c for s, c in status_counts}

    # Total datasets
    total_datasets = db.query(func.count(Dataset.id)).filter(
        Dataset.user_id == current_user.id
    ).scalar() or 0

    # Average duration for completed tasks
    completed_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.COMPLETED,
            Task.started_at.isnot(None),
            Task.completed_at.isnot(None),
        )
        .all()
    )

    avg_duration = None
    if completed_tasks:
        durations = [
            (t.completed_at - t.started_at).total_seconds()
            for t in completed_tasks
        ]
        avg_duration = round(sum(durations) / len(durations), 2)

    # Recent tasks (last 10)
    recent = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardMetrics(
        total_tasks=total_tasks,
        tasks_by_status=tasks_by_status,
        total_datasets=total_datasets,
        avg_duration_seconds=avg_duration,
        recent_tasks=[
            {
                "id": t.id,
                "description": t.description[:100],
                "status": t.status.value,
                "intent": t.intent,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in recent
        ],
    )


# ─── GET /datasets ───────────────────────────────────────────────────────────

@router.get("/datasets", response_model=list[DatasetResponse])
def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all datasets for the current user."""
    datasets = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    return datasets


# ─── GET /reports/{id}/download ──────────────────────────────────────────────

@router.get("/reports/{report_id}/download")
def download_report_file(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the file associated with a report (e.g., synthetic dataset)."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Verify ownership through task
    task = db.query(Task).filter(
        Task.id == report.task_id,
        Task.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=403, detail="Access denied")

    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=report.file_path,
        filename=os.path.basename(report.file_path),
        media_type="text/csv",
    )
