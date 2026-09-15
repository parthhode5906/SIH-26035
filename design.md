# design.md — UI/UX & Visual Design Specification

> **Document class:** Design spec (authority level 4 of 5 — see [rules.md](rules.md)).
> **Scope:** Every screen, component, and visual rule for the PWA — plus the aesthetics of the generated PDF report.
> **Status:** Canonical for UI decisions. Where this doc and a screenshot disagree, the code is wrong.

---

## 1. Users, Contexts & Constraints

### 1.1 Personas

| Persona | Goal | Frequency | Key needs |
|---|---|---|---|
| **Lab Technician** | Record readings fast and correctly during physical tests | Daily, multi-hour sessions | Numeric-first input, zero ambiguity, live PASS/FAIL, offline resilience |
| **Approving Officer** | Review completed sessions, sign reports | Daily, short bursts | Clean review view, one-click sign, audit confidence |
| **Admin** | Manage users, monitor activity | Weekly | Dashboards, user management, search |
| **Public verifier** | Scan QR, confirm report authenticity | Rare | Single unauthenticated page, instant answer |

### 1.2 Environmental constraints (these drive design decisions)

- Labs are often in basements / industrial zones → **offline-first is non-negotiable**; connectivity indicator always visible.
- Sessions run 30 min–4 h (creep tests) → autosave everything, never lose input, session state survives reload.
- Gloves, keyboards, tablets on carts → large hit targets (≥44 px), numeric keypads for all metrology inputs.
- Displays near bright light → high contrast; PASS/FAIL readable at arm's length.

---

## 2. Screen Inventory

| # | Screen | Route | Primary user | Purpose |
|---|---|---|---|---|
| S1 | Login | `/login` | all | JWT auth |
| S2 | Dashboard | `/` | tech, officer | Queue: in-progress, pending review, completed; quick stats |
| S3 | New Evaluation wizard | `/evaluations/new` | technician | Step 1 of session creation |
| S4 | Instrument spec form | inside S3 | technician | The "DNA" capture (class, Max, Min, e, d) |
| S5 | Session workspace | `/sessions/:id` | technician | Tabbed test modules + env panel + progress |
| S6 | Report preview & archive | `/reports`, `/reports/:id` | all roles | View/download PDF/DOCX, search |
| S7 | Admin console | `/admin` | admin | Users, activity, pendency |
| S8 | Public verification | `/verify/:reportId` | public (QR) | Report authenticity check |

---

## 3. The New Evaluation Wizard (S3/S4)

Sequential steps; each step validates before allowing advance:

1. **Instrument** — select existing instrument or create new (S4 fields: manufacturer, model, serial, accuracy class, Max, Min, e, d, base unit). Validation runs `engine.validate_instrument_spec` server-side on save; class/interval consistency errors block progression with explanations.
2. **Environment snapshot** — start temperature, humidity, pressure (pre-filled from last session where sensible; editable).
3. **Test plan** — auto-selected required tests per class; technician can see but not skip mandatory ones.
4. **Review & start** — summary card; "Start session" locks instrument parameters (session-scoped immutability).

**Rule:** instrument metrological parameters cannot be edited after a session starts. A mistake means a new session (append-only philosophy extends here).

---

## 4. Session Workspace (S5) — the heart of the app

### 4.1 Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Session: INSTRUMENT-NAME · Class III · e=5 g · [ONLINE ●/OFF]  │
├────────────────────────────────────────────────────────────────┤
│ [Weighing] [Eccentricity] [Repeatability] [Tare] [Creep] [Env] │  ← test tabs
├────────────────────────────────────────────────────────────────┤
│                                                                │
│              ACTIVE TEST MODULE (see §5)                       │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Progress: ▓▓▓▓▓░░░░░ 5/9 tests complete   [Finalize & Report]  │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Behavior rules

- Tabs show completion state (✓ / in-progress / empty).
- **Finalize is disabled** until every required test module is complete; tooltip lists what's missing.
- Autosave: every committed observation row persists to IndexedDB instantly; sync status icon in header.
- Offline: all modules fully usable; verdicts shown as *provisional* (amber badge) until server confirms on sync.

---

## 5. Flagship Components

### 5.1 Interactive Eccentricity Grid

- SVG top-down view of the weighing pan: center + 4 quadrants (numbered 1–5 per R 76-2 layout).
- Click a quadrant → opens the numeric entry row for that position → reading logged and rendered on the diagram (green/red per verdict).
- Completed positions visibly filled; the R-76-2 required position sequence is suggested by numbered highlighting.

### 5.2 Live Validation Row (used in EVERY numeric test)

