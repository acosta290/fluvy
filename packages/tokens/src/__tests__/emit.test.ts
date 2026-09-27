import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE, DEFAULT_PALETTE, PALETTE_MODES } from '../config.js';
import { derivePalettes } from '../build/palettes.js';
import { emitLabCss } from '../emit/css.js';
import { buildPaletteSummary, emitPalettesScript, emitTokensJson } from '../emit/json.js';
import { allPaletteVars } from '../emit/vars.js';
import { renderContrastReport } from '../emit/contrast.js';

const palettes = derivePalettes();
const css = emitLabCss(palettes);

describe('lab.css', () => {
  it('emits a block per palette and mode plus :root defaults', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        expect(css).toContain(`[data-palette='${palette.name}'][data-mode='${mode}']`);
      }
    }
    expect(css).toContain(`:root /* defaults: ${DEFAULT_PALETTE} ${DEFAULT_MODE} */`);
  });

  it('never emits a colour notation Home Assistant cannot parse', () => {
    // Only declarations matter; the file header names those notations to explain why.
    const declarations = css
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('--'));
    expect(declarations.length).toBeGreaterThan(1000);
    for (const notation of ['oklch(', 'color-mix(', 'rgba(', 'hsl(']) {
      expect(
        declarations.filter((line) => line.includes(notation)),
        notation,
      ).toEqual([]);
    }
  });

  it('carries both the brand layer and the representative HA mapping', () => {
    for (const name of [
      '--fluvy-accent-fill',
      '--fluvy-state-light-active-fill',
      '--fluvy-graph-12',
      '--ha-color-primary-40',
      '--ha-color-neutral-95',
      '--ha-color-text-primary',
      '--primary-color',
      '--card-background-color',
      '--divider-color',
      '--state-light-active-color',
      '--energy-solar-color',
      '--graph-color-12',
      '--app-header-background-color',
    ]) {
      expect(css, name).toContain(`${name}:`);
    }
  });
});

describe('variable maps', () => {
  it('declares no variable twice within one palette block', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        const names = allPaletteVars(palette[mode]).flatMap((group) =>
          group.declarations.map(([name]) => name),
        );
        expect(new Set(names).size, `${palette.name}/${mode}`).toBe(names.length);
      }
    }
  });
});

describe('json payloads', () => {
  it('produces parseable tokens.json with every palette', () => {
    const parsed: unknown = JSON.parse(emitTokensJson(palettes));
    expect(parsed).toHaveProperty('scales');
    expect(parsed).toHaveProperty('palettes');
  });

  it('exposes measured ratios in the lab summary', () => {
    const summary = buildPaletteSummary(palettes) as {
      palettes: { name: string; modes: Record<string, { contrast: Record<string, unknown> }> }[];
    };
    const sand = summary.palettes.find((entry) => entry.name === 'sand');
    expect(sand?.modes.light?.contrast).toHaveProperty('surface/card-on-page');
  });

  it('ships the lab payload as a classic script, since file:// blocks fetch and modules', () => {
    const script = emitPalettesScript(palettes);
    expect(script).toContain('globalThis.__DESIGN_TOKENS__ = {');
    expect(script).not.toContain('export ');
  });
});

describe('contrast report', () => {
  it('reports zero failures', () => {
    expect(renderContrastReport(palettes)).toContain('**Total failures: 0**');
  });
});
