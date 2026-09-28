"""Audit service (P7-1) — one call records one row, hash-chained.

Failure policy: an audit write failure RAISES in production
(``environment == "production"``) and logs-and-continues in development —
a broken audit trail must never pass unnoticed in a deployed lab.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.audit_models import AuditAction, AuditLog

logger = logging.getLogger(__name__)

#: Max JSON payload chars persisted — audit rows are summaries, not dumps.
_MAX_DETAIL = 2048


def _at_text(dt: datetime | None) -> str:
    """Canonical timestamp text for hashing — UTC-naive ISO format.

    SQLite drops the tzinfo on round-trip (aware at write, naive at read),
    so the hash payload must normalize: aware values are converted to UTC
    and stripped; naive values are taken as already-UTC.
    """
    if dt is None:
        return ""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat()


def _canonical(detail: dict[str, Any] | None) -> str | None:
    if detail is None:
        return None
    raw = json.dumps(detail, default=str, sort_keys=True, separators=(",", ":"))
    return raw[:_MAX_DETAIL]


def _row_payload(row: AuditLog) -> str:
    """Serialize every persisted audit field except ``row_hash``."""
    return json.dumps(
        {
            "id": row.id,
            "at": _at_text(row.at),
            "actor_id": str(row.actor_id) if row.actor_id else None,
            "actor_email": row.actor_email,
            "action": row.action.value if row.action else None,
            "action_detail": row.action_detail,
            "object_ref": row.object_ref,
            "source_ip": row.source_ip,
            "detail_json": row.detail_json,
            "prev_hash": row.prev_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def record(
    db: Session,
    *,
    actor_id: uuid.UUID | None,
    actor_email: str | None,
    action: AuditAction,
    action_detail: str,
    object_ref: str | None = None,
    source_ip: str | None = None,
    detail: dict[str, Any] | None = None,
) -> AuditLog | None:
    """Append one hash-chained audit row.

    Hash chain: ``row_hash = sha256(canonical_row)``. PostgreSQL's advisory
    transaction lock serializes head lookup and append; without it concurrent
    forks would not be verifiable.
    """
    try:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(726313)"))
        prev = db.scalar(select(func.max(AuditLog.id)))
        prev_hash: str | None = (
            db.get(AuditLog, prev).row_hash if prev is not None else None
        )
        entry = AuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            action_detail=action_detail,
            object_ref=object_ref,
            source_ip=source_ip[:64] if source_ip else None,
            detail_json=_canonical(detail),
            prev_hash=prev_hash,
        )
        # Bind to get server defaults (at) then hash the canonical row.
        db.add(entry)
        db.flush()
        entry.row_hash = hashlib.sha256(_row_payload(entry).encode("utf-8")).hexdigest()
        db.flush()
        return entry
    except Exception:
        db.rollback()
        if settings.environment == "production":
            raise
        logger.exception("audit write failed (non-production: continuing)")
        return None


def verify_chain(db: Session) -> dict[str, Any]:
    """Walk the chain and report the first broken link, if any."""
    rows = db.scalars(select(AuditLog).order_by(AuditLog.id)).all()
    prev: str | None = None
    for r in rows:
        expected = hashlib.sha256(_row_payload(r).encode("utf-8")).hexdigest()
        if r.prev_hash != prev or r.row_hash != expected:
            return {
                "intact": False,
                "broken_at_id": r.id,
                "reason": "prev_hash mismatch" if r.prev_hash != prev else "row_hash mismatch",
            }
        prev = r.row_hash
    return {"intact": True, "rows": len(rows), "head": rows[-1].row_hash if rows else None}


def list_recent(db: Session, limit: int = 100) -> list[AuditLog]:
    """Newest-first page for the admin console."""
    safe_limit = max(0, min(limit, 500))
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(safe_limit)
    ).all()
    return list(rows)
