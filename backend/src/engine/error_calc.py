"""Error formulas — OIML R-76-1 Section A.4.4.3 (pure domain module).

Two exact formulas:

1. Error prior to rounding::

       E = I + 0.5e - dL - L

   where
       I  = indication (displayed value at the changeover point),
       e  = verification scale interval,
       dL = additional load (dL) that pushes the indication to the next
            digital step — used to eliminate digital rounding bias,
       L  = applied load (certified mass).

2. Corrected error::

       Ec = E - E0

   where E0 is the error calculated at zero prior to loading (accounts for
   initial zero-setting / zero-tracking drift).

Both functions are exact: inputs are Decimals, operations are +/-
(terminating, never context-rounded at 28 significant digits for realistic
magnitudes). No rounding is applied here — presentation quantization lives
in ``rounding`` and never feeds back into verdicts.
"""

from __future__ import annotations

from decimal import Decimal

from .contracts import EngineValueError, Observation

__all__ = [
    "_corrected_error",
    "_error_prior_to_rounding",
    "corrected_error",
    "error_prior_to_rounding",
]


def error_prior_to_rounding(
    observation: Observation, verification_scale_interval: Decimal
) -> Decimal:
    """Compute E = I + 0.5e - dL - L (OIML R-76-1 A.4.4.3).

    Args:
        observation: The raw reading (I, dL, L populated; E0 not used here).
        verification_scale_interval: The instrument's ``e``; must be > 0.

    Returns:
        The exact, signed error prior to rounding.

    Raises:
        EngineValueError: If ``e <= 0``.
    """
    e = verification_scale_interval
    if e <= 0:
        raise EngineValueError(
            f"verification_scale_interval (e) must be > 0; got {e}."
        )
    half_e = e / 2  # exact: e has terminating digits and 2 | 10
    return (
        observation.indication
        + half_e
        - observation.additional_load
        - observation.applied_load
    )


def corrected_error(error_prior: Decimal, zero_error: Decimal) -> Decimal:
    """Compute Ec = E - E0.

    Args:
        error_prior: E from :func:`error_prior_to_rounding`.
        zero_error: E0, the error at zero prior to loading (may be negative).

    Returns:
        The exact, signed corrected error — the quantity legally judged
        against the MPE.
    """
    return error_prior - zero_error


# Short aliases matching the A.4.4.3 symbols (E, Ec) used across the codebase.
_error_prior_to_rounding = error_prior_to_rounding
_corrected_error = corrected_error
