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
1. **Ingests** weighing data directly from the instrument (serial connection or OCR from a display photo) — no manual transcription.
2. **Computes** e, MPE, and pass/fail status deterministically using codified OIML R-76 formulas — no spreadsheet drift.
3. **Monitors** ambient lab conditions throughout the test cycle to flag environmental non-compliance.
4. **Generates** a pixel-perfect PDF report matching the official R-76-2 pattern evaluation format, sealed with a tamper-evident QR code.

All of this runs **offline-first** as a PWA, so labs with unreliable connectivity aren't blocked.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Metrology Compliance Engine** | Deterministic calculation of Verification Scale Interval (e) and Maximum Permissible Error (MPE) for Accuracy Classes I, II, III, and IIII per OIML R-76 |
| **Multi-Mode Data Ingestion** | Web Serial API for direct RS-232/USB scale connection; OCR fallback for reading 7-segment digital displays from photos |
| **Environmental Drift Watchdog** | Continuous logging of temperature, relative humidity, and barometric pressure during the test cycle, with automatic flagging if conditions drift outside permissible bounds |
| **Interactive Eccentricity Diagram** | 2D interactive weighing-pan diagram to guide and record the eccentricity (corner-loading) test |
| **Pixel-Perfect PDF Generation** | Output report matches the official OIML R-76-2 pattern evaluation report layout, down to spacing and table structure |
| **Tamper-Evident QR Verification** | Each report is sealed with a cryptographically hashed QR code encoding the instrument model, pass/fail result, and original report hash — enabling instant authenticity checks |
| **Offline-First PWA** | IndexedDB local caching means the app works fully offline, syncing when connectivity returns |

---

## 🏗️ Tech Stack

- **Frontend:** Progressive Web App (PWA), IndexedDB for offline storage
- **Hardware Interface:** Web Serial API (RS-232/USB)
- **Computer Vision:** OCR engine for 7-segment display reading
- **PDF Generation:** [Your PDF library, e.g. pdf-lib / jsPDF] for pixel-accurate R-76-2 layout replication
- **Security:** Cryptographic hashing (e.g. SHA-256) + QR code generation for report integrity
- **Core Logic:** Deterministic JavaScript/TypeScript math engine implementing OIML R-76 formulas

## 🧮 Metrology Engine — Core Logic

```
Input:  Accuracy Class (I / II / III / IIII), Max Capacity, Min Capacity, e (verification scale interval)
Output: MPE at each test load, Pass/Fail determination per OIML R-76 Table

1. Determine e and number of verification scale intervals (n = Max / e)
2. Look up MPE bands based on Accuracy Class and n
3. Compare actual reading deviation against MPE at each test load
4. Flag Pass / Fail / Marginal per load point
5. Aggregate results into the final pattern evaluation verdict
```

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/pratikyeokar8b40/OMIL-R76-compliance-engine.git
cd OMIL-R76-compliance-engine

# Install dependencies
npm install

# Run locally
npm run dev
```

Open `http://localhost:<port>` in a Web Serial API–compatible browser (Chrome/Edge) to connect to a physical scale, or use the OCR upload flow for offline/manual testing.

---

## 📂 Project Structure

```
oiml-r76-compliance-engine/
├── backend/                   # Python FastAPI Backend
│   ├── src/
│   │   ├── engine/            # OIML R-76 math engine (e, MPE, pass/fail logic)
│   │   ├── environment/       # Drift watchdog (temp/humidity/pressure monitoring)
│   │   ├── report/            # PDF generation (ReportLab) + Crypto QR sealing
│   │   ├── api/               # REST endpoints mapping frontend to the engine
│   │   └── db/                # PostgreSQL database models and schemas
│   └── requirements.txt
├── frontend/                  # React PWA Frontend
│   ├── src/
│   │   ├── ingestion/         # Web Serial API + Camera OCR modules
│   │   ├── components/        # UI incl. interactive eccentricity diagram & test grids
│   │   ├── db/                # IndexedDB offline storage syncing logic
│   │   └── pages/             # Dashboard, Test Sessions, and Login views
│   ├── public/                # PWA manifest, offline service workers, icons
│   └── package.json
├── docs/                      # SIH PPT, OIML R-76 rulebooks, sample PDF reports
└── README.md

---

## 🎯 What Makes This Different

- **Deterministic, not discretionary** — calculations follow codified OIML formulas, removing human/spreadsheet error.
- **Hardware-aware** — direct serial ingestion is a rare capability among report-generation tools in this space.
- **Verifiable at a glance** — the QR-hash seal lets any inspector or auditor confirm a report hasn't been altered, without needing the original software.
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
