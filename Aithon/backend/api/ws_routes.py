"""
WebSocket connection manager for real-time PM updates.
Manages per-project broadcast channels.
"""

import json
from typing import Dict, List
from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from utils.logging_utils import get_logger

logger = get_logger("api.ws_routes")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages WebSocket connections grouped by project_id."""

    def __init__(self):
        # project_id -> list of connected WebSocket clients
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        logger.info(f"Client connected to project {project_id}. "
                    f"Total: {len(self.active_connections[project_id])}")

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            try:
                self.active_connections[project_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        logger.info(f"Client disconnected from project {project_id}")

    async def broadcast(self, project_id: str, message: dict):
        """Broadcast a JSON message to all subscribers of a project."""
        clients = self.active_connections.get(project_id, [])
        disconnected = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(ws)

        # Clean up dead connections
        for ws in disconnected:
            self.disconnect(ws, project_id)

    async def broadcast_global(self, message: dict):
        """Broadcast to ALL connected clients (e.g., activity feed updates)."""
        for project_id in list(self.active_connections.keys()):
            await self.broadcast(project_id, message)


# Singleton connection manager — shared across the app
manager = ConnectionManager()


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint per project.
    Clients subscribe by connecting to /ws/{project_id}.
    The server broadcasts pipeline events and task status changes.
    """
    await manager.connect(websocket, project_id)
    try:
        while True:
            # Keep connection alive; clients send pings if needed
            data = await websocket.receive_text()
            # Echo ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)


@router.websocket("/ws/global/activity")
async def global_activity_websocket(websocket: WebSocket):
    """Global activity feed WebSocket for manager dashboard."""
    await manager.connect(websocket, "__global__")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "__global__")
