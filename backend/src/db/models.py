"""SQLAlchemy models — the five canonical tables (architecture.md §4.2).

Metrology numerics are stored as ``Numeric(18, 6)`` — never floats
(architecture.md §4.3 rule 2). Observations are APPEND-ONLY: the service
layer never issues UPDATE/DELETE on this table (rule 1); supersession uses
``supersedes_id`` + latest-wins queries on ``(test_type, position,
sequence_no)``.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> uuid.UUID:
    return uuid.uuid4()


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class UserRole(str, enum.Enum):
    """RBAC roles (architecture.md §11)."""

    LAB_TECHNICIAN = "lab_technician"
    APPROVING_OFFICER = "approving_officer"
    ADMIN = "admin"


class AccuracyClassEnum(str, enum.Enum):
    """OIML R-76 accuracy classes."""

    I = "I"
    II = "II"
    III = "III"
    IIII = "IIII"


class SessionStatus(str, enum.Enum):
    """Test-session lifecycle (architecture.md §4.2)."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    APPROVED = "approved"


class ObservationVerdict(str, enum.Enum):
    """Engine-computed verdict stored at insert time."""

    PASS = "PASS"
    FAIL = "FAIL"


class ObservationSource(str, enum.Enum):
    """Where a reading came from (INV-6 provenance)."""

    MANUAL = "manual"
    SERIAL = "serial"
    OCR = "ocr"


class ObservationTestType(str, enum.Enum):
    """R-76 physical test types (Phase 4 modules map 1:1)."""

    WEIGHING_PERFORMANCE = "weighing_performance"
    ECCENTRICITY = "eccentricity"
    REPEATABILITY = "repeatability"
    TARE = "tare"
    CREEP = "creep"
    ZERO_CHECK = "zero_check"


class User(Base):
    """RBAC user account (login identifier: email)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_uuid)
    full_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False, length=32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    sessions: Mapped[list[TestSession]] = relationship(back_populates="creator")
    instruments: Mapped[list[Instrument]] = relationship(back_populates="creator")


class Instrument(Base):
    """The metrological identity of a scale under test."""

    __tablename__ = "instruments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_uuid)
    manufacturer: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    serial_number: Mapped[str] = mapped_column(Text, index=True)
    accuracy_class: Mapped[AccuracyClassEnum] = mapped_column(
        Enum(AccuracyClassEnum, native_enum=False, length=8)
    )
    max_capacity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    min_capacity: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    verification_scale_interval: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    display_interval: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    base_unit: Mapped[str] = mapped_column(String(8), default="kg")
    n_max: Mapped[Decimal] = mapped_column(Numeric(24, 6))  # Max / e, computed once
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    creator: Mapped[User] = relationship(back_populates="instruments")
    sessions: Mapped[list[TestSession]] = relationship(back_populates="instrument")


class TestSession(Base):
    """One evaluation campaign against one instrument."""

    __tablename__ = "test_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_uuid)
    instrument_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instruments.id"), index=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, native_enum=False, length=16),
        default=SessionStatus.DRAFT,
    )
    start_temp_c: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    end_temp_c: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    humidity_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    pressure_hpa: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    instrument: Mapped[Instrument] = relationship(back_populates="sessions")
    creator: Mapped[User] = relationship(back_populates="sessions")
    observations: Mapped[list[Observation]] = relationship(back_populates="session")
    reports: Mapped[list[Report]] = relationship(back_populates="session")


class Observation(Base):
    """One raw bench reading + stored engine verdict. APPEND-ONLY."""

    __tablename__ = "observations"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "test_type",
            "position",
            "sequence_no",
            "revision_no",
            name="uq_observation_logical_identity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("test_sessions.id"), index=True
    )
    test_type: Mapped[ObservationTestType] = mapped_column(
        Enum(ObservationTestType, native_enum=False, length=32)
    )
    position: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer)
    revision_no: Mapped[int] = mapped_column(Integer, default=0)  # latest-wins key
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("observations.id"), nullable=True
    )

    applied_load: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    indication: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    additional_load: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))
    zero_error: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0"))

    # Engine-computed at insert (architecture.md §4.3 rule 3):
    error_prior: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    corrected_error: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    mpe_limit: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    verdict: Mapped[ObservationVerdict] = mapped_column(
        Enum(ObservationVerdict, native_enum=False, length=8)
    )

    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    entered_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    source: Mapped[ObservationSource] = mapped_column(
        Enum(ObservationSource, native_enum=False, length=16),
        default=ObservationSource.MANUAL,
    )

    session: Mapped[TestSession] = relationship(back_populates="observations")


class Report(Base):
    """Generated report artifact + integrity seal."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_new_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("test_sessions.id"), index=True
    )
    file_path: Mapped[str] = mapped_column(Text)
    docx_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    sha256: Mapped[str] = mapped_column(String(64))
    qr_payload: Mapped[str] = mapped_column(Text)
    signed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    template_version: Mapped[str] = mapped_column(String(32), default="r76-2-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    session: Mapped[TestSession] = relationship(back_populates="reports")
