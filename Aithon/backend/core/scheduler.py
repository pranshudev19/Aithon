"""
Scheduler
─────────
Dependency-aware task scheduling with status tracking,
SLA monitoring, and resource management.
"""

import time
from datetime import datetime, timezone
from dataclasses import dataclass, field
from utils.logging_utils import get_logger
from config import settings

logger = get_logger("core.scheduler")


@dataclass
class ScheduledNode:
    """Represents a scheduled DAG node."""
    node_id: str
    agent_type: str
    status: str = "PENDING"        # PENDING, RUNNING, COMPLETED, FAILED
    started_at: float | None = None
    completed_at: float | None = None
    error: str | None = None
    result: dict | None = None
    sla_seconds: int = 300


@dataclass
class SchedulerState:
    """Global scheduler state."""
    active_tasks: int = 0
    total_scheduled: int = 0
    total_completed: int = 0
    total_failed: int = 0
    nodes: dict[str, ScheduledNode] = field(default_factory=dict)


class Scheduler:
    """
    Manages scheduling and execution tracking for DAG nodes.
    Provides dependency-aware execution ordering and SLA monitoring.
    """

    def __init__(self, sla_seconds: int | None = None):
        self.sla_seconds = sla_seconds or settings.DEFAULT_SLA_SECONDS
        self.state = SchedulerState()

    def schedule_dag(self, dag_data: dict):
        """Register all DAG nodes for scheduling."""
        for node in dag_data.get("nodes", []):
            self.state.nodes[node["id"]] = ScheduledNode(
                node_id=node["id"],
                agent_type=node.get("type", "unknown"),
                sla_seconds=self.sla_seconds,
            )
        self.state.total_scheduled = len(self.state.nodes)
        logger.info(f"Scheduled {self.state.total_scheduled} nodes")

    def can_execute(self, node_id: str, dag_engine) -> bool:
        """Check if a node can execute (dependencies met, not already running)."""
        node = self.state.nodes.get(node_id)
        if not node:
            return False
        if node.status != "PENDING":
            return False
        if self.state.active_tasks >= settings.MAX_CONCURRENT_TASKS:
            logger.warning("Max concurrent tasks reached")
            return False
        return dag_engine.are_dependencies_met(node_id)

    def mark_running(self, node_id: str):
        """Mark a node as currently executing."""
        node = self.state.nodes.get(node_id)
        if node:
            node.status = "RUNNING"
            node.started_at = time.time()
            self.state.active_tasks += 1
            logger.info(f"Node {node_id} → RUNNING")

    def mark_completed(self, node_id: str, result: dict | None = None):
        """Mark a node as successfully completed."""
        node = self.state.nodes.get(node_id)
        if node:
            node.status = "COMPLETED"
            node.completed_at = time.time()
            node.result = result
            self.state.active_tasks = max(0, self.state.active_tasks - 1)
            self.state.total_completed += 1
            duration = node.completed_at - (node.started_at or node.completed_at)
            logger.info(f"Node {node_id} → COMPLETED ({duration:.2f}s)")

    def mark_failed(self, node_id: str, error: str):
        """Mark a node as failed."""
        node = self.state.nodes.get(node_id)
        if node:
            node.status = "FAILED"
            node.completed_at = time.time()
            node.error = error
            self.state.active_tasks = max(0, self.state.active_tasks - 1)
            self.state.total_failed += 1
            logger.error(f"Node {node_id} → FAILED: {error}")

    def check_sla(self, node_id: str) -> dict:
        """Check if a running node has exceeded its SLA."""
        node = self.state.nodes.get(node_id)
        if not node or not node.started_at:
            return {"exceeded": False}

        elapsed = time.time() - node.started_at
        return {
            "exceeded": elapsed > node.sla_seconds,
            "elapsed_seconds": round(elapsed, 2),
            "sla_seconds": node.sla_seconds,
            "remaining_seconds": round(max(0, node.sla_seconds - elapsed), 2),
        }

    def get_next_runnable(self, dag_engine) -> list[str]:
        """Get list of nodes that are ready to execute."""
        runnable = []
        for node_id, node in self.state.nodes.items():
            if node.status == "PENDING" and dag_engine.are_dependencies_met(node_id):
                runnable.append(node_id)
        return runnable

    def is_complete(self) -> bool:
        """Check if all nodes have finished (completed or failed)."""
        return all(
            n.status in ("COMPLETED", "FAILED")
            for n in self.state.nodes.values()
        )

    def has_failures(self) -> bool:
        """Check if any node has failed."""
        return any(n.status == "FAILED" for n in self.state.nodes.values())

    def get_status_summary(self) -> dict:
        """Get an overall status summary."""
        statuses = {}
        for node in self.state.nodes.values():
            statuses[node.status] = statuses.get(node.status, 0) + 1

        return {
            "total": self.state.total_scheduled,
            "active": self.state.active_tasks,
            "completed": self.state.total_completed,
            "failed": self.state.total_failed,
            "by_status": statuses,
            "nodes": {
                nid: {
                    "status": n.status,
                    "agent_type": n.agent_type,
                    "error": n.error,
                    "duration": round(
                        (n.completed_at or time.time()) - n.started_at, 2
                    ) if n.started_at else None,
                }
                for nid, n in self.state.nodes.items()
            },
        }
