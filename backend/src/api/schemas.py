"""API schemas (Pydantic v2) — the HTTP boundary of every service.

Metrology numerics travel as **strings** end-to-end: the engine's ingress
models cast JSON numeric strings to Decimal and reject binary floats
(rules.md INV-4). Timestamps/IDs are the only non-string JSON types here.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ..engine.models import (
    NonNegativeDecimal,
    StrictDecimal,
)

# ---------------------------------------------------------------------------
# Auth & users
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """POST /auth/login body."""

    email: str
    password: str


class TokenResponse(BaseModel):
    """POST /auth/login and /auth/refresh response."""

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    role: str
    full_name: str


class RefreshRequest(BaseModel):
    """POST /auth/refresh body."""

    refresh_token: str


class UserCreate(BaseModel):
    """POST /users body (admin only)."""

    full_name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["lab_technician", "approving_officer", "admin"]


class UserOut(BaseModel):
    """User projection (never exposes the hash)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Instruments
# ---------------------------------------------------------------------------


class InstrumentCreate(BaseModel):
    """POST /instruments body — validated against Table 3 on create."""

    manufacturer: str = Field(min_length=1, max_length=200)
    model: str = Field(min_length=1, max_length=200)
    serial_number: str = Field(min_length=1, max_length=100)
    accuracy_class: Literal["I", "II", "III", "IIII"]
    max_capacity: NonNegativeDecimal = Field(description="Max, base unit, as string")
    min_capacity: NonNegativeDecimal
    verification_scale_interval: StrictDecimal = Field(gt=0)
    display_interval: StrictDecimal | None = None
    base_unit: Literal["kg", "g"] = "kg"


class InstrumentOut(BaseModel):
    """Instrument projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    manufacturer: str
    model: str
    serial_number: str
    accuracy_class: str
    max_capacity: Decimal
    min_capacity: Decimal
    verification_scale_interval: Decimal
    display_interval: Decimal | None
    base_unit: str
    n_max: Decimal
    created_by: uuid.UUID
    created_at: datetime


class Page(BaseModel):
    """Generic pagination envelope."""

    total: int
    skip: int
    limit: int


class InstrumentPage(Page):
    """GET /instruments response."""

    items: list[InstrumentOut]


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


class SessionCreate(BaseModel):
    """POST /sessions body."""

    instrument_id: uuid.UUID
    start_temp_c: StrictDecimal | None = None
    humidity_pct: StrictDecimal | None = None
    pressure_hpa: StrictDecimal | None = None


class SessionPatch(BaseModel):
    """PATCH /sessions/{id} body — environment only."""

    end_temp_c: StrictDecimal | None = None
    humidity_pct: StrictDecimal | None = None
    pressure_hpa: StrictDecimal | None = None


class SessionOut(BaseModel):
    """Session projection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    instrument_id: uuid.UUID
    status: str
    start_temp_c: Decimal | None
    end_temp_c: Decimal | None
    humidity_pct: Decimal | None
    pressure_hpa: Decimal | None
    started_at: datetime | None
    completed_at: datetime | None
    created_by: uuid.UUID
    created_at: datetime


class SessionPage(Page):
    """GET /sessions response."""

    items: list[SessionOut]


class DriftReport(BaseModel):
    """Watchdog verdict for the session's ambient delta (D-14)."""

    delta_c: Decimal
    allowed_drift_in_e: Decimal
    allowed_drift_in_unit: Decimal
    static_range_c: list[float]
    level: Literal["ok", "warn"]


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------


class ObservationCreate(BaseModel):
    """POST /sessions/{id}/observations body (engine casts strings→Decimal)."""

    test_type: Literal[
        "weighing_performance",
        "eccentricity",
        "repeatability",
        "tare",
        "creep",
        "zero_check",
    ]
    position: Literal["1", "2", "3", "4", "5"] | None = None
    sequence_no: int = Field(ge=0)
    applied_load: NonNegativeDecimal
    indication: NonNegativeDecimal
    additional_load: NonNegativeDecimal = "0"
    zero_error: StrictDecimal = "0"
    source: Literal["manual", "serial", "ocr"] = "manual"


class ObservationOut(BaseModel):
    """Observation projection — verdict fields are engine-stored values."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    test_type: str
    position: str | None
    sequence_no: int
    revision_no: int
    supersedes_id: uuid.UUID | None
    applied_load: Decimal
    indication: Decimal
    additional_load: Decimal
    zero_error: Decimal
    error_prior: Decimal
    corrected_error: Decimal
    mpe_limit: Decimal
    verdict: str
    entered_at: datetime
    source: str


class ObservationCreatedResponse(BaseModel):
    """POST /sessions/{id}/observations response (canonical §6.4 contract)."""

    observation: ObservationOut
    evaluation: dict[str, str]
    drift: DriftReport | None = None


class BatchSyncRequest(BaseModel):
    """POST /sessions/{id}/observations:batch body (P2-6)."""

    items: list[dict[str, object]] = Field(min_length=1, max_length=1000)


class BatchSyncResponse(BaseModel):
    """Per-item accept/reject report; accepted ids are server-assigned."""

    accepted: list[str]
    rejected: list[dict[str, str]]


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


class ReportArchiveOut(BaseModel):
    """Archive projection — never exposes server filesystem paths."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    sha256: str
    qr_payload: str
    signed_by: uuid.UUID | None
    signed_at: datetime | None
    template_version: str
    created_at: datetime


class ReportOut(BaseModel):
    """Report metadata projection; artifacts are served by download endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    sha256: str
    qr_payload: str
    signed_by: uuid.UUID | None
    signed_at: datetime | None
    template_version: str
    created_at: datetime
