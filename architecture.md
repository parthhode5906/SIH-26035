# architecture.md — System & Backend Architecture

> **Document class:** Structure spec (authority level 3 of 5 — see [rules.md](rules.md)).
> **Audience:** Any engineer or AI agent implementing this project.
> **Status:** Canonical. If code and this document disagree, update one of them in the same commit — never let them drift silently.

---

## 1. Purpose

This document defines the complete system architecture for the **NAWI Compliance Suite** — a deterministic, offline-first web application that generates standardized OIML R-76-2 pattern evaluation test reports for Non-Automatic Weighing Instruments (SIH 2026, PS 26035).

It answers: *what are the parts, where do they live, how do they talk, and why were these choices made?*

For **what to build next**, see [phases.md](phases.md). For **how it looks/behaves**, see [design.md](design.md). For **current project state**, see [memory.md](memory.md). For **binding rules**, see [rules.md](rules.md).

---

## 2. System Overview (Monorepo Layout)

```
OMIL-R76-compliance-engine/
├── backend/                        # FastAPI (Python) — API + Metrology Engine
│   ├── src/
│   │   ├── engine/                 # OIML R-76 math engine (PURE — no I/O, no framework imports)
│   │   │   ├── contracts.py        # Decimal-enforced dataclasses (ScaleParameters, Observation, EvaluationResult)
│   │   │   ├── mpe_rules.py        # MPE step tables for Classes I, II, III, IIII (data, not conditionals) + evaluate()
│   │   │   ├── error_calc.py       # E = I + ½e − ΔL − L  →  Ec = E − E0
│   │   │   ├── class_rules.py      # Class/Min/Max/e validity constraints (R 76-1 Table 3)
│   │   │   ├── rounding.py         # Precision policy: exact internal math, 6-dp ROUND_HALF_UP reporting
│   │   │   └── models.py           # Pydantic ingress schemas (JSON string → Decimal; floats rejected)
│   │   ├── environment/            # Drift watchdog (temp / humidity / pressure limits)
│   │   ├── report/                 # PDF generation (ReportLab/Docxtpl) + SHA-256 + QR seal
│   │   ├── api/                    # FastAPI routers, auth deps, schemas (Pydantic DTOs)
│   │   │   ├── routers/
│   │   │   ├── schemas/
│   │   │   └── dependencies.py     # JWT verification, RBAC dependency injection
│   │   ├── services/               # Application layer (orchestrates engine + repos)
│   │   ├── db/
│   │   │   ├── models.py           # SQLAlchemy ORM models
│   │   │   ├── session.py          # Engine/session factory
│   │   │   └── migrations/         # Alembic
│   │   └── infrastructure/         # Repositories, storage adapters
│   ├── tests/                      # pytest — MUST include golden OIML worked examples
│   ├── requirements.txt
│   └── pyproject.toml
│
├── frontend/                       # React PWA (Vite) — offline-first UI
│   ├── src/
│   │   ├── engine/                 # TS mirror of the math engine for offline/optimistic evaluation (*)
│   │   ├── ingestion/              # Web Serial API client + 7-segment OCR module
│   │   ├── components/             # Test grids, eccentricity diagram, live-validation row
│   │   ├── db/                     # IndexedDB (offline cache) + sync engine
│   │   ├── pages/                  # Login, Dashboard, New Evaluation wizard, Archive, Admin
│   │   └── lib/                    # API client, auth store, utilities
│   ├── public/                     # PWA manifest, service worker, icons
│   └── package.json
│
├── docs/                           # SIH PPT, OIML R-76-1/-2 PDFs, sample reports, deployment docs
├── architecture.md                 # ← THIS FILE
├── memory.md                       # Project state + decision log (AI handoff)
├── design.md                       # UI/UX spec
├── phases.md                       # Roadmap + task tracking
├── rules.md                        # Binding rules for any AI agent
├── knowledge.md                    # Engineering-philosophy annex (Ponytail decision ladder)
└── README.md                       # Public-facing summary
```

`(*)` **Offline math policy:** the frontend TS engine is a *mirror*, kept in lockstep with the Python engine via a shared golden test-vector file (`backend/tests/golden_vectors.json`, consumed by both test suites). The backend result is always authoritative; the frontend result is provisional until sync. See [rules.md §6](rules.md).

---

## 3. Layered Architecture (Backend — Clean Architecture)

Requests flow strictly downward; dependencies point inward. An outer layer may import an inner layer — never the reverse.

