"""
Task Planner Agent
──────────────────
Accepts natural language task descriptions.
Uses keyword-based NLP classification (with BERT stub for production).
Extracts entities and builds executable DAG.
"""

import re
from dataclasses import dataclass
from utils.logging_utils import get_logger, write_audit_log
from models.database_models import AgentType

logger = get_logger("agent.task_planner")


# ─── Intent Definitions ──────────────────────────────────────────────────────

INTENT_KEYWORDS = {
    "validate": [
        "validate", "validation", "check schema", "contract", "enforce",
        "verify structure", "check columns", "schema check",
    ],
    "quality_check": [
        "quality", "clean", "impute", "missing", "duplicate", "outlier",
        "governance", "data quality", "cleanse", "fix data",
    ],
    "generate_synthetic": [
        "synthetic", "generate", "fake data", "augment", "ctgan",
        "vae", "create data", "simulate", "privacy",
    ],
    "full_pipeline": [
        "full pipeline", "end to end", "complete", "all steps",
        "validate and generate", "validate and clean",
    ],
}

# Maps intent to the ordered list of agents to execute
INTENT_TO_AGENTS = {
    "validate": [AgentType.CONTRACT_ENFORCEMENT],
    "quality_check": [AgentType.DATA_GOVERNANCE],
    "generate_synthetic": [AgentType.SYNTHETIC_GENERATOR],
    "full_pipeline": [
        AgentType.CONTRACT_ENFORCEMENT,
        AgentType.DATA_GOVERNANCE,
        AgentType.SYNTHETIC_GENERATOR,
    ],
}

# Agent labels for DAG visualization
AGENT_LABELS = {
    AgentType.CONTRACT_ENFORCEMENT: "Schema Validation",
    AgentType.DATA_GOVERNANCE: "Data Quality",
    AgentType.SYNTHETIC_GENERATOR: "Synthetic Generator",
}


# ─── Entity Extraction ───────────────────────────────────────────────────────

@dataclass
class ExtractedEntities:
    dataset_name: str | None = None
    action_type: str | None = None
    row_count: int | None = None


def extract_entities(text: str) -> ExtractedEntities:
    """Extract entities (dataset name, action type, row count) from text."""
    entities = ExtractedEntities()

    # Extract dataset name — look for patterns like "sales dataset", "customer_data"
    dataset_patterns = [
        r"(?:the\s+)?(\w+(?:_\w+)*)\s+dataset",
        r"dataset\s+(?:named?\s+)?['\"]?(\w+(?:_\w+)*)['\"]?",
        r"(?:on|for|from|using)\s+['\"]?(\w+(?:_\w+)*)['\"]?\s+(?:data|file|csv|json)",
    ]
    for pattern in dataset_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            entities.dataset_name = match.group(1).lower()
            break

    # Extract row count for synthetic generation
    row_match = re.search(r"(\d+)\s*(?:rows?|records?|samples?)", text, re.IGNORECASE)
    if row_match:
        entities.row_count = int(row_match.group(1))

    return entities


# ─── Intent Classification ───────────────────────────────────────────────────

def classify_intent(text: str) -> str:
    """
    Classify the intent of a natural language task description.
    Uses keyword matching with priority scoring.
    """
    text_lower = text.lower()
    scores = {}

    for intent, keywords in INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[intent] = score

    if not scores:
        return "full_pipeline"  # default to full pipeline

    # Check for compound intents (multiple agent types mentioned)
    if len(scores) > 1 and "full_pipeline" not in scores:
        # If multiple intents detected, run full pipeline
        return "full_pipeline"

    return max(scores, key=scores.get)


# ─── BERT Classifier Stub ────────────────────────────────────────────────────

class BERTClassifier:
    """
    Production-ready BERT classifier stub.
    Replace with real transformers model for GPU deployment:

        from transformers import pipeline
        classifier = pipeline("text-classification", model="bert-base-uncased")

    The interface remains the same — just swap the classify() method.
    """

    def __init__(self, model_name: str = "bert-base-uncased"):
        self.model_name = model_name
        self.labels = list(INTENT_KEYWORDS.keys())
        logger.info(f"BERTClassifier initialized (stub mode, model={model_name})")

    def classify(self, text: str) -> dict:
        """Classify text intent. Returns {label, confidence}."""
        intent = classify_intent(text)
        return {"label": intent, "confidence": 0.85}


# ─── DAG Construction ────────────────────────────────────────────────────────

def build_dag_from_intent(intent: str, task_id: str) -> dict:
    """
    Convert an intent into a DAG structure for the orchestrator.
    Returns: {nodes: [...], edges: [...], execution_order: [...]}
    """
    agents = INTENT_TO_AGENTS.get(intent, INTENT_TO_AGENTS["full_pipeline"])

    nodes = []
    edges = []
    execution_order = []

    for i, agent_type in enumerate(agents):
        node_id = f"node_{i}"
        nodes.append({
            "id": node_id,
            "type": agent_type.value,
            "label": AGENT_LABELS.get(agent_type, agent_type.value),
            "status": "PENDING",
            "order": i,
        })
        execution_order.append(node_id)

        # Add edge from previous node
        if i > 0:
            edges.append({
                "source": f"node_{i - 1}",
                "target": node_id,
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "execution_order": execution_order,
    }


# ─── Main Agent Function ─────────────────────────────────────────────────────

def plan_task(description: str, task_id: str, db=None) -> dict:
    """
    Main entry point for the Task Planner Agent.

    1. Classify intent from natural language
    2. Extract entities (dataset name, action type)
    3. Build executable DAG
    4. Return plan for orchestrator

    Args:
        description: Natural language task description
        task_id: ID of the parent task
        db: Database session (optional, for audit logging)

    Returns:
        dict with keys: intent, entities, dag
    """
    logger.info(f"Planning task: {description[:100]}...")

    # Step 1: Classify intent
    intent = classify_intent(description)
    logger.info(f"Classified intent: {intent}")

    # Step 2: Extract entities
    entities = extract_entities(description)
    logger.info(f"Extracted entities: {entities}")

    # Step 3: Build DAG
    dag = build_dag_from_intent(intent, task_id)
    logger.info(f"Built DAG with {len(dag['nodes'])} nodes")

    # Step 4: Audit log
    if db:
        write_audit_log(
            db=db,
            action="Task planned",
            task_id=task_id,
            agent_type=AgentType.TASK_PLANNER,
            details={
                "intent": intent,
                "entities": {
                    "dataset_name": entities.dataset_name,
                    "action_type": entities.action_type,
                    "row_count": entities.row_count,
                },
                "dag_nodes": len(dag["nodes"]),
            },
        )

    return {
        "intent": intent,
        "entities": {
            "dataset_name": entities.dataset_name,
            "action_type": entities.action_type,
            "row_count": entities.row_count,
        },
        "dag": dag,
    }
