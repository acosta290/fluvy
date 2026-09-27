import { describe, expect, it } from 'vitest';
import { GATES } from '../build/derive.js';
import { fromHex, hueDistance, maxChroma, toHex } from '../color/oklch.js';
import { checkContrast, checkStructure } from '../emit/contrast.js';
import { allPaletteVars, OPTIONAL_BRAND_VARS, scaleVars } from '../emit/vars.js';
import { haSharedVars } from '../ha/groups.js';
import {
  CUSTOM_BASES,
  customSeed,
  declarationsCss,
  derivePalette,
  lookDeclarations,
  PALETTE_NAMES,
  seedOf,
  type CustomPalette,
} from '../runtime.js';

/** Accents a user can pick that a palette has to survive: yellow on white, pure blue, grey, lime, near-black… */
const HARD_ACCENTS = ['#ffd400', '#0000ff', '#808080', '#c6ff00', '#111111', '#ff4a1a', '#00b894'];
/** …and a walk round the wheel: deep, mid, light and very pale; electric, dusty and nearly grey. */
const WHEEL = Array.from({ length: 12 }, (_, i) => i * 30).flatMap((h) =>
  [0.45, 0.65, 0.85, 0.92].flatMap((l) => [0.03, 0.1, 0.3].map((c) => toHex({ l, c, h }))),
);

/** A colour's share of the chroma sRGB holds at its lightness and hue. */
const share = (hex: string): number => {
  const color = fromHex(hex);
  return color.c / maxChroma(color.l, color.h);
};

describe('custom palettes', () => {
  // every accent on one of the grounds, round the three
  const customs: CustomPalette[] = [...HARD_ACCENTS, ...WHEEL].flatMap((accent, i) => {
    const base = CUSTOM_BASES[i % CUSTOM_BASES.length] ?? 'neutral';
    return [
      { character: 'soft', base, accent },
      { character: 'vivid', base, accent, fill: 'tint' },
      {
        character: 'vivid',
        base,
        accent,
        fill: 'solid',
        ...(i % 2 ? { highlight: '#e2ff3d' } : {}),
      },
    ];
  });
  const derived = customs.map((custom) => ({ custom, palette: derivePalette(customSeed(custom)) }));

  it('pass every contrast gate, whatever accent is picked', () => {
    const failures = derived.flatMap(({ custom, palette }) =>
      (['light', 'dark'] as const).flatMap((mode) =>
        checkContrast(palette[mode])
          .filter((result) => !result.pass)
          .map((result) => `${JSON.stringify(custom)} ${mode} ${result.id} ${result.ratio}`),
      ),
    );
    expect(failures).toEqual([]);
  });

  it('pass the structural checks a preset passes', () => {
    const failures = derived.flatMap(({ custom, palette }) =>
      (['light', 'dark'] as const).flatMap((mode) =>
        checkStructure(palette, mode)
          // "electric" is asked of the accent only as far as the pick is: a dusty rose stays a dusty rose
          .filter((r) => !r.pass && r.id !== 'vivid/accent-chroma')
          .map((r) => `${JSON.stringify(custom)} ${mode} ${r.id}: ${r.detail}`),
      ),
    );
    expect(failures).toEqual([]);
  });

  it('keep an electric pick electric when its line has to go deeper', () => {
    for (const accent of ['#ff9bba', '#ffa383', '#98bfff']) {
      const palette = derivePalette(customSeed({ character: 'vivid', base: 'neutral', accent }));
      expect(share(palette.light.accent.ink), accent).toBeGreaterThanOrEqual(
        Math.min(share(accent), GATES.vividAccentGamut) - 0.02,
      );
    }
  });
});

