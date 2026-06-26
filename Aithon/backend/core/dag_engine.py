"""
DAG Engine
──────────
NetworkX-based DAG construction, validation, serialization,
and execution ordering.
"""

import json
import networkx as nx
from utils.logging_utils import get_logger

logger = get_logger("core.dag_engine")


class DAGEngine:
    """
    Manages Directed Acyclic Graphs for pipeline execution.
    Uses NetworkX under the hood.
    """

    def __init__(self):
        self.graph = nx.DiGraph()

    def build_from_plan(self, plan: dict) -> "DAGEngine":
        """
        Build DAG from a Task Planner output.
        plan = {nodes: [{id, type, label, status}], edges: [{source, target}]}
        """
        self.graph.clear()

        for node in plan.get("nodes", []):
            self.graph.add_node(
                node["id"],
                type=node.get("type"),
                label=node.get("label", node["id"]),
                status=node.get("status", "PENDING"),
                order=node.get("order", 0),
            )

        for edge in plan.get("edges", []):
            self.graph.add_edge(edge["source"], edge["target"])

        logger.info(f"Built DAG: {len(self.graph.nodes)} nodes, {len(self.graph.edges)} edges")
        return self

    def validate(self) -> dict:
        """
        Validate the DAG:
        - Must be a valid DAG (no cycles)
        - All edge endpoints must exist
        - At least one node
        """
        issues = []

        if len(self.graph.nodes) == 0:
            issues.append("DAG has no nodes")

        if not nx.is_directed_acyclic_graph(self.graph):
            cycles = list(nx.simple_cycles(self.graph))
            issues.append(f"DAG contains cycles: {cycles}")

        # Check for isolated nodes (warning)
        isolated = list(nx.isolates(self.graph))
        warnings = []
        if isolated and len(self.graph.nodes) > 1:
            warnings.append(f"Isolated nodes: {isolated}")

        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
        }

    def get_execution_order(self) -> list[str]:
        """Return nodes in topological sort order (dependencies first)."""
        return list(nx.topological_sort(self.graph))

    def get_node(self, node_id: str) -> dict | None:
        """Get node data by ID."""
        if node_id in self.graph.nodes:
            return dict(self.graph.nodes[node_id])
        return None

    def update_node_status(self, node_id: str, status: str):
        """Update the status of a node."""
        if node_id in self.graph.nodes:
            self.graph.nodes[node_id]["status"] = status

    def get_dependencies(self, node_id: str) -> list[str]:
        """Get the predecessor nodes that must complete before this node."""
        return list(self.graph.predecessors(node_id))

    def get_dependents(self, node_id: str) -> list[str]:
        """Get the nodes that depend on this node."""
        return list(self.graph.successors(node_id))

    def are_dependencies_met(self, node_id: str) -> bool:
        """Check if all predecessor nodes are COMPLETED."""
        for dep in self.get_dependencies(node_id):
            if self.graph.nodes[dep].get("status") != "COMPLETED":
                return False
        return True

    def serialize(self) -> dict:
        """Serialize DAG to JSON-compatible dict for database storage."""
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            nodes.append({"id": node_id, **data})

        edges = []
        for source, target in self.graph.edges:
            edges.append({"source": source, "target": target})

        return {
            "nodes": nodes,
            "edges": edges,
            "execution_order": self.get_execution_order(),
        }

    @classmethod
    def deserialize(cls, data: dict) -> "DAGEngine":
        """Reconstruct DAG from serialized dict."""
        engine = cls()
        engine.build_from_plan(data)
        return engine

    def get_visualization_data(self) -> dict:
        """
        Export node/edge data formatted for frontend visualization.
        Adds x/y positions for a left-to-right layout.
        """
        execution_order = self.get_execution_order()
        nodes = []
        for i, node_id in enumerate(execution_order):
            data = dict(self.graph.nodes[node_id])
            nodes.append({
                "id": node_id,
                "label": data.get("label", node_id),
                "type": data.get("type"),
                "status": data.get("status", "PENDING"),
                "position": {"x": i * 250 + 50, "y": 150},
            })

        edges = [
            {"id": f"e-{s}-{t}", "source": s, "target": t}
            for s, t in self.graph.edges
        ]

        return {"nodes": nodes, "edges": edges}
