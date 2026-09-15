# memory.md — Project State & AI Session Handoff

> **Document class:** State log (authority level 2 of 5 — see [rules.md](rules.md)).
> **Read this file FIRST in every session.** It tells you where the project stands, what has been decided, and where everything lives.
> **This file is append-only in its decision log.** Never delete or rewrite existing entries — add new ones.

---

## 1. Read-Me-First Order (mandatory)

1. **This file** (`memory.md`) — current state + decisions
2. [rules.md](rules.md) — binding rules you must follow
3. [phases.md](phases.md) — find the active phase and its checklist
4. [architecture.md](architecture.md) — consult for structural specifics
5. [design.md](design.md) — consult for UI/visual specifics

Then follow the startup ritual in [rules.md §3](rules.md).

---

## 2. Project Identity

| Field | Value |
|---|---|
| Project | NAWI Compliance Suite — OIML R-76 test report generator |
| Hackathon | Smart India Hackathon 2026 |
| Problem statement | **PS 26035** — Development of a Software Program/Application for Generation of Test Reports for Non-Automatic Weighing Instruments (NAWI) as per OIML R-76 |
| Theme | Miscellaneous (Ministry of Consumer Affairs, Food & Public Distribution) |
| Repository | `https://github.com/<repo-owner>/OMIL-R76-compliance-engine` (exact URL in README.md) |
| Primary branch | `main` |
| Repo layout | Monorepo: `backend/` (FastAPI) + `frontend/` (React PWA) + `docs/` + 5 planning docs at root |

---

## 3. Current Status Snapshot

> **Update this table at the end of EVERY session.** One row per phase. Do not mark complete unless the phase's "definition of done" in phases.md is met.

| Phase | Name | Status | Notes |
|---|---|---|---|
| 0 | Planning & governance docs | ✅ Complete | These five docs; README reconciliation still pending (task P0-4 in phases.md) |
| 1 | Core metrology engine + tests | ✅ Complete | 27/27 pytest green; P1-2 verification done 2026-09-15 (all four classes vs official PDF) |
| 2 | Backend API + database | ⬜ Not started | |
| 3 | Frontend shell (auth, dashboard, PWA base) | ⬜ Not started | |
| 4 | Test modules (weighing, eccentricity, repeatability, tare, creep) | ⬜ Not started | |
| 5 | Report generation (PDF/DOCX + QR seal) | ⬜ Not started | |
| 6 | Differentiators (serial, OCR, watchdog UI, public verify) | ⬜ Not started | |
| 7 | Hardening, docs, SIH deliverables | ⬜ Not started | |

**Working on right now:** Phase 2 — backend API + DB (SQLAlchemy models, JWT/RBAC, session & observation endpoints). Phase 1 closed 2026-09-15.

**Known blockers:** none.

---

## 4. Environment & Runbook

### 4.1 Local development (planned; verify commands as code lands)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
# uvicorn entrypoint lands in Phase 2 (src/api/main.py)

# Frontend
cd frontend
npm install
npm run dev                                       # Vite dev server

