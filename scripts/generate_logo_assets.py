from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "logo"
OUT_DIR.mkdir(parents=True, exist_ok=True)


FONT_PATH = "/System/Library/Fonts/Supplemental/Trebuchet MS Bold Italic.ttf"
TEXT = "Sinoport"


def text_mask(width: int, height: int, font_size: int):
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), TEXT, font=font, stroke_width=0)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = 42 - bbox[0]
    y = (height - text_h) // 2 - bbox[1] - 12
    draw.text((x, y), TEXT, fill=255, font=font, stroke_width=0)
    return mask, (x, y, text_w, text_h)


def vertical_gradient(size, stops):
    width, height = size
    grad = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = grad.load()
    for y in range(height):
        t = y / max(height - 1, 1)
        for idx in range(len(stops) - 1):
            y0, c0 = stops[idx]
            y1, c1 = stops[idx + 1]
            if y0 <= t <= y1:
                local = (t - y0) / max(y1 - y0, 1e-6)
                color = tuple(int(c0[i] + (c1[i] - c0[i]) * local) for i in range(4))
                break
        else:
            color = stops[-1][1]
        for x in range(width):
            pixels[x, y] = color
    return grad


def gold_swoosh(size, anchor):
    width, height = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    ax, ay = anchor

    # Top-right accent matching the reference logo's warm highlight.
    poly = [
        (ax - 40, ay + 28),
        (ax + 22, ay + 8),
        (ax + 130, ay + 8),
        (ax + 174, ay + 20),
        (ax + 152, ay + 40),
        (ax + 66, ay + 44),
        (ax + 6, ay + 54),
    ]
    draw.polygon(poly, fill=(250, 202, 74, 230))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    return layer


def create_logo(width=2400, height=700):
    mask, meta = text_mask(width, height, font_size=360)
    x, y, text_w, text_h = meta

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow_alpha = mask.filter(ImageFilter.GaussianBlur(10))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rectangle([0, 0, width, height], fill=(171, 33, 24, 42))
    shadow.putalpha(shadow_alpha.point(lambda v: min(255, int(v * 0.28))))
    shadow = ImageChops.offset(shadow, 8, 12)
    canvas.alpha_composite(shadow)

    base = vertical_gradient(
        (width, height),
        [
            (0.0, (217, 53, 41, 255)),
            (0.22, (250, 90, 68, 255)),
            (0.48, (231, 56, 43, 255)),
            (1.0, (180, 27, 20, 255)),
        ],
    )
    base.putalpha(mask)
    canvas.alpha_composite(base)

    gloss = vertical_gradient(
        (width, height),
        [
            (0.0, (255, 255, 255, 0)),
            (0.11, (255, 255, 255, 118)),
            (0.24, (255, 255, 255, 30)),
            (1.0, (255, 255, 255, 0)),
        ],
    )
    gloss_mask = ImageChops.multiply(mask, Image.new("L", (width, height), 160))
    gloss.putalpha(gloss_mask)
    canvas.alpha_composite(gloss)

    inner_shadow = vertical_gradient(
        (width, height),
        [
            (0.0, (0, 0, 0, 0)),
            (0.7, (0, 0, 0, 0)),
            (1.0, (102, 15, 12, 16)),
        ],
    )
    inner_shadow.putalpha(mask)
    canvas.alpha_composite(inner_shadow)

    stroke = Image.new("RGBA", (width, height), (186, 28, 21, 0))
    stroke.putalpha(mask.filter(ImageFilter.MaxFilter(3)).point(lambda v: min(255, int(v * 0.08))))
    canvas.alpha_composite(stroke)

    accent = gold_swoosh((width, height), (x + text_w - 110, y + 10))
    canvas.alpha_composite(accent)

    bbox = canvas.getbbox()
    cropped = canvas.crop(bbox)
    return cropped


def save_assets():
    logo = create_logo()
    logo.save(OUT_DIR / "sinoport-logo-transparent.png")

    nav_logo = logo.copy()
    nav_logo.thumbnail((900, 190), Image.Resampling.LANCZOS)
    nav_logo.save(OUT_DIR / "sinoport-logo-nav.png")


if __name__ == "__main__":
    save_assets()
