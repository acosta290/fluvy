#!/usr/bin/env node
/**
 * Composes a folder of PNGs into one labelled grid.
 *
 * Builds a throwaway HTML page that references the PNGs by `file://` and screenshots it,
 * so there is no image library in the dependency tree.
 *
 *   node contact-sheet.mjs --in ../../apps/design-lab/out --out ../../apps/design-lab/out/contact-sheet.png \
 *     --filter -412 --columns 6 --title 'Palette sheets — 412px'
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parseArgs, launchOptions } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), {
  in: '../../apps/design-lab/out',
  out: '../../apps/design-lab/out/contact-sheet.png',
  filter: '',
  columns: '6',
  tile: '340',
  title: 'Contact sheet',
});

const inDir = resolve(args.in);
const outFile = resolve(args.out);
const columns = Number(args.columns);
const tile = Number(args.tile);

const files = (await readdir(inDir))
  .filter((name) => name.endsWith('.png') && name !== 'contact-sheet.png')
  .filter((name) => (args.filter ? name.includes(args.filter) : true))
  .sort();

if (files.length === 0) {
  throw new Error(`No PNGs matching "${args.filter}" in ${inDir}`);
}

const cells = files
  .map(
    (name) => `<figure>
      <img src="${pathToFileURL(join(inDir, name)).href}" alt="${name}">
      <figcaption>${name.replace(/\.png$/, '')}</figcaption>
    </figure>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${args.title}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; background: #2a2a2a; color: #f2f2f2;
    font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 20px; }
  .grid { display: grid; grid-template-columns: repeat(${columns}, ${tile}px); gap: 20px; align-items: start; }
  figure { margin: 0; }
  img { width: ${tile}px; height: auto; display: block; border-radius: 6px; background: #fff; }
  figcaption { margin-top: 6px; font-size: 11px; color: #b9b9b9; word-break: break-all; }
</style></head>
<body><h1>${args.title} — ${files.length} frames</h1><div class="grid">${cells}</div></body></html>`;

await mkdir(dirname(outFile), { recursive: true });
const scratch = `${outFile}.html`;
await writeFile(scratch, html, 'utf8');

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: columns * (tile + 20) + 48, height: 900 },
});
await page.goto(pathToFileURL(scratch).href, { waitUntil: 'load' });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
await rm(scratch);

console.log(`${files.length} frames → ${outFile}`);
