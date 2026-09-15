"""Shared fixtures for the engine test suite.

Loads ``golden_vectors.json`` once and exposes fixtures used by every test
module (phases.md P1-7). Vectors are the single source of truth shared with
the future TypeScript mirror (memory.md D-12).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import pytest

from src.engine.contracts import AccuracyClass, ScaleParameters

VECTORS_PATH = Path(__file__).parent / "golden_vectors.json"


@pytest.fixture(scope="session")
def vectors() -> Dict[str, Any]:
    """The full golden-vector document, parsed once per session."""
    return json.loads(VECTORS_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def instruments(vectors: Dict[str, Any]) -> Dict[str, ScaleParameters]:
    """Named instruments from the vector file as domain contracts."""
    built: Dict[str, ScaleParameters] = {}
    for key, spec in vectors["instruments"].items():
        built[key] = ScaleParameters(
            accuracy_class=AccuracyClass(spec["accuracy_class"]),
            max_capacity=spec["max_capacity"],
            min_capacity=spec["min_capacity"],
            verification_scale_interval=spec["verification_scale_interval"],
            display_interval=(
                spec["display_interval"] if spec.get("display_interval") else None
            ),
        )
    return built
