import { describe, expect, it } from 'vitest';
import { resolveEntity } from '../entity.js';
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatTime,
  relativeTime,
  scaleUnit,
  stateText,
  valueParts,
} from '../format.js';
import type { HomeAssistant } from '../ha/types.js';

const make = (
  language: string,
  number_format = 'language',
  state = '1234.5',
  attributes: Record<string, unknown> = {},
): HomeAssistant =>
  ({
    states: {
      'sensor.x': { entity_id: 'sensor.x', state, attributes, last_changed: '', last_updated: '' },
    },
    entities: {},
    devices: {},
    areas: {},
    language,
    locale: { language, number_format, time_format: '24' },
  }) as unknown as HomeAssistant;

describe('formatNumber', () => {
  it('follows the language: comma decimals in Spanish', () => {
    expect(formatNumber(make('es'), 21.5)).toBe('21,5');
    expect(formatNumber(make('en'), 21.5)).toBe('21.5');
  });
  it("respects the user's number format override", () => {
    expect(formatNumber(make('en', 'decimal_comma'), 1234.5, { digits: 1 })).toBe('1.234,5');
    expect(formatNumber(make('es', 'comma_decimal'), 1234.5, { digits: 1 })).toBe('1,234.5');
    expect(formatNumber(make('en', 'none'), 1234.5, { digits: 1 })).toBe('1234.5');
  });
  it('can force a fixed number of decimals (a setpoint reads 24.0)', () => {
    expect(formatNumber(make('en'), 24, { digits: 1, minDigits: 1 })).toBe('24.0');
  });
  it('never prints NaN or Infinity, and survives contradictory or absurd digit counts', () => {
    expect(formatNumber(make('en'), Number.NaN)).toBe('—');
    expect(formatNumber(make('en'), Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatNumber(make('en'), 1.5, { digits: 0, minDigits: 2 })).toBe('1.50');
    expect(formatNumber(make('en'), 1.5, { digits: -3 })).toBe('2');
    expect(formatNumber(make('en'), 1.5, { digits: 99 })).toBe('1.5');
  });
  it('follows the system locale when the user asked for it and drops grouping for "none"', () => {
    expect(formatNumber(make('es', 'system'), 1234.5, { digits: 1 })).toMatch(
      /^1[.,\s\u202f]?234[.,]5$/,
    );
    expect(formatNumber(make('es', 'none'), 1234.5, { digits: 1 })).toBe('1234,5');
  });
});

describe('valueParts', () => {
  it('splits value and unit and rescales watts that crowd a readout', () => {
    const h = make('en', 'language', '4418', { unit_of_measurement: 'W', device_class: 'power' });
    expect(valueParts(h, resolveEntity(h, 'sensor.x'))).toEqual({ value: '4.42', unit: 'kW' });
  });
  it('keeps small values in their unit', () => {
    const h = make('en', 'language', '142', { unit_of_measurement: 'W' });
    expect(valueParts(h, resolveEntity(h, 'sensor.x'))).toEqual({ value: '142', unit: 'W' });
  });
  it('shows a dash, never NaN, for states that are not there', () => {
    const h = make('en', 'language', 'unavailable', { unit_of_measurement: '°C' });
    expect(valueParts(h, resolveEntity(h, 'sensor.x'))).toEqual({ value: '—', unit: '' });
    expect(valueParts(h, resolveEntity(h, 'sensor.ghost'))).toEqual({ value: '—', unit: '' });
  });
  it('uses the registry display precision when the user set one', () => {
    const h = {
      ...make('en', 'language', '21.456', { unit_of_measurement: '°C' }),
      entities: { 'sensor.x': { entity_id: 'sensor.x', display_precision: 2 } },
    } as HomeAssistant;
    expect(valueParts(h, resolveEntity(h, 'sensor.x')).value).toBe('21.46');
    const odd = {
      ...h,
      entities: { 'sensor.x': { entity_id: 'sensor.x', display_precision: null } },
    } as unknown as HomeAssistant;
    expect(valueParts(odd, resolveEntity(odd, 'sensor.x')).value).toBe('21.5');
  });
  it('shows the text of a state that is not a number, and a percent as a whole number', () => {
    const h = make('en', 'language', 'heating');
    expect(valueParts(h, resolveEntity(h, 'sensor.x'))).toEqual({ value: 'Heating', unit: '' });
    const p = make('es', 'language', '46.0', { unit_of_measurement: '%' });
    expect(valueParts(p, resolveEntity(p, 'sensor.x'))).toEqual({ value: '46', unit: '%' });
    const big = make('es', 'language', '12345.678', { unit_of_measurement: 'kWh' });
    expect(valueParts(big, resolveEntity(big, 'sensor.x'))).toEqual({ value: '12,3', unit: 'MWh' });
  });
});

describe('scaleUnit', () => {
  it('only rescales power and energy', () => {
    expect(scaleUnit(1500, 'W')).toEqual({ value: 1.5, unit: 'kW' });
    expect(scaleUnit(1500, 'Wh')).toEqual({ value: 1.5, unit: 'kWh' });
    expect(scaleUnit(1500, 'kWh')).toEqual({ value: 1.5, unit: 'MWh' });
    expect(scaleUnit(1500, 'lx')).toEqual({ value: 1500, unit: 'lx' });
  });
});

describe('stateText', () => {
  it('localizes the three non-states', () => {
    const es = make('es', 'language', 'unavailable');
    expect(stateText(es, resolveEntity(es, 'sensor.x'))).toBe('No disponible');
    expect(stateText(es, resolveEntity(es, 'sensor.ghost'))).toBe('Entidad no encontrada');
    const en = make('en', 'language', 'unknown');
    expect(stateText(en, resolveEntity(en, 'sensor.x'))).toBe('Unknown');
    expect(
      stateText(
        make('de', 'language', 'unavailable'),
        resolveEntity(make('de', 'language', 'unavailable'), 'sensor.x'),
      ),
    ).toBe('Unavailable');
  });
  it('falls back to the raw state when Home Assistant returns nothing usable', () => {
    const h = {
      ...make('en', 'language', 'not_home'),
      formatEntityState: () => '',
    } as unknown as HomeAssistant;
    expect(stateText(h, resolveEntity(h, 'sensor.x'))).toBe('Not home');
    const throwing = {
      ...make('en', 'language', 'idle'),
      formatEntityState: () => {
        throw new Error('x');
      },
    } as unknown as HomeAssistant;
    expect(stateText(throwing, resolveEntity(throwing, 'sensor.x'))).toBe('Idle');
  });
  it('capitalizes raw states Home Assistant did not translate', () => {
    const h = {
      ...make('en', 'language', 'idle'),
      formatEntityState: () => 'idle',
    } as unknown as HomeAssistant;
    expect(stateText(h, resolveEntity(h, 'sensor.x'))).toBe('Idle');
  });
});

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss and never goes negative', () => {
    expect(formatDuration(84)).toBe('1:24');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('formatTime / formatDate', () => {
  const at = (h: number, m: number): Date => new Date(2026, 8, 17, h, m);
  it('honours the 12 / 24 hour choice and never writes midnight as 24:05', () => {
    const h24 = {
      ...make('en'),
      locale: { language: 'en', number_format: 'language', time_format: '24' },
    } as HomeAssistant;
    const h12 = {
      ...make('en'),
      locale: { language: 'en', number_format: 'language', time_format: '12' },
    } as HomeAssistant;
    expect(formatTime(h24, at(0, 5))).toBe('00:05');
    expect(formatTime(h12, at(21, 5))).toMatch(/^09:05\s?PM$/);
    expect(formatTime(make('es'), at(21, 5))).toBe('21:05');
  });
  it('speaks the language for dates', () => {
    expect(formatDate(make('es'), at(12, 0))).toBe('jueves, 17 de septiembre');
    expect(formatDate(make('en'), at(12, 0), 'short')).toBe('Thu, Sep 17');
  });
  it('uses the server zone only when the profile says so, and shrugs off an unknown one', () => {
    const server = {
      ...make('en'),
      locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
      config: { unit_system: {}, time_zone: 'Pacific/Kiritimati' },
    } as unknown as HomeAssistant;
    const broken = {
      ...server,
      config: { unit_system: {}, time_zone: 'Mars/Olympus' },
    } as unknown as HomeAssistant;
    expect(formatTime(server, new Date(Date.UTC(2026, 8, 17, 12, 0)))).toBe('02:00');
    expect(formatTime(broken, at(9, 30))).toBe('09:30');
    expect(formatTime(make('en'), new Date('nope'))).toBe('—');
  });
});

describe('relativeTime', () => {
  it('says now under a minute, then counts in the language', () => {
    const now = new Date(2026, 8, 17, 12, 0, 0);
    expect(relativeTime(make('en'), new Date(now.getTime() - 20_000), now)).toBe('Now');
    expect(relativeTime(make('es'), new Date(now.getTime() - 20_000), now)).toBe('Ahora');
    expect(relativeTime(make('es'), new Date(now.getTime() - 5 * 60_000), now)).toBe('hace 5 min');
    expect(relativeTime(make('en'), new Date(now.getTime() - 3 * 3600_000), now)).toMatch(/3 ?h/);
    expect(relativeTime(make('en'), new Date('nope'), now)).toBe('—');
  });
});
