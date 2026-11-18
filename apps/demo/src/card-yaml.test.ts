// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { toYaml } from '../../../tools/docs/src/yaml.js';
import { yamlOf } from './card-yaml.js';
import { CARDS, cardOf } from './catalog.js';
import { highlightYaml, type YamlPiece } from './highlight.js';

const joined = (line: readonly YamlPiece[]): string => line.map((piece) => piece.text).join('');

/** A card's base example, as a plate asks for its YAML without a house. */
const base = (short: string) => {
  const example = cardOf(short)?.examples[0];
  if (!example) throw new Error(`no example of ${short}`);
  return { config: example.config, hass: undefined };
};

describe('the YAML of a plate’s cards', () => {
  it('reads a card both ways: what a person writes, as the docs print it, and every option of its editor', async () => {
    const [tile] = await yamlOf([base('tile')]);
    expect(tile?.type).toBe('custom:fluvy-tile-card');
    expect(tile?.minimal).toBe('type: custom:fluvy-tile-card\nentity: light.ceiling');
    const all = tile?.all.split('\n') ?? [];
    expect(all.slice(0, 2)).toEqual(['type: custom:fluvy-tile-card', 'entity: light.ceiling']);
    // a default of the card's own is written, the house's and an option with nothing to write are comments
    expect(all).toContain('size: large');
    expect(all).toContain('# card_opacity: 100');
    expect(all).toContain('# name:');
    expect(all.length).toBeGreaterThan(10);
  });

  it('reads each card of a plate in its order, and leaves out what is none of the catalogue’s', async () => {
    const read = await yamlOf([
      base('cover'),
      { config: { type: 'custom:pg-means-line' }, hass: undefined },
      base('tile'),
      // a hook of the tests' is no key, and a default written out is not what a person has to write
      {
        config: {
          type: 'custom:fluvy-tile-card',
          entity: 'light.desk',
          size: 'large',
          _now: '2026-09-17T19:50:00Z',
        },
        hass: undefined,
      },
    ]);
    expect(read.map(({ type }) => type)).toEqual([
      'custom:fluvy-cover-card',
      'custom:fluvy-tile-card',
      'custom:fluvy-tile-card',
    ]);
    expect(read[0]?.minimal).toBe(toYaml(base('cover').config));
    expect(read[2]?.minimal).toBe('type: custom:fluvy-tile-card\nentity: light.desk');
    expect(read[2]?.all).not.toContain('_now');
  });

  it('gives every card’s options whole to the panel’s colours: a key, an item or a comment a line', async () => {
    const read = await yamlOf(
      CARDS.flatMap((card) => card.examples.map(({ config }) => ({ config, hass: undefined }))),
    );
    expect(read.length).toBeGreaterThan(CARDS.length);
    for (const { type, all, minimal } of read) {
      expect(all.split('\n').length, type).toBeGreaterThan(minimal.split('\n').length);
      const lines = highlightYaml(all);
      expect(lines.map(joined).join('\n'), type).toBe(all);
      for (const line of lines) {
        const first = line.find((piece) => piece.kind !== 'space');
        expect(['key', 'dash', 'comment'], `${type}: ${joined(line)}`).toContain(first?.kind);
      }
    }
  });
});
