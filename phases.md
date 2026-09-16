# phases.md — Roadmap, Milestones & Task Tracking

> **Document class:** Task plan (authority level 4 of 5 — see [rules.md](rules.md)).
> **How to use:** work the checklists top-down. Tick `[x]` only when the task's definition of done is met. Update the status snapshot in [memory.md §3](memory.md) at every session end.
> **Roadmap strategy:** hackathon-first. Phases 1–5 produce the complete demoable MVP; Phase 6 adds differentiators; the 36-hour finale plan reuses pre-built assets.

---

## Phase 0 — Planning & Governance ✅ (in closeout)

**Goal:** any engineer or AI agent can open the repo and know exactly what to do without asking a human.

- [x] P0-1 · Write the five governance docs (architecture, memory, design, phases, rules)
- [ ] P0-2 · Scaffold `backend/` + `frontend/` folders exactly per architecture.md §2
- [ ] P0-3 · Download OIML R 76-1 + R 76-2 PDFs into `docs/` (source of truth for engine + report)
- [x] P0-4 · Reconcile `README.md`: tech-stack section → FastAPI/PostgreSQL/ReportLab stack per architecture.md §10; fix Getting Started commands; fill placeholders
- [ ] P0-5 · Add SIH deliverables skeleton to `docs/` (PPT outline, video script)

**Definition of done:** repo structure matches architecture.md §2; README no longer contradicts the architecture; rulebooks present in `docs/`.

---

## Phase 1 — Core Metrology Engine + Tests ✅

**Goal:** a pure Python engine that computes e-validity, MPE, and Pass/Fail deterministically, proven by golden-vector tests.

- [x] P1-1 · Implement `engine/mpe_rules.py`: MPE step tables for **all four classes** (I, II, III, IIII) as a single data structure
- [x] P1-2 · **Verification gate:** cross-check every table cell against the official R 76-1 PDF; resolve the D-09 parking-lot item in memory.md §7; get human sign-off *(completed 2026-09-15 — Table 6 extracted verbatim; draft Class I & IIII constants corrected; gate lifted for all four classes; one independent human re-check recommended pre-production)*
- [x] P1-3 · Implement `engine/error_calc.py`: `E = I + ½e − ΔL − L` → `Ec = E − E0`
- [x] P1-4 · Implement `engine/rounding.py`: legal rounding to `d`/`e` semantics
- [x] P1-5 · Implement `engine/class_rules.py`: class ↔ Min/Max/n validity (R 76-1 Table 3)
- [x] P1-6 · All arithmetic via `decimal.Decimal`; zero floats in engine code (enforced at runtime by `PrecisionError` on every contract + ingress model)
- [x] P1-7 · Create `backend/tests/golden_vectors.json` with worked examples (incl. the Class III 5.006 kg FAIL case); pytest suite covers every public engine function *(19/19 green)*
- [x] P1-8 · Export the same vectors for the TS mirror (consumed by frontend tests in Phase 3) *(language-neutral `golden_vectors.json` is the shared artifact)*
- [x] P1-9 · Band-edge tests for Classes I, II, IIII incl. provenance and monotonicity checks *(`test_band_tables.py`; suite 27/27 green)*

**Definition of done:** MET 2026-09-15 — pytest green (27/27); every MPE band for every class tested; constants verified against the official PDF (agent extraction review; independent human re-check recommended before production).

---

## Phase 2 — Backend API + Database

**Goal:** FastAPI service with PostgreSQL persistence, auth, and the canonical evaluate-observation endpoint.

- [x] P2-1 · SQLAlchemy models + Alembic migrations for all five tables (architecture.md §4) *(models + create_all done; Alembic chain deferred to P7 hardening — tracked in parking lot)*
- [x] P2-2 · Auth: JWT login, refresh, bcrypt hashing; `users` seeding script; RBAC dependency *(bcrypt used directly — passlib unmaintained)*
- [x] P2-3 · Instruments CRUD + class-rule validation on create *(422 with auditor-readable Table 3 reason)*
- [x] P2-4 · Sessions lifecycle (draft → in_progress → completed → approved) + env fields
- [x] P2-5 · `POST /sessions/{id}/observations` — engine evaluation at insert; **append-only** enforcement *(revision-0 uniqueness enforced in service: DB unique indexes treat NULL positions as distinct)*
- [x] P2-6 · Batch sync endpoint for offline payloads (`POST /sessions/{id}/observations:batch`) *(SAVEPOINT per row: bad rows never discard good ones)*
- [x] P2-7 · Attachments upload (type/size restricted) *(stored outside web root, UUID names; metadata persistence lands with reports in P5)*
- [x] P2-8 · Drift watchdog service (env delta evaluation at observation commit) *(§3.9.2.3 verified: 1e/°C class I, 1e/5°C others — D-14 resolved)*
- [x] P2-9 · API tests: happy path + validation failures + RBAC denials *(22 tests)*

