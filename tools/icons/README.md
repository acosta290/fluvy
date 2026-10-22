# Icons tooling

Fluvy's glyphs are drawn as strokes in `packages/ui/src/glyphs.ts`; Home Assistant's `ha-svg-icon` only fills, so the
set it registers holds the same glyphs outlined, in two parts: `packages/core/src/icons/generated.ts`, in core (the
shell draws from it), and `generated-on-demand.ts`, the glyphs the shell never names (`ON_DEMAND` in
`extract-glyphs.mjs`: the appliances, the garage, the gate, the window, the door open, the security camera), which
`getIcon` fetches the first time Home Assistant asks for one of them. Regenerate both after a glyph changes:

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/icons/requirements.txt
node tools/icons/extract-glyphs.mjs > glyphs.json
.venv/bin/python tools/icons/outline.py glyphs.json packages/core/src/icons/generated.ts \
  packages/core/src/icons/generated-on-demand.ts
```

`mdi-map.mjs` writes `packages/core/src/icons/mdi.ts`: the 32-bit keys of the Material Design Icons paths Home
Assistant draws in its chrome, so the shell can swap each for its Fluvy glyph (`@mdi/js` is pinned to Home Assistant's
version and never bundled).
