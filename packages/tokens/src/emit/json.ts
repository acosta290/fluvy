import { BRAND } from '../config.js';
import { RELEASE_VERSION } from '../release.js';
import {
  density,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  iconBox,
  lineHeight,
  numericVariant,
  radius,
  spacing,
} from '../scales/index.js';
import type { Palette, PaletteMode } from '../types.js';
import { buildReports } from './contrast.js';
import { haSharedVars } from '../ha/groups.js';
import { allPaletteVars, scaleVars } from './vars.js';

function flatten(
  groups: readonly { declarations: readonly (readonly [string, string])[] }[],
): Record<string, string> {
  return Object.fromEntries(groups.flatMap((group) => group.declarations.map(([k, v]) => [k, v])));
}

/** Complete machine-readable dump: scales, derived colours and the emitted custom properties. */
export function emitTokensJson(palettes: readonly Palette[]): string {
  const payload = {
    version: RELEASE_VERSION,
    brand: BRAND,
    scales: {
      spacing,
      density,
      radius,
      iconBox,
      typography: { fontFamily, fontSize, fontWeight, lineHeight, numericVariant },
      motion: { duration, easing },
      cssVars: flatten([...scaleVars(), ...haSharedVars()]),
    },
    palettes: palettes.map((palette) => ({
      name: palette.name,
      title: palette.title,
      description: palette.description,
      modes: Object.fromEntries(
        (['light', 'dark'] as const).map((mode) => [
          mode,
          { colors: palette[mode], cssVars: flatten(allPaletteVars(palette[mode])) },
        ]),
      ),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

interface PaletteSummaryMode {
  readonly colors: Palette['light'];
  readonly contrast: Record<string, { ratio: number; min: number; pass: boolean }>;
  /** Non-ratio gates (dark card lift, ΔE separation) so the lab can print them too. */
  readonly structural: Record<string, { detail: string; pass: boolean }>;
}

/** Trimmed payload the design lab renders from: colours plus the measured ratios. */
export function buildPaletteSummary(palettes: readonly Palette[]): unknown {
  const reports = buildReports(palettes);
  const byKey = new Map(reports.map((report) => [`${report.palette}:${report.mode}`, report]));

  return {
    version: RELEASE_VERSION,
    palettes: palettes.map((palette) => ({
      name: palette.name,
      title: palette.title,
      description: palette.description,
      modes: Object.fromEntries(
        (['light', 'dark'] as const).map((mode): [PaletteMode, PaletteSummaryMode] => {
          const report = byKey.get(`${palette.name}:${mode}`);
          const contrast = Object.fromEntries(
            (report?.contrast ?? []).map((entry) => [
              entry.id,
              { ratio: entry.ratio, min: entry.min, pass: entry.pass },
            ]),
          );
          const structural = Object.fromEntries(
            (report?.structural ?? []).map((entry) => [
              entry.id,
              { detail: entry.detail, pass: entry.pass },
            ]),
          );
          return [mode, { colors: palette[mode], contrast, structural }];
        }),
      ),
    })),
  };
}

export function emitPalettesJson(palettes: readonly Palette[]): string {
  return `${JSON.stringify(buildPaletteSummary(palettes), null, 2)}\n`;
}

/**
 * Same payload as a classic script assigning a global.
 *
 * The design lab has to open straight off the filesystem, and Chromium refuses both
 * `fetch()` and ES modules over `file://`. A classic script does load, so this is how
 * the sheets get their data without a dev server.
 *
 * The global is deliberately brand-neutral: renaming the product must not touch the lab.
 */
export const PALETTE_GLOBAL = '__DESIGN_TOKENS__';

export function emitPalettesScript(palettes: readonly Palette[]): string {
  const json = JSON.stringify(buildPaletteSummary(palettes));
  return [
    `/* ${BRAND.npmScope}/tokens v${RELEASE_VERSION} — generated, do not edit. */`,
    `globalThis.${PALETTE_GLOBAL} = ${json};`,
    '',
  ].join('\n');
}
