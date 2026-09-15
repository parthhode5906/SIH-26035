"""OIML R-76 metrology engine.

This package is the PURE domain layer. Binding rules (rules.md INV-1 / INV-2):

- No I/O, no network, no database, no clock, no randomness.
- No framework imports in the pure modules (contracts, class_rules,
  error_calc, rounding, mpe_rules). Pydantic appears ONLY in ``models.py``,
  the ingress boundary that casts JSON numeric strings to Decimal before
  any engine function runs.
- All arithmetic uses ``decimal.Decimal``. IEEE 754 floats are forbidden on
  metrology values (rules.md INV-4); floats raise ``PrecisionError`` at
  contract construction.

Public surface (consumed by the service layer in Phase 2):

- :class:`ScaleParameters`   -- validated instrument identity
- :class:`Observation`       -- one raw test reading
- :class:`EvaluationResult`  -- immutable evaluation verdict bundle
- :func:`evaluate`           -- full evaluation (E, Ec, MPE, verdict)
- :func:`mpe_for_load`       -- MPE lookup for a load
- :func:`corrected_error`    -- E and Ec calculation
- :func:`validate_instrument_spec` -- class/Max/Min/e validity gate
- :func:`dec`                -- the ONLY sanctioned float->Decimal cast
- :func:`quantize_to_d`      -- display-interval rounding for UI only
"""

from .class_rules import validate_instrument_spec
from .contracts import (
    AccuracyClass,
    EngineValueError,
    EvaluationResult,
    Observation,
    PrecisionError,
    ScaleParameters,
    Verdict,
    coerce_decimal,
)
from .error_calc import (
    _corrected_error,
    _error_prior_to_rounding,
    corrected_error,
    error_prior_to_rounding,
)
from .mpe_rules import (
    dec,
    evaluate,
    mpe_for_load,
    quantize_to_d,
)

__all__ = [
    "AccuracyClass",
    "EngineValueError",
    "EvaluationResult",
    "Observation",
    "PrecisionError",
    "ScaleParameters",
    "Verdict",
    "_corrected_error",
    "_error_prior_to_rounding",
    "corrected_error",
    "error_prior_to_rounding",
    "coerce_decimal",
    "dec",
    "evaluate",
    "mpe_for_load",
    "quantize_to_d",
    "validate_instrument_spec",
]
