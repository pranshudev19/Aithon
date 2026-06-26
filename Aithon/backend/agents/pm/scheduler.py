"""
Scheduler Agent
──────────────────
Assigns ranked tasks to available developers based on workload and skills.
Creates a timeline respecting dependency constraints.
"""

from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from models.database_models import User, PMTask, UserRole, PMTaskStatus
from utils.logging_utils import get_logger

logger = get_logger("agents.pm.scheduler")


def _get_developer_workload(db: Session) -> dict[str, dict]:
    """
    Fetch all active developers and their current task counts.

    Returns:
        {user_id: {"user": User, "active_tasks": int, "skills": list}}
    """
    developers = db.query(User).filter(
        User.role == UserRole.DEVELOPER,
        User.is_active == True
    ).all()

    workload = {}
    for dev in developers:
        active_tasks = db.query(PMTask).filter(
            PMTask.assigned_to == dev.id,
            PMTask.status.in_([PMTaskStatus.PENDING, PMTaskStatus.IN_PROGRESS])
        ).count()

        workload[dev.id] = {
            "user": dev,
            "active_tasks": active_tasks,
            "skills": dev.skills or [],
        }

    return workload


def _skill_match_score(task_title: str, developer_skills: list[str]) -> float:
    """Simple keyword-based skill matching score (0.0 to 1.0)."""
    if not developer_skills:
        return 0.0
    title_lower = task_title.lower()
    matches = sum(1 for skill in developer_skills if skill.lower() in title_lower)
    return min(matches / max(len(developer_skills), 1), 1.0)


def _pick_developer(
    task: dict,
    workload: dict[str, dict],
    assignments: dict[str, int],  # dev_id -> tasks assigned this run
) -> dict | None:
    """
    Pick the best developer for a task considering workload and skills.
    Returns developer info dict or None if no developers available.
    """
    if not workload:
        return None

    best_dev_id = None
    best_score = float("inf")

    for dev_id, info in workload.items():
        # Combined score: lower is better
        # Workload penalty + this-run assignments – skill match bonus
        workload_score = info["active_tasks"] + assignments.get(dev_id, 0) * 2
        skill_bonus = _skill_match_score(task.get("title", ""), info["skills"])
        final_score = workload_score - skill_bonus

        if final_score < best_score:
            best_score = final_score
            best_dev_id = dev_id

    return workload[best_dev_id] if best_dev_id else None


def _calculate_dates(
    idx: int,
    effort: str,
    blocked: bool,
    deadline_str: str | None,
) -> tuple[date, date]:
    """Calculate start/end dates for a task."""
    today = datetime.now(timezone.utc).date()
    effort_days = {"simple": 1, "medium": 3, "complex": 5}.get(effort, 3)

    # Blocked tasks can start a bit later
    start_offset = 1 if not blocked else 3
    start_date = today + timedelta(days=start_offset + idx)

    # Clamp end date to not exceed deadline
    end_date = start_date + timedelta(days=effort_days)
    if deadline_str:
        try:
            deadline = date.fromisoformat(str(deadline_str))
            if end_date > deadline:
                end_date = deadline
        except Exception:
            pass

    return start_date, end_date


def run_scheduler(ranked_tasks: list[dict], project_id: str, db: Session) -> list[dict]:
    """
    Assign tasks to developers and create a timeline.

    Args:
        ranked_tasks: Priority-scored tasks from Priority Engine
        project_id: Project these tasks belong to
        db: Database session

    Returns:
        Schedule list with developer assignments and dates
    """
    logger.info(f"Scheduler starting for {len(ranked_tasks)} tasks in project {project_id}")

    workload = _get_developer_workload(db)
    logger.info(f"Scheduler found {len(workload)} available developers")

    assignments: dict[str, int] = {}  # dev_id -> count of tasks assigned this run
    schedule = []

    for idx, task in enumerate(ranked_tasks):
        dev_info = _pick_developer(task, workload, assignments)

        start_date, end_date = _calculate_dates(
            idx,
            task.get("estimated_effort", "medium"),
            task.get("is_blocked", False),
            task.get("deadline"),
        )

        if dev_info:
            dev = dev_info["user"]
            assignments[dev.id] = assignments.get(dev.id, 0) + 1
            assigned_to = dev.id
            developer_name = dev.username
        else:
            # No developer available — leave unassigned, flag as at-risk
            assigned_to = None
            developer_name = "Unassigned"
            task["risk_flag"] = True

        schedule.append({
            **task,
            "assigned_to": assigned_to,
            "developer_name": developer_name,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "timeline_slot": idx + 1,
        })

    logger.info(f"Scheduler complete. {len([s for s in schedule if s['assigned_to']])} tasks assigned")
    return schedule
