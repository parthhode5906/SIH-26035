"""Band-table edge tests for ALL FOUR classes.

Constants verified against R 76-1 (2006) Section 3.5.1, Table 6 on
2026-09-15 (P1-2 record; see mpe_rules.py module docstring). Edge policy:
bands are (lo, hi] — the upper bound is inclusive, the lower exclusive.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from src.engine import AccuracyClass, EngineValueError, mpe_for_load

E = Decimal("0.01")  # arbitrary interval; bands scale linearly with e


class TestClassIBands:
    """Class I: 0.5e to 50k, 1.0e to 200k, 1.5e above."""

    def test_edges(self) -> None:
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("0"), E) == Decimal("0.005")
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("50000"), E) == Decimal("0.005")
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("50000.000001"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("200000"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("200000.000001"), E) == Decimal("0.015")
        assert mpe_for_load(AccuracyClass.SPECIAL_I, Decimal("1000000"), E) == Decimal("0.015")

    def test_class_i_n_floor_is_enforced(self) -> None:
        from src.engine import EngineValueError, ScaleParameters, validate_instrument_spec

        spec = ScaleParameters(
            accuracy_class=AccuracyClass.SPECIAL_I,
            max_capacity="10",
            min_capacity="1",
            verification_scale_interval="0.001",  # n = 10 000 < 50 000
        )
        with pytest.raises(EngineValueError, match="n = Max/e >= 50000"):
            validate_instrument_spec(spec)


class TestClassIIBands:
    """Class II: 0.5e to 5k, 1.0e to 20k, 1.5e to 100k."""

    def test_edges(self) -> None:
        assert mpe_for_load(AccuracyClass.HIGH_II, Decimal("5000"), E) == Decimal("0.005")
        assert mpe_for_load(AccuracyClass.HIGH_II, Decimal("5000.000001"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.HIGH_II, Decimal("20000"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.HIGH_II, Decimal("20000.000001"), E) == Decimal("0.015")
        assert mpe_for_load(AccuracyClass.HIGH_II, Decimal("100000"), E) == Decimal("0.015")


class TestClassIIIBands:
    """Class III: 0.5e to 500, 1.0e to 2k, 1.5e to 10k."""

    def test_edges(self) -> None:
        assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("500"), E) == Decimal("0.005")
        assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("500.000001"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("2000"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("2000.000001"), E) == Decimal("0.015")
        assert mpe_for_load(AccuracyClass.MEDIUM_III, Decimal("10000"), E) == Decimal("0.015")


class TestClassIIIIBands:
    """Class IIII (initial verification): 0.5e to 50, 1.0e to 200, 1.5e to 1 000."""

    def test_edges(self) -> None:
        assert mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("50"), E) == Decimal("0.005")
        assert mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("50.000001"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("200"), E) == Decimal("0.01")
        assert mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("200.000001"), E) == Decimal("0.015")
        assert mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("1000"), E) == Decimal("0.015")

    def test_above_class_iiii_ceiling_has_no_band(self) -> None:
        """Class IIII tops out at n = 1 000: beyond that is a table gap, not a guess."""
        with pytest.raises(EngineValueError, match="No MPE band covers"):
            mpe_for_load(AccuracyClass.ORDINARY_IIII, Decimal("1001"), E)


class TestAllClasses:
    def test_every_band_carries_verified_provenance(self) -> None:
        """No unverified constant may ever exist in the table (INV-5)."""
        from src.engine.mpe_rules import _MPE_TABLE

        for cls, bands in _MPE_TABLE.items():
            for band in bands:
                assert band.provenance.verified is True, (cls, band.factor)
                assert "Table 6" in band.provenance.source

    def test_monotonic_factor_progression(self) -> None:
        """Sanity: factors never decrease as load increases (all classes)."""
        from src.engine.mpe_rules import _MPE_TABLE

        for bands in _MPE_TABLE.values():
            factors = [band.factor for band in bands]
            assert factors == sorted(factors)
