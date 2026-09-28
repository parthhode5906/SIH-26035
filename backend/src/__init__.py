"""Backend package for the OIML R-76 compliance platform.

Package layout follows architecture.md (Clean Architecture):

- ``src.engine``   -- pure metrology domain (math only; no I/O, no frameworks)
- ``src.api``      -- HTTP boundary (Phase 2)
- ``src.services`` -- workflow orchestration (Phase 2)
- ``src.db``       -- persistence (Phase 2)
"""
