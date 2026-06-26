"""
Application configuration using pydantic-settings.
All settings are loaded from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Aithon Multi-Agent System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://aithon:aithon_secret@localhost:5432/aithon_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Authentication
    JWT_SECRET_KEY: str = "aithon-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    SYNTHETIC_OUTPUT_DIR: str = "./synthetic_output"
    MAX_UPLOAD_SIZE_MB: int = 100

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # SLA
    DEFAULT_SLA_SECONDS: int = 300
    MAX_CONCURRENT_TASKS: int = 50

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4000",
    ]

    # OpenAI (for PM Intent Parser agent)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
