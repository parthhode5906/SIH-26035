# knowledge.md — Engineering Wisdom & Decision Ladders

> **Document class:** Engineering-philosophy annex (companion to [rules.md](rules.md)).
> **Audience:** every contributor and AI agent writing code in this repository.
> **Adoption:** logged as decision D-15 in [memory.md](memory.md) §5.

---

## The Ponytail Ruleset

Before writing any code, you MUST climb down this decision ladder and stop at the first rung that solves the problem:

1. **Does this need to exist?** (If not, skip it — YAGNI).
2. **Does the standard library already provide it?**
3. **Is there a native platform or browser feature?**
4. **Is there an already installed dependency that does this?**
5. **Can it be done in a single line?**
6. **Only if all above fail, write the absolute minimum code that works.**

**NEVER sacrifice validation, security, error handling, or accessibility to save lines.**

---

## How this ladder applies in this repository

- **Rung 2 in practice:** `decimal.Decimal`, `dataclasses`, `enum`, `json`, and `re` cover the entire engine. The only third-party runtime dependency is `pydantic` (ADR-1, HTTP-boundary validation) — every new dependency must climb the ladder first and be logged per rules.md §5.
- **Rung 3 in practice:** pytest's native `pythonpath` ini setting instead of `sys.path` surgery; the Web Serial API instead of native desktop builds; IndexedDB instead of a hand-rolled browser cache.
- **The non-negotiable clause wins:** the engine is deliberately rich in docstrings, type hints, and tests. The ladder governs *what code exists* — never whether that code is validated, tested, and documented (rules.md §5).
