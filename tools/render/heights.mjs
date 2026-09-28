#!/usr/bin/env node
/**
 * Every card's declared height (`static layoutHeight`, what the automatic dashboard lays columns out with) against
 * what it measures in the playground at a 360 column: the sheets' frames at their natural width (a card of 360;
 * a frame with a width of its own, or a card showing its empty state, is not a sample). A drift over 8 px is
 * reported; advisory (exit 0) unless `--strict`, when any drift fails.
 *   PLAYGROUND=http://127.0.0.1:5183/ node tools/render/heights.mjs [--strict]
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSuite } from './lib/suite.mjs';

const TOLERANCE = 8;
const strict = process.argv.includes('--strict');
const sheets = readdirSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'playground', 'src', 'sheets'),
)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
  .map((file) => file.slice(0, -3))
  .sort();

const suite = await startSuite();
const drifts = [];
let counted = 0;
for (const sheet of sheets) {
  const page = await suite.page(`sheet=${sheet}`, { viewport: { width: 1400, height: 1200 } });
  const rows = await page.evaluate(() => {
    const out = [];
    for (const frame of document.querySelectorAll('[data-frame]')) {
      if (frame.getAttribute('data-measure') === 'false') continue;
      for (const el of frame.querySelectorAll('*')) {
        const tag = el.tagName.toLowerCase();
        if (!tag.startsWith('fluvy-') || !tag.endsWith('-card')) continue;
        if (
          el.closest('fluvy-tiles-card, fluvy-scenes-card') &&
          !/^fluvy-(tiles|scenes)-card$/.test(tag)
        )
          continue; // a tile inside a set is the set's
        const height = el.constructor.layoutHeight;
        if (typeof height !== 'function' || !el.config) continue;
        // the card's own box (what it renders at its root), not the host a frame's grid row may have stretched
        const card = [...(el.renderRoot?.children ?? [])].find((node) => node.tagName !== 'STYLE');
        const rect = (card ?? el).getBoundingClientRect();
        if (Math.round(rect.width) !== 360) continue; // a half tile, a frame of its own width: not a 360 column
        if (el.renderRoot?.querySelector('.fv-card--empty')) continue; // "no entity": not the card's height
        out.push({
          frame: frame.getAttribute('data-frame'),
          tag,
          declared: height(el.config),
          measured: Math.round(rect.height),
        });
      }
    }
    return out;
  });
  for (const row of rows) {
    counted += 1;
    if (Math.abs(row.declared - row.measured) > TOLERANCE) drifts.push(row);
  }
  await page.close();
}
await suite.browser.close();

for (const { frame, tag, declared, measured } of drifts)
  console.log(`  ${frame} · ${tag}: declared ${declared}, measured ${measured}`);
console.log(
  `${counted} cards measured at 360; ${drifts.length} drift over ${TOLERANCE} px${strict ? '' : ' (advisory)'}`,
);
process.exit(strict && drifts.length ? 1 : 0);
