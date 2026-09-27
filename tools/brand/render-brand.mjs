#!/usr/bin/env node
/**
 * Derives every brand file from two sources, so nothing is drawn twice: `brand/mark.svg` (the "Current" mark on a
 * 24-unit grid, drawn in `currentColor`) and `brand/wordmark.svg` (the word "fluvy" outlined from Inter 600 by
 * `wordmark.py`, so no font is needed here).
 *
 *   brand/mark-light.svg, brand/mark-dark.svg        the mark with an explicit fill — the Linen text ink of each
 *                                                    mode — for places that cannot inherit a colour (`<img>`, README)
 *   brand/lockup-light.svg|png, lockup-dark.svg|png  the mark beside the wordmark, as the logo sheet draws it
 *                                                    (mark 32, gap 10, wordmark 26 px, 48 tall), transparent, 2×
 *   custom_components/fluvy/brand/icon.png (256²), icon@2x.png (512²)
 *                                                    the icon Home Assistant shows for the integration: the mark in
 *                                                    the accent ink on a transparent square, trimmed to the mark
 *
 * Colours come from the tokens' build (`packages/tokens/dist/palettes.json`, palette linen), so a change of ink
 * there reaches the brand files on the next `pnpm brand`. Rasterised with resvg: no browser, no fonts, the same
 * bytes on every machine.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const brand = join(root, 'brand');
const integration = join(root, 'custom_components', 'fluvy', 'brand');

const markSource = await readFile(join(brand, 'mark.svg'), 'utf8');
const markPath = markSource.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
const fillRule = markSource.match(/fill-rule="([^"]+)"/)?.[1] ?? 'nonzero';
if (!markPath) throw new Error('brand/mark.svg: no path found');

const wordmark = await readFile(join(brand, 'wordmark.svg'), 'utf8');
const attr = (name) => wordmark.match(new RegExp(`${name}="([^"]+)"`))?.[1];
const word = {
  width: Number(attr('width')),
  unitsPerEm: Number(attr('data-units-per-em')),
  ascender: Number(attr('data-ascender')),
  descender: Number(attr('data-descender')),
  paths: [...wordmark.matchAll(/<path [^>]*\/>/g)].map((m) => m[0]).join('\n'),
};
if (!word.width || !word.paths)
  throw new Error('brand/wordmark.svg: run tools/brand/wordmark.py first');

const { palettes } = JSON.parse(
  await readFile(join(root, 'packages/tokens/dist/palettes.json'), 'utf8'),
);
const linen = palettes.find((p) => p.name === 'linen');
if (!linen)
  throw new Error('packages/tokens/dist/palettes.json: no linen palette (run pnpm build first)');
const ink = {
  light: linen.modes.light.colors.text.primary,
  dark: linen.modes.dark.colors.text.primary,
};
const accent = linen.modes.light.colors.accent.ink;

const svgOpen = (width, height, viewBox = `0 0 ${width} ${height}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-label="Fluvy">`;

/** The mark alone, the grid's 24 units, an explicit fill. */
const mark = (fill, size) =>
  `${svgOpen(size, size, '0 0 24 24')}<path fill="${fill}" fill-rule="${fillRule}" d="${markPath}"/></svg>\n`;

/** The lockup as the logo sheet draws it: the mark at 32 beside the wordmark at 26 px, on a 48 px line. */
function lockup(fill) {
  const MARK = 32;
  const GAP = 10;
  const FONT = 26;
  const LINE = 48;
  const scale = FONT / word.unitsPerEm;
  const textHeight = (word.ascender - word.descender) * scale;
  const textTop = (LINE - textHeight) / 2;
  const wordWidth = Math.ceil(word.width * scale);
  const width = MARK + GAP + wordWidth;
  return (
    `${svgOpen(width, LINE)}<g fill="${fill}">` +
    `<path transform="translate(0 ${(LINE - MARK) / 2}) scale(${MARK / 24})" fill-rule="${fillRule}" d="${markPath}"/>` +
    `<g transform="translate(${MARK + GAP} ${textTop.toFixed(2)}) scale(${scale.toFixed(6)})">\n${word.paths}\n</g>` +
    `</g></svg>\n`
  );
}

/** The icon: the mark in the accent ink, trimmed to its tile (the path spans units 2 → 22 of the grid). */
const icon = (size) =>
  `${svgOpen(size, size, '2 2 20 20')}<path fill="${accent}" fill-rule="${fillRule}" d="${markPath}"/></svg>\n`;

const png = (svg, zoom = 1) =>
  new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom } }).render().asPng();

const out = async (file, data) => {
  await writeFile(file, data);
  console.log(`wrote ${relative(root, file)}`);
};

await mkdir(integration, { recursive: true });
await out(join(brand, 'mark-light.svg'), mark(ink.light, 96));
await out(join(brand, 'mark-dark.svg'), mark(ink.dark, 96));
for (const mode of ['light', 'dark']) {
  const svg = lockup(ink[mode]);
  await out(join(brand, `lockup-${mode}.svg`), svg);
  await out(join(brand, `lockup-${mode}.png`), png(svg, 2));
}
await out(join(integration, 'icon.png'), png(icon(256)));
await out(join(integration, 'icon@2x.png'), png(icon(512)));
console.log(`inks · light ${ink.light} · dark ${ink.dark} · icon ${accent}`);
