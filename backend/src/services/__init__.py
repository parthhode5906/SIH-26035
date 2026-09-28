"""Service layer: orchestration between API routers, DB, and the engine.

Routers never touch the DB or the engine directly — every write path and
every evaluation flows through these modules (architecture.md §3).
"""
