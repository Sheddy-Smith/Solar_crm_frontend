"""
Recolor Malwa Solar Energy logo for CRM Dark Theme.
Preserves exact geometry — only remaps colors.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(r"C:\Malwa_Solar_CRM\public\brand")
SRC = Path(
    r"C:\Users\shedd\.cursor\projects\c-Malwa-Solar-CRM\assets"
    r"\c__Users_shedd_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-c6853dd6-ffa5-4892-a666-b6590a54cc12.png"
)
OUT = ROOT / "dark"

# Dark-theme palette
SUN = [(253, 186, 18), (245, 158, 11), (249, 115, 22)]          # #FDBA12 → #F59E0B → #F97316
PANEL = [(37, 99, 235), (14, 165, 233), (34, 211, 238)]         # #2563EB → #0EA5E9 → #22D3EE
MALWA = (255, 255, 255)                                         # #FFFFFF
SOLAR = [(34, 197, 94), (16, 185, 129)]                         # #22C55E → #10B981
ENERGY = (203, 213, 225)                                        # #CBD5E1
DIV = [(37, 99, 235), (34, 211, 238), (34, 197, 94)]            # #2563EB → #22D3EE → #22C55E
MONO = (255, 255, 255)


def lerp2(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def lerp_stops(stops: list[tuple[int, int, int]], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    if len(stops) == 1:
        return stops[0]
    seg = t * (len(stops) - 1)
    i = min(int(seg), len(stops) - 2)
    local = seg - i
    return lerp2(stops[i], stops[i + 1], local)


def is_near_white(r: int, g: int, b: int) -> bool:
    return r > 242 and g > 242 and b > 242


def is_warm(r: int, g: int, b: int) -> bool:
    return r > 160 and g > 70 and b < 140 and r >= g - 10 and r > b + 20


def is_cool_panel(r: int, g: int, b: int) -> bool:
    if r > 230 and g > 230 and b > 230:
        return False
    if (r + g + b) < 300 and max(r, g, b) < 120:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 40:
        return False
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
        "gap_y0": gap_y0,
        "gap_y1": gap_y1,
        "solar_x": solar_x,
    }


def recolor(im: Image.Image, layout: dict, mono: bool = False) -> Image.Image:
    out = im.copy()
    px = out.load()
    w, h = out.size
    icon_end = layout["icon_end"]
    text_start = layout["text_start"]
    gap_y0 = layout["gap_y0"]
    gap_y1 = layout["gap_y1"]
    solar_x = layout["solar_x"]

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

            if mono:
                # keep alpha silhouette in pure white
                px[x, y] = (*MONO, a)
                continue

            if x < icon_end:
                t = (x - icon_l) / icon_span
                ty = y / max(1, h - 1)
                if is_warm(r, g, b):
                    # sun: mix x/y for richer 3-stop look
                    px[x, y] = (*lerp_stops(SUN, (t * 0.55) + (ty * 0.45)), a)
                elif is_cool_panel(r, g, b) or (g > 90 and b > 70 and r < 200):
                    px[x, y] = (*lerp_stops(PANEL, t), a)
                else:
                    if r > g and r > b:
                        px[x, y] = (*lerp_stops(SUN, t), a)
                    else:
                        px[x, y] = (*lerp_stops(PANEL, t), a)
                continue

            tt = (x - text_l) / text_span

            if gap_y0 <= y < gap_y1 and (r + g + b) < 720:
                px[x, y] = (*lerp_stops(DIV, tt), a)
                continue

            if y < gap_y0:
                if is_warm(r, g, b):
                    st = (x - solar_x) / max(1, text_r - solar_x)
                    px[x, y] = (*lerp2(SOLAR[0], SOLAR[1], st), a)
                    continue
                if is_cool_panel(r, g, b) and (r + g + b) > 220:
                    px[x, y] = (*lerp_stops(DIV, tt), a)
                    continue
                # MALWA + AA → pure white
                px[x, y] = (*MALWA, a)
                continue

            # ENERGY
            if is_cool_panel(r, g, b) and (r + g + b) > 220:
                px[x, y] = (*lerp_stops(DIV, tt), a)
                continue
            if is_warm(r, g, b):
                px[x, y] = (*lerp_stops(DIV, tt), a)
                continue
            px[x, y] = (*ENERGY, a)

    return out


def make_mark(wordmark: Image.Image, icon_end: int) -> Image.Image:
    h = wordmark.size[1]
    mark = wordmark.crop((0, 0, min(wordmark.size[0], icon_end + 8), h))
    mark = trim(mark, pad=6)
    side = max(mark.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2), mark)
    return canvas


def fit_square(im: Image.Image, size: int, pad_ratio: float = 0.10) -> Image.Image:
    im = trim(im, pad=2)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_inner = int(size * (1 - pad_ratio * 2))
    ratio = min(max_inner / im.size[0], max_inner / im.size[1])
    nw, nh = max(1, int(im.size[0] * ratio)), max(1, int(im.size[1] * ratio))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(scaled, ((size - nw) // 2, (size - nh) // 2), scaled)
    return canvas


def write_svg(png_name: str, w: int, h: int, out_path: Path) -> None:
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" role="img" aria-label="Malwa Solar Energy">
  <title>Malwa Solar Energy</title>
  <image xlink:href="{png_name}" x="0" y="0" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"/>
</svg>
'''
    out_path.write_text(svg, encoding="utf-8")


def export_set(colored: Image.Image, prefix: str, icon_end_ratio: float) -> None:
    horizontal = colored
    horizontal.save(OUT / f"{prefix}-horizontal.png", "PNG", optimize=True)

    k4_w = 3840
    k4_h = max(1, int(horizontal.size[1] * (k4_w / horizontal.size[0])))
    k4 = horizontal.resize((k4_w, k4_h), Image.Resampling.LANCZOS)
    k4.save(OUT / f"{prefix}-horizontal-4k.png", "PNG", optimize=True)

    write_svg(f"{prefix}-horizontal.png", horizontal.size[0], horizontal.size[1], OUT / f"{prefix}-horizontal.svg")

    icon_end = int(horizontal.size[0] * icon_end_ratio)
    mark = make_mark(horizontal, icon_end)
    mark.save(OUT / f"{prefix}-mark.png", "PNG", optimize=True)
    write_svg(f"{prefix}-mark.png", mark.size[0], mark.size[1], OUT / f"{prefix}-mark.svg")

    for size in (1024, 512, 256):
        fit_square(mark, size, 0.10).save(OUT / f"{prefix}-mark-{size}.png", "PNG", optimize=True)
        fit_square(horizontal, size, 0.08).save(OUT / f"{prefix}-horizontal-{size}.png", "PNG", optimize=True)

    print(prefix, "horizontal", horizontal.size, "mark", mark.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = knock_out_white(Image.open(SRC))
    layout = detect_layout(base)
    print("layout", layout)
    icon_ratio = layout["icon_end"] / base.size[0]

    full = trim(recolor(base, layout, mono=False), pad=10)
    mono = trim(recolor(base, layout, mono=True), pad=10)

    export_set(full, "malwa-logo-dark", icon_ratio)
    export_set(mono, "malwa-logo-dark-mono", icon_ratio)

    # favicons from full-color mark
    mark = Image.open(OUT / "malwa-logo-dark-mark.png")
    for size in (16, 32, 48):
        fit_square(mark, size, 0.08).save(OUT / f"favicon-{size}.png", "PNG", optimize=True)
    fit_square(mark, 32, 0.08).save(OUT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    write_svg("malwa-logo-dark-mark.png", 64, 64, OUT / "favicon.svg")

    # CRM wiring copies
    full.save(ROOT / "malwa-logo-wordmark-dark.png", "PNG", optimize=True)
    Image.open(OUT / "malwa-logo-dark-mark.png").save(ROOT / "malwa-logo-mark-dark.png", "PNG", optimize=True)
    mono.save(ROOT / "malwa-logo-wordmark-dark-mono.png", "PNG", optimize=True)

    print("done ->", OUT)


if __name__ == "__main__":
    main()
