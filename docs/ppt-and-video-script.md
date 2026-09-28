# SIH 2026 — Presentation & Video Assets (P7-5)

Two artifacts live here: the **6-slide PPT outline** and the **≤3-minute
demo video script**. Both are written to be executed directly — every
value shown on screen is real and reproducible from the finale dataset
(`backend/scripts/seed_finale.py`).

---

## Part 1 — PPT outline (6 slides)

**Slide 1 · The problem is money you can't see**
- Every rupee transaction rides on a weighing instrument. Before any model
  reaches a shop, a government lab must approve it under OIML R-76 — and
  those labs run on Excel and Word.
- Numbers: manual MPE math per reading, ~4 h of paperwork per instrument,
  zero uniformity between labs, no tamper evidence.
- One line: **"We turn a 4-hour paperwork ritual into a 10-minute
  deterministic workflow."**

**Slide 2 · The rulebook, as law, in code**
- Screenshot: `engine/mpe_rules.py` band table + the R 76-1 PDF beside it.
- E = I + ½e − ΔL − L; Ec = E − E₀; PASS iff |Ec| ≤ MPE — Decimal-only.
- Key point for judges: **constants are data extracted from the official
  PDF with recorded provenance** — not hardcoded guesses.

**Slide 3 · The workflow (one screenshot, whole story)**
- Session workspace: rulebook-suggested loads, live PASS/FAIL row,
  eccentricity grid, creep timer, drift watchdog, completion gating.
- Live scale → capture-on-stable → row. Offline → IndexedDB → sync.

**Slide 4 · The deliverable: a report that defends itself**
- Generated R 76-2 PDF beside the official form; QR seal → public verify
  page (✓ Authentic / ✗ tampered).
- Two-layer seal: file SHA-256 + content digest in the QR.
- Officer sign-off re-renders + re-seals. Audit log with hash chain.

**Slide 5 · Engineering rigor (what teams usually fake)**
- Append-only observations, server-computed verdicts, Decimal-only
  metrology (73 backend tests; the TS mirror runs the same golden vectors).
- Docker compose + Postgres for real deployment; runbook + env matrix.

**Slide 6 · Impact & roadmap**
- adoption: every state Legal Metrology lab + GATCs; faster model
  approval = compliant instruments reach the market sooner.
- Roadmap: real DSC/e-Sign, automated test-rig REST ingestion, multi-lab
  tenancy, regional languages.

---

## Part 2 — Demo video script (≤ 3:00)

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:20 | Login → dashboard | "Legal metrology labs approve every new weighing scale model in India. Today that's Excel and Word. This is our replacement — offline-first, deterministic, and sealed." |
| 0:20–0:50 | Open live session; simulator "Live scale" chip; capture fills I | "Readings flow straight from the instrument over serial. The app waits for a stable reading — three matching frames — and fills the row. The engineer still commits it: the human stays in the loop." |
| 0:50–1:20 | Type I = 5.012 on L = 5.006 → red FAIL row | "As the reading is typed, the engine computes E, Ec, and the MPE from the official R 76-1 tables — here 0.006 kg against a 0.005 kg limit. FAIL, instantly, with the clause cited." |
| 1:20–1:50 | Toggle airplane mode → amber OFFLINE pill → commit another row → reconnect | "Basement labs have no signal. We kill the network: the session keeps working, verdicts come from the on-device mirror, and everything syncs the moment we're back — server-verified." |
| 1:50–2:20 | Finalize → report panel → open PDF → scan QR with phone → verify page | "Finalize generates the official R 76-2 report, sealed two ways — a file hash and a QR carrying the content digest. Anyone can scan it: authentic, signed, integrity-checked." |
| 2:20–2:45 | Audit trail + chain verify; reports archive search | "Every write is audited in a hash-chained trail. Search any past report by model, serial, or seal." |
| 2:45–3:00 | Slide 6 impact line | "Deterministic metrology for the labs that guard fair trade. Built to the rulebook — verifiable at every step." |

**Recording checklist:** Chrome profile signed in as `tech@lab.gov.in`;
finale dataset seeded; display brightness high on the FAIL row; phone QR scan on
camera for 5 s; record at 1080p; also export a screen-recording fallback
to USB (freeze rule in phases.md).
