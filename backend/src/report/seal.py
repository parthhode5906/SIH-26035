"""Integrity seal for generated reports (P5-3, architecture.md §7.3).

``sha256_hex`` is the single hashing primitive used for both the PDF bytes
seal and the QR payload; ``qr_payload`` builds the verification URL that the
QR code on the report cover encodes. ``qr_png_bytes`` renders that payload
as a PNG for embedding in the PDF and DOCX.
"""

from __future__ import annotations

import hashlib
import io
from typing import Final

import qrcode
from qrcode.constants import ERROR_CORRECT_M

#: Error-correction level M (~15% recoverable) balances scan reliability
#: against module density on a printed A4 cover page.
_QR_ERROR_CORRECTION: Final = ERROR_CORRECT_M
_QR_BOX_SIZE: Final = 6
_QR_BORDER: Final = 2


def sha256_hex(data: bytes) -> str:
    """Lowercase hex SHA-256 of ``data`` — the report's integrity seal."""
    return hashlib.sha256(data).hexdigest()


def qr_payload(verify_base_url: str, report_id: str, sha256: str) -> str:
    """QR content: ``{verify_base_url}/{report_id}#{sha256}``.

    The hash rides in the URL fragment so a scanner app that merely opens
    the link still lands on the verification page, while the fragment keeps
    the hash out of server logs (it is compared client-side against the
    stored seal too).
    """
    return f"{verify_base_url.rstrip('/')}/{report_id}#{sha256}"


def qr_png_bytes(payload: str) -> bytes:
    """Render ``payload`` as a PNG QR image for embedding in documents."""
    qr = qrcode.QRCode(error_correction=_QR_ERROR_CORRECTION, box_size=_QR_BOX_SIZE, border=_QR_BORDER)
    qr.add_data(payload)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    return buf.getvalue()
