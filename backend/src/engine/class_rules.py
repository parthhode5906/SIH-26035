"""Instrument specification validation — OIML R-76-1 Table 3 (pure domain).

An instrument's parameters must be mutually consistent BEFORE any test data
is evaluated. This module is the single gate for that validation
(phases.md P1-5, ``engine/class_rules.py``).

Table 3 data (metrological classes — parameter ranges)::

    Class   Min (lower bound)     n = Max / e
    I       (unconstrained)       n >= 50,000
    II      50e                   5,000 <= n <= 100,000
    III     20e                   100 <= n <= 10,000
    IIII    10e                   10 <= n <= 1,000

Additional structural rules enforced here:

- ``Max`` must be a positive integer multiple of ``e`` (n integral).
- ``Min <= Max``.
- ``d <= e`` when ``d`` is known (R 76-1 Section 3.2.2; the standard may
  additionally require ``e > d`` for Classes I/II — confirm at the P1-2
  verification gate before tightening).

VERIFICATION RECORD (rules.md INV-5 / phases.md P1-2) -- 2026-09-15
-------------------------------------------------------------------
``VERIFIED_CLASSES`` lists the classes whose Table 3 / Table 6 constants
have been human-checked against the official R 76-1 PDF. ALL FOUR classes
were verified on 2026-09-15 against the extracted official PDF (Table 6:
page 30; Table 3: page 27 of ``r076-1-e06.pdf``). Never remove a class
from this set without a new verification record.
"""

from __future__ import annotations

from decimal import Decimal, localcontext
from typing import Final

from .contracts import AccuracyClass, EngineValueError, ScaleParameters
from .rounding import INTERNAL_PRECISION

__all__ = ["VERIFIED_CLASSES", "validate_instrument_spec"]

#: Classes whose regulatory constants are human-verified (P1-2 gate).
#: All four verified 2026-09-15 against the official R 76-1 (2006) PDF.
VERIFIED_CLASSES: Final[frozenset[AccuracyClass]] = frozenset(
    {
        AccuracyClass.SPECIAL_I,
        AccuracyClass.HIGH_II,
        AccuracyClass.MEDIUM_III,
        AccuracyClass.ORDINARY_IIII,
    }
)

#: (lower bound on n inclusive, upper bound on n inclusive); None = unbounded.
_N_RANGE: Final[dict[AccuracyClass, tuple[Decimal | None, Decimal | None]]] = {
    AccuracyClass.SPECIAL_I: (Decimal("50000"), None),
    AccuracyClass.HIGH_II: (Decimal("5000"), Decimal("100000")),
    AccuracyClass.MEDIUM_III: (Decimal("100"), Decimal("10000")),
    AccuracyClass.ORDINARY_IIII: (Decimal("10"), Decimal("1000")),
}

#: Minimum capacity expressed in units of e; None = unconstrained.
_MIN_CAPACITY_IN_E: Final[dict[AccuracyClass, Decimal | None]] = {
    AccuracyClass.SPECIAL_I: None,
    AccuracyClass.HIGH_II: Decimal("50"),
    AccuracyClass.MEDIUM_III: Decimal("20"),
    AccuracyClass.ORDINARY_IIII: Decimal("10"),
}


def validate_instrument_spec(scale: ScaleParameters) -> None:
    """Validate an instrument's parameters against R 76-1 Table 3.

    Args:
        scale: The instrument parameters to validate.

    Raises:
        EngineValueError: With a specific, auditor-readable message on the
            first violated rule. A compliant spec returns ``None``.
    """
    e = scale.verification_scale_interval
    if e <= 0:
        raise EngineValueError(
            f"verification_scale_interval (e) must be > 0; got {e}."
        )
    if scale.max_capacity <= 0:
        raise EngineValueError(
            f"max_capacity (Max) must be > 0; got {scale.max_capacity}."
        )
    if scale.min_capacity > scale.max_capacity:
        raise EngineValueError(
            f"min_capacity (Min) {scale.min_capacity} exceeds "
            f"max_capacity (Max) {scale.max_capacity}."
        )

    with localcontext() as ctx:
        ctx.prec = INTERNAL_PRECISION
        n = scale.max_capacity / e

    if n != n.to_integral_value():
        raise EngineValueError(
            "max_capacity (Max) must be an integer multiple of "
            f"verification_scale_interval (e): n = Max/e = {n}."
        )

    lo, hi = _N_RANGE[scale.accuracy_class]
    if lo is not None and n < lo:
        raise EngineValueError(
            f"Class {scale.accuracy_class.value} requires n = Max/e >= {lo}; "
            f"got n = {n}."
        )
    if hi is not None and n > hi:
        raise EngineValueError(
            f"Class {scale.accuracy_class.value} requires n = Max/e <= {hi}; "
            f"got n = {n}."
        )

    min_e = _MIN_CAPACITY_IN_E[scale.accuracy_class]
    if min_e is not None and scale.min_capacity < min_e * e:
        raise EngineValueError(
            f"Class {scale.accuracy_class.value} requires "
            f"min_capacity (Min) >= {min_e}e = {min_e * e}; "
            f"got {scale.min_capacity}."
        )

    d = scale.display_interval
    if d is not None and d > 0 and d > e:
        raise EngineValueError(
            f"display_interval (d) {d} must not exceed "
            f"verification_scale_interval (e) {e} (R 76-1 3.2.2; "
            "Classes I/II may require e > d — confirm at P1-2 gate)."
        )
