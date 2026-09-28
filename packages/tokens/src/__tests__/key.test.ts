import { describe, expect, it } from 'vitest';
import { PALETTE_NAMES } from '../config.js';
import { paletteKey, parsePaletteKey, type PaletteChoice } from '../palettes/key.js';

describe('the palette key', () => {
  it('is a preset’s name, and reads back as it', () => {
    for (const name of PALETTE_NAMES) {
      expect(paletteKey(name)).toBe(name);
      expect(parsePaletteKey(name)).toBe(name);
    }
  });

  it('holds a custom palette’s fields in a fixed order and reads them back exactly', () => {
    const customs: PaletteChoice[] = [
      { character: 'soft', base: 'warm', accent: '#716345' },
      { character: 'vivid', base: 'cool', accent: '#ff4a1a', fill: 'solid', highlight: '#e2ff3d' },
      { character: 'vivid', base: 'neutral', accent: '#0000ff', fill: 'tint' },
    ];
    for (const custom of customs) {
      const key = paletteKey(custom);
      expect(key.startsWith('custom:')).toBe(true);
      expect(parsePaletteKey(key)).toEqual(custom);
    }
    // a hex typed in capitals keys, and reads back, in lower case
    expect(paletteKey({ character: 'soft', base: 'warm', accent: '#AABBCC' })).toBe(
      'custom:soft:warm:#aabbcc::',
    );
  });

  it('reads nothing into what is not one of ours', () => {
    for (const key of [
      '',
      'noir2',
      'custom:',
      'custom:loud:warm:#aabbcc::',
      'custom:soft:warm:red::',
      'custom:soft:warm:#aabbcc:matte:',
      'custom:soft:warm:#aabbcc::lime',
    ])
      expect(parsePaletteKey(key), key).toBeUndefined();
  });
});
