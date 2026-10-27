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

/** The cards whose figures take a unit and decimals (`numberFields`): those whose editor declares the keys. */
const cards = (
  await Promise.all(
    (await catalogue()).map(async ([tag, element]) => {
      const card = element as unknown as CardClass;
      return { tag, card, editor: await card.editor() };
    }),
  )
).filter(({ editor }) => editor.keys.includes('unit') && editor.keys.includes('decimals'));

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
      'fluvy-energy-usage-card',
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
    ({ editor }) => {
      const form = editor.getConfigForm();
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
      const defaults = editor.defaults?.({ type: 'custom:x' }, undefined) ?? {};
      expect(defaults['unit']).toBe('auto');
      expect(typeof defaults['decimals']).toBe('string');
    },
  );

  it('the energy card’s legend entries are offered their own sensor’s units, never the card’s sensor’s', () => {
    const energy = cards.find(({ tag }) => tag === 'fluvy-energy-card')!.editor;
    const legend = energy.lists!.find((list) => list.key === 'legend')!;
    const sensor = (unit: string) => ({
      entity_id: 'sensor.x',
      state: '1',
      attributes: { unit_of_measurement: unit },
    });
    const house = (unit: string) =>
      ({ states: { 'sensor.x': sensor(unit) } }) as unknown as Parameters<
        NonNullable<typeof legend.choices>
      >[1];
    const units = (unit: string) =>
      legend.choices?.({ type: 'x', entity: 'sensor.x' }, house(unit))['unit']?.map((o) => o.value);
    expect(units('kWh')).toEqual(['auto', 'Wh', 'kWh', 'MWh']);
    expect(units('W')).toEqual(['auto', 'W', 'kW', 'MW']);
  });

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