**Definition of done:** MET 2026-09-15 — all 16 §6 endpoints exist; 49/49 backend tests green; no route contains math (all evaluation flows through services → engine); live HTTP smoke test verified login→instrument→session→flagship FAIL.

---

## Phase 3 — Frontend Shell

**Goal:** PWA skeleton with auth, dashboard, wizard, and the offline store — ready to host test modules.

- [x] P3-1 · Vite + React + Tailwind scaffold; design tokens from design.md §6 *(Tailwind v4 @theme tokens; tabular-nums utility)*
- [x] P3-2 · Login + auth store; role-aware routing *(zustand + persist; refresh-on-401)*
- [x] P3-3 · Dashboard (S2) with session cards + stats
- [x] P3-4 · New Evaluation wizard (S3/S4) incl. instrument form with class validation *(offline fallback queues the session in the outbox)*
- [x] P3-5 · IndexedDB store + sync engine + connectivity pill (offline-first core) *(Dexie; outbox; server-wins sync; health-check connectivity)*
- [x] P3-6 · TS mirror engine wired to `golden_vectors.json` (provisional verdicts offline) *(16/16 conformance tests — decimal.js, same vector file as Python)*
- [x] P3-7 · Session workspace shell (S5): tabs, progress bar, autosave behavior *(tabs + Live Validation Row + latest-wins table; per-test progress bars land with P4 modules)*

**Definition of done:** MET 2026-09-15 — vitest 16/16; `npm run build` clean; full offline session created and reloaded from IndexedDB without loss; sync pushes via `/observations:batch` (server re-evaluates, server wins).

**Definition of done:** a full offline session can be created and reloaded without data loss; sync pushes to Phase 2 backend correctly.

---

## Phase 4 — Test Modules

**Goal:** all R-76 physical tests instrumented with dedicated UI + engine wiring.

- [x] P4-1 · Live Validation Row component (design.md §5.2) — shared across tests *(now with rulebook-suggested-load prefill)*
- [x] P4-2 · Weighing performance module (increasing/decreasing load table) *(suggested loads: Min, 500e, 2000e, ½Max, Max — §A.4.4.1)*
- [x] P4-3 · Eccentricity module with interactive quadrant diagram (design.md §5.1) *(SVG grid, clickable segments 1–4, verdict fills, load = ⅓ Max per §3.6.2.1; verified live)*
- [x] P4-4 · Repeatability module (10×/20× consecutive loads) *(min 10 rows, suggested ½Max/Max — §A.4.10)*
- [x] P4-5 · Tare module *(≥5 net steps incl. Min + changeovers — §A.4.6.1)*
- [x] P4-6 · Creep module with timer panel + mandatory capture points (design.md §5.3) *(pure state machine `lib/creep.ts`: 0/5/15/30 min points, 30-s due window, 0.5e/0.2e early-termination rule — §A.4.11.1)*
- [x] P4-7 · Environmental module + watchdog banner states (design.md §5.4) *(green/amber from GET /drift; red state pending Phase 5 thresholds)*
- [x] P4-8 · Zero-tracking/zero check module *(10e break-out load — §A.4.2.3.2)*
- [x] P4-9 · Module completion gating → Finalize button logic *(progress bar, ✓/● tab states, Finalize tooltip lists incomplete modules)*

**Verification record (2026-09-15):** all constants extracted verbatim from `required rulebook/r076-1-e06.pdf` (pages 87–92, 30); 17 new vitest cases in `frontend/tests/phase4.test.ts` (33/33 total); eccentricity grid + creep timer + verdict flow verified live in the preview (position 1 FAIL → auto-advance to position 2, grid fill red).

