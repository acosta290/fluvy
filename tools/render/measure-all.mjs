/**
 * Every measurable page at every width, one report each: the playground's sheets (`[data-frame]`) at 360, 412 and
 * 1400, and the settings panel's tabs (`fluvy-panel`) at the same widths, including the moments that change what a
 * tab shows (the language menu, with and without the Popover API; a custom palette; the house's palettes; every
 * template's dashboard; this device a wall). Reports land in `--out` (default `out/measure`), and the exit code is
 * 1 when any page has a violation — after every page has been measured, so one report never hides another.
 *
 *   PLAYGROUND=http://127.0.0.1:5183/ node tools/render/measure-all.mjs [--out out/measure] [--only home,climate]
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const BASE = (process.env.PLAYGROUND ?? 'http://127.0.0.1:5183/').replace(/\/?$/, '/');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback;
};
const outDir = resolve(root, option('--out', 'out/measure'));
const only = option('--only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const WIDTHS = [360, 412, 1400];
const sheets = (await readdir(join(root, 'apps', 'playground', 'src', 'sheets')))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''))
  .sort();
const PANEL = [
  ['appearance', ''],
  ['appearance-custom', 'appearance&state=custom'],
  ['appearance-palettes', 'appearance&state=custom,palettes'],
  ['scope', 'scope'],
  ['dashboard', 'dashboard&state=dashboards'],
  ['wall', 'wall&state=wall'],
  ['wall-night', 'wall&state=wall,night'],
  ['preferences', 'preferences'],
  ['preferences-menu', 'preferences&state=menu'],
  ['about', 'about'],
];

/** The pages to measure: `{ name, query, frame }`, one report per page and width. */
const pages = [
  ...sheets.map((sheet) => ({ name: sheet, query: `sheet=${sheet}`, frame: '[data-frame]' })),
  ...PANEL.map(([name, tab]) => ({
    name: `panel-${name}`,
    query: `panel=${tab || 'appearance'}`,
    frame: 'fluvy-panel',
  })),
  // the menu without the Popover API (an older WebView), on a phone only
  {
    name: 'panel-preferences-nopopover',
    query: 'panel=preferences&state=menu&nopopover=1',
    frame: 'fluvy-panel',
    widths: [360],
  },
].filter((page) => !only.length || only.includes(page.name));

const run = (page, width) =>
  new Promise((resolve) => {
    const out = join(outDir, `${page.name}-${width}`);
    const child = spawn(
      process.execPath,
      [
        join(here, 'measure.mjs'),
        '--page',
        `${BASE}?${page.query}`,
        '--frame',
        page.frame,
        '--width',
        String(width),
        '--grid',
        '4',
        '--out',
        `${out}.json`,
        '--md',
        `${out}.md`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let text = '';
    child.stdout.on('data', (chunk) => (text += chunk));
    child.stderr.on('data', (chunk) => (text += chunk));
    child.on('close', (code) => {
      const count = /\*\*(\d+) violations\*\*/.exec(text)?.[1];
      resolve({ code, count: count === undefined ? null : Number(count), text });
    });
  });

await mkdir(outDir, { recursive: true });
const started = Date.now();
const failed = [];
for (const page of pages)
  for (const width of page.widths ?? WIDTHS) {
    const result = await run(page, width);
    const label = `${page.name} @ ${width}`;
    if (result.code === 0 && result.count === 0) console.log(`✓ ${label}`);
    else {
      failed.push(
        `${label}: ${result.count ?? 'no report'} (${result.text.trim().split('\n').at(-1) ?? ''})`,
      );
      console.log(`✗ ${label} — ${result.count ?? 'no report'} violations`);
    }
  }
const total = pages.reduce((n, page) => n + (page.widths ?? WIDTHS).length, 0);
console.log(
  `\n${total - failed.length}/${total} pages at 0 violations (${Math.round((Date.now() - started) / 1000)} s) → ${outDir}`,
);
if (failed.length) {
  for (const line of failed) console.log(`  ${line}`);
  process.exit(1);
}
