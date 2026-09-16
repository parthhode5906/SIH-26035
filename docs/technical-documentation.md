# Technical Documentation — OIML R-76 Compliance Engine

**SIH 2026 · PS 26035 · Version 1.0 (September 2026)**

This is the consolidated engineering reference: system architecture, the
metrological calculation methodology exactly as implemented, and the
deployment framework. For product framing see `README.md`; for day-to-day
runbook see `deploy/README.md`.

---

## 1. System Architecture

### 1.1 Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind v4, Zustand, React Router 7 | PWA with install support; strict typing end-to-end |
| Offline store | Dexie (IndexedDB) + durable outbox + server-wins sync engine | Labs run in basements; sessions survive outages and reloads |
| Service worker | Hand-rolled app-shell SW (`public/sw.js`) | Cache-first assets, network-first navigation; **API traffic is never intercepted** — the sync engine owns data integrity |
| API | FastAPI (Python 3.12), Pydantic v2 strict contracts | Typed boundary; every numeric ingress is a `Decimal` via validators, never a JSON float |
| ORM / DB | SQLAlchemy 2, PostgreSQL (prod) / SQLite (dev) | Metrology values in `NUMERIC(18,6)` — never floats |
| Engine | Pure Python `decimal` module | Deterministic, auditable math; zero IEEE-754 artifacts |
| Reports | ReportLab (PDF, authoritative) + python-docx (editable twin) | Both render the *same immutable snapshot*, so the formats cannot disagree |
| Sealing | SHA-256 file digest + QR content digest | Two-layer tamper evidence (§4 below) |
| Auth | JWT (access + refresh), bcrypt, RBAC | technician / approving_officer / admin |

### 1.2 Module map

```
backend/src/
  engine/        pure metrology domain — no I/O, no framework imports
    mpe_rules.py     MPE band tables (all 4 classes) + evaluation core
    error_calc.py    E = I + ½e − ΔL − L ; Ec = E − E₀
    rounding.py      legal rounding to d/e semantics
    class_rules.py   class ↔ Min/Max/n validity (R 76-1 Table 3)
    contracts.py     Decimal-enforcing ingress contracts (PrecisionError)
  services/      workflow orchestration (no HTTP, no SQL-in-router)
  api/           FastAPI routers + Pydantic schemas + RBAC deps + audit glue
  db/            SQLAlchemy models; observations and audit_log are append-only
  report/        aggregate → pdf/docx renderers + seal + orchestration service
frontend/src/
  engine/mpe.ts  TypeScript MIRROR of the Python engine (decimal.js)
  lib/           requirements.ts (rulebook predicates), serial.ts, creep.ts
  db/offline.ts  Dexie schema + outbox
  lib/sync.ts    server-wins batch sync
deploy/          docker-compose, Dockerfiles, nginx, env template, runbook
docs/            this file, comparison-vs-r76-2.md, PPT/video scripts
```

### 1.3 The three data-integrity invariants

1. **Append-only observations.** A reading is never updated or deleted.
   Corrections create a new revision; the latest revision per
   `(test_type, position, sequence_no)` wins. Every historical value
   remains queryable — this is what makes the record defensible.
2. **Server-computed verdicts.** The UI never derives PASS/FAIL. The
   backend engine evaluates at insert and stores the verdict; offline the
   TS mirror shows a clearly-badged *provisional* verdict, but the stored
   authority is always the server's recomputation.
3. **Decimal-only metrology.** Every arithmetic path from JSON ingress to
   DB column to PDF cell is `Decimal`/`NUMERIC`. Raw JSON floats are
   rejected at the boundary with a 422 — they cannot silently enter a
   legal record.

---

## 2. Calculation Methodology (exactly as implemented)

Source of truth: **OIML R 76-1 (2006 edition)** — the official PDF is kept
in `docs/` and every constant was extracted from it (task P1-2 verification
gate, recorded in `memory.md`). Constants live as DATA tables in
`engine/mpe_rules.py`, not scattered conditionals.

### 2.1 Definitions

| Symbol | Meaning |
|---|---|
| `Max`, `Min` | maximum/minimum capacity of the instrument |
| `e` | verification scale interval — the interval used for accuracy classification and errors |
| `d` | actual digital display interval (`d ≤ e`) |
| `n` | number of verification scale intervals, `n = Max / e` |
| `L` | applied load (true load from standards) |
| `I` | indication displayed by the instrument |
| `ΔL` | additional load to find the changeover point between two digits |
| `E₀` | error calculated at (or near) zero prior to loading |

