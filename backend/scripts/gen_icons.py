"""Generate PWA icons (P6-4) — Chrome installability wants raster PNGs.

Draws the brand mark: blue rounded square, white balance-beam glyph and
"R76". Run once; output lands in frontend/public/. Pillow is already a
dependency (qrcode pulls it in).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public"
ACCENT = (37, 99, 235)  # blue-600, design.md token --accent
INK = (15, 23, 42)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Maskable needs a full-bleed square; "any" gets a rounded card.
    pad = 0 if maskable else max(2, size // 16)
    box = (pad, pad, size - pad, size - pad)
    radius = 0 if maskable else size // 8
    d.rounded_rectangle(box, radius=radius, fill=ACCENT)

    # Safe zone: content within the central 80% for maskable.
    cx, cy = size / 2, size / 2
    s = size * (0.62 if maskable else 0.72)
    # Balance beam: pillar + beam + two pans.
    beam_y = cy - s * 0.18
    d.line((cx - s / 2, beam_y, cx + s / 2, beam_y), fill="white", width=max(3, size // 40))
    d.line((cx, beam_y, cx, cy + s * 0.30), fill="white", width=max(3, size // 40))
    d.line((cx - s * 0.30, cy + s * 0.30, cx + s * 0.30, cy + s * 0.30), fill="white", width=max(3, size // 40))
    for dx in (-s / 2, s / 2):
        d.line((cx + dx, beam_y, cx + dx * 0.72, beam_y + s * 0.18), fill="white", width=max(2, size // 56))
        d.arc(
            (cx + dx * 0.72 - s * 0.14, beam_y + s * 0.18 - s * 0.06, cx + dx * 0.72 + s * 0.14, beam_y + s * 0.18 + s * 0.10),
            0, 180, fill="white", width=max(2, size // 56),
        )
    f = _font(int(size * (0.20 if maskable else 0.24)))
    d.text((cx, cy + s * 0.46), "R76", font=f, fill="white", anchor="mm")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    make(192, False).save(OUT / "icon-192.png")
    make(512, False).save(OUT / "icon-512.png")
    make(512, True).save(OUT / "icon-maskable-512.png")
    print(f"icons written to {OUT}")


if __name__ == "__main__":
    main()
