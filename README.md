# OMIL-R76-compliance-engine
# ⚖️ NAWI Compliance Suite
### Automated Test Report Generator for Non-Automatic Weighing Instruments (OIML R-76)

**Smart India Hackathon 2026 — Problem Statement PS 26035**

> A deterministic, offline-first Progressive Web App that turns raw weighing-instrument readings into pixel-perfect, cryptographically verifiable OIML R-76-2 pattern evaluation reports — eliminating manual calculation errors and formatting inconsistencies in legal metrology test labs.

---

## 📌 Problem Statement

**PS 26035** calls for software that generates standardized test reports for Non-Automatic Weighing Instruments (NAWI) in compliance with OIML R-76 (Non-automatic weighing instruments — Metrological and technical requirements). Legal metrology labs currently rely on manual spreadsheets and Word templates to compute Verification Scale Intervals, Maximum Permissible Errors, and pass/fail determinations — a process that is slow, error-prone, and inconsistent across labs and inspectors.

## 💡 Our Solution

We built a browser-based Metrology Compliance Engine that:
1. **Ingests** weighing data directly from the instrument through a serial connection or built-in simulator — no manual transcription.
2. **Computes** e, MPE, and pass/fail status deterministically using codified OIML R-76 formulas — no spreadsheet drift.
3. **Monitors** ambient lab conditions throughout the test cycle to flag environmental non-compliance.
4. **Generates** a pixel-perfect PDF report matching the official R-76-2 pattern evaluation format, sealed with a tamper-evident QR code.

All of this runs **offline-first** as a PWA, so labs with unreliable connectivity aren't blocked.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Metrology Compliance Engine** | Deterministic calculation of Verification Scale Interval (e) and Maximum Permissible Error (MPE) for Accuracy Classes I, II, III, and IIII per OIML R-76 |
| **Direct Data Ingestion** | Web Serial API for direct RS-232/USB scale connection, capture-on-stable readings, and a built-in simulator |
| **Environmental Drift Watchdog** | Continuous logging of temperature, relative humidity, and barometric pressure during the test cycle, with automatic flagging if conditions drift outside permissible bounds |
| **Interactive Eccentricity Diagram** | 2D interactive weighing-pan diagram to guide and record the eccentricity (corner-loading) test |
| **Pixel-Perfect PDF Generation** | Output report matches the official OIML R-76-2 pattern evaluation report layout, down to spacing and table structure |
| **Tamper-Evident QR Verification** | Each report is sealed with a cryptographically hashed QR code encoding the instrument model, pass/fail result, and original report hash — enabling instant authenticity checks |
| **Offline-First PWA** | IndexedDB local caching means the app works fully offline, syncing when connectivity returns |

---

## 🏗️ Tech Stack

- **Frontend:** React 19 + TypeScript + Vite PWA (Tailwind v4, Zustand, Dexie/IndexedDB, service worker)
- **Backend:** Python FastAPI + SQLAlchemy 2 — PostgreSQL in production, SQLite for dev
- **Core logic:** pure-Python `decimal` engine (zero floats) + a TypeScript mirror (decimal.js) that runs the *same* golden-vector test file
- **Reports:** ReportLab (authoritative PDF) + python-docx (editable Word twin), both from one immutable snapshot
- **Sealing:** SHA-256 file digest + QR content digest; public verification page
- **Hardware:** Web Serial API (Chrome/Edge, 9600 8N1) with capture-on-stable + built-in simulator
- **Security:** JWT auth (bcrypt), RBAC, append-only observations, hash-chained audit log

## 🧮 Metrology Engine — Core Logic

```
Input:  Accuracy Class (I / II / III / IIII), Max, Min, d
Derived server-side: e (the verification scale interval) from the instrument contract
Output: E, Ec, MPE and Pass/Fail per test load — computed server-side at insert

1. Validate the instrument against R 76-1 Table 3 (n = Max/e class ranges)
2. Error prior to rounding:  E  = I + ½·e − ΔL − L          (§A.4.4.3)
3. Corrected error:          Ec = E − E₀
4. MPE from the Table-6 band for the class at m = L/e (inclusive upper edge)
5. Verdict: PASS iff |Ec| ≤ MPE  — stored, never recomputed client-side
```

Full methodology (all four class band tables, worked example, ambient-drift
rules): [`docs/technical-documentation.md`](docs/technical-documentation.md).

---

## 🚀 Getting Started

**Backend** (Python 3.12):

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Unix-like shells (including Git Bash):
source .venv/bin/activate
pip install -r requirements.txt
python -m scripts.seed            # demo users (demo-password-2026) + instrument
python -m uvicorn src.api.main:app --host :: --port 8000
```

**Frontend** (Node 22):

```bash
cd frontend
npm install
npm run dev           # http://localhost:5173 (proxies /api to :8000)
```

Sign in as `tech@lab.gov.in` / `demo-password-2026` (officer and admin
accounts exist too). For the full finale demo dataset run
`python -m scripts.seed_finale`.

**Docker (production-style):** see [`deploy/README.md`](deploy/README.md) —
one compose file brings up Postgres + backend + nginx-served PWA.

---

## 📂 Project Structure

```
OMIL-R76-compliance-engine/
├── backend/                   # Python FastAPI Backend
│   ├── src/
│   │   ├── engine/            # OIML R-76 math engine (Decimal-only, band tables)
│   │   ├── services/          # workflow orchestration (sessions, instruments, audit)
│   │   ├── api/               # FastAPI routers, Pydantic schemas, RBAC, audit glue
│   │   ├── report/            # aggregate → ReportLab PDF + DOCX twin + QR seal
│   │   └── db/                # SQLAlchemy models (append-only observations + audit log)
│   ├── tests/                 # 73 tests incl. golden vectors shared with the frontend
│   └── scripts/               # seed, seed_finale, smoke scripts, icon generator
├── frontend/                  # React PWA Frontend
│   ├── src/
│   │   ├── engine/            # TS mirror of the Python engine (same golden vectors)
│   │   ├── hooks/             # useScaleConnection (Web Serial), usePwaInstall
│   │   ├── components/        # live validation row, eccentricity grid, evidence, panels
│   │   ├── db/                # IndexedDB offline store + outbox
│   │   ├── lib/               # requirements.ts (rulebook predicates), serial.ts, sync
│   │   └── pages/             # Dashboard, Workspace, Reports, Verify, Login
│   ├── public/                # PWA manifest, service worker, icons
│   └── tests/                 # mirror conformance + module tests (47)
├── deploy/                    # docker-compose, Dockerfiles, nginx, runbook
├── docs/                      # technical documentation, R 76-2 comparison, PPT/video scripts
└── README.md

---

## 🎯 What Makes This Different

- **Deterministic, not discretionary** — calculations follow codified OIML formulas, removing human/spreadsheet error.
- **Hardware-aware** — direct serial ingestion (capture-on-stable) plus a built-in simulator; camera evidence is supported, while OCR display reading remains deliberately deferred.
- **Verifiable at a glance** — the two-layer seal (file SHA-256 + QR content digest) lets any inspector confirm a report hasn't been altered, via a public page that needs no login.
- **Built for real lab conditions** — offline-first design and environmental monitoring address practical failure points that purely digital form-fillers ignore.

---

## 👥 Team

| Name | Role |
|---|---|
| [Name] | [Role] |
| [Name] | [Role] |
| [Name] | [Role] |

## 📄 License

[Choose a license, e.g. MIT]

## 🔗 Links

- **Demo Video:** [link]
- **Live Demo / Deployed App:** [link]
- **Problem Statement Reference:** PS 26035 — Smart India Hackathon 2026
