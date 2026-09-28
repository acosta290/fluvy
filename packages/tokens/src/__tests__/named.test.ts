import { describe, expect, it } from 'vitest';
import { isHex } from '../color/oklch.js';
import { derivePalettes } from '../build/palettes.js';
import { HA_COLOR_NAMES, NAMED_COLORS, resolveAccent, THEME_COLOR_NAMES } from '../ha/named.js';

const linen = derivePalettes().find((p) => p.name === 'linen')!;

describe('Home Assistant’s named colours', () => {
  it('are the 23 of its colour selector less primary and accent, 21 of them the theme’s', () => {
    expect(HA_COLOR_NAMES).toHaveLength(23);
    expect(THEME_COLOR_NAMES).toHaveLength(21);
    expect(THEME_COLOR_NAMES).not.toContain('black');
    expect(HA_COLOR_NAMES).toContain('black');
  });

  it('each resolve to a plain hex of the palette, in both modes', () => {
    for (const mode of ['light', 'dark'] as const)
      for (const name of HA_COLOR_NAMES)
        expect(isHex(NAMED_COLORS[name](linen[mode])), name).toBe(true);
  });

  it('keep the tone Home Assistant gives them', () => {
    const c = linen.light;
    expect(NAMED_COLORS.teal(c)).toBe(c.state['presence-home'].ink);
    expect(NAMED_COLORS.cyan(c)).toBe(c.state['energy-water'].ink);
    expect(NAMED_COLORS.brown(c)).toBe(c.state['energy-gas'].ink);
    expect(NAMED_COLORS.pink(c)).toBe(c.state['security-armed'].ink);
    expect(NAMED_COLORS.black(c)).toBe(c.neutralRamp['05']);
    expect(NAMED_COLORS.white(c)).toBe(c.neutralRamp['95']);
  });
});

describe('resolveAccent', () => {
  const c = linen.light;
  it('reads a name, a hex in any case or length, and a triplet', () => {
    expect(resolveAccent('Teal', c)).toBe(c.state['presence-home'].ink);
    expect(resolveAccent(' #AABBCC ', c)).toBe('#aabbcc');
    expect(resolveAccent('#abc', c)).toBe('#aabbcc');
    expect(resolveAccent([255, 74, 26], c)).toBe('#ff4a1a');
  });
  it('is nothing for the palette’s own names, an empty value and nonsense', () => {
    for (const choice of [
      'primary',
      'accent',
      '',
      undefined,
      null,
      42,
      'reddish',
      '#12345',
      [1, 2],
      [256, 0, 0],
      {},
    ])
      expect(resolveAccent(choice, c), String(choice)).toBeUndefined();
  });
});