# Tests (pytest.ini sets pythonpath=. so src.engine imports resolve)
cd backend && ./.venv/Scripts/python -m pytest      # 27 tests (golden vectors + all-class band edges)
```

### 4.2 Tooling & versions (agreed targets)

| Tool | Target |
|---|---|
| Python | 3.11+ |
| Node | 20 LTS |
| PostgreSQL | 15+ (dev may use SQLite via SQLAlchemy until Phase 2 wires Postgres) |
| Package mgr (FE) | npm |
| Test runner (BE) | pytest |
| Lint/format | ruff (BE), eslint (FE) |

### 4.3 Reference materials (download once, keep in `docs/`)

| Document | Use |
|---|---|
| OIML R 76-1 (Edition 2006) | Metrological & technical requirements — source of ALL math (Tables 3, 6; §A.4.4.3). **Present at workspace root: `required rulebook/r076-1-e06.pdf`** (copy into `docs/` at P0-3; extractable with pypdf — Table 6 = PDF page 30, Table 3 = page 27) |
| OIML R 76-2 (Edition 2007) | Pattern Evaluation Report format — the PDF layout to replicate |
| Legal Metrology (Approval of Models) Rules, 2011 | Indian administrative wrapper (labels, lab credentials) |
| SIH 2026 PS 26035 brief | Scope + judging expectations |

---

## 5. Decision Log (append-only)

> Format: `YYYY-MM-DD | ID | Decision | Rationale`. Never edit old entries; append corrections as new entries. Dates reflect when the decision was made in planning (project pre-dates doc creation; early entries dated at doc inception).

| Date | ID | Decision | Rationale |
|---|---|---|---|
| 2026-09-14 | D-01 | Team works on PS 26035 for SIH 2026 | Low-competition, deterministic-domain fit; existing Legal Metrology domain experience |
| 2026-09-14 | D-02 | Monorepo: `backend/` + `frontend/` + `docs/` + root planning docs | Single clone, atomic cross-cutting changes during 36-h finale |
| 2026-09-14 | D-03 | Backend: FastAPI (Python) | Decimal-precise metrology math; Pydantic boundary validation; speed |
| 2026-09-14 | D-04 | Database: PostgreSQL (SQLAlchemy + Alembic) | Rigid legal schema, ACID integrity for audit trails |
| 2026-09-14 | D-05 | PDF: ReportLab (pixel-perfect path) + Docxtpl (editable DOCX path) | HTML-to-PDF pagination is unreliable for official legal layout |
| 2026-09-14 | D-06 | Frontend: React PWA, offline-first with IndexedDB | Labs have unreliable connectivity; multi-hour sessions must survive dropouts |
| 2026-09-14 | D-07 | Data ingestion: Web Serial API primary; OCR fallback | Eliminates transcription errors at source |
| 2026-09-14 | D-08 | Crypto QR seal: SHA-256 of PDF + verify URL | Tamper-evident, instantly auditable reports |
| 2026-09-14 | D-09 | Accuracy classes supported: I, II, III, IIII with MPE step tables | Full R 76-1 coverage; Class III is the demo default |
| 2026-09-14 | D-10 | Observations are append-only; corrections are new rows | Legal audit trail; no silent history edits |
| 2026-09-14 | D-11 | Verdicts computed ONLY by backend engine and stored at insert time | Single source of truth; prevents render-time tampering |
| 2026-09-14 | D-12 | Frontend TS engine is a provisional mirror, synced via `golden_vectors.json` | Offline UX without forking the math; server always wins on conflict |
| 2026-09-14 | D-13 | Five governance docs live at repo root (this file, rules, architecture, phases, design) | Any agent opening the repo sees them immediately |
| 2026-09-14 | D-14 | Drift watchdog default limit ±5 °C session delta | Provisional — MUST be confirmed against R 76-1 in Phase 1 before engine freeze |
| 2026-09-15 | D-15 | Adopted the Ponytail decision-ladder ruleset; encoded in `knowledge.md` | Minimum-code discipline that never sacrifices validation, security, error handling, or accessibility |
| 2026-09-15 | D-16 | Engine split: `contracts.py` (dataclasses), `class_rules.py` (Table 3), `error_calc.py` (E/Ec), `rounding.py` (precision policy), `mpe_rules.py` (bands + evaluate), `models.py` (Pydantic ingress) | Single-responsibility pure domain; frameworks only at the ingress edge (INV-1/INV-2) |
| 2026-09-15 | D-17 | `STRICT_VERIFIED_ONLY` gate: Classes I/II/IIII refuse evaluation until P1-2 sign-off | Unverified regulatory constants must never emit legal verdicts (INV-5) |
| 2026-09-15 | D-18 | Precision policy: internal arithmetic exact (28-digit Decimal context); reported values quantized to 6 decimal places, ROUND_HALF_UP, strictly downstream of verdicts | Presentation rounding can never flip a Pass/Fail |
| 2026-09-15 | D-19 | Engine implements INITIAL-VERIFICATION MPEs (Table 6). In-service MPEs (2×, §3.5.2) are out of scope for v1; if ever needed they must be an explicit evaluation-mode parameter, never a constant change | Pattern evaluation scope per PS 26035; silent doubling would corrupt verdicts |
| 2026-09-15 | D-20 | P1-2 VERIFICATION RECORD: all four class columns of Table 6 verified against the extracted official PDF (`required rulebook/r076-1-e06.pdf`, Table 6 on PDF page 30). Draft Class I bands corrected (0.5/1.0/1.5e at 50k/200k, unbounded 1.5e) and Class IIII corrected (0.5/1.0/1.5e at 50/200/1000 — draft rows were the §3.5.2 in-service values). `VERIFIED_CLASSES` now includes all four; strict gate retained as defense-in-depth | Wrong draft constants would have legally approved/failed real instruments |

---

## 6. Where Things Are (living map)

> Append entries as code lands. One line per notable module. Agents: read this before searching the codebase; update it when you add or move files.

| Path | What it is | Status |
|---|---|---|
| `README.md` | Public summary; **needs tech-stack + runbook reconciliation** with architecture.md | ⚠️ pending (P0-4) |
| `architecture.md` | Canonical system/backend architecture | ✅ current |
| `memory.md` | This file — state + decisions | ✅ current |
| `design.md` | UI/UX spec + design tokens + PDF aesthetics | ✅ current |
| `phases.md` | Roadmap, checklists, 36-h finale plan | ✅ current |
| `rules.md` | Binding rules for any AI agent | ✅ current |
| `knowledge.md` | Ponytail decision-ladder annex (D-15) | ✅ current |
| `backend/src/engine/` | OIML math engine: contracts, class_rules, error_calc, rounding, mpe_rules, models | ✅ Phase 1 core |
| `backend/tests/` | pytest suite (27 green) + `golden_vectors.json` (BE+FE shared) + `test_band_tables.py` (all-class edges) | ✅ green |
| `backend/pytest.ini` / `requirements.txt` | Test config + pinned deps; local venv at `backend/.venv` | ✅ working |
| `frontend/src/engine/` | TS mirror of engine | ⬜ not created |
| `frontend/src/db/` | IndexedDB offline store + sync | ⬜ not created |
| `docs/` | Rulebooks, PPT, sample reports | ⬜ not created |

---

## 7. Parking Lot (unsolved questions / TODOs)

- [ ] Confirm drift-watchdog legal limit (D-14) against R 76-1 environmental requirements.
- [ ] Class III n-floor nuance (Table 3): e ≥ 5 g requires n ≥ 500 (coarse-e row), e ≤ 2 g requires n ≥ 100 — make `_N_RANGE`/`_MIN_CAPACITY_IN_E` e-dependent when spec validation hardens.
- [ ] §3.4.3: Min column of Table 3 compares against **d** (actual interval), not e — needs unit-aware comparison once `d` is always present.
- [ ] Optional in-service MPE mode (2× Table 6, §3.5.2) as an explicit parameter — see D-19.
- [ ] Decide template procurement: rebuild R-76-2 form from scratch in ReportLab vs. DOCX template sourcing (Phase 5 spike).
- [ ] Choose QR verification hosting approach (same backend public route vs. separate page) — Phase 5.
- [ ] SIH submission logistics: 6-slide PPT (PDF export) + ≤3-min video — owners and dates TBD by team.

---

## 8. Handoff Protocol (end-of-session checklist)

Before ending ANY session, an agent MUST:

1. **Update §3 Current Status Snapshot** (phase statuses + "working on now" + blockers).
2. **Append any new decisions to §5** (never edit old rows).
3. **Update §6 Where Things Are** for files created/moved/renamed.
4. **Tick completed checklists in phases.md** and mark the corresponding task IDs.
5. **Move resolved parking-lot items** to the decision log; add new open questions.
6. **Commit or clearly report uncommitted work** — state exactly which files were touched and why (agents must not commit unless the user asks).
7. **Leave the repo green:** tests passing (once they exist), no stray debug code, no secrets in tracked files.

*Cross-references: [rules.md](rules.md) · [phases.md](phases.md) · [architecture.md](architecture.md) · [design.md](design.md)*