### 2.2 Error prior to rounding (Annex A.4.4.3)

```
E = I + ½·e − ΔL − L
```

At a changeover point, `I + ½e` sits exactly between two possible
indications; adding `ΔL` determines which side the instrument actually
flips to. This recovers the instrument's *true* response before the
display's rounding — the error you would measure with an infinitely
fine readout.

### 2.3 Corrected error

```
Ec = E − E₀
```

Subtracting the zero-point error removes the instrument's zero offset so
the reported error is the *span* error at that load.

### 2.4 Maximum Permissible Errors (Section 3.5, Table 6 semantics)

MPE depends on the load expressed in verification scale intervals
(`m = L / e`) and the accuracy class. Bands are **inclusive of the upper
bound** (`lo < m ≤ hi`; the zero band includes m = 0). Values as
implemented:

| m = L/e | Class I | Class II | Class III | Class IIII |
|---|---|---|---|---|
| 0 ≤ m ≤ 50 000 | ±0.5e | — | — | — |
| 50 000 < m ≤ 200 000 | ±1.0e | — | — | — |
| 200 000 < m ≤ max | ±1.5e | — | — | — |
| 0 ≤ m ≤ 5 000 | — | ±0.5e | — | — |
| 5 000 < m ≤ 20 000 | — | ±1.0e | — | — |
| 20 000 < m ≤ 100 000 | — | ±1.5e | — | — |
| 0 ≤ m ≤ 500 | — | — | ±0.5e | — |
| 500 < m ≤ 2 000 | — | — | ±1.0e | — |
| 2 000 < m ≤ 10 000 | — | — | ±1.5e | — |
| 0 ≤ m ≤ 50 | — | — | — | ±0.5e |
| 50 < m ≤ 200 | — | — | — | ±1.0e |
| 200 < m ≤ 1 000 | — | — | — | ±1.5e |

Notes:
- **First-period errors** (type approval context): Table 6 values apply.
  **In-service** MPEs are **twice** these values (R 76-1 §3.5.2) — the
  engine carries this distinction for future verification workflows.
- Class validity ranges (`n = Max/e`, Table 3): I: ≥ 50 000;
  II: 100–100 000; III: 100–10 000; IIII: 10–1 000. Instrument creation
  is rejected with an auditor-readable reason when Table 3 is violated.
- MPEs apply for loads `Min ≤ L ≤ Max`; the engine refuses evaluations
  outside the measuring range.

### 2.5 Verdict rule

```
PASS  iff  |Ec| ≤ MPE(class, L, e)    else FAIL
```

The comparison is inclusive at the boundary — an error exactly at the
limit passes (per §3.5: "not exceeding the maximum permissible error").

### 2.6 Worked example (the documented Class III PASS vector)

Class III instrument: `e = 5 g = 0.005 kg`, `Max = 15 kg`.
Reading: `L = 5.006 kg` applied, `I = 5.008 kg`, `ΔL = 0`, `E₀ = 0`.

```
E  = 5.008 + 0.0025 − 0 − 5.006 = 0.0045 kg
Ec = 0.0045 − 0 = 0.0045 kg
```

Here `m = 5.006 / 0.005 = 1001.2`, so the Class III MPE is `0.005 kg`.

```
L = 5.006, I = 5.008, ΔL = 0, E₀ = 0
E = Ec = 0.0045 kg
m = 5.006 / 0.005 = 1001.2  →  band (500, 2000]  →  MPE = 1.0e = 0.005 kg
|Ec| = 0.0045 ≤ 0.005        →  PASS
```

Both the Python engine and the TypeScript mirror must produce this exact
verdict — the shared golden-vector file locks the two implementations
together (16 conformance tests in the frontend run the *same* JSON the
backend tests run).

### 2.7 Ambient-drift watchdog (§3.9.2.3)

The zero indication may not vary more than **1e per 1 °C** (class I) or
**1e per 5 °C** (classes II/III/IIII). The service computes the allowed
zero drift from the session's start/end temperatures and classifies:

