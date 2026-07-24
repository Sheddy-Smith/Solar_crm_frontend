"""Remove white background from Malwa brand logos and build light/dark variants."""
from PIL import Image
import os

SRC = r"C:\Malwa_Solar_CRM\public\brand\malwa-logo-02-wordmark.png"
OUT = r"C:\Malwa_Solar_CRM\public\brand\malwa-logo-wordmark-transparent.png"
OUT_DARK = r"C:\Malwa_Solar_CRM\public\brand\malwa-logo-wordmark-dark.png"
OUT_MARK = r"C:\Malwa_Solar_CRM\public\brand\malwa-logo-mark-transparent.png"
OUT_MARK_DARK = r"C:\Malwa_Solar_CRM\public\brand\malwa-logo-mark-dark.png"


def knock_out_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            if r > 235 and g > 235 and b > 235:
                pixels[x, y] = (255, 255, 255, 0)
            elif r > 220 and g > 220 and b > 220 and (mx - mn) < 18:
                avg = (r + g + b) / 3
                t = max(0.0, min(1.0, (245 - avg) / 25))
                pixels[x, y] = (r, g, b, int(a * t))
    return im


def trim(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    w, h = im.size
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))


def to_dark_sidebar(im: Image.Image) -> Image.Image:
    """Recolor deep navy ink to near-white so logo reads on dark UI; keep orange/sun."""
    out = im.copy()
    pixels = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 8:
                continue
            # Orange / warm sun — keep
            if r > 180 and g > 70 and b < 120 and r > g:
                continue
            # Light panel grid lines / pale strokes on icon — keep soft
            if r > 190 and g > 190 and b > 200 and a > 40:
                continue
            # Deep navy / dark blue ink → soft white for dark theme
            if b >= r and b >= g and (r + g + b) < 220:
                lum = (r * 0.3 + g * 0.4 + b * 0.9) / 255
                # brighter if originally lighter navy
                tone = int(220 + lum * 35)
                pixels[x, y] = (tone, tone, min(255, tone + 8), a)
            elif (r + g + b) < 140:
                pixels[x, y] = (245, 247, 250, a)
    return out


def make_mark(wordmark: Image.Image) -> Image.Image:
    bbox = wordmark.getbbox()
    l, t, r, b = bbox
    content_w = r - l
    mark_w = max(24, int(content_w * 0.34))
    mark = wordmark.crop((l, t, l + mark_w, b))
    side = max(mark.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2), mark)
    canvas = trim(canvas, pad=4)
    side = max(canvas.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(canvas, ((side - canvas.size[0]) // 2, (side - canvas.size[1]) // 2), canvas)
    return sq


def main() -> None:
    wordmark = trim(knock_out_white(Image.open(SRC)))
    wordmark.save(OUT, "PNG", optimize=True)
    print("wordmark", wordmark.size, os.path.getsize(OUT))

    dark = to_dark_sidebar(wordmark)
    dark.save(OUT_DARK, "PNG", optimize=True)
    print("wordmark-dark", dark.size, os.path.getsize(OUT_DARK))

    mark = make_mark(wordmark)
    mark.save(OUT_MARK, "PNG", optimize=True)
    print("mark", mark.size, os.path.getsize(OUT_MARK))

    mark_dark = make_mark(dark)
    mark_dark.save(OUT_MARK_DARK, "PNG", optimize=True)
    print("mark-dark", mark_dark.size, os.path.getsize(OUT_MARK_DARK))


if __name__ == "__main__":
    main()
