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

from src.engine import AccuracyClass, EngineValueError, Verdict, evaluate
from src.engine.mpe_rules import (
    STRICT_VERIFIED_ONLY,
    EvaluationMode,
    ScaleParameters,
    Observation,
    mpe_for_load,
)


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
    """Run every golden evaluation case; assert exact expected quantities.

    Cases may carry ``mode`` (default initial_verification) — the shared
    vector file pins both Table 6 regimes (D-19)."""
    assert len(vectors["evaluation_cases"]) == 15, "vector file drifted"
    for case in vectors["evaluation_cases"]:
        scale = instruments[case["instrument"]]
        obs_in = case["observation"]
        from src.engine import EvaluationMode, Observation

        observation = Observation(
            applied_load=obs_in["applied_load"],
            indication=obs_in["indication"],
            additional_load=obs_in["additional_load"],
            zero_error=obs_in["zero_error"],
            second_indication=obs_in.get("second_indication"),
        )
        mode = EvaluationMode(case.get("mode", "initial_verification"))
        result = evaluate(
            scale, observation, mode=mode, test_type=case.get("test_type")
        )
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


# --------------------------------------------------------------------------
# In-service mode (Section 3.5.2: 2× Table 6) — decision D-19
# --------------------------------------------------------------------------


def _iii_scale() -> "ScaleParameters":
    return ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
    )


def _obs(load: str, indication: str) -> "Observation":
    return Observation(applied_load=load, indication=indication)


def test_in_service_mpe_is_exactly_twice_table_6() -> None:
    """§3.5.2: in-service MPE = 2× the initial-verification band value."""
    e = Decimal("0.005")
    for load_in_e in ("100", "1000", "3000"):
        m = Decimal(load_in_e)
        base = mpe_for_load(AccuracyClass.MEDIUM_III, m, e)
        doubled = mpe_for_load(
            AccuracyClass.MEDIUM_III, m, e, EvaluationMode.IN_SERVICE
        )
        assert doubled == base * 2, (load_in_e, base, doubled)


def test_initial_verification_is_the_default_mode() -> None:
    """No mode argument must equal INITIAL_VERIFICATION (D-19: explicit only)."""
    e = Decimal("0.005")
    assert mpe_for_load(
        AccuracyClass.MEDIUM_III, Decimal("3000"), e
    ) == mpe_for_load(
        AccuracyClass.MEDIUM_III, Decimal("3000"), e,
        EvaluationMode.INITIAL_VERIFICATION,
    )


def test_in_service_mode_flips_borderline_verdict() -> None:
    """A reading failing initial verification at 2.0e passes in service.

    Load 7.5 kg = 1500e (1.0e band): indication 7.5075 gives
    Ec = +0.0100 = 2.0e — FAIL at initial verification (|Ec| > 1.0e),
    PASS in service (|Ec| <= 2.0e).
    """
    scale = _iii_scale()
    obs = _obs("7.5", "7.5075")
    initial = evaluate(scale, obs)
    assert initial.verdict is Verdict.FAIL
    in_service = evaluate(scale, obs, EvaluationMode.IN_SERVICE)
    assert in_service.verdict is Verdict.PASS
    assert in_service.mpe_limit == initial.mpe_limit * 2


def test_mode_multiplier_is_exact_decimal() -> None:
    assert EvaluationMode.INITIAL_VERIFICATION.mpe_multiplier == Decimal("1")
    assert EvaluationMode.IN_SERVICE.mpe_multiplier == Decimal("2")



# ---------------------------------------------------------------------------
# Discrimination (3.8.2.2 digital / A.4.8.2) and the fixed 1e no-load
# temperature limit (3.9.2.3) - pure engine branches (P4b).
# ---------------------------------------------------------------------------


def test_discrimination_pass_at_exactly_d() -> None:
    """I2 - I1 == d is an unambiguous shift: PASS (edge inclusive)."""
    scale = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
        display_interval="0.001",
    )
    obs = Observation(
        applied_load="5", indication="5.000", additional_load="0.001",
        second_indication="5.001",
    )
    result = evaluate(scale, obs)
    assert result.verdict is Verdict.PASS
    assert result.corrected_error == Decimal("0.001")
    assert result.mpe_limit == Decimal("0.001")


def test_discrimination_fail_below_d() -> None:
    scale = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
        display_interval="0.001",
    )
    obs = Observation(
        applied_load="5", indication="5.000", additional_load="0.0005",
        second_indication="5.0005",
    )
    result = evaluate(scale, obs)
    assert result.verdict is Verdict.FAIL


def test_discrimination_requires_d() -> None:
    """No display_interval recorded -> refuse with a readable error."""
    scale = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
    )
    obs = Observation(
        applied_load="5", indication="5.000", second_indication="5.001",
    )
    with pytest.raises(EngineValueError, match="display_interval"):
        evaluate(scale, obs)


