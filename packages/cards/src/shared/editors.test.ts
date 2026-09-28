// @vitest-environment happy-dom
import type { HaFormSchemaItem, LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../index.js';
import type { Card } from './base.js';
import type { FluvyRowsEditor } from './rows-editor.js';

/**
 * The editors' contract (see `Card` in base.ts), held for every card of the catalogue: the editor is the base's,
 * built from the card's form, lists and defaults; the form never shows a list twice, nor an older name; a default
 * is for a field the editor shows; and, for a card under contract, what the form and the lists show is exactly
 * `base ∪ keys`. The cards not yet under contract are named here, so a card cannot lose its keys unnoticed and
 * the list can only shrink.
 */
const PENDING = new Set([
  'fluvy-energy-card',
  'fluvy-energy-flow-card',
  'fluvy-energy-devices-card',
  'fluvy-gauge-card',
  'fluvy-stat-tiles-card',
  'fluvy-production-card',
  'fluvy-bars-card',
  'fluvy-distribution-card',
  'fluvy-humidity-card',
  'fluvy-clock-card',
  'fluvy-calendar-card',
]);

type CardClass = typeof Card & {
  getStubConfig?(hass: unknown, entities: readonly string[]): LovelaceCardConfig;
};

/** Every field name a schema shows, through its grids. */
const names = (schema: readonly HaFormSchemaItem[]): string[] =>
  schema.flatMap((item) => (item.schema ? names(item.schema) : item.name ? [item.name] : []));

const cards = CATALOGUE.map(([tag, element]) => ({ tag, card: element as unknown as CardClass }));

describe('the editors’ contract', () => {
  it('names each card of the catalogue once, and pending ones that exist', () => {
    expect(new Set(cards.map((c) => c.tag)).size).toBe(cards.length);
    for (const tag of PENDING)
      expect(
        cards.some((c) => c.tag === tag),
        tag,
      ).toBe(true);
  });

  it.each(cards)(
    '$tag: the editor is the base’s, from the form, the lists and the defaults',
    ({ card }) => {
      const element = card.getConfigElement() as FluvyRowsEditor;
      expect(element.tagName.toLowerCase()).toBe('fluvy-rows-editor');
      const spec = element.spec!;
      expect(spec.lists).toBe(card.lists);
      const listKeys = new Set(
        card.lists.flatMap((list) => [list.key, ...(list.alias ? [list.alias] : [])]),
      );
      // a list is edited item by item: its picker leaves the form
      for (const name of names(spec.schema)) expect(listKeys.has(name), name).toBe(false);
      for (const list of card.lists) {
        expect(names(list.schema)[0], `${list.key}: the id field comes first`).toBe(
          list.idKey ?? 'entity',
        );
        if (list.keys) expect(new Set(names(list.schema))).toEqual(new Set(list.keys));
      }
    },
  );

  it.each(cards)(
    '$tag: a default is for a field the editor shows, never an older name',
    ({ card }) => {
      const shown = new Set(names(card.getConfigForm().schema));
      const defaults = card.defaults?.({ type: 'custom:x' }, undefined) ?? {};
      for (const key of Object.keys(defaults)) expect(shown.has(key), key).toBe(true);
      // a conditional move (`forecast: none` → `show_forecast: false`) keeps its key: `forecast` is still a field
      for (const move of card.aliases?.keys ?? [])
        if (!move.when) expect(shown.has(move.from), move.from).toBe(false);
    },
  );

  it.each(cards)('$tag: what the form and the lists show is base ∪ keys', ({ tag, card }) => {
    if (!card.keys.length) {
      expect(PENDING.has(tag), `${tag} declares no keys and is not named as pending`).toBe(true);
      return;
    }
    expect(PENDING.has(tag), `${tag} declares its keys: drop it from PENDING`).toBe(false);
    const shown = new Set([
      ...names(card.getConfigForm().schema),
      ...card.lists.flatMap((list) => [list.key, ...(list.alias ? [list.alias] : [])]),
    ]);
    expect([...shown].sort()).toEqual([...new Set([...card.base, ...card.keys])].sort());
  });
});
