"""Pydantic ingress contract tests: numeric strings in, floats out, Decimal through."""

from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.engine.models import EvaluateRequest, ObservationIn, ScaleParametersIn

VALID_SCALE = {
    "accuracy_class": "III",
    "max_capacity": "15",
    "min_capacity": "0.5",
    "verification_scale_interval": "0.005",
    "display_interval": "0.0005",
}


def test_numeric_strings_cast_to_decimal() -> None:
    scale = ScaleParametersIn(**VALID_SCALE)
    assert scale.max_capacity == Decimal("15")
    assert isinstance(scale.max_capacity, Decimal)


def test_scientific_notation_string_accepted() -> None:
    payload = dict(VALID_SCALE, verification_scale_interval="5e-3")
    scale = ScaleParametersIn(**payload)
    assert scale.verification_scale_interval == Decimal("0.005")


def test_binary_float_rejected() -> None:
    with pytest.raises(ValidationError) as excinfo:
        ScaleParametersIn(**dict(VALID_SCALE, max_capacity=15.0))
    assert "forbidden" in str(excinfo.value)


def test_nan_and_infinity_rejected() -> None:
    with pytest.raises(ValidationError):
        ScaleParametersIn(**dict(VALID_SCALE, max_capacity="NaN"))
    with pytest.raises(ValidationError):
        ScaleParametersIn(**dict(VALID_SCALE, min_capacity="Infinity"))


def test_negative_load_rejected() -> None:
    with pytest.raises(ValidationError):
        ObservationIn(applied_load="-1", indication="0")


def test_zero_e_rejected() -> None:
    with pytest.raises(ValidationError):
        ScaleParametersIn(**dict(VALID_SCALE, verification_scale_interval="0"))


def test_extra_fields_forbidden() -> None:
    with pytest.raises(ValidationError):
        ScaleParametersIn(**dict(VALID_SCALE, hacker_field="1"))


def test_bad_class_string_rejected() -> None:
    with pytest.raises(ValidationError):
        ScaleParametersIn(**dict(VALID_SCALE, accuracy_class="V"))


def test_full_request_round_trip_to_domain() -> None:
    request = EvaluateRequest(
        scale=ScaleParametersIn(**VALID_SCALE),
        observation=ObservationIn(
            applied_load="5", indication="5.006", additional_load="0", zero_error="0"
        ),
    )
    scale = request.scale.to_domain()
    observation = request.observation.to_domain()

    from src.engine import evaluate

    result = evaluate(scale, observation)
    assert result.verdict.value == "FAIL"
    assert result.corrected_error == Decimal("0.0085")
