# P5-7 · Structural comparison — generated report vs. official OIML R 76-2

Purpose (phases.md P5-7): demonstrate that the generated PDF follows the
official *Pattern Evaluation Report* structure. This artifact pairs each
section of our output with its counterpart in `docs/r076-2-e07.pdf`
(62-page official form, OIML 2006 edition).

## Side-by-side

| Official R 76-2 sheet | Our generated report (r76-2-v1) | Where in code |
|---|---|---|
| Cover / general information blocks (instrument type, manufacturer, model, serial, class, Max/Min/e) | Cover page §1 "Instrument identity" — same fields incl. n = Max/e | `report/pdf.py::_cover` ← `aggregate.py` |
| Metrological characteristics + ambient conditions recorded per sheet | §2 "Laboratory & environmental conditions" (start/end temp, RH, pressure) | `aggregate.py::aggregate_session` |
| Examiner / responsible person blocks per sheet | §3 "Personnel" (Tested by / Authorized Signatory) + signature blocks | `pdf.py` cover + body |
| Sheet 1 "WEIGHING PERFORMANCE (A.4.4) (A.5.3.1)" — columns L, I, ΔL, E, E₀/Ec, MPE | §5.1 Weighing performance — columns L, I, ΔL, E, Ec, MPE, MPE in ±ne, verdict | `pdf.py::_observation_table` |
| Sheet 3 "ECCENTRICITY (A.4.7)" — 4-position loading diagram | §5.2 Eccentricity section (position column; interactive quadrant grid in the UI at entry time) | `aggregate.py` TEST_ORDER, `EccentricityGrid.tsx` |
| Sheet 5 "REPEATABILITY (A.4.10)" | §5.3 Repeatability | same table renderer |
| Sheet 9 "TARE (A.4.6)" | §5.4 Tare | same table renderer |
| Creep / return-to-zero (A.4.11) | §5.5 Creep / return to zero | same table renderer |
| Zero-tracking break-out (A.4.2.3.2) | §5.6 Zero check (10e) | same table renderer |
| Result / conclusion blocks signed by the authority | §6 "Result summary" + OVERALL RESULT box on cover + signature blocks | `pdf.py::_body` |
| — (paper-era artifact) | §4 "Verification seal": QR → public verify URL, content digest + SHA-256 of the file | `report/seal.py`, `service.py` |

## Column semantics (sheet 1 vs. our table)

Official columns for the weighing test: load L, indication I, additional
load ΔL (small-weights changeover method), error E = I + ½e − ΔL − L,
corrected error Ec = E − E₀, MPE (R 76-1 §3.5, Table 6). Our table renders
exactly these columns plus the verdict, computed by the same formulas the
engine stores at insert (`engine/mpe_rules.py`, golden-vector tested).

## Deviations, declared honestly

1. **Scope.** The official form spans 17+ test sheets; the MVP renders the
   six modules implemented in Phase 4 (the highest-value metrological core).
   Adding sheets = adding entries to `TEST_ORDER` — the renderer is generic.
2. **Electronic delivery.** The QR seal and public verification page are
   additions the paper form cannot have; they implement the PS 26035 ask
   for a "digital repository" and tamper evidence.
3. **Layout fidelity target.** Structure, ordering, and column semantics
   follow R 76-2; exact visual reproduction of OIML's form furniture is a
   final-mile polish item, not a metrological gap.

## How to regenerate the comparison

```bash
cd backend && PYTHONIOENCODING=utf-8 ./.venv/Scripts/python scripts/smoke_phase5.py
# → reports/<session>.pdf + .docx; open reports dir next to docs/r076-2-e07.pdf
```