describe('a custom electric accent on a device colour', () => {
  it('makes the device colour it was picked from its twin, so the two never mean different things', () => {
    const plain = derivePalette(
      customSeed({ character: 'vivid', base: 'neutral', accent: '#ff2d7a' }),
    );
    const accent = plain.light.state['presence-home'].ink;
    const seed = customSeed({ character: 'vivid', base: 'neutral', accent });
    expect(seed.twin).toBe('presence-home');
    const palette = derivePalette(seed);
    expect(palette.light.state['presence-home']).toEqual({
      ink: palette.light.accent.ink,
      fill: palette.light.accent.fill,
      fillBorder: palette.light.accent.fillBorder,
      onFill: palette.light.accent.onFill,
    });
  });

  it('turns a status aside rather than twinning it: success stays a green of its own', () => {
    const seed = customSeed({ character: 'vivid', base: 'cool', accent: '#00e36a', fill: 'solid' });
    const hue = seed.statuses?.success?.hue;
    expect(hue).toBeDefined();
    expect(hueDistance(hue ?? 0, 150)).toBeGreaterThan(0);
    expect(hueDistance(hue ?? 0, 150)).toBeLessThanOrEqual(24);
  });

  it('leaves an accent clear of every colour as it is', () => {
    const seed = customSeed({ character: 'vivid', base: 'cool', accent: '#ff2d7a', fill: 'tint' });
    expect(seed.twin).toBeUndefined();
    expect(seed.states).toBeUndefined();
    expect(seed.statuses).toBeUndefined();
  });
});

describe('lookDeclarations', () => {
  it('declares what the theme file declares for that mode, plus the rgb triplets Home Assistant would add', () => {
    for (const name of PALETTE_NAMES) {
      const palette = derivePalette(seedOf(name));
      for (const mode of ['light', 'dark'] as const) {
        const theme = [...scaleVars(), ...haSharedVars(), ...allPaletteVars(palette[mode])].flatMap(
          (group) => group.declarations,
        );
        const look = lookDeclarations(palette, mode);
        expect(look.slice(0, theme.length), `${name} ${mode}`).toEqual(theme);
        for (const [key, value] of look.slice(theme.length)) {
          if (OPTIONAL_BRAND_VARS.includes(key)) {
            expect(value, key).toBe('initial');
            continue;
          }
          expect(key.startsWith('--rgb-'), key).toBe(true);
          expect(value, key).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/);
        }
      }
    }
  });

  it('declares every brand name any palette writes, empty where it has none (nothing of an outer look shows)', () => {
    const everywhere = PALETTE_NAMES.flatMap((name) =>
      (['light', 'dark'] as const).map(
        (mode) => new Set(lookDeclarations(derivePalette(seedOf(name)), mode).map(([key]) => key)),
      ),
    );
    const brand = new Set(
      everywhere.flatMap((names) => [...names]).filter((key) => key.startsWith('--fluvy-')),
    );
    for (const names of everywhere) for (const key of brand) expect(names.has(key), key).toBe(true);
    expect(
      new Map(lookDeclarations(derivePalette(seedOf('linen')), 'light')).get('--fluvy-mark'),
    ).toBe('initial');
  });

  it('gives every Home Assistant hex its triplet, and our own none', () => {
    const look = lookDeclarations(derivePalette(seedOf('linen')), 'light');
    const map = new Map(look);
    expect(map.get('--rgb-primary-color')).toBe('133,101,41');
    expect([...map.keys()].some((key) => key.startsWith('--rgb-fluvy-'))).toBe(false);
  });

  it('moves every radius with the shape', () => {
    const palette = derivePalette(seedOf('linen'));
    const round = new Map(lookDeclarations(palette, 'light', 'round'));
    expect(round.get('--fluvy-radius-card')).toBe('28px');
    expect(round.get('--ha-card-border-radius')).toBe('var(--fluvy-radius-card)');
  });

  it('writes a rule body, important when asked', () => {
    expect(
      declarationsCss([
        ['--a', '1'],
        ['--b', '#fff'],
      ]),
    ).toBe('--a:1;--b:#fff;');
    expect(declarationsCss([['--a', '1']], true)).toBe('--a:1 !important;');
  });
});
