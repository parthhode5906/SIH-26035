"""R 76-2 CHECKLIST (sheet 17) catalog — the requirement rows of test 17.

Sheet 17 covers what tests 1–15 cannot: visual/experimental checks such as
descriptive markings (R 76-1 §7.1), device prohibitions (e.g. §4.13.3.3,
automatic tare for direct sales to the public) and operating ranges of
devices (e.g. tare range §4.6.4). Structure per the official sheet:
``Requirement | Testing procedures | PASSED | FAILED | Remarks``.

Rows are grouped by clause in sheet order. ``mandatory`` flags the
"Compulsory in all cases" block (7.1.1); everything else is marked NA
when the device/feature does not exist on the instrument under test.

VERIFICATION RECORD (P4c, 2026-09-24)
-------------------------------------
Item texts are condensed (not verbatim) transcriptions of
``docs/r076-2-e07.pdf`` pages 50–55, sheet 17.1 (all types except
non-self-indicating). Clause numbers are verbatim. A human reviewer must
confirm the full 7.x/4.x coverage before presenting as production-grade
(phases.md P4c ⚠ gate) — the sheet spans five printed pages.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class ChecklistEntry:
    """One row of the official checklist (sheet 17)."""

    clause: str
    item_key: str
    requirement: str
    test_procedure: str = "visual"
    mandatory: bool = False


CHECKLIST_CATALOG: Final[tuple[ChecklistEntry, ...]] = (
    # --- 7.1.1 Compulsory in all cases (A.3) -------------------------------
    ChecklistEntry("7.1.1", "manufacturer_mark", "Manufacturer's mark or name", mandatory=True),
    ChecklistEntry("7.1.1", "accuracy_class", "Accuracy class", mandatory=True),
    ChecklistEntry("7.1.1", "max_capacity", "Maximum capacity, Max, Max1, Max2, ...", test_procedure="A.3 + 3.3.1", mandatory=True),
    ChecklistEntry("7.1.1", "min_capacity", "Minimum capacity, Min", mandatory=True),
    ChecklistEntry("7.1.1", "scale_interval_e", "Verification scale interval, e, e1, e2, ...", test_procedure="A.3 + 3.3.1", mandatory=True),
    # --- 7.1.2 Compulsory if applicable (A.3) ------------------------------
    ChecklistEntry("7.1.2", "manufacturer_agent", "Name or mark of manufacturer's agent"),
    ChecklistEntry("7.1.2", "serial_number", "Serial number"),
    ChecklistEntry("7.1.2", "associated_units", "Identification marks on separate but associated units"),
    ChecklistEntry("7.1.2", "type_approval_mark", "Type approval mark"),
    ChecklistEntry("7.1.2", "scale_interval_d", "Scale interval, d (d < e)"),
    ChecklistEntry("7.1.2", "software_id", "Software identification (if applicable)"),
    ChecklistEntry("7.1.2", "max_tare_effect", "Maximum tare effect, T (subtractive tare only if T != Max)"),
    ChecklistEntry("7.1.2", "max_safe_load", "Maximum safe load, Lim (if Lim > Max + T)"),
    ChecklistEntry("7.1.2", "special_temperature_limits", "Special temperature limits"),
    ChecklistEntry("7.1.2", "counting_ratio", "Counting ratio"),
    ChecklistEntry("7.1.2", "platform_ratio", "Ratio between weight platform and load platform"),
    ChecklistEntry("7.1.2", "plus_minus_range", "Range of plus/minus indication"),
    # --- 7.1.3 Additional markings (A.3) -----------------------------------
    ChecklistEntry("7.1.3", "not_direct_sales", "Not to be used for direct sales to the public"),
    ChecklistEntry("7.1.3", "exclusive_use", "To be used exclusively for: ..."),
    ChecklistEntry("7.1.3", "stamp_guarantee", "The stamp does not guarantee ... / guarantees only ..."),
    ChecklistEntry("7.1.3", "use_only_as_follows", "To be used only as follows: ..."),
    ChecklistEntry("7.1.3", "special_applications", "Special applications clearly marked (weighing ranges in classes I and II or II and III)", test_procedure="3.2"),
    ChecklistEntry("7.1.3", "near_display_notice", "Near display: not to be used for direct sales to the public (for instruments similar to those used for direct sales to the public)", test_procedure="4.15"),
    # --- 7.1.4 Presentation of markings (A.3) ------------------------------
    ChecklistEntry("7.1.4", "marking_presentation", "Presentation of markings: clear, legible, indelible, in one piece or protected against unauthorized removal (7.1.4.1-7.1.4.3)"),
    ChecklistEntry("7.1.4", "marking_cover", "Protective cover for markings: shatter-proof, sealable, removable without damage"),
    ChecklistEntry("7.1.4", "sealing_provisions", "Provisions for sealing (7.1.5): marks remain visible; sealing spaces for instruments/units"),
    # --- 7.1.5.2 Separately-built main parts -------------------------------
    ChecklistEntry("7.1.5.2", "separate_parts_id", "Identification mark repeated in descriptive markings for separately-built main parts"),
    ChecklistEntry("7.1.5.2", "separate_type_exam", "Identification of devices which have been subject to separate type examination (4.1.1.3 suitability for verification)"),
    # --- 4.x device checks (exist / type / operating range / prohibitions) --
    ChecklistEntry("4.5.2", "zero_setting_type", "Zero-setting device: non-automatic, semi-automatic, automatic (4.2.2-4.2.4); zero-tracking device (4.2.5)"),
    ChecklistEntry("4.6.2", "tare_type", "Tare device: non-automatic, semi-automatic, automatic; subtractive/additive (4.6.2-4.6.3)"),
    ChecklistEntry("4.6.4", "tare_operating_range", "Operating range of the tare device checked experimentally: covers Max (subtractive) and positive/negative range per 4.6.4"),
    ChecklistEntry("4.6.5", "tare_accuracy", "Accuracy of the tare device: after setting tare at any load within its range, weighing accuracy over the whole net range meets 3.5"),
    ChecklistEntry("4.11.1", "lock_unlock", "Devices for locking weighing and setting operations, for integration prohibition and for deception prevention"),
    ChecklistEntry("4.13.3.3", "auto_tare_prohibition", "NO automatic tare device for instruments for direct sales to the public (prohibition 4.13.3.3)"),
    ChecklistEntry("4.14", "price_calculating", "Price-indicating / price-computing devices: correct calculation, printing rules per 4.14"),
    ChecklistEntry("4.16", "levelling", "Levelling system: levelling device and level indicator present and effective (3.9.1.1a); indicators clearly visible"),
    ChecklistEntry("4.18", "tilt_sensor_function", "Automatic tilt sensor (if fitted): releases display switch-off / alarm, inhibits printout and data transmission beyond the limiting tilt"),
    ChecklistEntry("6.2", "cheat_prevention", "Instruments for direct sales to the public: no facilities for fraud (6.2.2): no unforeseen deviation, no deceptive zero indication, etc."),
)


def entries_for(clause_prefixes: tuple[str, ...]) -> tuple[ChecklistEntry, ...]:
    """Catalog rows whose clause starts with one of the given prefixes."""
    return tuple(
        e for e in CHECKLIST_CATALOG if e.clause.startswith(clause_prefixes)
    )


__all__ = [
    "CHECKLIST_CATALOG",
    "ChecklistEntry",
    "entries_for",
]
