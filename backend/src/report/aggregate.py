"""Session aggregation for report rendering (P5-2, architecture.md §7.3).

Pulls the session, instrument, latest-wins observations and ambient
conditions into one immutable ``ReportData`` value object that both the
PDF and DOCX renderers consume verbatim — the two formats can never drift
because they render the same snapshot.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from ..db.models import Instrument, Observation, Report, TestSession, User
from ..services.session_service import latest_observations

#: Display order of test sections in the report (R 76-2 layout order).
TEST_ORDER: tuple[str, ...] = (
    "weighing_performance",
    "eccentricity",
    "repeatability",
    "tare",
    "creep",
    "zero_check",
)

_TEST_TITLES: dict[str, str] = {
    "weighing_performance": "Weighing performance",
    "eccentricity": "Eccentricity test",
    "repeatability": "Repeatability",
    "tare": "Tare",
    "creep": "Creep / return to zero",
    "zero_check": "Zero check (initial zero-tracking break-out)",
}


def test_title(test_type: str) -> str:
    """Human title for a test type key."""
    return _TEST_TITLES.get(test_type, test_type.replace("_", " ").title())


@dataclass(frozen=True, slots=True)
class ReportData:
    """Immutable render snapshot — one session's complete evaluation."""

    session_id: uuid.UUID
    instrument: dict[str, str]
    conditions: dict[str, str]
    session_state: str  # completed | approved
    observations: dict[str, list[dict[str, str]]] = field(default_factory=dict)
    overall: dict[str, Any] = field(default_factory=dict)
    lab: dict[str, str] = field(default_factory=dict)
    tested_by: str = ""
    approved_by: str = ""
    template_version: str = "r76-2-v1"

    def test_rows(self, test_type: str) -> list[dict[str, str]]:
        """Rows for one test section in render order."""
        return self.observations.get(test_type, [])


def _fmt(value: Decimal | None, places: int = 6) -> str:
    """Fixed-point 6-decimal string (never scientific notation). ASCII dash
    for None — the standard PDF fonts are Latin-1 and cannot render '—'."""
    if value is None:
        return "-"
    return f"{value:.{places}f}"


def aggregate_session(db: OrmSession, session_id: uuid.UUID) -> ReportData:
    """Build the render snapshot for a finalized session.

    Raises ``ValueError`` if the session is not yet completed — reports are
    only generated on the finalize transition (architecture.md §7.3).
    """
    session = db.get(TestSession, session_id)
    if session is None:
        raise ValueError(f"session {session_id} not found")
    if session.status.value not in ("completed", "approved"):
        raise ValueError(
            f"session is {session.status.value}; reports are generated on finalize"
        )

    instrument = session.instrument
    e = Decimal(str(instrument.verification_scale_interval))

    # --- ambient conditions -------------------------------------------
    conditions = {
        "Start temperature (°C)": _fmt(session.start_temp_c, 2),
        "End temperature (°C)": _fmt(session.end_temp_c, 2),
        "Relative humidity (%)": _fmt(session.humidity_pct, 2),
        "Barometric pressure (hPa)": _fmt(session.pressure_hpa, 2),
    }

    # --- latest-wins observations, grouped by test ---------------------
    rows_by_test: dict[str, list[dict[str, str]]] = {}
    verdict_counts = {"PASS": 0, "FAIL": 0}
    worst_ratio: Decimal | None = None  # |Ec| / MPE, 1.0 = exactly at limit

    for obs in latest_observations(db, session_id):
        mpe = Decimal(str(obs.mpe_limit))
        ec = Decimal(str(obs.corrected_error))
        if mpe != 0:
            ratio = abs(ec) / mpe
            worst_ratio = ratio if worst_ratio is None else max(worst_ratio, ratio)

        key = obs.test_type.value
        verdict_counts[obs.verdict.value] += 1
        mpe_mult = mpe / e if e != 0 else Decimal("0")
        rows_by_test.setdefault(key, []).append(
            {
                "position": obs.position or "-",
                "seq": str(obs.sequence_no),
                "L": _fmt(obs.applied_load),
                "I": _fmt(obs.indication),
                "dL": _fmt(obs.additional_load),
                "E": _fmt(obs.error_prior),
                "Ec": _fmt(obs.corrected_error),
                "MPE": _fmt(obs.mpe_limit),
                "MPE_e": f"±{mpe_mult.normalize():f}e",
                "verdict": obs.verdict.value,
                "verdict_glyph": "✓ PASS" if obs.verdict.value == "PASS" else "✗ FAIL",
            }
        )
    observations_out = {k: rows_by_test[k] for k in TEST_ORDER if k in rows_by_test}

    # --- overall verdict -----------------------------------------------
    overall = {
        "result": "FAIL" if verdict_counts["FAIL"] else "PASS",
        "pass_count": verdict_counts["PASS"],
        "fail_count": verdict_counts["FAIL"],
        "total": verdict_counts["PASS"] + verdict_counts["FAIL"],
        "worst_utilization": (
            f"{float(worst_ratio):.1%}" if worst_ratio is not None else "—"
        ),
        "clause": "OIML R 76-1 (2006), §3.5 / §3.6 / §3.9 with Annex A procedures",
    }

    # --- lab + identities ----------------------------------------------
    creator = db.get(User, session.created_by)
    approver: User | None = None
    latest_report = db.scalar(
        select(Report)
        .where(Report.session_id == session_id)
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    if latest_report is not None and latest_report.signed_by is not None:
        approver = db.get(User, latest_report.signed_by)

    return ReportData(
        session_id=session_id,
        instrument={
            "Manufacturer": instrument.manufacturer,
            "Model": instrument.model,
            "Serial number": instrument.serial_number,
            "Accuracy class": instrument.accuracy_class.value,
            "Maximum (Max)": _fmt(instrument.max_capacity, 3),
            "Minimum (Min)": _fmt(instrument.min_capacity, 3),
            "Scale interval (e)": _fmt(instrument.verification_scale_interval, 6),
            "Display interval (d)": _fmt(instrument.display_interval, 6),
            "Unit": instrument.base_unit,
            "n (Max/e)": _fmt(Decimal(str(instrument.n_max)), 0),
        },
        conditions=conditions,
        session_state=session.status.value,
        observations=observations_out,
        overall=overall,
        lab={
            "name": "Legal Metrology Laboratory (demo)",
            "address": "Demo Lab, Government of India — Legal Metrology Division",
        },
        tested_by=creator.full_name if creator else "—",
        approved_by=approver.full_name if approver else "",
        template_version="r76-2-v1",
    )
