"""R 76-2 checklist (test 17) service — seed, submit, latest-wins read.

The checklist covers requirements that tests 1–15 cannot exercise:
descriptive markings (R 76-1 §7.1), device types/operating ranges
(§4.2–§4.6), and prohibitions (§4.13.3.3). Items are APPEND-ONLY like
observations: a correction supersedes via ``revision_no`` +
``supersedes_id`` (architecture.md §4.3 rule 1).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db.models import ChecklistItem, ChecklistOutcome, TestSession
from ..engine.checklist_catalog import CHECKLIST_CATALOG, ChecklistEntry


class ChecklistStateError(Exception):
    """Checklist is closed or otherwise not writable."""


class UnknownChecklistItemError(Exception):
    """item_key/clause pair not in the sheet-17 catalog."""


class ChecklistConflictError(Exception):
    """Another writer created the same checklist revision first."""


def _entry(clause: str, item_key: str) -> ChecklistEntry:
    for e in CHECKLIST_CATALOG:
        if e.clause == clause and e.item_key == item_key:
            return e
    raise UnknownChecklistItemError(
        f"no checklist catalog entry for clause {clause!r} item {item_key!r}"
    )


def seed_checklist(db: Session, session: TestSession, entered_by: uuid.UUID) -> int:
    """Pre-create every catalog item as unchecked (idempotent: existing rows win).

    Seeding gives the UI the full official sheet immediately; the tester
    then flips items to PASSED/FAILED as they are checked. Returns the
    number of items created.
    """
    if session.status.value not in ("draft", "in_progress"):
        raise ChecklistStateError(
            f"session is {session.status.value}; closed sessions accept no checklist updates"
        )
    existing = {
        (row.clause, row.item_key)
        for row in latest_checklist(db, session.id)
    }
    created = 0
    for entry in CHECKLIST_CATALOG:
        if (entry.clause, entry.item_key) in existing:
            continue
        db.add(
            ChecklistItem(
                session_id=session.id,
                clause=entry.clause,
                item_key=entry.item_key,
                requirement=entry.requirement,
                test_procedure=entry.test_procedure,
                outcome=ChecklistOutcome.UNCHECKED,
                revision_no=0,
                supersedes_id=None,
                entered_by=entered_by,
            )
        )
        created += 1
    if created:
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ChecklistConflictError(
                "another update created a checklist revision; retry seeding"
            ) from exc
    return created


def latest_checklist(db: Session, session_id: uuid.UUID) -> list[ChecklistItem]:
    """Latest-wins view: per (clause, item_key), the highest revision."""
    rows = db.execute(
        select(ChecklistItem).where(ChecklistItem.session_id == session_id)
    ).scalars().all()
    latest: dict[tuple[str, str], ChecklistItem] = {}
    for row in rows:
        key = (row.clause, row.item_key)
        current = latest.get(key)
        if current is None or (
            row.revision_no,
            row.entered_at,
            str(row.id),
        ) > (
            current.revision_no,
            current.entered_at,
            str(current.id),
        ):
            latest[key] = row
    catalog_order = {
        (e.clause, e.item_key): i for i, e in enumerate(CHECKLIST_CATALOG)
    }
    return sorted(
        latest.values(),
        key=lambda r: catalog_order.get((r.clause, r.item_key), 999),
    )


def submit_checklist_item(
    db: Session,
    session: TestSession,
    *,
    entered_by: uuid.UUID,
    clause: str,
    item_key: str,
    outcome: str,
    remarks: str | None = None,
) -> ChecklistItem:
    """Record one outcome (append-only supersession, like observations)."""
    if session.status.value not in ("draft", "in_progress"):
        raise ChecklistStateError(
            f"session is {session.status.value}; closed sessions accept no checklist updates"
        )
    entry = _entry(clause, item_key)
    outcome_enum = ChecklistOutcome(outcome)
    if entry.mandatory and outcome_enum is ChecklistOutcome.NOT_APPLICABLE:
        raise ChecklistStateError("mandatory checklist items cannot be marked not applicable")

    current = [
        r
        for r in latest_checklist(db, session.id)
        if r.clause == clause and r.item_key == item_key
    ]
    revision = (current[0].revision_no + 1) if current else 0

    row = ChecklistItem(
        session_id=session.id,
        clause=clause,
        item_key=item_key,
        requirement=entry.requirement,
        test_procedure=entry.test_procedure,
        outcome=outcome_enum,
        remarks=remarks,
        revision_no=revision,
        supersedes_id=current[0].id if current else None,
        entered_by=entered_by,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ChecklistConflictError(
            "another update created this checklist revision; retry the submission"
        ) from exc
    db.refresh(row)
    return row


def checklist_progress(
    items: list[ChecklistItem],
) -> dict[str, int]:
    """Counts the UI/report gate: passed / failed / open / total."""
    return {
        "passed": sum(1 for i in items if i.outcome is ChecklistOutcome.PASSED),
        "failed": sum(1 for i in items if i.outcome is ChecklistOutcome.FAILED),
        "open": sum(1 for i in items if i.outcome is ChecklistOutcome.UNCHECKED),
        "total": len(items),
    }