The single most important component — the demo showpiece.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Load (L)  Indication (I)  ΔL     E        Ec       MPE       Verdict   │
│ 5.000     5.006           0.000  +0.006   +0.006   ±0.0025   🔴 FAIL   │
└────────────────────────────────────────────────────────────────────────┘
```

- As the technician types `I`, the row instantly shows computed E, Ec, the MPE limit for that load, and PASS/FAIL.
- Online: values come from the backend engine (typed → debounced evaluate call, or evaluate-on-commit per performance choice in Phase 4).
- Offline: TS mirror engine provides provisional values (amber "provisional" chip).
- Verdict cell: green fill (PASS) / red fill (FAIL), white bold text, ≥44 px tall.

### 5.3 Creep Timer Panel

- Built-in countdown/elapsed timer; mandatory capture points at 0, 5, 15, 30 min (extendable to 4 h).
- Timer chip turns amber at each capture point: "Record reading now."
- Chart strip shows drift over time as readings accumulate.

### 5.4 Environmental Watchdog Banner

- Session header banner; green (within limits) → amber (approaching limit) → red (drift exceeded).
- Red state: banner explains the metrological consequence and recommends restarting the affected tests; session flag persisted for the report.

### 5.5 Numeric Input Discipline

- All metrology inputs: numeric keypad, unit locked to the instrument's base unit, step validated against `d`.
- No free-text numbers, ever. Paste is allowed but re-validated.

---

## 6. Design System Foundations

### 6.1 Color tokens

| Token | Value (baseline) | Use |
|---|---|---|
| `--pass` | emerald 600 `#059669` | PASS verdicts, completion checks |
| `--fail` | red 600 `#DC2626` | FAIL verdicts, blocking errors |
| `--warn` | amber 500 `#F59E0B` | provisional values, drift-approaching |
| `--surface` | slate 50 `#F8FAFC` | app background |
| `--surface-raised` | white | cards, tables |
| `--ink` | slate 900 `#0F172A` | primary text |
| `--ink-muted` | slate 500 `#64748B` | secondary text |
| `--accent` | blue 600 `#2563EB` | primary actions, links |

### 6.2 Typography

- UI: Inter (or system stack). Tabular numerals (`font-variant-numeric: tabular-nums`) for ALL metrology columns — alignment is correctness-affirming.
- Monospace for raw readings in review views: JetBrains Mono or ui-monospace.

### 6.3 Spacing & density

- 4 px base grid; tables dense (technicians see many rows), buttons generous.
- Verdict cells and primary CTAs ≥44 px height.

### 6.4 Iconography & states

- Outline icon set (e.g., Lucide). State badges: filled dot + label (`PASS`, `FAIL`, `PROVISIONAL`, `SYNCING`).
- Connectivity: persistent header pill — `ONLINE` (green) / `OFFLINE — saving locally` (amber).

---

## 7. Interaction & Validation Rules

1. **Never block typing.** Validate on blur/commit; inline errors appear under the field with a plain-language explanation ("Load exceeds Max capacity 15 kg").
2. **Impossible inputs are rejected with reasons**, not silently clamped.
3. **Destructive actions require confirmation** (finalizing a session, signing a report).
4. **Keyboard-first:** Enter commits row, arrow keys move between rows — technicians' hands stay on the keyboard.
5. **Every verdict displayed is engine output.** The UI never derives PASS/FAIL itself (mirrors the ADR-11 rule in architecture.md §4.3).
6. Session reload mid-test restores full state from IndexedDB/server — zero data loss tolerance.

---

## 8. Dashboard (S2) & Review (S6)

- **Dashboard:** card per active session (instrument, progress bar, last activity); stats row (in-progress / completed / pending approval); recent reports list. Admin sees pendency + user activity.
- **Review/archive:** searchable table (manufacturer, model, serial, date, status, verdict); filters by class and date range; row → report preview with embedded PDF viewer; download PDF/DOCX buttons; sign action for officers.

---

## 9. The Generated PDF (aesthetic spec)

The PDF is a designed artifact, not a printout of a webpage.

- **Layout source of truth:** official OIML R-76-2 Pattern Evaluation Report (kept in `docs/`).
- Multi-column tables with continuous borders; headers repeated on every page; page numbers "Page X of Y".
- Cover page: lab identity, instrument identity block, verdict summary, QR seal (encodes `{verify_url, report_id, sha256}`), signature blocks for *Tested by* / *Authorized Signatory*.
- Body: per-test tables exactly matching R-76-2 column semantics (L, I, ΔL, E, Ec, MPE, Pass/Fail), env conditions, attachments index.
- Fonts embedded; tabular numerals; no color dependence for meaning (verdicts also carry ✓/✗ glyphs) for grayscale printing.
- DOCX export (Docxtpl) must contain identical content; PDF is the authoritative rendering.

---

## 10. Accessibility

- WCAG 2.1 AA targets: contrast ≥4.5:1 for text, ≥3:1 for verdict fills; visible focus rings; full keyboard operability; `aria-live` announcement of PASS/FAIL verdicts as they land.
- All forms labeled; error messages tied to inputs via `aria-describedby`.

---

*Cross-references: [architecture.md](architecture.md) · [memory.md](memory.md) · [phases.md](phases.md) · [rules.md](rules.md)*
