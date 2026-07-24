"""
Recolor Malwa Solar Energy logo for CRM Light Theme.
Preserves exact geometry — only remaps colors.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(r"C:\Malwa_Solar_CRM\public\brand")
SRC = Path(
    r"C:\Users\shedd\.cursor\projects\c-Malwa-Solar-CRM\assets"
    r"\c__Users_shedd_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-c6853dd6-ffa5-4892-a666-b6590a54cc12.png"
)
OUT = ROOT / "light"

# Target palette
SUN_A = (244, 180, 0)       # #F4B400
SUN_B = (249, 168, 38)      # #F9A826
PANEL_A = (37, 99, 235)     # #2563EB
PANEL_B = (6, 182, 212)     # #06B6D4
MALWA = (15, 23, 42)        # #0F172A
SOLAR_A = (22, 163, 74)     # #16A34A
SOLAR_B = (34, 197, 94)     # #22C55E
ENERGY = (100, 116, 139)    # #64748B
DIV_A = (37, 99, 235)       # #2563EB
DIV_B = (34, 197, 94)       # #22C55E


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def is_near_white(r: int, g: int, b: int) -> bool:
    return r > 242 and g > 242 and b > 242


def is_warm(r: int, g: int, b: int) -> bool:
    return r > 160 and g > 70 and b < 140 and r >= g - 10 and r > b + 20


def is_cool_panel(r: int, g: int, b: int) -> bool:
    # blues, teals, greens used in panel / divider (not dark navy text)
    if r > 230 and g > 230 and b > 230:
        return False
    if (r + g + b) < 300 and max(r, g, b) < 120:
        return False  # navy / dark ink
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 40:
        return False
    # strong blue or green chroma only
    return (b > r + 35 and b > 110) or (g > r + 35 and g > 110)


def is_navy_ink(r: int, g: int, b: int) -> bool:
    return (r + g + b) < 280 and b >= r - 5 and max(r, g, b) < 140


def knock_out_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 245 and g > 245 and b > 245:
                px[x, y] = (255, 255, 255, 0)
            elif r > 230 and g > 230 and b > 230:
                avg = (r + g + b) / 3
                t = max(0.0, min(1.0, (248 - avg) / 20))
                px[x, y] = (r, g, b, int(a * t))
    return im


def trim(im: Image.Image, pad: int = 12) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    w, h = im.size
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))


def detect_layout(im: Image.Image) -> dict:
    w, h = im.size
    ink_x = [0] * w
    for y in range(h):
        for x in range(w):
            r, g, b, a = im.getpixel((x, y))
            if a > 20 and not is_near_white(r, g, b):
                ink_x[x] += 1
    nonzero = [i for i, v in enumerate(ink_x) if v > 4]
    icon_end = nonzero[0]
    text_start = nonzero[-1]
    for i in range(nonzero[0], nonzero[-1]):
        if ink_x[i] < 3:
            j = i
            while j < w and ink_x[j] < 3:
                j += 1
            if j - i > 12:
                icon_end = i
                text_start = j
                break

    # text vertical bands
    ink_y = [0] * h
    for y in range(h):
        for x in range(text_start, w):
            r, g, b, a = im.getpixel((x, y))
            if a > 20 and not is_near_white(r, g, b):
                ink_y[y] += 1
    rows = [y for y in range(h) if ink_y[y] > 15]
    top, bot = rows[0], rows[-1]
    gap_y0 = gap_y1 = (top + bot) // 2
    y = top
    while y <= bot:
        if ink_y[y] < 12:
            y0 = y
            while y <= bot and ink_y[y] < 12:
                y += 1
            if y - y0 >= 2:
                gap_y0, gap_y1 = y0, y
                break
        else:
            y += 1

    # SOLAR starts where warm pixels dominate in upper text band
    solar_x = text_start + int((w - text_start) * 0.55)
    warm_xs = []
    for yy in range(top, gap_y0):
        for x in range(text_start, w):
            r, g, b, a = im.getpixel((x, yy))
            if a > 20 and is_warm(r, g, b):
                warm_xs.append(x)
    if warm_xs:
        solar_x = min(warm_xs) - 2

    return {
        "icon_end": icon_end,
        "text_start": text_start,
        "title_top": top,
        "gap_y0": gap_y0,
        "gap_y1": gap_y1,
        "title_bot": bot,
        "solar_x": solar_x,
    }


def recolor(im: Image.Image, layout: dict) -> Image.Image:
    out = im.copy()
    px = out.load()
    w, h = out.size
    icon_end = layout["icon_end"]
    text_start = layout["text_start"]
    gap_y0 = layout["gap_y0"]
    gap_y1 = layout["gap_y1"]
    solar_x = layout["solar_x"]

    # icon content bounds for gradients
    icon_l, icon_r = 0, icon_end
    for x in range(icon_end):
        for y in range(h):
            r, g, b, a = im.getpixel((x, y))
            if a > 30 and not is_near_white(r, g, b):
                icon_l = x
                break
        else:
            continue
        break
    for x in range(icon_end - 1, -1, -1):
        for y in range(h):
            r, g, b, a = im.getpixel((x, y))
            if a > 30 and not is_near_white(r, g, b):
                icon_r = x
                break
        else:
            continue
        break
    icon_span = max(1, icon_r - icon_l)

    text_l, text_r = text_start, w - 1
    text_span = max(1, text_r - text_l)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if is_near_white(r, g, b):
                px[x, y] = (255, 255, 255, 0)
                continue

            # keep anti-alias soft edges by blending toward target with source alpha
            src_a = a / 255.0

            if x < icon_end:
                t = (x - icon_l) / icon_span
                if is_warm(r, g, b):
                    nr, ng, nb = lerp(SUN_A, SUN_B, t)
                elif is_cool_panel(r, g, b) or (g > 90 and b > 70 and r < 200):
                    nr, ng, nb = lerp(PANEL_A, PANEL_B, t)
                elif is_navy_ink(r, g, b):
                    # rare dark edges in icon — push to panel blue
                    nr, ng, nb = PANEL_A
                else:
                    # unclassified chromatic → nearest of sun/panel by warmth
                    if r > g and r > b:
                        nr, ng, nb = lerp(SUN_A, SUN_B, t)
                    else:
                        nr, ng, nb = lerp(PANEL_A, PANEL_B, t)
                px[x, y] = (nr, ng, nb, a)
                continue

            # text + divider region
            tt = (x - text_l) / text_span

            # divider band (thin line between title and ENERGY)
            if gap_y0 <= y < gap_y1 and (is_cool_panel(r, g, b) or is_warm(r, g, b) or is_navy_ink(r, g, b)):
                # only recolor non-white line pixels
                if not is_near_white(r, g, b) and (r + g + b) < 720:
                    nr, ng, nb = lerp(DIV_A, DIV_B, tt)
                    px[x, y] = (nr, ng, nb, a)
                continue

            if y < gap_y0:
                # MALWA / SOLAR title line
                if is_warm(r, g, b):
                    st = (x - solar_x) / max(1, text_r - solar_x)
                    px[x, y] = (*lerp(SOLAR_A, SOLAR_B, st), a)
                    continue
                if is_cool_panel(r, g, b) and (r + g + b) > 220:
                    px[x, y] = (*lerp(DIV_A, DIV_B, tt), a)
                    continue
                if x >= solar_x and is_warm(r, g, b):
                    st = (x - solar_x) / max(1, text_r - solar_x)
                    px[x, y] = (*lerp(SOLAR_A, SOLAR_B, st), a)
                    continue
                # MALWA + AA edges → solid deep navy (no cyan fringe)
                px[x, y] = (*MALWA, a)
                continue

            # ENERGY line (+ lower AA) → slate, never leftover navy
            if is_cool_panel(r, g, b) and (r + g + b) > 220:
                px[x, y] = (*lerp(DIV_A, DIV_B, tt), a)
                continue
            if is_warm(r, g, b):
                px[x, y] = (*lerp(DIV_A, DIV_B, tt), a)
                continue
            px[x, y] = (*ENERGY, a)

    return out


def make_mark(wordmark: Image.Image, icon_end: int) -> Image.Image:
    # crop icon portion with a bit of padding
    h = wordmark.size[1]
    mark = wordmark.crop((0, 0, min(wordmark.size[0], icon_end + 8), h))
    mark = trim(mark, pad=6)
    # square canvas
    side = max(mark.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2), mark)
    return canvas


def fit_square(im: Image.Image, size: int, pad_ratio: float = 0.12) -> Image.Image:
    im = trim(im, pad=2)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_inner = int(size * (1 - pad_ratio * 2))
    ratio = min(max_inner / im.size[0], max_inner / im.size[1])
    nw, nh = max(1, int(im.size[0] * ratio)), max(1, int(im.size[1] * ratio))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(scaled, ((size - nw) // 2, (size - nh) // 2), scaled)
    return canvas


def export_4k_horizontal(im: Image.Image) -> Image.Image:
    # 4K width 3840, keep aspect
    target_w = 3840
    ratio = target_w / im.size[0]
    target_h = max(1, int(im.size[1] * ratio))
    return im.resize((target_w, target_h), Image.Resampling.LANCZOS)


def write_svg_wrapper(png_rel: str, w: int, h: int, out_path: Path) -> None:
    # SVG that references the transparent PNG (vector container, exact artwork preserved)
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" role="img" aria-label="Malwa Solar Energy">
  <title>Malwa Solar Energy</title>
  <image xlink:href="{png_rel}" x="0" y="0" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"/>
</svg>
'''
    out_path.write_text(svg, encoding="utf-8")


def write_svg_favicon(mark_path: Path, out_path: Path, size: int = 64) -> None:
    # Embed mark as data-free file reference for favicon SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{size}" height="{size}" viewBox="0 0 {size} {size}" fill="none">
  <image xlink:href="malwa-logo-mark-light.png" x="0" y="0" width="{size}" height="{size}" preserveAspectRatio="xMidYMid meet"/>
</svg>
'''
    out_path.write_text(svg, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    src = Image.open(SRC).convert("RGBA")
    base = knock_out_white(src)
    layout = detect_layout(base)
    print("layout", layout)

    colored = recolor(base, layout)
    colored = trim(colored, pad=10)

    # Re-detect icon end on trimmed image roughly by proportion
    # Use original layout ratios
    src_w = base.size[0]
    icon_ratio = layout["icon_end"] / src_w
    icon_end_trimmed = int(colored.size[0] * icon_ratio)

    # 1) Horizontal transparent PNG (master)
    horizontal = colored
    horizontal_path = OUT / "malwa-logo-horizontal-light.png"
    horizontal.save(horizontal_path, "PNG", optimize=True)
    print("horizontal", horizontal.size)

    # 2) 4K transparent PNG
    k4 = export_4k_horizontal(horizontal)
    k4_path = OUT / "malwa-logo-horizontal-light-4k.png"
    k4.save(k4_path, "PNG", optimize=True)
    print("4k", k4.size)

    # 3) SVG (horizontal wrapper referencing 4k or master)
    write_svg_wrapper(
        "malwa-logo-horizontal-light.png",
        horizontal.size[0],
        horizontal.size[1],
        OUT / "malwa-logo-horizontal-light.svg",
    )

    # 4) Icon-only
    mark = make_mark(horizontal, icon_end_trimmed)
    mark_path = OUT / "malwa-logo-mark-light.png"
    mark.save(mark_path, "PNG", optimize=True)
    print("mark", mark.size)

    write_svg_wrapper(
        "malwa-logo-mark-light.png",
        mark.size[0],
        mark.size[1],
        OUT / "malwa-logo-mark-light.svg",
    )

    # 5) 512 / 256 (icon square)
    for size in (512, 256):
        sq = fit_square(mark, size, pad_ratio=0.10)
        sq.save(OUT / f"malwa-logo-mark-light-{size}.png", "PNG", optimize=True)
        print(f"mark-{size}", sq.size)

    # Also 512/256 horizontal-fit versions for app icons that prefer full wordmark
    for size in (512, 256):
        sq = fit_square(horizontal, size, pad_ratio=0.08)
        sq.save(OUT / f"malwa-logo-horizontal-light-{size}.png", "PNG", optimize=True)

    # 6) Favicon versions
    fav32 = fit_square(mark, 32, pad_ratio=0.08)
    fav16 = fit_square(mark, 16, pad_ratio=0.06)
    fav48 = fit_square(mark, 48, pad_ratio=0.08)
    fav32.save(OUT / "favicon-32.png", "PNG", optimize=True)
    fav16.save(OUT / "favicon-16.png", "PNG", optimize=True)
    fav48.save(OUT / "favicon-48.png", "PNG", optimize=True)
    write_svg_favicon(mark_path, OUT / "favicon.svg", size=64)

    # multi-size ICO
    fav32.save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    # Convenience copies into public/brand root for CRM wiring
    horizontal.save(ROOT / "malwa-logo-wordmark-light.png", "PNG", optimize=True)
    mark.save(ROOT / "malwa-logo-mark-light.png", "PNG", optimize=True)

    print("done ->", OUT)


if __name__ == "__main__":
    main()
