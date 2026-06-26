"""
Intent Parser Agent
────────────────────
Parses natural language input from manager into structured tasks.
Uses OpenAI API if key is available, falls back to rule-based extraction.
"""

import re
import json
from datetime import datetime, timedelta, date, timezone
from config import settings
from utils.logging_utils import get_logger

logger = get_logger("agents.pm.intent_parser")


def _parse_deadline_text(text: str) -> str | None:
    """Convert relative deadline phrases to ISO date strings."""
    today = datetime.now(timezone.utc).date()
    text_lower = text.lower()

    if "tomorrow" in text_lower:
        return (today + timedelta(days=1)).isoformat()
    if "end of week" in text_lower or "end of this week" in text_lower:
        days_to_friday = (4 - today.weekday()) % 7
        if days_to_friday == 0:
            days_to_friday = 7
        return (today + timedelta(days=days_to_friday)).isoformat()
    if "next week" in text_lower:
        return (today + timedelta(days=7)).isoformat()
    if "in 2 days" in text_lower or "2 days" in text_lower:
        return (today + timedelta(days=2)).isoformat()
    if "in 3 days" in text_lower or "3 days" in text_lower:
        return (today + timedelta(days=3)).isoformat()
    if "in a week" in text_lower:
        return (today + timedelta(days=7)).isoformat()
    if "in 2 weeks" in text_lower:
        return (today + timedelta(days=14)).isoformat()
    if "end of month" in text_lower:
        # Last day of current month
        if today.month == 12:
            last_day = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(today.year, today.month + 1, 1) - timedelta(days=1)
        return last_day.isoformat()

    # Try to find "in N days"
    m = re.search(r"in (\d+) days?", text_lower)
    if m:
        return (today + timedelta(days=int(m.group(1)))).isoformat()

    return (today + timedelta(days=7)).isoformat()  # Default: 1 week


def _rule_based_parse(description: str) -> dict:
    """Fallback rule-based intent extraction when OpenAI is not available."""
    description_lower = description.lower()

    # Extract priority hints
    tasks_raw = []
    sentences = re.split(r'[.;]', description)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        priority = "MEDIUM"
        if any(w in sentence.lower() for w in ["high priority", "urgent", "critical", "asap", "immediately"]):
            priority = "HIGH"
        elif any(w in sentence.lower() for w in ["low priority", "when possible", "eventually", "low"]):
            priority = "LOW"
        elif any(w in sentence.lower() for w in ["medium priority", "moderate"]):
            priority = "MEDIUM"

        deadline = _parse_deadline_text(sentence)

        # Clean up the action text
        action = sentence
        for phrase in ["high priority", "medium priority", "low priority", "urgent", "critical",
                        "end of week", "end of this week", "by tomorrow", "as soon as possible",
                        "should be completed", "needs to be done", "please"]:
            action = re.sub(phrase, "", action, flags=re.IGNORECASE).strip()

        action = action.strip(" .,;")
        if len(action) > 10:
            tasks_raw.append({
                "action": action,
                "priority": priority,
                "deadline": deadline
            })

    if not tasks_raw:
        tasks_raw = [{
            "action": description[:200],
            "priority": "MEDIUM",
            "deadline": _parse_deadline_text(description)
        }]

    # Extract project name
    project_match = re.search(r"(?:project|for|the)\s+([A-Z][a-zA-Z\s]+?)(?:\s+project|\s+module|$|[.,;])", description)
    project_name = project_match.group(1).strip() if project_match else "Project"

    # Extract constraints
    constraints = []
    if re.search(r"(auth|login|authentication).*(before|then|first).*(dashboard|ui|frontend)", description_lower):
        constraints.append("auth must complete before dashboard")
    if re.search(r"(backend|api|database|db).*(before|then|first).*(frontend|ui|dashboard)", description_lower):
        constraints.append("backend must complete before frontend")

    return {
        "project": project_name,
        "tasks_raw": tasks_raw,
        "constraints": constraints,
    }


def _openai_parse(description: str) -> dict:
    """Use OpenAI to parse natural language into structured tasks."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        today = datetime.now(timezone.utc).date().isoformat()

        system_prompt = f"""You are a project management assistant. Parse the user's natural language 
project description into structured JSON. Today's date is {today}.

Return ONLY valid JSON with this exact structure:
{{
  "project": "project name",
  "tasks_raw": [
    {{
      "action": "what needs to be built/done",
      "priority": "HIGH|MEDIUM|LOW",
      "deadline": "YYYY-MM-DD"
    }}
  ],
  "constraints": ["dependency constraint strings, e.g. 'auth must complete before dashboard'"]
}}

Rules:
- Extract each distinct task/module/component as a separate item in tasks_raw
- Convert relative deadlines (end of week, tomorrow, in 3 days) to absolute dates based on today: {today}
- Priority keywords: urgent/critical/high priority → HIGH; when possible/low → LOW; default → MEDIUM
- Identify any ordering dependencies between tasks
- Keep action descriptions concise but clear (under 80 chars)
"""

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": description}
            ],
            temperature=0.1,
            max_tokens=1000,
        )

        content = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        content = re.sub(r"```(?:json)?\s*", "", content).strip("`").strip()
        parsed = json.loads(content)
        logger.info(f"OpenAI parsed {len(parsed.get('tasks_raw', []))} tasks")
        return parsed

    except Exception as e:
        logger.warning(f"OpenAI parse failed ({e}), falling back to rule-based")
        return None


def run_intent_parser(description: str) -> dict:
    """
    Parse manager natural language input into structured task data.

    Args:
        description: Raw NL string from manager

    Returns:
        {
            "project": str,
            "tasks_raw": [{"action": str, "priority": str, "deadline": str}],
            "constraints": [str]
        }
    """
    logger.info("Intent Parser starting")

    result = None

    # Try OpenAI first if key is configured
    if settings.OPENAI_API_KEY:
        result = _openai_parse(description)

    # Fall back to rule-based
    if not result:
        result = _rule_based_parse(description)

    logger.info(f"Intent Parser extracted {len(result['tasks_raw'])} tasks for project '{result['project']}'")
    return result
