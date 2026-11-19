# Icons tooling

Fluvy's glyphs are drawn as strokes: the set's own in `packages/ui/src/glyphs.ts`, the glyph sets of 1.23 (#226: the
levels, energy, devices, climate, safety, outdoors, home, rooms) in `packages/ui/src/glyph-sets/`. Home Assistant's
`ha-svg-icon` only fills, so the set it registers holds the same glyphs outlined, in parts: core's
(`packages/core/src/icons/generated.ts`, the glyphs the shell draws), the part `getIcon` fetches first
(`generated-on-demand.ts`: the glyphs the shell never names, `ON_DEMAND` in `extract-glyphs.mjs` — the garage, the gate,
the window, the door open, the security camera — and the index of the others), and the other parts
(`parts/<name>.ts`: the appliances a person picks and one per glyph set), each fetched the first time Home Assistant asks
for one of its icons. What a glyph draws faint (`opacity`: a signal's bars it does not reach) is outlined apart, and
Home Assistant draws it faint (`secondaryPath`). Regenerate them all after a glyph changes:

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/icons/requirements.txt
node tools/icons/extract-glyphs.mjs > glyphs.json
.venv/bin/python tools/icons/outline.py glyphs.json packages/core/src/icons/generated.ts \
  packages/core/src/icons/generated-on-demand.ts packages/core/src/icons/parts
```

`mdi-map.mjs` writes `packages/core/src/icons/mdi.ts`: the 32-bit keys of the Material Design Icons paths Home
Assistant draws in its chrome, so the shell can swap each for its Fluvy glyph (`@mdi/js` is pinned to Home Assistant's
version and never bundled).
