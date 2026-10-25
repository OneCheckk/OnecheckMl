"""
OneCheck ML Service — Environment Configuration
Centralizes all environment variables with sensible defaults.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # ── General ─────────────────────────────────────────────────────────────
    APP_TITLE: str = "OneCheck AI & ML Forensics Microservice"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = Field(default="development", alias="APP_ENV")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")

    # ── Google Gemini API (Engine 8) ─────────────────────────────────────────
    GEMINI_API_KEY: str = Field(default="", alias="GEMINI_API_KEY")

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(default="*", alias="CORS_ORIGINS")

    # ── File Limits ──────────────────────────────────────────────────────────
    MAX_UPLOAD_BYTES: int = Field(default=20 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")  # 20 MB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


settings = Settings()
