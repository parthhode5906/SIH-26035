"""HTTP boundary (Phase 2): FastAPI routers, schemas, deps.

Routers contain zero math and zero SQL beyond delegation — every rule
lives in the service layer, every formula in the engine (rules.md INV-1).
"""

from .main import app

__all__ = ["app"]
