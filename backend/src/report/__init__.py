"""Report generation & verification package (Phase 5).

Layout:
- ``aggregate`` — session → immutable ReportData snapshot (single source
  of truth for every renderer);
- ``pdf``       — authoritative R-76-2 PDF (ReportLab platypus);
- ``docx``      — editable DOCX twin (python-docx);
- ``seal``      — SHA-256 hashing + QR payload/PNG;
- ``service``   — orchestration: render, two-layer seal, persist.
"""

from .aggregate import ReportData, aggregate_session, test_title
from .pdf import render_pdf
from .docx import render_docx
from .seal import qr_payload, qr_png_bytes, sha256_hex
from .service import content_digest, generate_report, regenerate_artifacts, reverify_bytes

__all__ = [
    "ReportData",
    "aggregate_session",
    "test_title",
    "render_pdf",
    "render_docx",
    "qr_payload",
    "qr_png_bytes",
    "sha256_hex",
    "content_digest",
    "generate_report",
    "regenerate_artifacts",
    "reverify_bytes",
]
