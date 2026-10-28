import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import './english.js';
import { FLIGHTS, mappingOf, presetOf, rowOf, sheetOf } from './presets.js';

/*
 * The flights preset on the issue's shape (#66): a flight climbing, one descending and one on the ground, the route
 * and the aircraft on its line, its photo, its link, the sheet's lines in order with the integration's units; and how
 * the preset is detected. Then a list of the person's own, mapped field by field.
 */

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { time_zone: 'UTC' },
} as unknown as HomeAssistant;

const flight = (extra: Record<string, unknown>) => ({
  flight_number: 'KL1412',
  callsign: 'KLM1412',
  airline: 'KLM Royal Dutch Airlines',
  airline_short: 'KLM',
  airport_origin_code_iata: 'AMS',
  airport_origin_city: 'Amsterdam',
  airport_destination_code_iata: 'BCN',
  airport_destination_city: 'Barcelona',
  aircraft_model: 'Boeing 737-800',
  aircraft_registration: 'PH-BXE',
  aircraft_photo_small: 'https://cdn.example/ph-bxe.jpg',
  altitude: 34_000,
  ground_speed: 452,
  vertical_speed: 0,
  heading: 212,
  distance: 8.74,
  latitude: 41.29714,
  longitude: 2.07846,
  on_ground: 0,
  time_scheduled_departure: 1_758_300_000,
  time_scheduled_arrival: 1_758_308_400,
  ...extra,
});

describe('the flights preset', () => {
  it('names a flight by its callsign, lines it with its route and aircraft, and shows its photo', () => {
    const row = FLIGHTS.row(flight({}), hass);
    expect(row.name).toBe('KLM1412');
    expect(row.secondary).toBe('AMS → BCN · Boeing 737-800');
    expect(row.image).toBe('https://cdn.example/ph-bxe.jpg');
    expect(row.icon).toBe('mdi:airplane');
    expect(row.url).toBe('https://www.flightradar24.com/KLM1412');
    // no callsign: the flight number names it and links it
    const numbered = FLIGHTS.row(flight({ callsign: '' }), hass);
    expect(numbered.name).toBe('KL1412');
    expect(numbered.url).toBe('https://www.flightradar24.com/KL1412');
    expect(FLIGHTS.row(flight({ callsign: '', flight_number: null }), hass).url).toBe('');
  });

  it('values the altitude in feet, climbing or descending by the vertical speed, or on the ground', () => {
    const level = FLIGHTS.row(flight({}), hass);
    // bare where a compact row is too narrow for the unit
    expect([level.value, level.bare]).toEqual(['34,000 ft', '34,000']);
    expect(level.glyph).toBeUndefined();
    expect(level.quiet).toBeUndefined();
    const climbing = FLIGHTS.row(flight({ altitude: 12_500, vertical_speed: 2400 }), hass);
    expect([climbing.value, climbing.glyph]).toEqual(['12,500 ft', 'trendUp']);
    const descending = FLIGHTS.row(flight({ altitude: 4200, vertical_speed: -1100 }), hass);
    expect([descending.value, descending.glyph]).toEqual(['4,200 ft', 'trendDown']);
    // under a hundred feet a minute is level flight
    expect(FLIGHTS.row(flight({ vertical_speed: 64 }), hass).glyph).toBeUndefined();
    const grounded = FLIGHTS.row(flight({ altitude: 0, on_ground: 1, vertical_speed: 0 }), hass);
    expect([grounded.value, grounded.bare, grounded.quiet, grounded.glyph]).toEqual([
      'On ground',
      undefined,
      true,
      undefined,
    ]);
    expect(FLIGHTS.row(flight({ on_ground: true }), hass).value).toBe('On ground');
    expect(FLIGHTS.row(flight({ altitude: null }), hass).value).toBe('');
  });

  it('lists the flight in the sheet, in order, in the integration’s units', () => {
    const rows = FLIGHTS.sheet(flight({}), hass);
    expect(rows.map((row) => row.label)).toEqual([
      'Airline',
      'Flight number',
      'Callsign',
      'Route',
      'Aircraft',
      'Registration',
      'Altitude',
      'Ground speed',
      'Vertical speed',
      'Heading',
      'Distance',
      'Position',
      'Departure',
      'Arrival',
    ]);
    const value = (label: string) => rows.find((row) => row.label === label)?.value;
    expect(value('Airline')).toBe('KLM Royal Dutch Airlines');
    expect(value('Route')).toBe('Amsterdam → Barcelona');
    expect(value('Altitude')).toBe('34,000 ft');
    expect(value('Ground speed')).toBe('452 kt');
    expect(value('Vertical speed')).toBe('0 ft/min');
    expect(value('Heading')).toBe('212°');
    expect(value('Distance')).toBe('8.7 km');
    expect(value('Position')).toBe('41.2971, 2.0785');
    expect(value('Departure')).toMatch(/\d{2}:\d{2}$/);
    // a field the flight does not carry is no line; the real time before the scheduled one
    const sparse = FLIGHTS.sheet(
      flight({ airline: null, airline_short: 'KLM', time_real_departure: 1_758_301_200 }),
      hass,
    );
    expect(sparse.find((row) => row.label === 'Airline')?.value).toBe('KLM');
    expect(sparse.find((row) => row.label === 'Departure')?.value).not.toBe(
      rows.find((row) => row.label === 'Departure')?.value,
    );
    expect(FLIGHTS.sheet({}, hass)).toEqual([]);
  });

  it('is found by the attribute’s name or by a callsign or flight number on the items, unless asked otherwise', () => {
    expect(presetOf({}, 'flights', [])).toBe(FLIGHTS);
    expect(presetOf({ preset: 'auto' }, 'aircraft', [{ callsign: 'X' }])).toBe(FLIGHTS);
    expect(presetOf({}, 'aircraft', [{ flight_number: 'X' }])).toBe(FLIGHTS);
    expect(presetOf({}, 'departures', [{ line: 'L3' }])).toBeUndefined();
    expect(presetOf({ preset: 'none' }, 'flights', [{ callsign: 'X' }])).toBeUndefined();
    expect(presetOf({ preset: 'flights' }, 'departures', [])).toBe(FLIGHTS);
  });
});

