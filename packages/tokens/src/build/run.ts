import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromHex } from '../color/index.js';
import { seedList } from '../palettes/index.js';
import { buildReports, countFailures, renderContrastReport } from '../emit/contrast.js';
import { emitLabCss } from '../emit/css.js';
import { emitPalettesJson, emitPalettesScript, emitTokensJson } from '../emit/json.js';
import type { Palette, PaletteSeed } from '../types.js';
import { derivePalettes } from './palettes.js';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');

/**
 * Seeds are starting points, so the build says out loud where derivation had to move one.
 * Anchors only ever travel along lightness, so a difference here means a gate bit.
 */
function reportAnchorAdjustments(seed: PaletteSeed, palette: Palette): void {
  const derived = palette[seed.baseMode];
  const pairs: readonly (readonly [string, string, string])[] = [
    ['page', seed.page, derived.surface.page],
    ['card', seed.card, derived.surface.card],
    ['accentInk', seed.accentInk, derived.accent.ink],
    ['accentFill', seed.accentFill, derived.accent.fill],
    ['accentOnFill', seed.accentOnFill, derived.accent.onFill],
  ];
  for (const [role, before, after] of pairs) {
    if (before === after) continue;
    const delta = (fromHex(after).l - fromHex(before).l) * 100;
    console.log(
      `  adjusted ${seed.name}.${role}: ${before} → ${after} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp lightness)`,
    );
  }
}

async function main(): Promise<void> {
  const palettes = derivePalettes();

  console.log(`Deriving ${palettes.length} palettes × 2 modes…`);
  seedList.forEach((seed, index) => {
    const palette = palettes[index];
    if (palette !== undefined) reportAnchorAdjustments(seed, palette);
  });

  await mkdir(DIST, { recursive: true });
  await Promise.all([
    writeFile(join(DIST, 'lab.css'), emitLabCss(palettes), 'utf8'),
    writeFile(join(DIST, 'tokens.json'), emitTokensJson(palettes), 'utf8'),
    writeFile(join(DIST, 'palettes.json'), emitPalettesJson(palettes), 'utf8'),
    writeFile(join(DIST, 'palettes.js'), emitPalettesScript(palettes), 'utf8'),
    writeFile(join(DIST, 'contrast-report.md'), renderContrastReport(palettes), 'utf8'),
  ]);

  const reports = buildReports(palettes);
  const checks = reports.reduce(
    (total, report) => total + report.contrast.length + report.structural.length,
    0,
  );
  const failures = countFailures(reports);

  console.log(
    `Wrote lab.css, tokens.json, palettes.json, palettes.js, contrast-report.md to dist/`,
  );
  console.log(`${checks} gates checked, ${failures} failing.`);

  if (failures > 0) {
    for (const report of reports) {
      for (const entry of report.contrast) {
        if (entry.pass) continue;
        console.error(
          `FAIL ${report.palette}/${report.mode} ${entry.id}: ${entry.ratio.toFixed(2)} < ${entry.min} (${entry.foreground} on ${entry.background})`,
        );
      }
      for (const entry of report.structural) {
        if (entry.pass) continue;
        console.error(`FAIL ${report.palette}/${report.mode} ${entry.id}: ${entry.detail}`);
      }
    }
    console.error('\nContrast gates are not negotiable — adjust the seeds or the derivation.');
    process.exitCode = 1;
  }
}

await main();
