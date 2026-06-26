"""
Aithon Multi-Agent System — FastAPI Application
────────────────────────────────────────────────
Entry point for the backend server.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from models.database import init_db
from api.auth import router as auth_router
from api.routes import router as api_router
from api.pm_routes import router as pm_router
from api.ws_routes import router as ws_router, manager as ws_manager
from core.pm_orchestrator import set_ws_manager
from utils.logging_utils import get_logger

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Create upload directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.SYNTHETIC_OUTPUT_DIR, exist_ok=True)

    # Initialize database tables
    init_db()
    logger.info("Database tables initialized")

    # Wire WebSocket manager into PM orchestrator
    set_ws_manager(ws_manager)
    logger.info("WebSocket manager registered with PM orchestrator")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Multi-agent data governance system with Task Planning, "
        "Contract Enforcement, Data Quality, and Synthetic Data Generation."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(api_router)
app.include_router(pm_router)
app.include_router(ws_router)


@app.get("/", tags=["Health"])
def root():
    """Health check endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "version": settings.APP_VERSION,
    }
