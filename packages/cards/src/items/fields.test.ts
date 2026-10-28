import type { EntityView, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import {
  fitSegments,
  formatValue,
  labelOf,
  listAttribute,
  listAttributes,
  parsePattern,
  resolveField,
  sortItems,
  valueAt,
} from './fields.js';

/*
 * The fields an Items card reads off an item: a pattern parsed (a path, words with `{field}`, `{a|b}`), a value
 * formatted in the house's formats, a line resolved and its blank segments let go, the list sorted, the list
 * attribute found, and a line's segments fitted to their room.
 */

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { time_zone: 'UTC' },
} as unknown as HomeAssistant;

const FLIGHT = {
  callsign: 'KLM1412',
  flight_number: 'KL1412',
  airport_origin_code_iata: 'AMS',
  airport_destination_code_iata: 'BCN',
  aircraft_model: 'Boeing 737-800',
  altitude: 34_000,
  distance: 3.25,
  legs: [{ from: 'AMS' }, { from: 'BCN' }],
  airport: { city: 'Barcelona' },
};

describe('a pattern', () => {
  it('is one field for a bare path, else its words with each {…} a field of its paths', () => {
    expect(parsePattern('altitude')).toEqual([['altitude']]);
    expect(parsePattern('airport.city')).toEqual([['airport.city']]);
    expect(parsePattern('Platform {platform}')).toEqual(['Platform ', ['platform']]);
    expect(parsePattern('{callsign|flight_number}')).toEqual([['callsign', 'flight_number']]);
    expect(parsePattern('{a} → {b} · {c}')).toEqual([['a'], ' → ', ['b'], ' · ', ['c']]);
    expect(parsePattern('  ')).toEqual([]);
  });

  it('reads a dot path through objects and lists', () => {
    expect(valueAt(FLIGHT, 'airport.city')).toBe('Barcelona');
    expect(valueAt(FLIGHT, 'legs.1.from')).toBe('BCN');
    expect(valueAt(FLIGHT, 'airport.country')).toBeUndefined();
    expect(valueAt(FLIGHT, 'callsign.length')).toBeUndefined();
  });
});

describe('a value as a line', () => {
  it('writes a number with its digits, a Unix time and an ISO date as moments, a truth as on or off', () => {
    expect(formatValue(hass, 34_000)).toBe('34,000');
    expect(formatValue(hass, 3.25)).toBe('3.3');
    expect(formatValue(hass, 3.25, { digits: 2 })).toBe('3.25');
    expect(formatValue(hass, 41.29714, { digits: 4 })).toBe('41.2971');
    // a moment not today: its short date and its time
    expect(formatValue(hass, 1_758_300_000, { epoch: true })).toMatch(
      /^\w{3}, Sep 19 \d{2}:\d{2}$/,
    );
    expect(formatValue(hass, '2025-03-04T09:05:00+00:00')).toMatch(/^\w{3}, Mar 4 \d{2}:\d{2}$/);
    expect(formatValue(hass, true)).toBe('On');
    expect(formatValue(hass, ' Vueling ')).toBe('Vueling');
    expect(formatValue(hass, null)).toBe('');
    expect(formatValue(hass, { nested: 1 })).toBe('');
    expect(formatValue(hass, [1, 2])).toBe('');
  });

  it('writes a moment’s weekday short as the calendar does, in every language', () => {
    // Friday 19 September 2025 in the house's zone: not today (its time as the clock writes it)
    const at = (language: string): string =>
      formatValue({ ...hass, language } as HomeAssistant, 1_758_300_000, { epoch: true }).replace(
        / \d{2}:\d{2}$/,
        '',
      );
    // Portugal's own short weekday is the word written out ("sexta"): three letters, as the calendar writes it
    expect(at('pt-PT')).toBe('sex, 19/09');
    expect(at('pt-BR')).toBe('sex., 19 de set.');
    expect(at('de')).toBe('Fr., 19. Sept.');
    expect(at('fr')).toBe('ven. 19 sept.');
    expect(at('ja')).toBe('9月19日(金)');
  });
});

describe('a line resolved', () => {
  it('fills each field with the first of its paths that says something', () => {
    expect(resolveField(FLIGHT, parsePattern('{callsign|flight_number}'), hass)).toBe('KLM1412');
    expect(
      resolveField({ flight_number: 'KL1412' }, parsePattern('{callsign|flight_number}'), hass),
    ).toBe('KL1412');
    expect(resolveField(FLIGHT, parsePattern('Altitude {altitude}'), hass)).toBe('Altitude 34,000');
    expect(resolveField(FLIGHT, parsePattern('distance'), hass, { digits: 1 })).toBe('3.3');
  });

  it('lets a segment that says nothing go, and an arrow a blank field left at an edge', () => {
    const route = parsePattern(
      '{airport_origin_code_iata} → {airport_destination_code_iata} · {aircraft_model}',
    );
    expect(resolveField(FLIGHT, route, hass)).toBe('AMS → BCN · Boeing 737-800');
    expect(resolveField({ ...FLIGHT, aircraft_model: '' }, route, hass)).toBe('AMS → BCN');
    expect(resolveField({ airport_origin_code_iata: 'AMS' }, route, hass)).toBe('AMS');
    expect(resolveField({ airport_destination_code_iata: 'BCN' }, route, hass)).toBe('BCN');
    expect(resolveField({}, route, hass)).toBe('');
    expect(resolveField({}, parsePattern('Platform {platform}'), hass)).toBe('Platform');
    // a figure's minus stays
    expect(resolveField({ v: -1100 }, parsePattern('v'), hass)).toBe('-1,100');
  });
});

