"""
SQLAlchemy database engine and session management.
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
from config import settings

logger = logging.getLogger(__name__)

# When running locally without Postgres, registration/logins will fall back
# to a local SQLite file so the app works out-of-the-box for dev.
SQLITE_FALLBACK_URL = "sqlite:///./aithon_dev.db"


def _configure_engine(database_url: str):
    """Create SQLAlchemy engine. SQLite requires different pool params."""
    is_sqlite = str(database_url).startswith("sqlite")
    if is_sqlite:
        # SQLite does not support connection pooling parameters
        eng = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            echo=settings.DEBUG,
        )
    else:
        eng = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=30,
            echo=settings.DEBUG,
        )
    sess = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    return eng, sess


engine, SessionLocal = _configure_engine(settings.DATABASE_URL)
Base = declarative_base()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called on application startup.

    NOTE: We intentionally do NOT drop existing tables on startup — doing so
    would wipe user accounts and all data on every server restart, which
    breaks authentication. Use explicit migration scripts for schema changes.
    """
    from models.database_models import (
        User, Task, DAG, Dataset, AuditLog, Lineage, Report
    )  # noqa: F401 — imported to register models with Base
    is_postgres = str(settings.DATABASE_URL).startswith("postgresql")

    try:
        # Only create missing tables — never drop existing ones
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized (create_all — no drops).")
    except SQLAlchemyError as e:
        # If Postgres is unavailable, fall back to SQLite for local dev
        if is_postgres:
            logger.warning(
                "Database initialization failed (%s). Falling back to SQLite (%s).",
                e,
                SQLITE_FALLBACK_URL,
            )
            engine_fallback, session_fallback = _configure_engine(SQLITE_FALLBACK_URL)
            globals()["engine"] = engine_fallback
            globals()["SessionLocal"] = session_fallback
            Base.metadata.create_all(bind=engine_fallback)
            return
        raise
