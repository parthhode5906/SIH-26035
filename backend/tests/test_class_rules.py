"""Instrument-spec validation tests (Table 3 gate) and rounding module tests."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict

import pytest

from src.engine import (
    AccuracyClass,
    EngineValueError,
    ScaleParameters,
    quantize_to_d,
    validate_instrument_spec,
)


def _spec(case: Dict[str, Any], instruments: Dict[str, Any]) -> ScaleParameters:
    payload = case["instrument"]
    if isinstance(payload, str):  # named reference into the instruments block
        return instruments[payload]
    return ScaleParameters(
        accuracy_class=AccuracyClass(payload["accuracy_class"]),
        max_capacity=payload["max_capacity"],
        min_capacity=payload["min_capacity"],
        verification_scale_interval=payload["verification_scale_interval"],
        display_interval=payload.get("display_interval") or None,
        base_unit=payload.get("base_unit", "kg"),
    )


def test_validation_cases(vectors: Dict[str, Any], instruments: Dict[str, Any]) -> None:
    """Every golden VAL case: either clean or rejected with the right reason."""
    for case in vectors["validation_cases"]:
        spec = _spec(case, instruments)
        if "expect_error_contains" not in case:
            assert validate_instrument_spec(spec) is None, case["id"]
        else:
            with pytest.raises(EngineValueError) as excinfo:
                validate_instrument_spec(spec)
            for fragment in case["expect_error_contains"]:
                assert fragment in str(excinfo.value), (case["id"], str(excinfo.value))


def test_min_above_max_rejected() -> None:
    spec = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="20",
        verification_scale_interval="0.005",
    )
    with pytest.raises(EngineValueError, match="exceeds"):
        validate_instrument_spec(spec)


def test_n_max_is_exact_decimal() -> None:
    spec = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
    )
    assert spec.n_max == Decimal("3000")


def test_quantize_to_d_rounds_to_display_interval() -> None:
    d = Decimal("0.0005")
    assert quantize_to_d(Decimal("0.0085"), d) == Decimal("0.0085")
    assert quantize_to_d(Decimal("0.00851"), d) == Decimal("0.0085")
    assert quantize_to_d(Decimal("0.00875"), d) == Decimal("0.0090")
    assert quantize_to_d(Decimal("1.234"), None) == Decimal("1.234")
    assert quantize_to_d(Decimal("1.234"), Decimal("0")) == Decimal("1.234")
    with pytest.raises(EngineValueError, match="must be > 0"):
        quantize_to_d(Decimal("1"), Decimal("-0.01"))