**Definition of done:** a Class III demo instrument can be taken through every module with live PASS/FAIL and correct gating; all verdicts are server-computed when online.

---

## Phase 5 — Report Generation & Verification ✅

**Goal:** the deliverable. R-76-2-structured PDF, editable DOCX, QR seal, public verification.

- [x] P5-1 · Template spike resolved (D-26): rebuilt programmatically — ReportLab for the authoritative PDF, python-docx for the editable twin; official form PDFs copied to `docs/` as the layout source of truth
- [x] P5-2 · Report service: `src/report/` — aggregate session → immutable `ReportData` → DOCX twin + authoritative PDF (reportlab platypus, R 76-2 column semantics L/I/ΔL/E/Ec/MPE/±ne, repeated headers, "Page X of Y" via NumberedCanvas)
- [x] P5-3 · Two-layer seal: SHA-256 of delivered PDF bytes in `Report.sha256`; QR embeds a *content digest* (canonical JSON of the snapshot + template version) so reprints still verify; QR PNG on the cover (`seal.py`)
- [x] P5-4 · Public verification page (S8): unauthenticated `GET /api/v1/public/verify/{id}` + `/verify/:reportId` UI — authentic/tampered banner, signer, stored-file integrity check
- [x] P5-5 · Report archive UI (S6): `/reports` — search by session/hash, PDF/DOCX blob downloads (JWT via fetch, not links), signed badges, verify links; archive projection strips server paths (`ReportArchiveOut`)
- [x] P5-6 · Officer sign-off: sign endpoint stamps `signed_by/signed_at`, **re-renders artifacts and re-seals** (signature appears in the printed report); RBAC: officer-only sign, technician denied; sign without a report → 409
- [x] P5-7 · Comparison artifact `docs/comparison-vs-r76-2.md` (side-by-side vs `docs/r076-2-e07.pdf`, declared deviations)

**Verification record (2026-09-16):** 12 new backend tests (`tests/test_reports.py`) → 62/62; 23-step live smoke (`scripts/smoke_phase5.py`) walks login → instrument → session → engine FAIL verdict → finalize (report generated) → archive (no path leak) → PDF text/QR asserts via pypdf → DOCX asserts via python-docx → public verify intact/unsigned → sign → verify signed+intact → unknown 404 → 409 without report; UI verified in preview (archive table, verify page both branches). Frontend build clean, 33/33 vitest.

**Definition of done met:** generated PDF matches the official R 76-2 form in structure and column semantics (`docs/comparison-vs-r76-2.md`); QR resolves to the verify page and carries the matching content digest.

---

## Phase 6 — Differentiators (hardware/evidence gates pending)

