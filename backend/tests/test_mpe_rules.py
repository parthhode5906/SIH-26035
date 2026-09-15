"""Golden-vector evaluation tests (phases.md P1-7).

Every ``evaluation_cases`` entry in golden_vectors.json is executed through
:func:`src.engine.evaluate` and compared against expected values parsed as
Decimal (never float), so verdicts, MPE limits, and serialized quantities
are all checked exactly.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict

import pytest

from src.engine import AccuracyClass, Verdict, evaluate
from src.engine.mpe_rules import STRICT_VERIFIED_ONLY, mpe_for_load


def _dec(value: str) -> Decimal:
    return Decimal(value)


def _evaluation_cases(vectors: Dict[str, Any]) -> list[Any]:
    cases: list[Any] = []
    for case in vectors["evaluation_cases"]:
        instrument = vectors["instruments"][case["instrument"]]
        cases.append(
            pytest.param(
                instrument,
                case["observation"],
                case["expected"],
                case["id"],
                id=case["id"],
            )
        )
    return cases


def test_all_evaluation_cases(
    vectors: Dict[str, Any], instruments: Dict[str, Any]
) -> None:
    """Run every golden evaluation case; assert exact expected quantities."""
    assert len(vectors["evaluation_cases"]) == 10, "vector file drifted"
    for case in vectors["evaluation_cases"]:
        scale = instruments[case["instrument"]]
        obs_in = case["observation"]
        from src.engine import Observation

        observation = Observation(
            applied_load=obs_in["applied_load"],
            indication=obs_in["indication"],
            additional_load=obs_in["additional_load"],
            zero_error=obs_in["zero_error"],
        )
        result = evaluate(scale, observation)
        expected = case["expected"]

        assert result.verdict is Verdict(expected["verdict"]), case["id"]
        assert result.error_prior == _dec(expected["error_prior"]), case["id"]
        assert result.corrected_error == _dec(expected["corrected_error"]), case["id"]
        assert result.mpe_limit == _dec(expected["mpe_limit"]), case["id"]
        assert result.mpe_in_e == expected["mpe_in_e"], case["id"]
        assert result.load_in_e == expected["load_in_e"], case["id"]
        for fragment in expected["message_contains"]:
            assert fragment in result.message, (case["id"], result.message)


def test_serialized_quantities_are_six_decimal_places(
    vectors: Dict[str, Any], instruments: Dict[str, Any]
) -> None:
    """Reported quantities render in fixed 6-decimal notation (never 1E+3)."""
    case = vectors["evaluation_cases"][6]  # III-07: load_in_e = 3000
    from src.engine import Observation

    scale = instruments[case["instrument"]]
    obs_in = case["observation"]
    result = evaluate(
        scale,
        Observation(
            applied_load=obs_in["applied_load"],
            indication=obs_in["indication"],
            additional_load=obs_in["additional_load"],
            zero_error=obs_in["zero_error"],
        ),
    )
    assert result.load_in_e == "3000.000000"
    assert "E+" not in result.load_in_e
    payload = result.to_dict()
    assert payload["verdict"] == "PASS"
    assert all(isinstance(v, str) for v in payload.values())


def test_class_iii_band_lookup_table() -> None:
    """Direct band lookups: edges are inclusive on the upper bound."""
    e = Decimal("0.005")
    assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("0"), e) == Decimal("0.0025")
    assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("500"), e) == Decimal("0.0025")
    assert mpe_for_load(
        AccuracyClass.MEDIUM_III, Decimal("500.000001"), e
    ) == Decimal("0.005")
    assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("2000"), e) == Decimal("0.005")
    assert mpe_for_load(
        AccuracyClass.MEDIUM_III, Decimal("2000.000001"), e
    ) == Decimal("0.0075")
    assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("10000"), e) == Decimal(
        "0.0075"
    )


def test_strict_gate_blocks_unverified_class(monkeypatch: pytest.MonkeyPatch) -> None:
    """Defense-in-depth: a class without verified provenance must refuse.

    All four real classes passed the P1-2 gate on 2026-09-15, so the gate is
    exercised by clearing the verified set (simulates a future class being
    added without sign-off).
    """
    import src.engine.mpe_rules as mpe_module

    assert mpe_module.STRICT_VERIFIED_ONLY is True
    monkeypatch.setattr(mpe_module, "VERIFIED_CLASSES", frozenset())
    with pytest.raises(Exception, match="P1-2 human verification gate"):
        mpe_for_load(AccuracyClass.HIGH_II, Decimal("100"), Decimal("0.01"))


def test_engine_rejects_float_inputs(vectors: Dict[str, Any]) -> None:
    """rules.md INV-4: floats must never enter the engine."""
    from src.engine import Observation, PrecisionError, ScaleParameters

    with pytest.raises(PrecisionError, match="forbidden"):
        Observation(applied_load=5.0, indication="5.000")  # type: ignore[arg-type]
    with pytest.raises(PrecisionError, match="forbidden"):
        ScaleParameters(
            accuracy_class=AccuracyClass.MEDIUM_III,
            max_capacity=15.0,  # type: ignore[arg-type]
            min_capacity="0.5",
            verification_scale_interval="0.005",
        )


def test_float_escape_hatch_dec_uses_decimal_meaning() -> None:
    """dec() casts via str: 0.1 means exactly one tenth, not the binary artifact."""
    from src.engine import dec

    assert dec(0.1) == Decimal("0.1")
    assert dec(2.675) == Decimal("2.675")
    assert dec(7) == Decimal("7")
    assert dec("1.5e-3") == Decimal("0.0015")
    with pytest.raises(Exception):
        dec(float("nan"))
