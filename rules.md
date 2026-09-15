# rules.md — Binding Rules for Any AI Agent (and Humans Too)

> **Document class:** Governing law (authority level 1 of 5 — the highest).
> **Audience:** every AI agent, in any tool (Cursor, Claude, Copilot, Codebuff, etc.), and every human contributor.
> **If you take over this repo mid-project and read only one file: this is that file.**

---

## 1. Document Hierarchy (who wins when docs disagree)

```
1. rules.md          ← law (this file) — always wins
2. memory.md         ← current state + decisions (append-only log)
3. architecture.md   ← structural truth (folders, data model, APIs, ADRs)
4. phases.md         ← what to build next (tasks, definitions of done)
5. design.md         ← how things look and behave (UI/UX, tokens, PDF spec)
   knowledge.md      ← engineering-philosophy annex (Ponytail decision ladder)
```

- A lower document never overrides a higher one. If you spot a contradiction between documents, **stop and fix the documents in the same change** — never code against a contradiction.
- If code contradicts architecture.md, treat it as a defect: fix the code, or (if the design intentionally changed) update architecture.md + log the decision in memory.md §5 in the same commit.

---

## 2. Core Identity of This Project (never lose sight of this)

You are building a **legal metrology instrument** in software form. Its output decides whether commercial weighing devices may be used in trade in India. A wrong calculation does not just fail a demo — in production it would approve faulty scales that defraud consumers.

Therefore: **deterministic, verifiable correctness beats every other concern** (speed, elegance, features). When in doubt, choose the boring, auditable option.

---

## 3. Startup Ritual (mandatory, every session)

Before writing or modifying ANY code:

1. Read [memory.md](memory.md) §3 (status snapshot) and §7 (parking lot).
2. Read this file (you did).
3. Read [phases.md](phases.md) and locate the active phase + its checklist.
4. Consult [architecture.md](architecture.md) for anything structural and [design.md](design.md) for anything visual.
5. **State your plan briefly before editing** (one paragraph: what tasks from phases.md you will do, what you will touch).
6. Then execute.

---

## 4. Immutable Invariants (NEVER violate)

### 4.1 The math

- **INV-1** All OIML R-76 calculation logic lives ONLY in `backend/src/engine/` (Python) and its sanctioned mirror `frontend/src/engine/` (TypeScript). Nowhere else — not in routers, not in services, not in React components, not in SQL.
- **INV-2** The engine is PURE: no I/O, no network, no database, no clock, no randomness. Same input ⇒ same output, forever.
- **INV-3** MPE bands are DATA (a single table structure in `engine/mpe_rules.py`), never scattered conditionals. Changing a band is a one-line data edit, reviewable by a metrologist.
- **INV-4** All engine arithmetic uses `decimal.Decimal` (Python) / decimal-safe arithmetic (TS). Raw `float`/`double` math on metrology values is a defect.
- **INV-5** Constants traceable to OIML R 76-1 (Tables 3, 6; §A.4.4.3) must cite their source in a comment. **Never guess a metrological constant.** If unsure → stop, add it to memory.md §7 parking lot, ask a human.
- **INV-6** The frontend TS engine produces PROVISIONAL verdicts only. The backend engine is authoritative; on sync conflict the server wins and the UI flags the row for review.

### 4.2 The data

- **INV-7** `observations` are append-only. No UPDATE/DELETE on observation rows. Corrections = new rows with incremented sequence. (architecture.md §4.3)
- **INV-8** Verdicts (`status` PASS/FAIL) are computed by the engine at insert time and stored. The UI never re-derives verdicts for display.
- **INV-9** Instrument metrological parameters are immutable within a started session. Mistake ⇒ new session.
- **INV-10** A finalized report is never silently regenerated. Re-generation creates a new versioned row; the old file and hash remain retrievable.

### 4.3 The repo

- **INV-11** Never commit secrets, credentials, or `.env` files. Secrets via environment variables only.
- **INV-12** Never rename folders/APIs documented in architecture.md without updating architecture.md and memory.md §6 in the same change.
- **INV-13** Never delete or rewrite memory.md §5 (decision log) entries. Append corrections as new entries.
- **INV-14** Never mark a phases.md task or phase complete without its definition of done being met (tests passing where applicable).

---

## 5. Engineering Standards

- **Language & typing:** Python with type hints everywhere; strict TypeScript on the frontend.
- **Validation:** Pydantic at every API boundary; reject bad input with explanatory messages (never silently clamp).
- **Tests:** every public engine function has a unit test backed by `backend/tests/golden_vectors.json`; API endpoints have happy-path + failure + RBAC tests. **Tests must pass before any phases.md task may be ticked.**
- **Style:** ruff (Python), eslint (TS). Run before finishing.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`) referencing task IDs, e.g. `feat: P1-3 corrected error formula`.
- **Branches:** feature branches (`feat/…`, `fix/…`, `docs/…`) → PR → merge to `main`. Direct pushes to `main` only for docs.
- **Dependencies:** adding a new backend/frontend dependency requires a one-line justification in memory.md §5 as a decision entry.
- **No dead code:** remove debug prints, commented-out blocks, and unused scaffolding before ending a session.

---

## 6. AI-Specific Rules (for any agent, any platform)

1. **Assume nothing about state.** memory.md is your only reliable picture of the project. Re-read it even if you "remember" — another agent or a human may have changed things since.
2. **Stay in your lane.** Work only the tasks in the active phase unless the user explicitly re-scopes. If you see something broken elsewhere, log it in memory.md §7 — don't scope-creep.
3. **No orphan work.** Every code change maps to a phases.md task ID. If it doesn't map to one, either it's docs/governance (fine — update memory.md §6) or ask.
4. **Respect the append-only logs.** memory.md §5 is history; correct forward, never backward.
5. **Don't fabricate OIML content.** If a rule, table value, or procedure isn't in the repo's `docs/` rulebooks and you can't verify it, flag it — never invent it (INV-5).
6. **Don't touch git state destructively.** No force-push, no history rewrite, no resets that discard human work. Commit only when the user asks; otherwise leave work uncommitted and report it.
7. **Document as you go.** If you add a module, update memory.md §6 (where things are) in the same session.
8. **Hand off like a professional.** The end-of-session checklist in memory.md §8 is not optional. The next agent's success depends on it.

---

## 7. When Uncertain (escalation protocol)

| Situation | Action |
|---|---|
| Uncertain about an OIML constant/procedure | STOP. Add to memory.md §7. Ask the user. Do not guess (INV-5). |
| Docs contradict each other | Fix docs first (same change), per §1. |
| Task seems to require changing architecture | Propose the change + rationale to the user; on approval, update architecture.md + log decision. |
| Tests fail and cause is non-obvious | Fix forward; never weaken a test to make it pass without logging a decision entry explaining why. |
| User asks for something violating an invariant | Explain the invariant and the risk; suggest a compliant alternative; proceed only on explicit user override (and log it). |

---

## 8. Outro Ritual (end-of-session checklist)

Run the full checklist in [memory.md §8](memory.md). Summary: update status snapshot, append decisions, update the file map, tick phases.md tasks honestly, move resolved parking-lot items, report uncommitted work, leave the repo green.

---

*Document hierarchy: rules.md → memory.md → architecture.md → phases.md → design.md (+ knowledge.md as the engineering-philosophy annex). Cross-links: [memory.md](memory.md) · [architecture.md](architecture.md) · [phases.md](phases.md) · [design.md](design.md) · [knowledge.md](knowledge.md)*
