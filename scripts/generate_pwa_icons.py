"""Generate PWA icons: full sun + panel, transparent background (no white plate)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "brand" / "malwa-app-icon-source.png"
OUT_DIR = ROOT / "public" / "icons"
LIGHT_FAV = ROOT / "public" / "brand" / "light"

SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
FAVICON_SIZES = [16, 32, 48]


def punch_black(img: Image.Image, threshold: int = 42) -> Image.Image:
    out = img.convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (0, 0, 0, 0)
    return out


def punch_near_white(img: Image.Image, threshold: int = 248) -> Image.Image:
    """Remove any leftover near-white plate pixels."""
    out = img.convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (0, 0, 0, 0)
    return out


def trim(img: Image.Image, pad: int = 24) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    content = img.crop((l, t, r, b))
    padded = Image.new("RGBA", (content.width + pad * 2, content.height + pad * 2), (0, 0, 0, 0))
    padded.alpha_composite(content, (pad, pad))
    return padded


def contain_square(mark: Image.Image, size: int, fill: float = 0.72) -> Image.Image:
    """Fit entire logo on a transparent square — nothing cropped, no plate."""
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = max(1, int(size * fill))
    fitted = mark.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    plate.alpha_composite(fitted, (x, y))
    return plate


def save_png(img: Image.Image, path: Path) -> None:
    img.save(path, format="PNG", optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LIGHT_FAV.mkdir(parents=True, exist_ok=True)

    mark = trim(punch_near_white(punch_black(Image.open(SOURCE))))

    for size in SIZES:
        save_png(contain_square(mark, size), OUT_DIR / f"icon-{size}.png")
        print(f"wrote icon-{size}.png")

    for size in (192, 512):
        save_png(contain_square(mark, size), OUT_DIR / f"maskable-{size}.png")
        print(f"wrote maskable-{size}.png")

    for size in FAVICON_SIZES:
        icon = contain_square(mark, size, fill=0.78)
        save_png(icon, OUT_DIR / f"favicon-{size}.png")
        save_png(icon, LIGHT_FAV / f"favicon-{size}.png")
        print(f"wrote favicon-{size}.png")

    ico_sizes = [16, 32, 48, 64, 128, 256]
    icos = [contain_square(mark, s) for s in ico_sizes]
    icos[0].save(
        OUT_DIR / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=icos[1:],
    )
    print("wrote favicon.ico")

    save_png(contain_square(mark, 512), ROOT / "public" / "brand" / "malwa-app-icon-512.png")
    print("done (transparent, local only)")


if __name__ == "__main__":
    main()
