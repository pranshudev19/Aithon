"""
Data lineage tracker.
Records input → agent → output transformations with timestamps and hashes.
"""

import hashlib
import time
from sqlalchemy.orm import Session
from models.database_models import Lineage, AgentType


def compute_hash(data: str) -> str:
    """Compute SHA-256 hash of data for lineage tracking."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class LineageTracker:
    """
    Track data transformations through the agent pipeline.
    Usage:
        tracker = LineageTracker(db, task_id)
        tracker.start(AgentType.DATA_GOVERNANCE, input_hash="abc123")
        # ... agent does work ...
        tracker.end(output_hash="def456", description="Cleaned dataset")
    """

    def __init__(self, db: Session, task_id: str):
        self.db = db
        self.task_id = task_id
        self._start_time = None
        self._current_agent = None
        self._input_hash = None
        self._input_dataset_id = None

    def start(
        self,
        agent_type: AgentType,
        input_hash: str | None = None,
        input_dataset_id: str | None = None,
    ):
        """Begin tracking a transformation step."""
        self._start_time = time.time()
        self._current_agent = agent_type
        self._input_hash = input_hash
        self._input_dataset_id = input_dataset_id

    def end(
        self,
        output_hash: str | None = None,
        description: str = "",
        transformation: str = "",
    ) -> Lineage:
        """Complete tracking and save lineage record to database."""
        duration = time.time() - self._start_time if self._start_time else 0

        record = Lineage(
            task_id=self.task_id,
            agent_type=self._current_agent,
            input_dataset_id=self._input_dataset_id,
            output_description=description,
            transformation=transformation,
            input_hash=self._input_hash,
            output_hash=output_hash,
            duration_seconds=round(duration, 3),
        )
        self.db.add(record)
        self.db.commit()

        # Reset state
        self._start_time = None
        self._current_agent = None
        self._input_hash = None
        self._input_dataset_id = None

        return record

    def record(
        self,
        agent_type: AgentType,
        input_hash: str | None = None,
        output_hash: str | None = None,
        input_dataset_id: str | None = None,
        description: str = "",
        transformation: str = "",
        duration_seconds: float = 0.0,
    ) -> Lineage:
        """Write a complete lineage record in one call."""
        record = Lineage(
            task_id=self.task_id,
            agent_type=agent_type,
            input_dataset_id=input_dataset_id,
            output_description=description,
            transformation=transformation,
            input_hash=input_hash,
            output_hash=output_hash,
            duration_seconds=duration_seconds,
        )
        self.db.add(record)
        self.db.commit()
        return record
