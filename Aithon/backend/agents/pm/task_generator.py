"""
Task Generator Agent
──────────────────────
Converts raw extracted tasks into fully structured PMTask objects with subtasks.
Estimates effort/complexity and generates subtask breakdowns.
"""

import re
from utils.logging_utils import get_logger
from config import settings

logger = get_logger("agents.pm.task_generator")


# ─── Effort estimation heuristics ─────────────────────────────────────────────

EFFORT_KEYWORDS = {
    "complex": ["authentication", "auth", "payment", "security", "encryption",
                 "microservice", "machine learning", "ml", "ai", "blockchain",
                 "real-time", "websocket", "distributed", "kubernetes"],
    "simple": ["button", "label", "text", "color", "style", "typo",
               "readme", "comment", "logo", "icon", "tooltip"],
}

# Subtask templates per common task keywords
SUBTASK_TEMPLATES = {
    "auth": ["Design DB schema", "Build login API endpoint", "Implement JWT tokens",
              "Add password hashing", "Write unit tests", "Test edge cases"],
    "authentication": ["Design DB schema", "Build login API endpoint", "Implement JWT tokens",
                       "Add password hashing", "Write unit tests"],
    "dashboard": ["Design wireframes", "Build component layout", "Integrate API calls",
                   "Add charts/graphs", "Implement filters", "Write tests"],
    "ui": ["Design wireframes", "Build React components", "Add responsive styles", "Write snapshot tests"],
    "api": ["Define endpoint schema", "Implement route handler", "Add validation",
             "Write integration tests", "Update API docs"],
    "database": ["Design schema", "Write migration", "Add indexes", "Seed test data", "Write tests"],
    "payment": ["Integrate payment gateway", "Handle webhooks", "Implement refund logic",
                 "Add error handling", "Security review", "Write tests"],
    "deploy": ["Write Dockerfile", "Configure CI/CD pipeline", "Set up environment vars",
                "Add health checks", "Deploy to staging", "Smoke test"],
    "test": ["Write unit tests", "Write integration tests", "Set up test fixtures", "Run coverage report"],
    "notification": ["Design notification schema", "Build notification service",
                      "Add email templates", "Integrate push notifications", "Test delivery"],
}

DEFAULT_SUBTASKS = ["Analyse requirements", "Design solution", "Implement", "Write tests", "Code review"]


def _estimate_effort(action: str) -> str:
    """Estimate task effort based on keywords in the action description."""
    action_lower = action.lower()
    for keyword in EFFORT_KEYWORDS["complex"]:
        if keyword in action_lower:
            return "complex"
    for keyword in EFFORT_KEYWORDS["simple"]:
        if keyword in action_lower:
            return "simple"
    return "medium"


def _generate_subtasks(action: str) -> list[str]:
    """Generate contextual subtasks based on the action description."""
    action_lower = action.lower()
    for keyword, subtask_list in SUBTASK_TEMPLATES.items():
        if keyword in action_lower:
            return subtask_list
    return DEFAULT_SUBTASKS.copy()


def _openai_generate(tasks_raw: list[dict]) -> list[dict] | None:
    """Use OpenAI to generate richer task breakdowns."""
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        import json
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        system_prompt = """You are a senior software engineer. Given a list of raw tasks, 
generate structured task objects with realistic subtasks and effort estimates.

Return ONLY a valid JSON array. Each element must have:
{
  "title": "concise task title (max 80 chars)",
  "description": "brief description of what this task involves",
  "subtasks": ["list", "of", "3-6", "specific", "subtasks"],
  "estimated_effort": "simple|medium|complex"
}

Rules:
- subtasks should be specific, actionable items (not generic)
- estimated_effort: 'simple' < 4h, 'medium' 1-3 days, 'complex' > 3 days
- Keep subtask titles under 60 characters
"""

        task_descriptions = [t["action"] for t in tasks_raw]
        user_message = f"Generate task breakdowns for: {json.dumps(task_descriptions)}"

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.2,
            max_tokens=1500,
        )
        content = response.choices[0].message.content.strip()
        content = re.sub(r"```(?:json)?\s*", "", content).strip("`").strip()
        generated = json.loads(content)
        return generated

    except Exception as e:
        logger.warning(f"OpenAI task generation failed ({e}), using heuristics")
        return None


def run_task_generator(tasks_raw: list[dict], project_id: str) -> list[dict]:
    """
    Convert raw task descriptions into structured task objects.

    Args:
        tasks_raw: List of {"action": str, "priority": str, "deadline": str}
        project_id: The project this belongs to

    Returns:
        List of structured task dicts ready to be saved to DB
    """
    logger.info(f"Task Generator starting for {len(tasks_raw)} raw tasks")

    # Try LLM-enriched generation
    llm_results = _openai_generate(tasks_raw)

    structured_tasks = []
    for idx, raw in enumerate(tasks_raw):
        task_ref = f"TSK-{str(idx + 1).zfill(3)}"

        if llm_results and idx < len(llm_results):
            llm = llm_results[idx]
            title = llm.get("title", raw["action"][:200])
            description = llm.get("description", "")
            subtasks = llm.get("subtasks", _generate_subtasks(raw["action"]))
            estimated_effort = llm.get("estimated_effort", _estimate_effort(raw["action"]))
        else:
            title = raw["action"][:200]
            description = ""
            subtasks = _generate_subtasks(raw["action"])
            estimated_effort = _estimate_effort(raw["action"])

        structured_tasks.append({
            "task_ref": task_ref,
            "title": title,
            "description": description,
            "priority": raw.get("priority", "MEDIUM"),
            "deadline": raw.get("deadline"),
            "estimated_effort": estimated_effort,
            "subtasks": subtasks,
            "status": "PENDING",
            "project_id": project_id,
        })

    logger.info(f"Task Generator produced {len(structured_tasks)} structured tasks")
    return structured_tasks
