#!/usr/bin/env node
/**
 * Screenshots a design-lab page for a matrix of palettes, modes and widths.
 *
 * The page is opened over `file://` with `?palette=&mode=&width=`; `lab.js` reads those,
 * puts the attributes on <html>, filters the sheets down to the requested combination and
 * sets `data-lab-ready` when it is done — which is what this waits on instead of a timer.
 *
 *   node render.mjs --page ../../apps/design-lab/sheets/palettes.html \
 *     --palette all --mode all --width 412,1024 --scale 2 \
 *     --out ../../apps/design-lab/out --selector '[data-sheet]'
 *
 * `--mode none` is for pages that show both modes at once, such as the gallery.
 */
import { mkdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parseArgs, paletteNames, MODES, launchOptions } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), {
  page: '../../apps/design-lab/sheets/palettes.html',
  palette: 'all',
  mode: 'all',
  width: '412,1024',
  scale: '2',
  out: '../../apps/design-lab/out',
  selector: '',
  // `--frame dark` forces every [data-frame] on a both-modes sheet to dark (the sheet script reads `?frame=`).
  frame: '',
});

const pagePath = resolve(args.page);
const outDir = resolve(args.out);
const pageName = basename(pagePath, extname(pagePath));
const scale = Number(args.scale);
const widths = args.width.split(',').map((value) => Number(value.trim()));
const palettes = args.palette === 'all' ? await paletteNames() : args.palette.split(',');
// `none` is for pages that render both modes themselves (the gallery): the query and the
// filename then carry no mode at all.
const modes = args.mode === 'all' ? MODES : args.mode === 'none' ? [null] : args.mode.split(',');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch(launchOptions);
let written = 0;

for (const mode of modes) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 1200 },
      deviceScaleFactor: scale,
      colorScheme: mode ?? 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    for (const palette of palettes) {
      const url = new URL(pathToFileURL(pagePath));
      const query = { palette, width: String(width) };
      if (mode) query.mode = mode;
      if (args.frame) query.frame = args.frame;
      url.search = new URLSearchParams(query).toString();

      await page.goto(url.href, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.dataset.labReady === '1');

      const stem = [pageName, palette, mode, args.frame ? `frame-${args.frame}` : '', width]
        .filter(Boolean)
        .join('-');
      const targets = args.selector ? await page.locator(args.selector).all() : [];

      if (targets.length === 0) {
        const file = `${outDir}/${stem}.png`;
        await page.screenshot({ path: file, fullPage: true });
        written += 1;
        continue;
      }

      for (const target of targets) {
        // Only disambiguate when a page really renders more than one sheet.
        const sheet = targets.length > 1 ? `-${await target.getAttribute('data-sheet')}` : '';
        await target.screenshot({ path: `${outDir}/${stem}${sheet}.png` });
        written += 1;
      }
    }

    await context.close();
  }
}

await browser.close();
console.log(`${written} screenshots → ${outDir}`);
