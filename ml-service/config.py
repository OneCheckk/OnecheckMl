"""
OneCheck ML Service — Environment Configuration
Centralizes all environment variables with sensible defaults.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # ── General ─────────────────────────────────────────────────────────────
    APP_TITLE: str = "OneCheck AI & ML Forensics Microservice"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = Field(default="development", alias="APP_ENV")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    PORT: int = Field(default=8000, alias="PORT")

    # ── Security & Privacy ───────────────────────────────────────────────────
    FACULTY_HMAC_SALT: str = Field(
        default="e10d4165cf4d5242832d9b0f8d4068cba05c2892bbf80229d9b487599c72b8c5",
        alias="FACULTY_HMAC_SALT"
    )

    # ── Google Gemini API (Engine 8) ─────────────────────────────────────────
    GEMINI_API_KEY: str = Field(default="", alias="GEMINI_API_KEY")

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(default="*", alias="CORS_ORIGINS")

    # ── File Limits ──────────────────────────────────────────────────────────
    MAX_UPLOAD_BYTES: int = Field(default=26214400, alias="MAX_UPLOAD_BYTES")  # 25 MB

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


settings = Settings()
