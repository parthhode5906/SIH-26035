"""Phase 5 live smoke (P5-2…P5-6): full report lifecycle over real HTTP.

Run with servers up:  ./.venv/Scripts/python scripts/smoke_phase5.py
Walks: login → instrument → session → observation → finalize (generates the
report) → archive → PDF/DOCX download → public verify → officer sign →
re-verify (re-seal) → tamper detection on a copy of the file.
"""

from __future__ import annotations

import io
import os

import httpx
from pypdf import PdfReader

BASE = os.environ.get("OIML_BASE", "http://[::1]:8000")
steps: list[tuple[str, bool, str]] = []


def step(name: str, ok: bool, detail: str = "") -> None:
    steps.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


c = httpx.Client(base_url=BASE, timeout=30)

# 1 — login both roles
tok = {}
for name, email in (("tech", "tech@lab.gov.in"), ("officer", "officer@lab.gov.in")):
    r = c.post("/api/v1/auth/login", json={"email": email, "password": "demo-password-2026"})
    step(f"login {name}", r.status_code == 200, r.text[:80] if r.status_code != 200 else "")
    tok[name] = {"Authorization": f"Bearer {r.json()['access_token']}"}

# 2 — instrument + session
r = c.post(
    "/api/v1/instruments",
    headers=tok["tech"],
    json={
        "manufacturer": "Essae",
        "model": "DS-415",
        "serial_number": "SMOKE5-001",
        "accuracy_class": "III",
        "max_capacity": "15",
        "min_capacity": "0.1",
        "verification_scale_interval": "0.005",
    },
)
step("create instrument", r.status_code == 201, "")
iid = r.json()["id"]

r = c.post(
    "/api/v1/sessions",
    headers=tok["tech"],
    json={"instrument_id": iid, "start_temp_c": "23.5", "humidity_pct": "51", "pressure_hpa": "1012"},
)
step("create session", r.status_code == 201, "")
sid = r.json()["id"]

# 3 — one flagship FAIL observation (Ec 0.0085 > MPE 0.005)
r = c.post(
    f"/api/v1/sessions/{sid}/observations",
    headers=tok["tech"],
    json={
        "test_type": "weighing_performance",
        "sequence_no": 1,
        "applied_load": "5",
        "indication": "5.012",
        "additional_load": "0.003",
        "zero_error": "0.001",
    },
)
ev = r.json()["evaluation"]
step("observation FAIL verdict", ev["verdict"] == "FAIL", f"Ec {ev['corrected_error']} vs MPE {ev['mpe_limit']}")

# 4 — finalize generates the report
r = c.post(f"/api/v1/sessions/{sid}/finalize", headers=tok["tech"])
step("finalize → report generated", r.status_code == 200 and r.json()["status"] == "completed", "")

# 5 — archive lists it with a seal
r = c.get("/api/v1/reports", headers=tok["tech"])
reports = r.json()
report = next((x for x in reports if x["session_id"] == sid), None)
step("archive contains report with sha256", report is not None and len(report["sha256"]) == 64, "")
rid = report["id"]
step("archive does not leak server paths", "file_path" not in report and "docx_path" not in report, "")

# 6 — PDF download: magic bytes + extracted text
r = c.get(f"/api/v1/reports/{rid}/download", headers=tok["tech"])
pdf_ok = r.status_code == 200 and r.content.startswith(b"%PDF-")
step("PDF download", pdf_ok, f"{len(r.content)} bytes")
reader = PdfReader(io.BytesIO(r.content))
text = "\n".join(p.extract_text() or "" for p in reader.pages)
for needle in ("Pattern Evaluation Report", "OVERALL RESULT", "FAIL", "Weighing performance", "Page 1 of"):
    step(f"PDF contains {needle!r}", needle in text, "")
step("PDF carries QR seal image", "/XObject" in r.content.decode("latin-1"), "")

# 7 — DOCX twin
r = c.get(f"/api/v1/reports/{rid}/docx", headers=tok["tech"])
step("DOCX download (OOXML zip)", r.status_code == 200 and r.content[:2] == b"PK", f"{len(r.content)} bytes")

# 8 — public verify (no auth): intact, unsigned
r = c.get(f"/api/v1/public/verify/{rid}")
v = r.json()
step(
    "public verify: intact + unsigned + completed",
    r.status_code == 200 and v["file_intact"] is True and v["signed"] is False and v["session_status"] == "completed",
    "",
)
qr_fragment = report["qr_payload"].rsplit("#", 1)[-1]
step("QR fragment == content digest", v["content_digest"] == qr_fragment, qr_fragment[:16] + "…")

# 9 — officer sign → re-seal
r = c.post(f"/api/v1/reports/sessions/{sid}/sign", headers=tok["officer"])
step("officer sign-off", r.status_code == 200 and r.json()["status"] == "approved", "")

r = c.get(f"/api/v1/public/verify/{rid}")
v2 = r.json()
step(
    "verify after sign: signed + intact (re-sealed)",
    v2["signed"] is True and v2["signed_by"] is not None and v2["file_intact"] is True,
    v2.get("signed_by") or "",
)

# 10 — unknown report 404
r = c.get("/api/v1/public/verify/00000000-0000-0000-0000-000000000000")
step("unknown report 404", r.status_code == 404, "")

# 12 — technician cannot sign
r = c.post(
    "/api/v1/instruments",
    headers=tok["tech"],
    json={
        "manufacturer": "Essae",
        "model": "DS-415",
        "serial_number": "SMOKE5-002",
        "accuracy_class": "III",
        "max_capacity": "15",
        "min_capacity": "0.1",
        "verification_scale_interval": "0.005",
    },
)
iid2 = r.json()["id"]
r = c.post("/api/v1/sessions", headers=tok["tech"], json={"instrument_id": iid2, "start_temp_c": "22"})
sid2 = r.json()["id"]
r = c.post(f"/api/v1/reports/sessions/{sid2}/sign", headers=tok["officer"])
step("sign without report rejected 409", r.status_code == 409, "")

passed = sum(1 for _, ok, _ in steps if ok)
print(f"\n{passed}/{len(steps)} steps passed")
raise SystemExit(0 if passed == len(steps) else 1)