describe('a list mapped field by field', () => {
  const config = {
    item_name: '{line} → {destination}',
    item_secondary: 'Platform {platform}',
    item_value: 'due',
    item_unit: 'min',
    item_icon: 'icon',
    item_url: 'https://metro.example/{line}',
  };
  const train = {
    line: 'L3',
    destination: 'Trinitat Nova',
    platform: '2',
    due: 5,
    icon: 'mdi:train',
  };

  it('draws the name, the line, the value with its unit (and bare), the icon and the link from the item', () => {
    const row = rowOf(train, mappingOf(config), hass, 'list');
    expect(row).toEqual({
      name: 'L3 → Trinitat Nova',
      secondary: 'Platform 2',
      value: '5 min',
      bare: '5',
      icon: 'mdi:train',
      image: '',
      url: 'https://metro.example/L3',
    });
  });

  it('names an item by the usual keys where none is mapped, and keeps the card’s glyph without an icon', () => {
    const mapping = mappingOf({});
    expect(rowOf({ title: 'Shoes' }, mapping, hass, 'list').name).toBe('Shoes');
    expect(rowOf({ id: 'x1', name: 'Lamp' }, mapping, hass, 'list').name).toBe('Lamp');
    expect(rowOf({ id: 'x1' }, mapping, hass, 'list').icon).toBe('list');
    expect(rowOf({ icon: 'bulb' }, mappingOf({ item_icon: 'icon' }), hass, 'list').icon).toBe(
      'list',
    );
    expect(
      rowOf({ due: 0 }, mappingOf({ item_value: 'due', item_unit: 'min' }), hass, 'list').value,
    ).toBe('0 min');
    expect(rowOf({}, mappingOf({ item_value: 'due', item_unit: 'min' }), hass, 'list').value).toBe(
      '',
    );
  });

  it('lists every field that is a line in the sheet, labelled by its name', () => {
    expect(sheetOf({ line: 'L3', due: 5, legs: [1], meta: { a: 1 }, late: false }, hass)).toEqual([
      { label: 'Line', value: 'L3' },
      { label: 'Due', value: '5' },
      { label: 'Late', value: 'Off' },
    ]);
  });
});
