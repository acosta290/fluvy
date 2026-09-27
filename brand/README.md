# Fluvy brand

**Mark: "Current"** (chosen on 2026-09-17). A rounded tile — the card every Fluvy dashboard is made of — with the
flow carved through it, centred on the tile. The wordmark is Inter 600 at −0.03 em.

| File | What |
| --- | --- |
| `mark.svg` | the source: 24-unit grid, one even-odd path, `currentColor` |
| `wordmark.svg` | "fluvy" outlined from Inter 600 (one path per glyph, 2048 units per em), so no font is needed to draw it |
| `mark-light.svg`, `mark-dark.svg` | the mark with an explicit fill (the Linen text ink of each mode), for `<img>` and the README |
| `lockup-light.svg|png`, `lockup-dark.svg|png` | the mark beside the wordmark: mark 32, gap 10, wordmark 26 px on a 48 px line |
| `../custom_components/fluvy/brand/icon.png`, `icon@2x.png` | the icon Home Assistant shows for the integration (256², 512²): the mark in the accent ink, transparent |

Everything but `mark.svg` is derived: `python3 tools/brand/wordmark.py` outlines the wordmark from the shipped Inter
subset; `pnpm brand` (`tools/brand/render-brand.mjs`) composes and rasterises the rest, taking the inks from the
tokens' build (`packages/tokens/dist/palettes.json`). The review sheet (16 → 128 px, app icon, lockup, inverted,
squint) is `apps/design-lab/sheets/logo.html`.

## Using the name

The product is **Fluvy** in prose and in the UI; identifiers are lowercase (`fluvy`, `fluvy-…`, `@fluvy/…`). Say
"Fluvy for Home Assistant" or "works with Home Assistant"; never combine the name with Home Assistant's own logo
or wordmark — Home Assistant is a trademark of the Open Home Foundation, and Fluvy is not affiliated with it.
