import { describe, expect, it } from 'vitest';
import { derivePalette, GATES } from '../build/derive.js';
import { fitSeries } from '../build/series.js';
import { contrastRatio, deltaE, minPairwiseDeltaE } from '../color/index.js';
import { fromHex, hueDistance } from '../color/oklch.js';
import { PALETTE_MODES } from '../config.js';
import { seeds } from '../palettes/index.js';

/** A set of the house's own: six colours as a person might pick them, some of them only for one mode. */
const PICKED = ['#1e3a8a', '#f4e9d0', '#15803d', '#fde047', '#3b2a1a', '#0f766e'] as const;

describe('a set of series colours fitted to a palette’s mode', () => {
  for (const seed of Object.values(seeds))
    for (const mode of PALETTE_MODES) {
      const colors = derivePalette(seed)[mode];
      it(`${seed.name} ${mode}: every colour reads on the card at its own hue, the ones that read kept as picked`, () => {
        const fitted = fitSeries(PICKED, colors);
        fitted.forEach((hex, n) => {
          const pick = PICKED[n] as string;
          expect(contrastRatio(hex, colors.surface.card)).toBeGreaterThanOrEqual(GATES.icon);
          if (contrastRatio(pick, colors.surface.card) >= GATES.icon) expect(hex).toBe(pick);
          // only the lightness moves: a grey-brown keeps its lean, a colour its hue
          if (fromHex(pick).c > 0.03)
            expect(hueDistance(fromHex(hex).h, fromHex(pick).h)).toBeLessThan(6);
        });
      });

      it(`${seed.name} ${mode}: the palette’s own six from either mode stand apart once fitted`, () => {
        for (const from of PALETTE_MODES) {
          const six = derivePalette(seed)[from].graph.slice(0, 6);
          expect(minPairwiseDeltaE(fitSeries(six, colors))).toBeGreaterThanOrEqual(
            GATES.graphSeparation,
          );
        }
      });
    }

  it('lifts a dark navy on a dark card, deepens a pale cream on a light one, and goes no further than that', () => {
    const { light, dark } = derivePalette(seeds.linen);
    const [navy] = fitSeries(['#1e3a8a'], dark);
    const [cream] = fitSeries(['#f4e9d0'], light);
    expect(fromHex(navy as string).l).toBeGreaterThan(fromHex('#1e3a8a').l);
    expect(fromHex(cream as string).l).toBeLessThan(fromHex('#f4e9d0').l);
    // just past the gate: a fitted colour is the picked one as far as the card asks, never a step of the palette's
    expect(contrastRatio(navy as string, dark.surface.card)).toBeLessThan(GATES.icon + 0.1);
    expect(contrastRatio(cream as string, light.surface.card)).toBeLessThan(GATES.icon + 0.1);
  });

  it('cannot set apart two hues a breath apart: what the panel says', () => {
    for (const mode of PALETTE_MODES) {
      const [a, b] = fitSeries(['#2563eb', '#2463ea'], derivePalette(seeds.linen)[mode]);
      expect(deltaE(a as string, b as string)).toBeLessThan(GATES.graphSeparation);
    }
  });
});