| Level | Condition | Consequence |
|---|---|---|
| `ok` | ΔT ≤ 15 °C, inside static range | none |
| `warn` | 15 °C < ΔT ≤ 30 °C | monitor room conditions |
| `red` | ΔT > 30 °C **or** any reading outside the instrument's static temperature range (§3.9.2) | affected readings void — re-run; note printed in the report |

The drift note is part of the report snapshot, so PDF and DOCX both carry
the ambient-drift verdict on the summary page.

---

## 3. Report Generation Pipeline (§7.3)

```
finalize ──▶ aggregate_session()  ──▶ ReportData (immutable snapshot)
                    │                     │
                    │               ┌─────┴─────┐
                    │               ▼           ▼
                    │           DOCX twin    authoritative PDF (ReportLab)
                    │               └─────┬─────┘
                    ▼                     ▼
             Report row  ◀──  SHA-256(pdf_bytes)  +  QR(content digest)
```

- **Snapshot, not live query.** Both renderers consume one frozen
  `ReportData`; the two formats cannot drift.
- **Two-layer seal.** (1) `Report.sha256` = SHA-256 of the delivered PDF
  bytes — byte-level tamper evidence re-checked on download. (2) The QR
  embeds a *content digest* = SHA-256 over the canonical JSON of the
  snapshot + template version — so a *reprint* of the same report still
  verifies as authentic even though its bytes differ.
- **Officer sign-off re-renders and re-seals**, so the printed signature
  is part of the sealed content.
- **Public verification.** The QR resolves to `/verify/:reportId`, an
  unauthenticated endpoint reporting authenticity, both digests, signer,
  and stored-file integrity.

---

## 4. Audit & Accountability (P7-1)

Every authenticated write and authentication event — login (success *and* failure), instrument
create, session create, environment patch, observation create, batch
sync, attachment upload, finalize, sign — appends a row to `audit_log`:
actor, action, object reference, source IP, small JSON summary, and a
**hash chain** (`row_hash = SHA-256(prev_hash ‖ canonical_row)`).

- The chain is verifiable at any time: `GET /api/v1/users/audit/verify`
  (admin) walks every row and names the first broken link if a value was
  edited in place.
- Audit rows are INSERT-only; no code path updates or deletes them.
- Failure policy: an audit write failure **raises in production** and
  logs-and-continues in development — a silent audit gap can never ship.

---

## 5. Offline-First Design

- Every committed observation persists to IndexedDB **instantly**; the
  outbox queues unsynced rows; the sync engine pushes them via the batch
  endpoint when connectivity returns.
- **Server wins:** the server re-evaluates every synced row and its
  verdict overwrites the provisional one. The UI badges provisional
  values amber until confirmed.
- The service worker caches only the app shell and static assets — API
  calls are never intercepted, so there is exactly one writer for data.
- Reload-mid-test restores full state (sessions cache the instrument
  binding and environment).

---

## 6. Deployment Framework

See `deploy/README.md` for the runbook. Summary:

- `deploy/docker-compose.yml` — Postgres 16 (healthchecked), backend
  (uvicorn), frontend (nginx: PWA + `/api` proxy + SPA fallback).
- Secrets via `deploy/.env` (template in `.env.example`, git-ignored):
  `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `CORS_ALLOW_ORIGINS`,
  `REPORT_VERIFY_BASE_URL`.
- Volumes: `pgdata`, `reports`, `uploads`; nightly `pg_dump` procedure
  documented; restore-consistency check via the public verify endpoint.
- Environment matrix documents every dev default and its production
  requirement.

---

## 7. Test & Verification Estate

| Suite | Count | What it locks |
|---|---|---|
| Engine unit + band-edge tests | pytest | every MPE band edge for all 4 classes; monotonicity; Table-3 rejection |
| API tests | pytest | happy paths, 422/409/403 semantics, batch per-row SAVEPOINT, append-only, RBAC denials, drift levels |
| Report tests | pytest | PDF text/QR via pypdf, DOCX content, seal determinism, verify endpoint, re-seal on sign |
| Audit tests | pytest | records on writes, login-failure audit, admin-only reads, chain intact + tamper detection |
| TS↔Python conformance | vitest | the mirror agrees with the engine on the shared golden vectors |
| Phase 4/6 module tests | vitest | rulebook predicates (§A.4.x), serial parser formats, stabilization latch |
| Live smoke scripts | `backend/scripts/smoke*.py` | full lifecycle over real HTTP against running servers |
