#!/usr/bin/env python3
"""Outline the wordmark once, so no brand file needs a font at render time.

    python3 tools/brand/wordmark.py

Reads the Inter variable subset the product ships (packages/fonts/files/inter-variable.woff2), instantiates
weight 600, sets "fluvy" with the lockup's −0.03 em tracking and writes brand/wordmark.svg: one path per glyph
on a 1000-unit em, with the advance width in a data attribute so a lockup can be composed from it. Needs
fontTools (with brotli, for woff2): `pip install fonttools brotli`.
"""

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "packages/fonts/files/inter-variable.woff2"
OUT = ROOT / "brand/wordmark.svg"
WORD = "fluvy"
WEIGHT = 600
TRACKING_EM = -0.03


def main() -> None:
    font = instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT, "opsz": 32})
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    ascender, descender = font["hhea"].ascent, font["hhea"].descent
    tracking = TRACKING_EM * upem
    x = 0.0
    paths = []
    for char in WORD:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        glyph_set[name].draw(pen)
        d = pen.getCommands()
        # y grows downwards in SVG: flip, and place the baseline at the ascender line
        paths.append(f'  <path transform="translate({x:.1f} {ascender}) scale(1 -1)" d="{d}"/>')
        x += hmtx[name][0] + tracking
    width = x - tracking
    height = ascender - descender
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height}" '
        f'width="{width:.0f}" height="{height}" fill="currentColor" role="img" aria-label="fluvy" '
        f'data-font="Inter {WEIGHT}" data-tracking="{TRACKING_EM}em" data-units-per-em="{upem}" '
        f'data-ascender="{ascender}" data-descender="{descender}">\n' + "\n".join(paths) + "\n</svg>\n"
    )
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} · {width:.0f} × {height} units · {len(paths)} glyphs")


if __name__ == "__main__":
    main()