describe('the list sorted', () => {
  const items = [
    { name: 'b', due: 7 },
    { name: 'a', due: 2 },
    { name: 'c' },
    { name: 'd', due: 2 },
    { name: 'e', due: '11' },
  ];

  it('orders numbers as numbers and words as the language does, the item without the field last', () => {
    expect(sortItems(items, 'due').map((item) => item.name)).toEqual(['a', 'd', 'b', 'e', 'c']);
    expect(sortItems(items, 'due', 'descending').map((item) => item.name)).toEqual([
      'e',
      'b',
      'a',
      'd',
      'c',
    ]);
    expect(sortItems(items, 'name', 'descending').map((item) => item.name)).toEqual([
      'e',
      'd',
      'c',
      'b',
      'a',
    ]);
    expect(sortItems([{ n: 'L10' }, { n: 'L2' }, { n: 'L1' }], 'n').map((item) => item.n)).toEqual([
      'L1',
      'L2',
      'L10',
    ]);
  });

  it('keeps the sensor’s order without a field, and the order of equals', () => {
    expect(sortItems(items, undefined)).toEqual(items);
    expect(sortItems(items, '')).toEqual(items);
    expect(sortItems(items, 'missing').map((item) => item.name)).toEqual(['b', 'a', 'c', 'd', 'e']);
  });
});

describe('the list attribute', () => {
  const view = (attributes: Record<string, unknown>): EntityView =>
    ({
      stateObj: { attributes },
      attr: (key: string) => attributes[key],
    }) as unknown as EntityView;

  it('is the one named, else the usual names first, else the first list of objects, else the first list', () => {
    const flights = [{ callsign: 'A' }];
    expect(listAttribute(view({ icon: 'x', flights }), 'flights')).toEqual({
      name: 'flights',
      items: flights,
    });
    expect(listAttribute(view({ tags: ['a'], flights }))).toEqual({
      name: 'flights',
      items: flights,
    });
    expect(listAttribute(view({ tags: ['a'], flights }), 'auto')).toEqual({
      name: 'flights',
      items: flights,
    });
    expect(listAttribute(view({ tags: ['a'], departures: [{ line: 'L3' }] }))).toEqual({
      name: 'departures',
      items: [{ line: 'L3' }],
    });
    expect(listAttribute(view({ tags: ['a'], later: [] }))).toEqual({ name: 'tags', items: [] });
    expect(listAttribute(view({ count: 3 }))).toEqual({ name: '', items: [] });
    // a named attribute that is no list, or lists what are not items, lists nothing
    expect(listAttribute(view({ flights: 'none' }), 'flights')).toEqual({
      name: 'flights',
      items: [],
    });
    expect(listAttribute(view({ mixed: [1, { a: 1 }, null] }), 'mixed').items).toEqual([{ a: 1 }]);
  });

  it('offers every attribute that is a list', () => {
    expect(listAttributes(view({ tags: [], flights: [{}], icon: 'x', n: 1 }))).toEqual([
      'tags',
      'flights',
    ]);
    expect(listAttributes({ stateObj: undefined } as unknown as EntityView)).toEqual([]);
  });
});

describe('a line fitted', () => {
  const ruler = { width: (_cls: string, text: string) => text.length * 8 };

  it('keeps its first segment and loses the rest from the end', () => {
    const line = 'AMS → BCN · Boeing 737-800';
    expect(fitSegments(ruler, 'fv-row__sub', line, 300)).toBe(line);
    expect(fitSegments(ruler, 'fv-row__sub', line, 100)).toBe('AMS → BCN');
    expect(fitSegments(ruler, 'fv-row__sub', line, 10)).toBe('AMS → BCN');
    expect(fitSegments(ruler, 'fv-row__sub', '', 10)).toBe('');
  });
});

describe('a field’s label', () => {
  it('is its name with its underscores and dots as spaces, its first letter up', () => {
    expect(labelOf('aircraft_model')).toBe('Aircraft model');
    expect(labelOf('airport.city')).toBe('Airport city');
    expect(labelOf('eta')).toBe('Eta');
  });
});
