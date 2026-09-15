"""MPE step tables and the deterministic evaluation core (pure domain).

This module implements the heart of the OIML R-76-1 compliance engine:

1. **MPE bands (Section 5.10 / Table 6 semantics)** — the Maximum
   Permissible Error for a load depends on the load expressed in
   verification scale intervals (``m = L / e``) and the accuracy class.
   Bands are DATA (:data:`_MPE_TABLE`), never scattered conditionals
   (rules.md INV-3). Canonical Class III bands::

       0     <= m <= 500e      -> MPE = 0.5e
       500e  <  m <= 2000e     -> MPE = 1.0e
       2000e <  m <= 10000e    -> MPE = 1.5e

2. **Evaluation core** — :func:`evaluate` runs the full chain:

       E  = I + 0.5e - dL - L          (A.4.4.3, error prior to rounding)
       Ec = E - E0                     (corrected error)
       MPE = band(class, L, e)
       verdict = PASS  iff  |Ec| <= MPE   else FAIL

   The comparison uses the *inclusive* upper bound at the band edge: an
   error exactly equal to the limit PASSES (this is the intent of
   "must not exceed the maximum permissible error").

VERIFICATION RECORD (rules.md INV-5 / phases.md P1-2) -- 2026-09-15
-------------------------------------------------------------------
All four class columns of :data:`_MPE_TABLE` were hand-checked against the
official R 76-1 (2006) PDF, Section 3.5.1, Table 6 (extracted verbatim from
``required rulebook/r076-1-e06.pdf``, page 30 of the PDF)::

    mpe      Class I              Class II             Class III            Class IIII
    0.5e     0 <= m <= 50 000     0 <= m <= 5 000      0 <= m <= 500        0 <= m <= 50
    1.0e     50 000 < m <= 200 000| 5 000 < m <= 20 000 | 500 < m <= 2 000   | 50 < m <= 200
    1.5e     200 000 < m          20 000 < m <= 100 000| 2 000 < m <= 10 000| 200 < m <= 1 000

NOTE (Section 3.5.2): the MPEs *in service* are TWICE the values above.
This engine implements INITIAL VERIFICATION (pattern evaluation) limits.
In-service mode, if ever required, must be an explicit parameter (see
memory.md parking lot) -- never a silent constant change.

The strict gate (:data:`STRICT_VERIFIED_ONLY`) remains in place as a
defense-in-depth mechanism: any future class or band added without a
:class:`Verified` provenance marker is refused automatically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from typing import Final

from .class_rules import VERIFIED_CLASSES
from .contracts import (
    AccuracyClass,
    EngineValueError,
    EvaluationResult,
    Observation,
    ScaleParameters,
    Verdict,
)
from .error_calc import corrected_error, error_prior_to_rounding
from .rounding import INTERNAL_PRECISION, format_quantity

__all__ = [
    "STRICT_VERIFIED_ONLY",
    "Verified",
    "dec",
    "evaluate",
    "mpe_for_load",
    "quantize_to_d",
]

#: When ``True`` (default), evaluating an instrument whose class has not
#: passed the P1-2 human verification gate raises :class:`EngineValueError`.
#: Flip to ``False`` only via a logged decision (memory.md section 5).
STRICT_VERIFIED_ONLY: Final[bool] = True


@dataclass(frozen=True, slots=True)
class Verified:
    """Provenance marker for a regulatory constant.

    Attributes:
        verified: Whether a human has checked the value against the
            official R 76-1 PDF (P1-2 gate).
        source: Citation, e.g. ``"R 76-1 Table 6, Class III column"``.
        checked_at_phase: Tracking identifier of the verification record.
    """

    verified: bool
    source: str
    checked_at_phase: str | None = None


@dataclass(frozen=True, slots=True)
class _MPEBand:
    """One contiguous MPE band: ``lo < m <= hi`` (``lo`` is exclusive-open)."""

    lo: Decimal | None  # None = band starts at zero (m >= 0)
    hi: Decimal | None  # None = unbounded above
    factor: Decimal  # MPE = factor * e
    provenance: Verified = field(
        default_factory=lambda: Verified(verified=False, source="pending P1-2 gate")
    )


# --------------------------------------------------------------------------
# The single source of truth for MPE bands (rules.md INV-3).
# lo is EXCLUSIVE below (bands are (lo, hi]); hi is INCLUSIVE.
# ALL FOUR CLASSES verified against R 76-1 (2006) Section 3.5.1, Table 6
# on 2026-09-15 (P1-2 record; see module docstring for the verbatim source).
# --------------------------------------------------------------------------
_MPE_TABLE: Final[dict[AccuracyClass, tuple[_MPEBand, ...]]] = {
    AccuracyClass.MEDIUM_III: (
        _MPEBand(
            lo=None,
            hi=Decimal("500"),
            factor=Decimal("0.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class III: 0 <= m <= 500 -> 0.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("500"),
            hi=Decimal("2000"),
            factor=Decimal("1.0"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class III: 500 < m <= 2 000 -> 1.0e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("2000"),
            hi=Decimal("10000"),
            factor=Decimal("1.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class III: 2 000 < m <= 10 000 -> 1.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
    ),
    AccuracyClass.SPECIAL_I: (
        _MPEBand(
            lo=None,
            hi=Decimal("50000"),
            factor=Decimal("0.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class I: 0 <= m <= 50 000 -> 0.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("50000"),
            hi=Decimal("200000"),
            factor=Decimal("1.0"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class I: 50 000 < m <= 200 000 -> 1.0e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("200000"),
            hi=None,
            factor=Decimal("1.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class I: 200 000 < m -> 1.5e (unbounded)",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
    ),
    AccuracyClass.HIGH_II: (
        _MPEBand(
            lo=None,
            hi=Decimal("5000"),
            factor=Decimal("0.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class II: 0 <= m <= 5 000 -> 0.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("5000"),
            hi=Decimal("20000"),
            factor=Decimal("1.0"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class II: 5 000 < m <= 20 000 -> 1.0e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("20000"),
            hi=Decimal("100000"),
            factor=Decimal("1.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class II: 20 000 < m <= 100 000 -> 1.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
    ),
    AccuracyClass.ORDINARY_IIII: (
        _MPEBand(
            lo=None,
            hi=Decimal("50"),
            factor=Decimal("0.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class IIII: 0 <= m <= 50 -> 0.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("50"),
            hi=Decimal("200"),
            factor=Decimal("1.0"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class IIII: 50 < m <= 200 -> 1.0e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
        _MPEBand(
            lo=Decimal("200"),
            hi=Decimal("1000"),
            factor=Decimal("1.5"),
            provenance=Verified(
                verified=True,
                source="R 76-1 (2006) Table 6, Class IIII: 200 < m <= 1 000 -> 1.5e",
                checked_at_phase="P1-2 (2026-09-15, official PDF)",
            ),
        ),
    ),
}


def dec(value: float | int | str | Decimal) -> Decimal:
    """Convert a value to :class:`Decimal` exactly, or fail loudly.

    The ONLY sanctioned float -> Decimal escape hatch (rules.md INV-4).
    Python floats are binary rationals; their ``repr`` is the shortest
    string that round-trips, so ``str(value)`` preserves the decimal value
    the user *meant* (``str(0.1) == "0.1"``) instead of the binary artifact
    (``Decimal(0.1) == 0.1000000000000000055511151231257827...``).

    Args:
        value: A float, int, numeric string, or Decimal.

    Returns:
        The exact Decimal interpretation of the value's decimal meaning.

    Raises:
        PrecisionError: If ``value`` is a non-finite float (NaN/inf).
        EngineValueError: If the value cannot be parsed as a decimal.
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            from .contracts import PrecisionError

            raise PrecisionError(
                f"dec(): NaN/Infinity floats are not physical quantities: {value!r}."
            )
        return Decimal(str(value))
    from .contracts import coerce_decimal

    return coerce_decimal(value, "dec()")