```
┌──────────────────────────────────────────────────────────────┐
│  API LAYER (src/api/)                                        │
│  HTTP concerns only: routing, auth, Pydantic validation.     │
│  ZERO metrology math.                                        │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER (src/services/)                           │
│  Workflow orchestration: "take this observation, evaluate    │
│  it, persist it, update session status."                     │
└───────────────┬──────────────────────────────┬───────────────┘
                ▼                              ▼
┌───────────────────────────────┐  ┌───────────────────────────┐
│  DOMAIN LAYER (src/engine/)   │  │  INFRASTRUCTURE           │
│  PURE OIML R-76 math.         │  │  (src/db/, src/infra/,    │
│  No I/O. No framework.        │  │   src/report/)            │
│  Deterministic: same input →  │  │  SQLAlchemy repos,        │
│  same output, forever.        │  │  PDF generator, QR sealer │
└───────────────────────────────┘  └───────────────────────────┘
```

### Layer responsibilities

| Layer | Location | May import | Must never do |
|---|---|---|---|
| **API** | `src/api/` | services, schemas, core | Contain math; touch ORM models directly; contain business rules |
| **Application** | `src/services/` | domain, infrastructure | Contain OIML formulas; contain SQL |
| **Domain** | `src/engine/` | stdlib only | Import FastAPI, SQLAlchemy, requests, datetime-as-logic (no time-dependent behavior), or any I/O |
| **Infrastructure** | `src/db/`, `src/infrastructure/`, `src/report/` | domain (types only where needed) | Contain workflow decisions or formulas |

---

## 4. Data Model

### 4.1 Entity relationship outline

```
users (RBAC)
  │
  └── test_sessions ──────────┐
        │                     │
        │                     └── test_sessions_observations (per-reading rows, append-only)
        │
instruments (the "DNA" of a scale)
        │
        └── reports (generated PDFs, hashes, QR payloads, signature status)
```

### 4.2 Tables (canonical fields)

**`users`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `full_name` | text | |
| `email` | text UNIQUE | login identifier |
| `password_hash` | text | bcrypt/argon2 |
| `role` | enum | `lab_technician` \| `approving_officer` \| `admin` |
| `is_active` | bool | soft disable |

**`instruments`** — the metrological identity of the scale under test

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `manufacturer` | text | |
| `model` | text | |
| `serial_number` | text | |
| `accuracy_class` | enum | `I` \| `II` \| `III` \| `IIII` |
| `max_capacity` | numeric | **Max** — stored in `base_unit` |
| `min_capacity` | numeric | **Min** |
| `verification_scale_interval` | numeric | **e** |
| `display_interval` | numeric | **d** (actual digital resolution) |
| `base_unit` | text | `kg` / `g` — all engine math in base unit |
| `n_max` | numeric | derived: `Max / e` (stored, computed once) |
| `created_by` | FK users | |

**`test_sessions`** — one evaluation campaign against one instrument

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `instrument_id` | FK instruments | |
| `status` | enum | `draft` \| `in_progress` \| `completed` \| `approved` |
| `start_temp_c` / `end_temp_c` | numeric | drift watchdog inputs |
| `humidity_pct` / `pressure_hpa` | numeric | |
| `started_at` / `completed_at` | timestamptz | recorded, **never used in math** |
| `created_by` | FK users | |

