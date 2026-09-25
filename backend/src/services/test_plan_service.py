from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import ObservationTestType, TestPlanItem, TestPlanStatus, TestSession

CORE_REQUIRED = {
    ObservationTestType.WEIGHING_PERFORMANCE,
    ObservationTestType.ECCENTRICITY,
    ObservationTestType.REPEATABILITY,
    ObservationTestType.TARE,
    ObservationTestType.CREEP,
    ObservationTestType.ZERO_CHECK,
}

class TestPlanStateError(Exception):
    pass

def ensure_plan(db: Session, session: TestSession, user_id: uuid.UUID) -> list[TestPlanItem]:
    existing = {r.test_type: r for r in db.scalars(select(TestPlanItem).where(TestPlanItem.session_id == session.id)).all()}
    for tt in ObservationTestType:
        if tt not in existing:
            db.add(TestPlanItem(session_id=session.id, test_type=tt,
                status=TestPlanStatus.REQUIRED if tt in CORE_REQUIRED else TestPlanStatus.OPTIONAL,
                updated_by=user_id))
    db.commit()
    return db.scalars(select(TestPlanItem).where(TestPlanItem.session_id == session.id).order_by(TestPlanItem.test_type)).all()

def list_plan(db: Session, session_id: uuid.UUID) -> list[TestPlanItem]:
    return db.scalars(select(TestPlanItem).where(TestPlanItem.session_id == session_id).order_by(TestPlanItem.test_type)).all()

def set_status(db: Session, session: TestSession, *, test_type: str, status: str, rationale: str | None, user_id: uuid.UUID) -> TestPlanItem:
    row = db.scalar(select(TestPlanItem).where(TestPlanItem.session_id == session.id, TestPlanItem.test_type == ObservationTestType(test_type)))
    if row is None:
        raise TestPlanStateError("test plan has not been initialized")
    row.status = TestPlanStatus(status)
    row.rationale = rationale
    row.updated_by = user_id
    row.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(row)
    return row

def completion(db: Session, session: TestSession) -> dict[str, object]:
    rows = list_plan(db, session.id)
    from .session_service import latest_observations
    obs_types = {o.test_type for o in latest_observations(db, session.id)}
    required = [r for r in rows if r.status is TestPlanStatus.REQUIRED]
    missing = [r.test_type.value for r in required if r.test_type not in obs_types]
    return {"required": len(required), "required_completed": len(required)-len(missing), "missing_required": missing, "ready": bool(rows) and not missing}
