// @vitest-environment happy-dom
import type { HaFormSchemaItem, LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { catalogue } from '../index.js';
import type { Card } from './base.js';

type CardClass = typeof Card & {
  getStubConfig?(hass: unknown, entities: readonly string[]): LovelaceCardConfig;
};

/** Every field name a schema shows, through its rows. */
const names = (schema: readonly HaFormSchemaItem[]): string[] =>
  schema.flatMap((item) => (item.schema ? names(item.schema) : [item.name]));

/** The cards whose figures take a unit and decimals (`numberFields`): those that declare the keys. */
const cards = (await catalogue())
  .map(([tag, element]) => ({ tag, card: element as unknown as CardClass }))
  .filter(({ card }) => card.keys.includes('unit') && card.keys.includes('decimals'));

describe('the cards whose figures take a unit and decimals', () => {
  it('are the energy family, the gauge, the sensor, the stat tiles and the readouts', () => {
    expect(cards.map((c) => c.tag).sort()).toEqual([
      'fluvy-batteries-card',
      'fluvy-energy-balance-card',
      'fluvy-energy-card',
      'fluvy-energy-devices-card',
      'fluvy-energy-flow-card',
      'fluvy-energy-sankey-card',
      'fluvy-energy-score-card',
      'fluvy-ev-charger-card',
      'fluvy-gauge-card',
      'fluvy-grid-card',
      'fluvy-history-bars-card',
      'fluvy-meters-card',
      'fluvy-production-card',
      'fluvy-readouts-card',
      'fluvy-sensor-card',
      'fluvy-stat-tiles-card',
    ]);
  });

  it.each(cards)(
    '$tag: shows them on one row, the last before the actions, and never writes auto',
    ({ card }) => {
      const form = card.getConfigForm();
      const shown = names(form.schema);
      const unit = shown.indexOf('unit');
      expect(unit).toBeGreaterThan(-1);
      expect(shown[unit + 1]).toBe('decimals');
      // what follows the row is the card's actions, or nothing
      const after = shown.slice(unit + 2);
      expect(
        after.every((name) => name === 'tap_action' || name === 'hold_action'),
        after.join(),
      ).toBe(true);
      const defaults = card.defaults?.({ type: 'custom:x' }, undefined) ?? {};
      expect(defaults['unit']).toBe('auto');
      expect(typeof defaults['decimals']).toBe('string');
    },
  );

  // the history bars had both keys before: they lay their facts out by their figures' width, which the unit and the
  // decimals say, so their declared height reads them, as it did
  it.each(cards.filter(({ tag }) => tag !== 'fluvy-history-bars-card'))(
    '$tag: keeps its declared height whatever the figures ask',
    ({ card }) => {
      const stub = card.getStubConfig?.(undefined, ['sensor.a', 'sensor.b']) ?? {
        type: 'custom:x',
      };
      const height = card.layoutHeight!;
      const plain = height(stub);
      expect(height({ ...stub, unit: 'kW', decimals: 0 })).toBe(plain);
      expect(height({ ...stub, unit: 'W', decimals: 3 })).toBe(plain);
    },
  );
});
