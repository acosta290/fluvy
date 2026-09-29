import { describe, expect, it } from 'vitest';
import { COMMUNITY_PALETTES } from '@fluvy/tokens/community';
import {
  customKey,
  knownPalettes,
  matchOf,
  paletteFileOf,
  roomFor,
  slugOf,
  withPalette,
  withoutPalette,
} from './palettes.js';

const moss = COMMUNITY_PALETTES.find((file) => file.name === 'moss')!;
const citrus = COMMUNITY_PALETTES.find((file) => file.name === 'citrus')!;

describe('palettes that travel', () => {
  it('reads a vivid palette without a fill as the tinted one it draws', () => {
    expect(customKey({ character: 'vivid', base: 'cool', accent: '#2f5bff' })).toBe(
      customKey({ character: 'vivid', base: 'cool', accent: '#2F5BFF', fill: 'tint' }),
    );
    expect(customKey(moss.palette)).not.toBe(customKey(citrus.palette));
  });

  it('finds the file a draft equals, the house’s before the community’s', () => {
    const own = { ...moss, name: 'my-moss', title: 'My moss' };
    expect(matchOf(moss.palette, knownPalettes([own]))?.name).toBe('my-moss');
    expect(matchOf(moss.palette, knownPalettes([]))?.name).toBe('moss');
    expect(matchOf('linen', knownPalettes([own]))).toBeUndefined();
    expect(matchOf({ ...moss.palette, accent: '#123456' }, knownPalettes([]))).toBeUndefined();
    // a saved palette that shares a community name stands in for it
    expect(
      knownPalettes([{ ...citrus, title: 'Ours' }]).filter((f) => f.name === 'citrus'),
    ).toHaveLength(1);
  });

  it('names a file from its title, plainly', () => {
    expect(slugOf('Warm Sand')).toBe('warm-sand');
    expect(slugOf('  Été à Séville!  ')).toBe('ete-a-seville');
    expect(slugOf('X')).toBe('palette');
    expect(slugOf('a'.repeat(60)).length).toBe(40);
    const file = paletteFileOf(moss.palette, 'Warm Sand', ' Marta ');
    expect(file).toMatchObject({
      fluvy_palette: 1,
      name: 'warm-sand',
      title: 'Warm Sand',
      author: 'Marta',
    });
    expect(paletteFileOf(moss.palette, '', 'Marta')).toBeUndefined();
  });

  it('keeps twelve palettes, replacing one by its name', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      ...moss,
      name: `p${i}`,
      title: `P${i}`,
    }));
    expect(roomFor(twelve, 'p3')).toBe(true);
    expect(roomFor(twelve, 'new')).toBe(false);
    expect(roomFor(twelve.slice(0, 11), 'new')).toBe(true);
    const saved = withPalette(twelve.slice(0, 3), { ...citrus, name: 'p1', title: 'Replaced' });
    expect(saved.map((f) => f.name)).toEqual(['p0', 'p2', 'p1']);
    expect(saved.find((f) => f.name === 'p1')?.title).toBe('Replaced');
    expect(withoutPalette(saved, 'p0').map((f) => f.name)).toEqual(['p2', 'p1']);
  });
});
