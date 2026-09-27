# Icons tooling

Fluvy's glyphs are drawn as strokes in `packages/ui/src/glyphs.ts`; Home Assistant's `ha-svg-icon` only fills, so the
set it registers (`packages/core/src/icons/generated.ts`) holds the same glyphs outlined. Regenerate it after a glyph
changes:

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/icons/requirements.txt
npx tsx tools/icons/extract-glyphs.mjs > glyphs.json
.venv/bin/python tools/icons/outline.py glyphs.json packages/core/src/icons/generated.ts
```

`mdi-map.mjs` writes `packages/core/src/icons/mdi.ts`: the 32-bit keys of the Material Design Icons paths Home
Assistant draws in its chrome, so the shell can swap each for its Fluvy glyph (`@mdi/js` is pinned to Home Assistant's
version and never bundled).
