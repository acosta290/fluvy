import { describe, expect, it } from 'vitest';
import { derivePalette, GATES } from '../build/derive.js';
import { EXACT_TINT, exactFamily, exactHex } from '../build/exact.js';
import { composite, contrastRatio, fromHex, hueDistance } from '../color/index.js';
import { HA_COLOR_NAMES, NAMED_COLORS } from '../ha/named.js';
import { HA_STANDARD_COLORS } from '../ha/standard.js';
import { customSeed } from '../palettes/custom.js';
import { seeds } from '../palettes/index.js';
import type { PaletteModeColors, PaletteSeed } from '../types.js';

/**
 * Colours worn as they are named (#250), held on every preset and a custom palette of each character and fill, in both
 * modes: the names Home Assistant's own, a hex as typed, every colour the issue's and the hardest a card can be given.
 */
const PICKS = [
  ...['amber', 'teal', 'indigo', 'yellow', 'brown', 'white', 'black'].map(
    (name) => HA_STANDARD_COLORS[name as 'amber'],
  ),
  '#e91e63',
  '#c6ff00',
  '#0000ff',
];

const SEEDS: readonly PaletteSeed[] = [
  ...Object.values(seeds),
  customSeed({ character: 'soft', base: 'warm', accent: '#3a7bd5' }),
  customSeed({ character: 'vivid', base: 'cool', accent: '#ff4f7b', fill: 'tint' }),
  customSeed({ character: 'vivid', base: 'neutral', accent: '#5a6ff0', fill: 'solid' }),
];
const MODES: [string, PaletteSeed, PaletteModeColors][] = SEEDS.flatMap((seed) => {
  const palette = derivePalette(seed);
  return (['light', 'dark'] as const).map((mode): [string, PaletteSeed, PaletteModeColors] => [
    `${seed.name} ${mode}`,
    seed,
    palette[mode],
  ]);
});

describe('a colour named exactly', () => {
  const linen = derivePalette(seeds.linen!).light;

  it('is Home Assistant’s own value for each of its names, the same in both modes', () => {
    for (const name of HA_COLOR_NAMES) expect(exactHex(name, linen)).toBe(HA_STANDARD_COLORS[name]);
    expect(exactHex(' Amber ', linen)).toBe('#ffc107');
    expect(exactHex('deep-orange', derivePalette(seeds.volt!).dark)).toBe('#ff6f22');
    // where the palette's tone of it is another colour
    expect(exactHex('amber', linen)).not.toBe(NAMED_COLORS.amber(linen));
  });

  it('is a hex as typed, and reads what a card’s colour reads besides as it always has', () => {
    expect(exactHex('#E91E63', linen)).toBe('#e91e63');
    expect(exactHex([255, 74, 26], linen)).toBe('#ff4a1a');
    expect(exactHex('primary-text', linen)).toBe(linen.text.primary);
    for (const nothing of ['primary', 'accent', 'none', 'state', '', 'reddish', undefined, 3])
      expect(exactHex(nothing, linen), String(nothing)).toBeUndefined();
  });
});

describe.each(MODES)('a colour worn exactly on %s', (_, seed, colors) => {
  const { card, page } = colors.surface;

  it.each(PICKS)('%s: its glyph, its line and its first series are the colour itself', (pick) => {
    const family = exactFamily(seed, colors, pick);
    expect(family.ink).toBe(pick);
    expect(family.graph).toHaveLength(12);
    expect(family.graph[0]).toBe(pick);
    // its primary action is the colour on a tint palette, its fill (the colour too) on a solid one
    expect(family.primary.fill).toBe(pick);
  });

  it.each(PICKS)(
    '%s: its fill is the colour on a solid palette, Home Assistant’s fifth of it on a tint one',
    (pick) => {
      const { fill } = exactFamily(seed, colors, pick);
      expect(fill).toBe(colors.fillStyle === 'solid' ? pick : composite(pick, card, EXACT_TINT));
    },
  );

  it.each(PICKS)('%s: words on its fill and on the colour are black or white, at 4.5', (pick) => {
    const family = exactFamily(seed, colors, pick);
    for (const [words, ground] of [
      [family.onFill, family.fill],
      [family.onAccent, pick],
      [family.primary.on, family.primary.fill],
    ] as const) {
      expect(contrastRatio(words, ground)).toBeGreaterThanOrEqual(GATES.text);
      // a neutral: the palette's black or white, never a colour of its own
      expect(fromHex(words).c).toBeLessThan(0.04);
    }
  });

  it.each(PICKS)(
    '%s: a word written in it reads at 4.5 on the card and the page, in its hue',
    (pick) => {
      const { text } = exactFamily(seed, colors, pick);
      expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(GATES.text);
      expect(contrastRatio(text, page)).toBeGreaterThanOrEqual(GATES.text);
      // only its lightness moved, and only where it had to
      const asked = fromHex(pick);
      if (Math.min(contrastRatio(pick, card), contrastRatio(pick, page)) >= GATES.text)
        expect(text).toBe(pick);
      else if (asked.c > 0.05 && fromHex(text).c > 0.03)
        expect(hueDistance(fromHex(text).h, asked.h)).toBeLessThan(12);
    },
  );

  it.each(PICKS)('%s: its fill’s hairline stands off the fill', (pick) => {
    const { fill, fillBorder } = exactFamily(seed, colors, pick);
    expect(contrastRatio(fillBorder, fill)).toBeGreaterThanOrEqual(GATES.borderVsCard - 0.01);
  });
});
