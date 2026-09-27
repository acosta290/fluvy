#!/usr/bin/env python3
"""The files the home-assistant/brands repository asks for, from the brand files `render-brand.mjs` writes.

    python3 tools/brand/ha-brands.py

Writes brand/ha-brands/: icon.png (256²) and icon@2x.png (512²) — the integration's own icon, already trimmed —
plus logo.png and logo@2x.png (the light-ink lockup, shortest side 192 / 384 px) and their dark_ variants (the
light-on-dark lockup), every image trimmed to its subject, transparent and interlaced (the brands repository's
preference). Needs Pillow; interlacing is done by ImageMagick's `convert` when it is installed.
"""

import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "brand/ha-brands"
OUT.mkdir(parents=True, exist_ok=True)


def trimmed(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    box = image.getbbox()
    return image.crop(box) if box else image


def logo(source: Path, name: str, height: int) -> None:
    image = trimmed(source)
    width = round(image.width * height / image.height)
    image.resize((width, height), Image.LANCZOS).save(OUT / name, optimize=True)


for mode, prefix in (("light", ""), ("dark", "dark_")):
    logo(ROOT / f"brand/lockup-{mode}@8x.png", f"{prefix}logo.png", 192)
    logo(ROOT / f"brand/lockup-{mode}@8x.png", f"{prefix}logo@2x.png", 384)
for name in ("icon.png", "icon@2x.png"):
    trimmed(ROOT / "custom_components/fluvy/brand" / name).save(OUT / name, optimize=True)

convert = shutil.which("convert")
for file in sorted(OUT.glob("*.png")):
    if convert:
        subprocess.run([convert, str(file), "-interlace", "PNG", str(file)], check=True)
    with Image.open(file) as image:
        print(f"{file.relative_to(ROOT)}  {image.width}×{image.height}  {'interlaced' if image.info.get('interlace') else 'not interlaced'}")
