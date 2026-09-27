# Brand tooling

Two steps derive every brand file from `brand/mark.svg`:

```sh
python3 tools/brand/wordmark.py     # brand/wordmark.svg: "fluvy" outlined from the shipped Inter subset (needs fontTools + brotli)
pnpm brand                          # marks with explicit inks, lockups (SVG + 2× PNG), the integration's icons
```

`render-brand.mjs` composes plain SVG and rasterises it with resvg: no browser, no fonts at render time, the same
bytes on every machine. The inks come from the tokens' build (`packages/tokens/dist/palettes.json`, palette linen),
so `pnpm build` runs first.
