"""
Structured logging utilities and audit log writer.
"""

import logging
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.database_models import AuditLog, AgentType


# ─── Structured JSON Logger ──────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured logging."""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "task_id"):
            log_entry["task_id"] = record.task_id
        if hasattr(record, "agent"):
            log_entry["agent"] = record.agent
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger with JSON formatting."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
    return logger


# ─── Audit Log Writer ────────────────────────────────────────────────────────

def write_audit_log(
    db: Session,
    action: str,
    task_id: str | None = None,
    agent_type: AgentType | None = None,
    details: dict | None = None,
    severity: str = "INFO",
):
    """Write an audit log entry to the database."""
    log = AuditLog(
        task_id=task_id,
        agent_type=agent_type,
        action=action,
        details=details or {},
        severity=severity,
    )
    db.add(log)
    db.commit()
    return log


# Module-level logger
logger = get_logger("aithon")
