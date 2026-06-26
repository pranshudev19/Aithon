"""
Celery application configuration.
Async task execution with Redis broker.
"""

from celery import Celery
from config import settings

# Create Celery app
celery_app = Celery(
    "aithon",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    task_soft_time_limit=300,
    task_time_limit=600,
)


# ─── Celery Tasks ────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="aithon.execute_pipeline")
def execute_pipeline_task(self, task_id: str, file_path: str):
    """
    Async Celery task for pipeline execution.
    Creates its own database session for the worker process.
    """
    from models.database import SessionLocal
    from core.orchestrator import execute_pipeline

    db = SessionLocal()
    try:
        result = execute_pipeline(task_id=task_id, file_path=file_path, db=db)
        return result
    except Exception as e:
        # Update task status on unhandled error
        from models.database_models import Task, TaskStatus
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            db.commit()
        raise
    finally:
        db.close()
