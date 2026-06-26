"""
Priority Engine Agent
──────────────────────
Ranks tasks using a scoring formula based on deadline urgency,
priority label, dependency constraints, and estimated effort.
Flags at-risk tasks.
"""

from datetime import datetime, date, timezone, timedelta
from utils.logging_utils import get_logger

logger = get_logger("agents.pm.priority_engine")

# Scoring weights
PRIORITY_WEIGHTS = {"HIGH": 30, "MEDIUM": 20, "LOW": 10}
EFFORT_PENALTY = {"complex": -15, "medium": -5, "simple": 0}


def _days_until(deadline_str: str | None) -> int:
    """Calculate days from today until deadline."""
    if not deadline_str:
        return 30  # Long time away — no urgency
    try:
        today = datetime.now(timezone.utc).date()
        deadline = date.fromisoformat(str(deadline_str))
        return (deadline - today).days
    except Exception:
        return 30


def _urgency_score(days_remaining: int) -> float:
    """Convert deadline proximity into urgency score (0-40)."""
    if days_remaining <= 0:
        return 40.0  # Overdue — maximum urgency
    if days_remaining == 1:
        return 38.0
    if days_remaining == 2:
        return 35.0
    if days_remaining <= 3:
        return 30.0
    if days_remaining <= 5:
        return 25.0
    if days_remaining <= 7:
        return 20.0
    if days_remaining <= 14:
        return 10.0
    return 5.0


def _dependency_penalty(task: dict, all_tasks: list[dict]) -> float:
    """
    Apply a penalty if this task depends on other incomplete tasks.
    Tasks with unresolvable dependencies should rank lower.
    """
    return 0.0  # Dependencies determined by constraints in orchestrator


def run_priority_engine(structured_tasks: list[dict], constraints: list[str]) -> list[dict]:
    """
    Rank all tasks using a scoring formula and flag at-risk tasks.

    Score = priority_weight (0-30) + urgency_score (0-40) + effort_penalty (-15 to 0)
    Max raw score: 70  → normalized to 0-100

    Args:
        structured_tasks: Output from Task Generator
        constraints: Dependency constraints from Intent Parser

    Returns:
        Tasks list enriched with priority_score and risk_flag, sorted by score desc
    """
    logger.info(f"Priority Engine ranking {len(structured_tasks)} tasks")

    # Parse constraint dependencies
    # Simple heuristic: if "A must complete before B", A gets +5, B gets -5
    constraint_blocked: set[str] = set()
    for constraint in constraints:
        constraint_lower = constraint.lower()
        for task in structured_tasks:
            title_lower = task["title"].lower()
            # If task appears after "before" it's blocked
            after_marker = constraint_lower.find("before")
            if after_marker > -1:
                after_text = constraint_lower[after_marker:]
                if any(word in title_lower for word in after_text.split() if len(word) > 4):
                    constraint_blocked.add(task["task_ref"])

    ranked = []
    for task in structured_tasks:
        priority = task.get("priority", "MEDIUM")
        deadline = task.get("deadline")
        effort = task.get("estimated_effort", "medium")

        days_left = _days_until(deadline)
        urgency = _urgency_score(days_left)
        p_weight = PRIORITY_WEIGHTS.get(priority, 20)
        e_penalty = EFFORT_PENALTY.get(effort, -5)

        # Dependency penalty: blocked tasks rank lower
        dep_penalty = -15.0 if task["task_ref"] in constraint_blocked else 0.0

        raw_score = p_weight + urgency + e_penalty + dep_penalty
        # Clamp to 0-100
        priority_score = round(min(max(raw_score, 0.0), 100.0), 2)

        # Risk flag: high-priority task with deadline ≤ 3 days, or overdue
        risk_flag = (
            days_left <= 3 and priority in ("HIGH", "MEDIUM")
        ) or days_left < 0

        ranked.append({
            **task,
            "priority_score": priority_score,
            "risk_flag": risk_flag,
            "days_until_deadline": days_left,
            "is_blocked": task["task_ref"] in constraint_blocked,
        })

    # Sort by priority_score descending
    ranked.sort(key=lambda t: t["priority_score"], reverse=True)

    logger.info(
        f"Priority Engine complete. Risk flags: {sum(1 for t in ranked if t['risk_flag'])}/{len(ranked)}"
    )
    return ranked