# --------------------------------------------------------------------------
# MPE lookup
# --------------------------------------------------------------------------


def mpe_for_load(
    accuracy_class: AccuracyClass, load_in_e: Decimal, e: Decimal
) -> Decimal:
    """Return the MPE magnitude (in base unit) for a load on a class.

    Args:
        accuracy_class: The instrument's accuracy class.
        load_in_e: The applied load expressed in intervals (``m = L / e``).
            Must be finite and >= 0.
        e: The verification scale interval; must be > 0.

    Returns:
        ``factor * e`` for the band containing ``load_in_e``.

    Raises:
        EngineValueError: If the accuracy class has not passed the P1-2
            human verification gate (strict mode), if ``e <= 0``, if the
            load is negative, or if no band covers the load (possible only
            if the class's band table has a gap — a defect that must never
            be swallowed).
    """
    if STRICT_VERIFIED_ONLY and accuracy_class not in VERIFIED_CLASSES:
        raise EngineValueError(
            f"Class {accuracy_class.value} MPE constants have not passed the "
            "P1-2 human verification gate (memory.md section 7, D-09). "
            "Refusing to emit a legal verdict on unverified constants."
        )
    if e <= 0:
        raise EngineValueError(
            f"verification_scale_interval (e) must be > 0; got {e}."
        )
    if load_in_e < 0:
        raise EngineValueError(
            f"load_in_e must be >= 0; got {load_in_e}."
        )
    bands = _MPE_TABLE[accuracy_class]
    with localcontext() as ctx:
        ctx.prec = INTERNAL_PRECISION
        for band in bands:
            above_lo = band.lo is None or load_in_e > band.lo
            below_hi = band.hi is None or load_in_e <= band.hi
            if above_lo and below_hi:
                return band.factor * e
    # No covering band: table gap. Never guess — raise (rules.md section 7).
    raise EngineValueError(
        f"No MPE band covers load {load_in_e}e for class "
        f"{accuracy_class.value}; MPE table gap is a defect."
    )


