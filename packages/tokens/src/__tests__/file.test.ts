import { describe, expect, it } from 'vitest';
import { paletteFileName, parsePaletteFile } from '../palettes/file.js';

const good = {
  fluvy_palette: 1,
  name: 'moss',
  title: 'Moss',
  author: 'Fluvy',
  description: 'A soft moss green.',
  palette: { character: 'soft', base: 'warm', accent: '#4F7A4A' },
};

describe('a palette file', () => {
  it('parses a well-formed file, lowercasing its colours and trimming its words', () => {
    expect(parsePaletteFile({ ...good, title: '  Moss ' })).toEqual({
      ...good,
      title: 'Moss',
      palette: { character: 'soft', base: 'warm', accent: '#4f7a4a' },
    });
    expect(paletteFileName(good)).toBe('moss.fluvy-palette.json');
  });

  it('refuses anything malformed', () => {
    expect(parsePaletteFile(undefined)).toBeUndefined();
    expect(parsePaletteFile({ ...good, fluvy_palette: 2 })).toBeUndefined();
    expect(parsePaletteFile({ ...good, name: 'Moss' })).toBeUndefined();
    expect(parsePaletteFile({ ...good, name: 'm' })).toBeUndefined();
    expect(parsePaletteFile({ ...good, name: 'a'.repeat(41) })).toBeUndefined();
    expect(parsePaletteFile({ ...good, title: '' })).toBeUndefined();
    expect(parsePaletteFile({ ...good, title: 'x'.repeat(33) })).toBeUndefined();
    expect(
      parsePaletteFile({ ...good, palette: { character: 'soft', base: 'warm' } }),
    ).toBeUndefined();
  });

  it('leaves out an optional word that is too long or empty rather than refusing the file', () => {
    const parsed = parsePaletteFile({
      ...good,
      author: '',
      description: 'd'.repeat(141),
      version: '2',
    });
    expect(parsed?.author).toBeUndefined();
    expect(parsed?.description).toBeUndefined();
    expect(parsed?.version).toBe('2');
  });
});