def test_discrimination_d_below_5mg_rejected() -> None:
    """A.4.8.2 applies only to d >= 5 mg (gram-denominated, unit-aware)."""
    scale = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
        display_interval="0.001",
    )
    obs = Observation(
        applied_load="5", indication="5.000", second_indication="5.001",
    )
    # d = 1 g = 1000 mg >= 5 mg -> fine. Now the sub-threshold instrument:
    fine = ScaleParameters(
        accuracy_class=AccuracyClass.SPECIAL_I,
        max_capacity="220",          # gram-denominated: 220 g balance
        min_capacity="0.01",
        verification_scale_interval="0.001",   # e = 1 mg
        display_interval="0.001",    # d = 1 mg < 5 mg -> out of scope
        base_unit="g",
    )
    obs_g = Observation(
        applied_load="100", indication="100", second_indication="100.0005",
    )
    with pytest.raises(EngineValueError, match="5 mg"):
        evaluate(fine, obs_g)


def test_discrimination_backwards_indication_rejected() -> None:
    scale = ScaleParameters(
        accuracy_class=AccuracyClass.MEDIUM_III,
        max_capacity="15",
        min_capacity="0.5",
        verification_scale_interval="0.005",
        display_interval="0.001",
    )
    obs = Observation(
        applied_load="5", indication="5.000", second_indication="4.999",
    )
    with pytest.raises(EngineValueError, match="INCREASE"):
        evaluate(scale, obs)


def test_temperature_no_load_fixed_1e_limit() -> None:
    """3.9.2.3: zero drift judged against 1e, not the 0.5e band.

    I = 0.004, dL = 0.001, E0 = 0 -> E = 0.004 + 0.0025 - 0.001 = +0.0055
    = 1.1e > 1e -> FAIL, with the asserted limit exactly e (not 0.5e).
    """
    scale = _iii_scale()
    obs = Observation(
        applied_load="0", indication="0.004", additional_load="0.001",
        zero_error="0",
    )
    result = evaluate(scale, obs, test_type="temperature_no_load")
    assert result.verdict is Verdict.FAIL
    assert result.mpe_limit == Decimal("0.005")
    assert result.mpe_in_e == "1.000000"
    # And the same numeric row without the test_type stays on the band:
    band = evaluate(scale, obs)
    assert band.mpe_limit == Decimal("0.0025")


def test_temperature_no_load_pass() -> None:
    """+2.5 g (0.5e) drift passes the 1e rule."""
    scale = _iii_scale()
    obs = Observation(applied_load="0", indication="0", additional_load="0.0025")
    result = evaluate(scale, obs, test_type="temperature_no_load")
    assert result.verdict is Verdict.PASS
    assert result.mpe_limit == Decimal("0.005")


def test_temperature_no_load_rejects_loaded_row() -> None:
    scale = _iii_scale()
    obs = Observation(applied_load="1", indication="1")
    with pytest.raises(EngineValueError, match="no-load"):
        evaluate(scale, obs, test_type="temperature_no_load")


# ---------------------------------------------------------------------------
# P4c fixed-limit family: equilibrium (1e), EMC (1e), tilting (2e no-load).
# Warm-up / span stability / endurance deliberately use the class band.
# ---------------------------------------------------------------------------


def test_equilibrium_fixed_1e_limit() -> None:
    """A.4.12 / 4.4.2: print/store deviation under disturbance <= 1e."""
    scale = _iii_scale()
    # I = 0.006, dL = 0.001 -> E = +0.0075 = 1.5e: FAILS 1e (passes 1.5e band).
    obs = Observation(applied_load="0", indication="0.006", additional_load="0.001")
    result = evaluate(scale, obs, test_type="equilibrium")
    assert result.verdict is Verdict.FAIL
    assert result.mpe_limit == Decimal("0.005")
    # Same numeric row without the test_type stays on the 0.5e band:
    assert evaluate(scale, obs).mpe_limit == Decimal("0.0025")


def test_emc_deviation_within_1e_passes() -> None:
    """B.3.x: indication deviation <= e passes (no significant fault)."""
    scale = _iii_scale()
    obs = Observation(applied_load="0", indication="0", additional_load="0.004")
    result = evaluate(scale, obs, test_type="emc_disturbances")
    assert result.verdict is Verdict.PASS
    assert result.mpe_limit == Decimal("0.005")


def test_tilting_no_load_uses_2e() -> None:
    """3.9.1.1: zero shift under limiting tilt <= 2e."""
    scale = _iii_scale()
    # Zero shift +1.5e: passes 2e (would fail the 0.5e band).
    obs = Observation(applied_load="0", indication="0.005", additional_load="0.0025")
    result = evaluate(scale, obs, test_type="tilting")
    assert result.verdict is Verdict.PASS
    assert result.mpe_limit == Decimal("0.010")


def test_tilting_loaded_uses_class_band() -> None:
    """Loaded tilting rows: mpe for the load with tilted-zero correction."""
    scale = _iii_scale()
    obs = Observation(applied_load="5", indication="5.000", additional_load="0")
    result = evaluate(scale, obs, test_type="tilting")
    assert result.mpe_limit == Decimal("0.0050")  # 1.0e band at 1000e


def test_warm_up_span_endurance_use_class_band() -> None:
    """A.5.2 / B.4 / A.6 say 'within the mpe for the applied load'."""
    scale = _iii_scale()
    obs = Observation(applied_load="5", indication="5.000")
    for tt in ("warm_up", "span_stability", "endurance"):
        result = evaluate(scale, obs, test_type=tt)
        assert result.mpe_limit == Decimal("0.0050"), tt  # 1.0e band at 1000e