# --------------------------------------------------------------------------
# Full evaluation core
# --------------------------------------------------------------------------


def evaluate(scale: ScaleParameters, observation: Observation) -> EvaluationResult:
    """Run the full deterministic evaluation chain for one observation.

    Chain (all exact Decimal arithmetic):

        1. E  = I + 0.5e - dL - L       (A.4.4.3)
        2. Ec = E - E0                  (corrected error)
        3. MPE = band(class, L/e, e)    (P1-2 verification gate inside)
        4. verdict = PASS iff |Ec| <= MPE

    Domain guards enforced here (fail-fast, auditor-readable messages):

        - ``dL`` must not exceed ``e`` (the changeover point lies within
          one interval; a larger dL is a transcription error).
        - ``L`` must not exceed ``Max`` (test loads live in the legal range).

    Args:
        scale: Validated instrument parameters (call
            :func:`validate_instrument_spec` first at the service layer).
        observation: The raw reading.

    Returns:
        The immutable :class:`EvaluationResult` bundle.

    Raises:
        EngineValueError: On any domain violation (unverified class via the
            gate inside ``mpe_for_load``, dL > e, L > Max, non-positive e).
    """
    if observation.additional_load > scale.verification_scale_interval:
        raise EngineValueError(
            f"additional_load (dL) {observation.additional_load} must not "
            f"exceed verification_scale_interval (e) "
            f"{scale.verification_scale_interval}: the changeover point lies "
            "within one interval; check the reading."
        )
    if observation.applied_load > scale.max_capacity:
        raise EngineValueError(
            f"applied_load (L) {observation.applied_load} exceeds "
            f"max_capacity (Max) {scale.max_capacity}: test loads must lie "
            "within the legal range."
        )

    e = scale.verification_scale_interval

    with localcontext() as ctx:
        ctx.prec = INTERNAL_PRECISION
        load_in_e = observation.applied_load / e
        error_prior = error_prior_to_rounding(observation, e)
        ec = corrected_error(error_prior, observation.zero_error)
        mpe_limit = mpe_for_load(scale.accuracy_class, load_in_e, e)
        verdict = Verdict.PASS if abs(ec) <= mpe_limit else Verdict.FAIL

    mpe_in_e = mpe_limit / e  # exact: factor * e / e
    message = (
        f"Corrected error {format_quantity(ec)} "
        f"{'within' if verdict is Verdict.PASS else 'exceeds'} MPE "
        f"±{format_quantity(mpe_limit)} ({format_quantity(mpe_in_e)}e) at "
        f"{format_quantity(load_in_e)}e for Class {scale.accuracy_class.value}."
    )

    return EvaluationResult(
        error_prior=error_prior,
        corrected_error=ec,
        mpe_limit=mpe_limit,
        mpe_in_e=format_quantity(mpe_in_e),
        load_in_e=format_quantity(load_in_e),
        verdict=verdict,
        message=message,
    )


# Re-export so that ``engine.quantize_to_d`` resolves (presentation-only
# rounding for UI echo; never used in verdict computation).
from .rounding import quantize_to_d  # noqa: E402  (intentional re-export)
