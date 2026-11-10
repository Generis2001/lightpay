"""Render the shared vector mark into Expo's launcher and splash PNG assets.

Run with Python 3 and Pillow. The SVG component uses the same brand.json.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / 'assets' / 'images'
BRAND = json.loads((ASSETS / 'brand.json').read_text())
SCALE = 4


def mark(canvas_size, tile_size=None, background=None, adaptive=False):
    tile_size = tile_size or canvas_size
    canvas = Image.new('RGBA', (canvas_size * SCALE, canvas_size * SCALE), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    inset = (canvas_size - tile_size) / 2
    ratio = tile_size * SCALE / BRAND['viewBox']
    offset = inset * SCALE
    if not adaptive:
        draw.rounded_rectangle((offset, offset, offset + tile_size * SCALE - 1, offset + tile_size * SCALE - 1), radius=BRAND['cornerRadius'] * ratio, fill=BRAND['green'])
    draw.polygon([(offset + x * ratio, offset + y * ratio) for x, y in BRAND['points']], fill=BRAND['cutout'])
    return canvas.resize((canvas_size, canvas_size), Image.Resampling.LANCZOS)


def generate():
    mark(1024, background=BRAND['green']).convert('RGB').save(ASSETS / 'icon.png')
    # The glyph fits inside the Android adaptive icon safe area.
    mark(1024, 640, adaptive=True).save(ASSETS / 'adaptive-icon.png')
    mark(1024, 800).save(ASSETS / 'splash-icon.png')
    mark(48).save(ASSETS / 'favicon.png')
    splash = Image.new('RGB', (1284, 2778), BRAND['ink'])
    logo = mark(512)
    splash.paste(logo, ((1284 - 512) // 2, (2778 - 512) // 2), logo)
    splash.save(ASSETS / 'splash.png')
    points = ' '.join(f'{x},{y}' for x, y in BRAND['points'])
    (ASSETS / 'lightpay-logo.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
        f'<rect width="256" height="256" rx="{BRAND["cornerRadius"]}" fill="{BRAND["green"]}"/>'
        f'<polygon points="{points}" fill="{BRAND["cutout"]}"/></svg>\n'
    )
    print('Generated app icon, adaptive foreground, favicon, splash logo and SVG from brand.json.')


if __name__ == '__main__':
    generate()
