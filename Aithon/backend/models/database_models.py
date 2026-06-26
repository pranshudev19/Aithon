"""
SQLAlchemy ORM models for the Aithon multi-agent system.
Tables: users, tasks, dags, datasets, audit_logs, lineage, reports
+ PM system: projects, pm_tasks, subtasks, code_commits, pm_audit_logs, pm_lineage
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Text, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum, Index, Date
)
from sqlalchemy.orm import relationship
from models.database import Base
import enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AgentType(str, enum.Enum):
    TASK_PLANNER = "TASK_PLANNER"
    CONTRACT_ENFORCEMENT = "CONTRACT_ENFORCEMENT"
    DATA_GOVERNANCE = "DATA_GOVERNANCE"
    SYNTHETIC_GENERATOR = "SYNTHETIC_GENERATOR"


# ─── PM Enums ─────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    MANAGER = "MANAGER"
    DEVELOPER = "DEVELOPER"


class PMTaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class Priority(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Effort(str, enum.Enum):
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    DELAYED = "DELAYED"
    COMPLETED = "COMPLETED"


class PMAGentType(str, enum.Enum):
    INTENT_PARSER = "INTENT_PARSER"
    TASK_GENERATOR = "TASK_GENERATOR"
    PRIORITY_ENGINE = "PRIORITY_ENGINE"
    SCHEDULER = "SCHEDULER"


class PipelineStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ─── Helper ───────────────────────────────────────────────────────────────────

def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ─── Existing Models ──────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    # PM fields
    role = Column(SAEnum(UserRole), default=UserRole.DEVELOPER, nullable=False)
    skills = Column(JSON, default=list)  # e.g. ["python", "react", "auth"]
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships (existing)
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")

    # PM Relationships
    managed_projects = relationship("Project", back_populates="manager", foreign_keys="Project.manager_id")
    assigned_tasks = relationship("PMTask", back_populates="assigned_developer", foreign_keys="PMTask.assigned_to")
    commits = relationship("CodeCommit", back_populates="developer")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    intent = Column(String(100))
    entities = Column(JSON, default=dict)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING, index=True)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    sla_seconds = Column(Integer, default=300)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="tasks")
    dag = relationship("DAG", back_populates="task", uselist=False, cascade="all, delete-orphan")
    lineage_records = relationship("Lineage", back_populates="task", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="task", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="task", cascade="all, delete-orphan")


class DAG(Base):
    __tablename__ = "dags"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), unique=True, nullable=False)
    nodes = Column(JSON, nullable=False)        # [{id, type, label, status}]
    edges = Column(JSON, nullable=False)        # [{source, target}]
    execution_order = Column(JSON)              # topological sort result
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    task = relationship("Task", back_populates="dag")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(Integer)
    file_type = Column(String(20))               # csv, json
    row_count = Column(Integer)
    column_count = Column(Integer)
    columns_metadata = Column(JSON)              # [{name, dtype, nullable, ...}]
    schema_contract = Column(JSON)               # JSON schema for validation
    is_encrypted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    user = relationship("User", back_populates="datasets")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=True, index=True)
    agent_type = Column(SAEnum(AgentType), nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(JSON, default=dict)
    severity = Column(String(20), default="INFO")  # INFO, WARNING, ERROR
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)

    # Relationships
    task = relationship("Task", back_populates="audit_logs")


class Lineage(Base):
    __tablename__ = "lineage"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False, index=True)
    agent_type = Column(SAEnum(AgentType), nullable=False)
    input_dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    output_description = Column(Text)
    transformation = Column(Text)
    input_hash = Column(String(64))
    output_hash = Column(String(64))
    duration_seconds = Column(Float)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    task = relationship("Task", back_populates="lineage_records")

    __table_args__ = (
        Index("ix_lineage_task_agent", "task_id", "agent_type"),
    )


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False, index=True)
    report_type = Column(String(50), nullable=False)  # quality, synthetic, validation
    title = Column(String(255))
    summary = Column(Text)
    data = Column(JSON, nullable=False)               # full report data
    file_path = Column(Text)                           # path to downloadable file
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    task = relationship("Task", back_populates="reports")


# ─── PM Models ────────────────────────────────────────────────────────────────

class Project(Base):
    """A PM project created by a manager via natural language."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)   # original NL input from manager
    manager_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.ACTIVE)
    pipeline_status = Column(SAEnum(PipelineStatus), default=PipelineStatus.PENDING)
    pipeline_current_agent = Column(String(50))  # which agent is currently running
    pipeline_error = Column(Text)
    deadline = Column(Date)
    completion_percentage = Column(Float, default=0.0)
    constraints = Column(JSON, default=list)     # dependency constraints from NL
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    manager = relationship("User", back_populates="managed_projects", foreign_keys=[manager_id])
    pm_tasks = relationship("PMTask", back_populates="project", cascade="all, delete-orphan")
    pm_audit_logs = relationship("PMAuditLog", back_populates="project", cascade="all, delete-orphan")
    pm_lineage = relationship("PMLineage", back_populates="project", cascade="all, delete-orphan")


