import type { EntityView } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { readFigure, type OwnHost } from './own-values.js';

/** A house of sensors (their reading and unit) and templates' answers: one it has no answer for is still to come. */
function host(
  sensors: Readonly<Record<string, readonly [number | null, string]>> = {},
  answers: Readonly<Record<string, string>> = {},
): OwnHost & { readonly read: string[] } {
  const read: string[] = [];
  return {
    read,
    entity: (id) => {
      read.push(id);
      const [number, unit] = sensors[id] ?? [null, ''];
      return { id, number, unit } as unknown as EntityView;
    },
    template: (text) => answers[text],
  };
}

const figure = (raw: unknown, unit = '%', house = host()) => readFigure(raw, unit, house);

describe('a figure of the card’s own (#253)', () => {
  it('a number as it is; none for one that is not finite', () => {
    expect(figure(20)).toEqual({ value: 20, pending: false });
    expect(figure(-0.5)).toEqual({ value: -0.5, pending: false });
    expect(figure(Number.NaN)).toEqual({ value: undefined, pending: false });
    expect(figure(Number.POSITIVE_INFINITY)).toEqual({ value: undefined, pending: false });
  });

  it('words that are a figure, as the editor’s text field writes one; none for any other words', () => {
    expect(figure('20').value).toBe(20);
    expect(figure(' -0.5 ').value).toBe(-0.5);
    expect(figure('1e3').value).toBe(1000);
    expect(figure('.5').value).toBe(0.5);
    for (const words of ['20 %', '', 'low', '2,5'])
      expect(figure(words)).toEqual({ pending: false });
  });

  it('none for what is no figure at all: nothing, a toggle, a list', () => {
    for (const raw of [undefined, null, true, [20], { value: 20 }])
      expect(figure(raw)).toEqual({ pending: false });
  });

  it('an entity’s reading, in the unit it is compared in: another of its family converted', () => {
    const house = host({
      'input_number.humidity_low': [40, '%'],
      'sensor.inverter_limit': [1.5, 'kW'],
      'sensor.string_floor': [500, 'W'],
      'sensor.battery_reserve': [2, 'kWh'],
      'sensor.mains_voltage': [230, 'V'],
      'input_number.bare': [7, ''],
      'sensor.away': [null, 'W'],
    });
    expect(figure('input_number.humidity_low', '%', house).value).toBe(40);
    expect(figure('sensor.inverter_limit', 'W', house).value).toBe(1500);
    expect(figure('sensor.string_floor', 'kW', house).value).toBe(0.5);
    expect(figure('sensor.battery_reserve', 'Wh', house).value).toBe(2000);
    // a unit of no family of the row's, and a reading the house cannot give: none, never a figure without ground
    expect(figure('sensor.mains_voltage', 'W', house)).toEqual({
      value: undefined,
      pending: false,
    });
    expect(figure('sensor.away', 'W', house)).toEqual({ value: undefined, pending: false });
    // a figure or a row that says no unit: as it is
    expect(figure('input_number.bare', 'W', house).value).toBe(7);
    expect(figure('input_number.humidity_low', '', house).value).toBe(40);
    // every entity read is told the card, which watches it
    expect(house.read).toContain('sensor.inverter_limit');
  });

  it('a template’s answer: pending until Home Assistant gives one, none where it says no figure', () => {
    const SEASON = "{{ 30 if is_state('input_boolean.summer', 'on') else 20 }}";
    const HIGH = "{{ states('input_number.bedroom_high') }}";
    const FAILED = '{{ nonsense( }}';
    const WORDS = "{{ states('sensor.nowhere') }}";
    const house = host({}, { [SEASON]: '30', [HIGH]: ' 62.5 ', [FAILED]: '', [WORDS]: 'unknown' });
    expect(figure(SEASON, '%', house)).toEqual({ value: 30, pending: false });
    expect(figure(HIGH, '%', house).value).toBe(62.5);
    expect(figure(FAILED, '%', house)).toEqual({ value: undefined, pending: false });
    expect(figure(WORDS, '%', house)).toEqual({ value: undefined, pending: false });
    // not answered yet: pending, and no figure meanwhile
    expect(figure("{{ states('input_number.later') }}", '%', house)).toEqual({
      value: undefined,
      pending: true,
    });
  });
});
