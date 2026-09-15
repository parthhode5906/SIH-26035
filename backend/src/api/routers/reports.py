"""Report endpoints (architecture.md §6.5) — stub-backed, Phase 5 completes.

The finalize transition already flips the session; the PDF rendering,
hash seal and QR payload land in Phase 5. Sign-off (officer-only) marks
the session approved so the RBAC lifecycle is fully testable now.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import DbDep, OfficerOnly
from ...db.models import Report, TestSession
from ...services.session_service import SessionStateError, mark_approved
from ..schemas import ReportOut, SessionOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{report_id}", response_model=ReportOut)
def read_report(report_id: uuid.UUID, db: DbDep, _user: OfficerOnly) -> ReportOut:
    """Fetch a report record (officer/admin)."""
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "report not found")
    return ReportOut.model_validate(report)


@router.post("/sessions/{session_id}/sign", response_model=SessionOut)
def sign_session(session_id: uuid.UUID, db: DbDep, officer: OfficerOnly) -> SessionOut:
    """Officer sign-off: completed → approved (digital seal in Phase 5)."""
    session = db.get(TestSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    try:
        session = mark_approved(db, session)
    except SessionStateError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return SessionOut.model_validate(session)