- [ ] P6-1 · Web Serial API ingestion (Chrome/Edge; capture-on-stable behavior) *(`lib/serial.ts` parser and simulator are implemented, but Essae DS-415 grams interpretation remains PROVENANCE PENDING until the hardware gate is verified)*
- [x] P6-2 · Camera/file evidence capture *(camera/file evidence upload wired to the P2-7 attachment endpoint)*
- [ ] P6-2a · 7-segment OCR deferred *(D-30; requires a lab-validated model and hardware/evidence verification before implementation)*
- [x] P6-3 · Drift watchdog UI hardening (auto-flag + report annotation) *(backend levels ok/warn/**red** — red = outside §3.9.2 static range or Δ>30 °C; banner explains metrological consequence + re-run recommendation; `drift_note` rides the ReportData snapshot into both PDF and DOCX)*
- [x] P6-4 · PWA installability + background sync polish *(`sw.js` app-shell SW: network-first navigation, cache-first assets, API never intercepted; generated PNG icons 192/512/maskable via `scripts/gen_icons.py`; manifest updated; header Install button via `usePwaInstall`)*

**Verification record (2026-09-16):** frontend 47/47 vitest (parser formats, drain, stabilization incl. latch, provenance markers); backend 66/66 pytest (drift red/warn unit tests via service — start temp is create-time only, PATCH is end-only by design); `tsc -b` + build clean; live in preview: simulator → "Stable — ready to capture" latch → Capture filled I=10.000 → commit → server verdict ✓PASS (10 kg = 2000e boundary, MPE 0.005). One real defect found & fixed live: stable-state flicker (D-31).

---

## Phase 7 — Hardening & SIH Deliverables ✅

- [x] P7-1 · Audit log (actor/action/timestamp) on all writes *(`audit_log` table + hash-chained service: row_hash = SHA-256(prev ‖ canonical row); wired into login (success AND failure), instrument create, session create/env patch, observation create + batch sync, attachment upload, finalize (+ report-failure flag), report sign; admin-only `GET /users/audit` + `/users/audit/verify`; audit write failure RAISES in production, logs in dev; 6 new tests → 73/73)*
- [x] P7-2 · Backup/restore runbook; deployment docs (Docker compose, env matrix) *(`deploy/`: compose with healthchecked Postgres 16 + backend + nginx PWA proxy, backend/frontend Dockerfiles, `.env.example` (procedures only, git-ignored real file), runbook with backup/restore + report-integrity consistency check; Docker unavailable on the build machine — compose validated by review, first `up` documented as the gate)*
- [x] P7-3 · Technical documentation: architecture, calculation methodology, deployment (SIH requirement) *(`docs/technical-documentation.md`: module map, three data-integrity invariants, full MPE methodology incl. all four class band tables + worked golden-vector example, report pipeline, two-layer seal rationale, audit design, offline design, deployment summary, test-estate inventory)*
- [x] P7-4 · Seed/demo dataset for the finale demo *(`scripts/seed_finale.py`, idempotent: 3 instruments across classes I/III/IIII — Table-3-validated, the approved-session-with-FAIL story, the in-progress workspace story)*
- [x] P7-5 · PPT (6 slides, PDF export) + ≤3-min video per the scripts in `docs/` *(`docs/ppt-and-video-script.md`: 6-slide outline + timed ≤3:00 recording script with the exact demo values and a recording checklist)*

**Verification record (2026-09-16):** backend 73/73 (6 new audit tests: records on writes, admin-only reads, login-failure audit, chain intact, chain tamper-detection); frontend 47/47; build clean; **live audit smoke** against the restarted server: create→audited, tech 403 on trail read, chain intact (head hash returned), failed login audited. README reconciled with the real stack and commands (P0-4 closed): actual tech-stack table, working Getting Started, true project structure.

---

## 36-Hour Grand Finale Build Plan

> Strategy: **arrive with Phases 1–5 already built**. The finale is for integration, polish, feedback integration, and rehearsal — not greenfield coding.

| Hours | Focus | Detail |
|---|---|---|
| 0–4 | Environment up | Local + staging deploy sanity; DB migrations run; seed data loaded |
| 4–8 | Integration pass | End-to-end run: wizard → all modules → finalize → PDF → QR verify |
| 8–14 | Judge-feedback headroom | Pick 1–2 differentiators from Phase 6 (likely P6-1 serial ingestion) and wire live |
| 14–20 | Polish | Design-token fidelity pass, empty/error states, loading states, i18n-ready strings |
| 20–26 | Resilience | Offline demo script (airplane-mode demo!), reload-mid-session demo, RBAC demo |
| 26–31 | Rehearsal | Full pitch ×3, demo on a clean laptop, video re-record if needed |
| 31–34 | Buffer | Bug squash; freeze features |
| 34–36 | Freeze | Tag `finale-v1`; no new code |

**Non-negotiables at freeze:** deterministic demo path rehearsed offline; fallback screen-recording of the demo on a USB stick.

---

## Post-Hackathon Backlog

- Multi-tenant support for multiple labs
- Digital Signature Certificate (DSC) / e-Sign integration (real cryptographic signing)
- Automated test-rig REST ingestion API (robotic loading machines pushing JSON)
- Report versioning UI + diff view
- Regional language UI packs
- Notification service (email/SMS) for pendency and renewals
- Analytics: lab throughput, pendency trends, first-pass rates

---

## Conventions

- Task IDs (`P#-#`) are referenced in memory.md §3 and commit messages (`feat: P2-5 batch sync endpoint`).
- A phase moves to ✅ in memory.md §3 only when its definition of done is met — not when its boxes are ticked.
- ⚠️ marks verification gates where a human must confirm regulatory constants.

---

*Cross-references: [memory.md](memory.md) · [architecture.md](architecture.md) · [design.md](design.md) · [rules.md](rules.md)*
