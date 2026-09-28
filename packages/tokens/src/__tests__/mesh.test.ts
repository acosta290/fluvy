import { describe, expect, it } from 'vitest';
import { derivePalettes } from '../build/palettes.js';
import { meshOf } from '../build/mesh.js';
import { deltaE, fromHex, isHex } from '../color/index.js';

/** The approved Linen renders (design-lab/backgrounds): Paper, Charcoal and Wall. */
const PAPER = ['#f6efe3', '#e9e2d3', '#f2ebdf'] as const;
const CHARCOAL = ['#2a2216', '#1f1a12', '#241d12'] as const;
const WALL = ['#1c160d', '#17120b', '#100d07'] as const;

const palettes = derivePalettes();
const linen = palettes.find((palette) => palette.name === 'linen')!;

describe('the mesh', () => {
  it('reproduces the approved Linen renders within ΔE 2', () => {
    const light = meshOf(linen.light.surface.page, 'light');
    const dark = meshOf(linen.dark.surface.page, 'dark');
    PAPER.forEach((hex, i) =>
      expect(deltaE(light.mesh[i]!, hex), `paper ${i + 1}`).toBeLessThan(2),
    );
    CHARCOAL.forEach((hex, i) =>
      expect(deltaE(dark.mesh[i]!, hex), `charcoal ${i + 1}`).toBeLessThan(2),
    );
    WALL.forEach((hex, i) => expect(deltaE(dark.wall[i]!, hex), `wall ${i + 1}`).toBeLessThan(2));
  });

  it('gives every preset six well-formed stops, none the page itself', () => {
    for (const palette of palettes)
      for (const mode of ['light', 'dark'] as const) {
        const page = palette[mode].surface.page;
        const { mesh, wall } = meshOf(page, mode);
        for (const hex of [...mesh, ...wall]) {
          expect(isHex(hex), `${palette.name} ${mode}`).toBe(true);
          expect(hex, `${palette.name} ${mode}`).not.toBe(page);
        }
      }
  });

  it('keeps a grey page grey', () => {
    const { mesh, wall } = meshOf('#f2f2f2', 'light');
    for (const hex of [...mesh, ...wall]) expect(fromHex(hex).c).toBeLessThan(0.002);
  });
});