class PMTask(Base):
    """A task within a project, generated by the agent pipeline."""
    __tablename__ = "pm_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_ref = Column(String(20))                # e.g. "TSK-001"
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    priority = Column(SAEnum(Priority), default=Priority.MEDIUM)
    priority_score = Column(Float, default=0.0)
    status = Column(SAEnum(PMTaskStatus), default=PMTaskStatus.PENDING, index=True)
    estimated_effort = Column(SAEnum(Effort), default=Effort.MEDIUM)
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    deadline = Column(Date)
    start_date = Column(Date)
    end_date = Column(Date)
    timeline_slot = Column(Integer)
    risk_flag = Column(Boolean, default=False)
    dependency_task_ids = Column(JSON, default=list)  # list of PMTask IDs this depends on
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    project = relationship("Project", back_populates="pm_tasks")
    assigned_developer = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_to])
    subtasks = relationship("Subtask", back_populates="pm_task", cascade="all, delete-orphan")
    commits = relationship("CodeCommit", back_populates="pm_task", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pm_tasks_project_status", "project_id", "status"),
    )


class Subtask(Base):
    """A subtask belonging to a PMTask."""
    __tablename__ = "subtasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    pm_task_id = Column(String, ForeignKey("pm_tasks.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    status = Column(SAEnum(PMTaskStatus), default=PMTaskStatus.PENDING)
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    pm_task = relationship("PMTask", back_populates="subtasks")


class CodeCommit(Base):
    """Records a code commit linked to a task."""
    __tablename__ = "code_commits"

    id = Column(String, primary_key=True, default=generate_uuid)
    pm_task_id = Column(String, ForeignKey("pm_tasks.id"), nullable=False, index=True)
    developer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    file_ref = Column(String(500))   # optional file/branch reference
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)

    # Relationships
    pm_task = relationship("PMTask", back_populates="commits")
    developer = relationship("User", back_populates="commits")


class PMAuditLog(Base):
    """Audit log specific to PM pipeline actions."""
    __tablename__ = "pm_audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    pm_task_id = Column(String, nullable=True)
    agent_type = Column(SAEnum(PMAGentType), nullable=True)
    action = Column(String(500), nullable=False)
    details = Column(JSON, default=dict)
    severity = Column(String(20), default="INFO")
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)

    # Relationships
    project = relationship("Project", back_populates="pm_audit_logs")


class PMLineage(Base):
    """Lineage record for each PM agent execution step."""
    __tablename__ = "pm_lineage"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    agent_type = Column(SAEnum(PMAGentType), nullable=False)
    input_data = Column(JSON)
    output_data = Column(JSON)
    duration_seconds = Column(Float)
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    success = Column(Boolean, default=True)

    # Relationships
    project = relationship("Project", back_populates="pm_lineage")

    __table_args__ = (
        Index("ix_pm_lineage_project_agent", "project_id", "agent_type"),
    )
