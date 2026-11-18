import { describe, expect, it } from 'vitest';
import { GALLERY } from '../../../tools/docs/src/gallery.js';
import {
  CARDS,
  cardOf,
  cardOfType,
  docsOf,
  layoutsOf,
  searchCards,
  type CardWords,
} from './catalog.js';
import { CARD_GROUPS, FAMILIES, groupOf } from './families.js';

/** What the card picker would say: a few cards' real words, the rest named by their short name. */
const WORDS: Readonly<Record<string, CardWords>> = {
  light: { name: 'Light', description: 'The precision dimmer: relative drag, colour temperature.' },
  lights: { name: 'Room lights', description: 'A room’s lights on one card.' },
  tile: { name: 'Tile', description: 'A light, switch, cover or sensor as a tile.' },
  'energy-flow': { name: 'Energy flow', description: 'Where the house’s energy comes from.' },
  thermostat: { name: 'Thermostat', description: 'Climate on a dial, with its modes.' },
};
const words = (card: { short: string }): CardWords =>
  WORDS[card.short] ?? { name: card.short, description: '' };

describe('the demo’s cards', () => {
  it('has a page for every card of the docs’ gallery, its examples the gallery’s', () => {
    expect(CARDS.map((card) => card.tag)).toEqual(Object.keys(GALLERY));
    expect(CARDS.length).toBeGreaterThanOrEqual(62);
    const tile = cardOf('tile');
    expect(tile?.tag).toBe('fluvy-tile-card');
    expect(tile && layoutsOf(tile)).toEqual(['compact', 'mini']);
    expect(tile && docsOf(tile)).toBe(
      'https://github.com/acosta290/fluvy/blob/main/docs/cards/tile.md',
    );
    expect(cardOf('fluvy-tile-card')).toBeUndefined();
  });

  it('knows the card a configuration’s type names, and one that is none of the catalogue’s', () => {
    for (const card of CARDS)
      for (const example of card.examples) expect(cardOfType(example.config.type)).toBe(card);
    expect(cardOfType('custom:fluvy-tile-card')).toBe(cardOf('tile'));
    // a stand-in of the playground's, and Home Assistant's own card of a Fluvy card's short name
    expect(cardOfType('custom:pg-means-line')).toBeUndefined();
    expect(cardOfType('entities')).toBeUndefined();
  });

  it('lists every card once in the README’s groups, and nothing that is not a card', () => {
    const listed = CARD_GROUPS.flatMap((group) => group.cards);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(CARDS.map((card) => card.short).sort());
    for (const card of CARDS) expect(groupOf(card.short), card.short).toBeDefined();
  });

  it('keeps the showcase’s families as the demo had them', () => {
    expect(FAMILIES.map((family) => family.key)).toEqual([
      'home',
      'devices',
      'climate',
      'vehicles',
      'energy',
      'charts',
      'media',
      'time',
      'helpers',
    ]);
  });
});

describe('the search', () => {
  const find = (query: string): string[] =>
    searchCards(query, CARDS, words).map((card) => card.short);

  it('finds a card by its name, a name that starts with the words first', () => {
    expect(find('light')[0]).toBe('light');
    expect(find('light')).toEqual(expect.arrayContaining(['light', 'lights', 'tile']));
    expect(find('light').indexOf('lights')).toBeLessThan(find('light').indexOf('tile'));
  });

  it('finds a card by its line and by its short name, every word typed in it', () => {
    expect(find('dimmer')).toEqual(['light']);
    expect(find('colour dial')).toEqual([]);
    expect(find('climate dial')).toEqual(['thermostat']);
    expect(find('ev-charger')).toEqual(['ev-charger']);
  });

  it('reads past case and accents, and finds nothing in nothing', () => {
    expect(find('ÉNERGY FLÔW')).toEqual(['energy-flow']);
    expect(find('   ')).toEqual([]);
    expect(find('zzz')).toEqual([]);
  });
});