**`observations`** — individual test readings (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | FK test_sessions | |
| `test_type` | enum | `weighing_performance` \| `eccentricity` \| `repeatability` \| `tare` \| `creep` \| `zero_check` |
| `position` | text nullable | e.g. eccentricity quadrant `1..5` |
| `sequence_no` | int | ordering within test type |
| `applied_load` | numeric | **L** |
| `indication` | numeric | **I** |
| `additional_load` | numeric | **ΔL** (changeover-point extra load) |
| `zero_error` | numeric | **E0** (error at zero prior to loading) |
| `error_prior` | numeric | computed by engine: **E** |
| `corrected_error` | numeric | computed: **Ec = E − E0** |
| `mpe_limit` | numeric | computed band limit |
| `status` | enum | `PASS` \| `FAIL` |
| `entered_at` | timestamptz | audit only |
| `entered_by` | FK users | |
| `source` | enum | `manual` \| `serial` \| `ocr` |

**`reports`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | FK test_sessions | |
| `file_path` | text | storage location of PDF |
| `docx_path` | text nullable | editable export |
| `sha256` | text | hash of final PDF bytes |
| `qr_payload` | text | verify-URL + hash digest |
| `signed_by` | FK users nullable | approving officer |
| `signed_at` | timestamptz nullable | |
| `template_version` | text | pins the R-76-2 layout version used |

### 4.3 Integrity rules

1. **Append-only observations.** No UPDATE/DELETE on `observations`. A wrong entry is superseded by a new row that retains the same logical `sequence_no` and references the prior row through `supersedes_observation_id` (or an equivalent stable revision field), with `source` noted. The UI and queries apply latest-wins filtering by selecting only the newest revision for each logical observation identified by `(test_type, position, sequence_no)`.
2. All numeric metrology columns use `NUMERIC`/`DECIMAL` — never floating point.
3. Every observation's `status` is computed **by the engine at insert time** and stored; the UI never re-derives it from local math at render time.
4. `instruments.n_max` must satisfy the class validity ranges of R 76-1 Table 3 (validated at creation; see `engine/class_rules.py`).

---

## 5. The Metrology Engine (Domain Core)

### 5.1 Canonical formula chain

```
n  = Max / e                              (number of verification scale intervals)
MPE = f(accuracy_class, load/e)           (step-table lookup — see 5.2)
E  = I + ½e − ΔL − L                      (error prior to rounding, R 76-1 A.4.4.3)
Ec = E − E0                               (corrected error; E0 = error at zero)
verdict: |Ec| ≤ MPE  →  PASS  else  FAIL
```

### 5.2 MPE step tables — ✅ VERIFIED vs R 76-1 (2006) §3.5.1 Table 6 (2026-09-15)

| MPE | Class I | Class II | Class III | Class IIII |
|---|---|---|---|---|
| ±0.5e | 0 ≤ m ≤ 50,000 | 0 ≤ m ≤ 5,000 | 0 ≤ m ≤ 500 | 0 ≤ m ≤ 50 |
| ±1.0e | 50,000 < m ≤ 200,000 | 5,000 < m ≤ 20,000 | 500 < m ≤ 2,000 | 50 < m ≤ 200 |
| ±1.5e | 200,000 < m (unbounded) | 20,000 < m ≤ 100,000 | 2,000 < m ≤ 10,000 | 200 < m ≤ 1,000 |

- Band edges are `(lo, hi]`: the upper bound is inclusive (an error exactly at the limit passes).
- These are **initial-verification** limits (pattern evaluation scope). In-service MPEs are 2× (§3.5.2) and are out of scope for v1 — if ever required, they must be an explicit parameter, never a constant change (memory.md D-19).
- Source: `required rulebook/r076-1-e06.pdf` extracted verbatim (Table 6 on PDF page 30); every band in `engine/mpe_rules.py` carries a `Verified` provenance marker. These corrected the original draft table, which had wrong Class I and Class IIII rows.

### 5.3 Engine implementation rules

- Pure functions only. Input → output with no globals, no clock, no randomness, no DB, no HTTP.
- All MPE bands live in **one data structure** (`mpe_rules.py`) — never scattered `if` statements across files.
- All arithmetic via Python `decimal.Decimal` (frontend: decimal-safe arithmetic; never raw float math on `e`-derived values).
- Every public function has a unit test backed by a worked example from the OIML docs / a calibrated instrument run.
- The engine exposes exactly three verbs to services: `evaluate_observation(...)`, `mpe_for_load(...)`, `validate_instrument_spec(...)`.

---

## 6. API Surface (v1 contract)

Base path: `/api/v1`. All bodies JSON. Auth: `Authorization: Bearer <JWT>`.

### 6.1 Auth & users

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | returns JWT |
| POST | `/users` | admin | create user |
| GET | `/users/me` | any | profile |

### 6.2 Instruments

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/instruments` | technician+ | register instrument (validated against class rules) |
| GET | `/instruments` | any | list / search |
| GET | `/instruments/{id}` | any | detail incl. session history |

### 6.3 Sessions & observations

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/sessions` | technician | start session (captures env conditions) |
| PATCH | `/sessions/{id}` | technician | update env conditions (start→end temp etc.) |
| POST | `/sessions/{id}/observations` | technician | submit one observation → returns engine evaluation |
| GET | `/sessions/{id}/observations` | any | list (latest-wins view) |
| POST | `/sessions/{id}/attachments` | technician | photo/document upload |
| POST | `/sessions/{id}/finalize` | technician | mark complete → triggers report generation |
| POST | `/reports/{id}/sign` | approving_officer | digital sign-off |

### 6.4 Canonical endpoint: evaluate observation

**Request**

```json
{
  "test_type": "weighing_performance",
  "sequence_no": 3,
  "position": null,
  "applied_load": "5.0",
  "indication": "5.006",
  "additional_load": "0.0",
  "zero_error": "0.0",
  "source": "manual"
}
```

**Response**

```json
{
  "observation_id": "uuid",
  "error_prior": 0.006,
  "corrected_error": 0.006,
  "mpe_limit": 0.0025,
  "status": "FAIL",
  "message": "Corrected error 0.006 kg exceeds MPE ±0.5e (0.0025 kg) at 1000e for Class III."
}
```

**Contract rules:** the response contains the engine verdict **and** a human-readable message; the client renders it verbatim in the live-validation row (see design.md §5.2). The client **must not** compute its own final verdict for display.

### 6.5 Reports & verification

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/reports/{id}/download` | any | PDF bytes |
| GET | `/public/verify/{report_id}` | public | QR target: hash + status check |

---

## 7. Data Flow Walkthroughs

### 7.1 Normal flow (online)

```
Lab Tech enters reading ──► POST /observations ──► Pydantic validation ──► Service
    ──► engine.evaluate_observation() ──► verdict persisted ──► response to UI
    ──► live-validation row shows E, Ec, MPE, PASS/FAIL
```

### 7.2 Offline flow

```
Reading captured ──► TS mirror engine gives PROVISIONAL verdict ──► stored in IndexedDB
    ──► sync (when online): batch POST ──► backend engine re-evaluates ──► authoritative verdict
    ──► if mismatch: server wins; session row flagged for review in UI
```

### 7.3 Finalization flow

```
All required tests complete ──► POST /finalize ──► service aggregates session ──►
report service renders R-76-2 layout (ReportLab/Docxtpl) ──► SHA-256 over PDF bytes ──►
QR payload (verify URL + hash) ──► report row + file stored ──► officer signs
```

---

## 8. Environment Drift Watchdog (`src/environment/`)

- Watches `start_temp_c` vs current temperature across the session; flags the session if drift exceeds the configured limit (default ±5 °C; final limit to be confirmed against R 76-1 during Phase 1).
- Emits a session-level warning status consumed by the UI banner (design.md §5.4).
- Implemented as a service-layer helper over stored observations + session env fields — no background daemons in v1.

---

## 9. Document Generation & Verification Layer (`src/report/`)

- **Layout engine:** Docxtpl (template injection into a Word replica of OIML R-76-2) primary for editable output; ReportLab for the pixel-perfect PDF path. Template files versioned under `backend/src/report/templates/` with `template_version` recorded per report.
- **Seal:** SHA-256 over final PDF bytes → QR payload `{verify_url, report_id, sha256}` embedded on the cover page.
- **Immutability:** a finalized report is never regenerated silently; re-generation produces a **new version row** linked to the session.

---

## 10. Architecture Decision Records

| # | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| ADR-1 | FastAPI (Python) backend | Decimal-precise math for metrology; Pydantic strict validation at the boundary; async perf | Node.js (float-precision pitfalls, no native Decimal), Django (heavier middleware for strict typing) |
| ADR-2 | PostgreSQL | Rigid legal schema, ACID, relational integrity across instruments→sessions→observations | MongoDB (schemaless — wrong for legal audit trails) |
| ADR-3 | ReportLab/Docxtpl over HTML-to-PDF | Absolute X/Y control over page breaks and table layout; replicates official R-76-2 forms; HTML-to-PDF breaks multi-page tables | Puppeteer/wkhtmltopdf (unpredictable pagination, styling drift) |
| ADR-4 | React PWA, offline-first (IndexedDB) | Labs have unreliable connectivity; sessions run for hours and must survive dropouts | Standard SPA without SW (hard failure mid-session) |
| ADR-5 | Web Serial API ingestion | Removes manual transcription errors at the source; zero-install hardware link in Chrome/Edge | Native desktop app (heavy deployment for govt labs) |
| ADR-6 | Append-only observations + engine-computed verdicts stored | Legal audit trail; verdicts cannot be tampered with at render time | Editable rows (auditors could silently alter history) |
| ADR-7 | Monorepo | One clone gives backend+frontend+docs; atomic cross-cutting changes | Separate repos (sync overhead during 36-h finale) |
| ADR-8 | TS mirror engine + golden vectors | Offline provisional verdicts without duplicating drift between languages | Frontend-always-authoritative (violates single-source-of-truth math) |

---

## 11. Security & RBAC

| Role | Instruments | Observations | Finalize | Sign report | Admin users |
|---|---|---|---|---|---|
| `lab_technician` | create | create | ✅ | ❌ | ❌ |
| `approving_officer` | view | view | ❌ | ✅ | ❌ |
| `admin` | full | full | ❌ | ❌ | ✅ |

- JWT (short-lived access + refresh), bcrypt/argon2 password hashing.
- All list endpoints paginated; all write endpoints audited (actor + timestamp).
- Uploads type/size restricted; stored outside web root.
- Secrets via environment only (`.env` git-ignored; already covered in `.gitignore`).

---

## 12. Deployment (target)

- Backend: containerized (Docker) behind Nginx; PostgreSQL volume-backed.
- Frontend: static PWA build served by Nginx/CDN.
- Target environment: government cloud (NIC / MeghRaj) — minimal infrastructure footprint.
- Config via env vars; health endpoint `/health`.

---

*Cross-references: [memory.md](memory.md) · [design.md](design.md) · [phases.md](phases.md) · [rules.md](rules.md)*
