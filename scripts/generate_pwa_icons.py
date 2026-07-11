"""Generate PWA icon set (any + maskable) from the source logo artwork.

Run once (or whenever the source logo changes):
    python scripts/generate_pwa_icons.py
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "assets" / "app-icon-source.png"
OUT_DIR = ROOT / "public" / "icons"
BG_COLOR = (240, 250, 240, 255)  # matches generated logo's pale mint background

ANY_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]


def trimmed_logo():
    """Chroma-key the flat background to transparent, then crop to content bbox."""
    im = Image.open(SOURCE).convert("RGBA")
    bg = im.getpixel((0, 0))
    br, bgc, bb, _ba = bg
    pixels = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            dist = abs(r - br) + abs(g - bgc) + abs(b - bb)
            if dist <= 24:
                pixels[x, y] = (r, g, b, 0)
                continue
            if x < min_x:
                min_x = x
            if x > max_x:
                max_x = x
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y
    if max_x <= min_x or max_y <= min_y:
        return im
    pad = int(max(w, h) * 0.03)
    box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + pad),
        min(h, max_y + pad),
    )
    return im.crop(box)


def square_canvas(content, canvas_size, content_ratio, bg=BG_COLOR):
    """Paste `content` centered on a square canvas, scaled to `content_ratio`."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    target = int(canvas_size * content_ratio)

    cw, ch = content.size
    scale = target / max(cw, ch)
    new_size = (max(1, round(cw * scale)), max(1, round(ch * scale)))
    resized = content.resize(new_size, Image.LANCZOS)

    offset = ((canvas_size - new_size[0]) // 2, (canvas_size - new_size[1]) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    content = trimmed_logo()

    # "any" purpose icons: logo fills most of the canvas (small breathing margin).
    for size in ANY_SIZES:
        icon = square_canvas(content, size, content_ratio=0.82)
        icon.save(OUT_DIR / f"icon-{size}.png")

    # "maskable" icons: keep artwork inside the ~80% safe zone Android uses,
    # background fills edge-to-edge so OS masks (circle/squircle/etc) don't clip it.
    for size in MASKABLE_SIZES:
        icon = square_canvas(content, size, content_ratio=0.6)
        icon.save(OUT_DIR / f"maskable-{size}.png")

    # Favicons.
    for size in (16, 32, 48):
        icon = square_canvas(content, size, content_ratio=0.86)
        icon.save(OUT_DIR / f"favicon-{size}.png")

    print(f"Wrote {len(ANY_SIZES) + len(MASKABLE_SIZES) + 3} icons to {OUT_DIR}")


if __name__ == "__main__":
    main()
