"""Application configuration — environment-sourced, secrets never committed.

All settings come from environment variables (rules.md §5; a ``.env`` file
is loaded if present — ``.env`` is already git-ignored).
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

# Load a .env from backend/ if python-dotenv is available (optional dep).
try:  # pragma: no cover - trivial env loading
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:  # pragma: no cover
    pass

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # --- App -----------------------------------------------------------
    app_name: str = "OIML R-76 Compliance Engine"
    environment: str = Field(default="development")  # development|production

    # --- Database --------------------------------------------------------
    # Default: local SQLite for development/demo (zero setup). Production
    # swaps to PostgreSQL via DATABASE_URL (NUMERIC columns work in both).
    database_url: str = Field(
        default="sqlite:///./oiml_dev.db",
        description="SQLAlchemy URL. Production: postgresql+psycopg://...",
    )

    # --- Auth ------------------------------------------------------------
    jwt_secret_key: str = Field(
        default="dev-only-secret-change-me",
        description="MUST be overridden in production via JWT_SECRET_KEY.",
    )
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    # --- Uploads ---------------------------------------------------------
    uploads_dir: str = Field(default="./uploads")
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_upload_mimetypes: frozenset[str] = frozenset(
        {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    )

    # --- CORS ------------------------------------------------------------
    #: Loopback dev origins by default (any port). Pin exact origins in
    #: production via CORS_ALLOW_ORIGINS='["https://pwa.example.gov.in"]'.
    cors_allow_origins: list[str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://[::1]:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://[::1]:4173",
        ],
        description="Browser origins allowed to call this API.",
    )

    # --- Reports (Phase 5) ------------------------------------------------
    reports_dir: str = Field(default="./reports")
    #: Base URL of the public verification page the QR code points at.
    #: Dev: Vite serves /verify/:reportId. Production: pin via env.
    report_verify_base_url: str = Field(default="http://localhost:5173/verify")

    # --- Drift watchdog (D-14, verified from R 76-1 §3.9.2.3) ------------
    #: Zero-indication drift allowance: 1e per 1 degC (class I),
    #: 1e per 5 degC (classes II/III/IIII).
    drift_scale_intervals_per_degree: dict[str, int] = Field(
        default_factory=lambda: {"I": 1, "II": 5, "III": 5, "IIII": 5}
    )
    #: Default static temperature limits when none are marked (§3.9.2.1).
    default_temp_min_c: float = -10.0
    default_temp_max_c: float = 40.0


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (FastAPI dependency-friendly)."""
    return Settings()


settings = get_settings()
