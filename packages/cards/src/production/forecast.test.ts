import type { EntityView, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { fetchSolarForecast } from '../energy-model/house.js';
import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import {
  dayOf,
  daysAhead,
  forecastEntries,
  houseForecast,
  sensorForecast,
  summed,
  tomorrowOf,
  type ForecastDay,
} from './forecast.js';

const HOUR = 3_600_000;

/**
 * The house's days are its own: a house on Kiritimati (UTC+14, a zone no test runner is in) whose user reads the
 * server's time. At 20:00 UTC on the 17th it is 10:00 on the 18th there; the day began at 10:00 UTC.
 */
const ZONE = 'Pacific/Kiritimati';
const NOW = new Date('2026-09-17T20:00:00Z');
const MIDNIGHT = Date.parse('2026-09-17T10:00:00Z');
/** An hour of the house's day, `days` after today, as an integration writes it (UTC). */
const at = (days: number, hour: number, minute = 0): string =>
  new Date(MIDNIGHT + (days * 24 + hour) * HOUR + minute * 60_000).toISOString();

const view = (attributes: Record<string, unknown>, unit = 'kWh'): EntityView =>
  ({ unit, attr: (key: string) => attributes[key] }) as unknown as EntityView;

/** A house's Energy dashboard: each array's meter (and power sensor) with the entries that forecast it. */
const dashboard = (
  arrays: ReadonlyArray<readonly [meter: string, entries: readonly string[], power?: string]>,
): EnergyPrefs => ({
  energy_sources: arrays.map(([meter, entries, power]) => ({
    type: 'solar',
    stat_energy_from: meter,
    ...(power ? { stat_rate: power } : {}),
    config_entry_solar_forecast: entries,
  })),
});

/** A house that answers the Energy dashboard's two questions, and keeps what it was asked. */
const house = (
  prefs: EnergyPrefs,
  forecasts: Record<string, { wh_hours: Record<string, number> }> | Error,
  asked: string[] = [],
  devices: Record<string, string> = {},
): HomeAssistant =>
  ({
    config: { time_zone: ZONE },
    locale: { time_zone: 'server' },
    connection: {},
    entities: Object.fromEntries(
      Object.entries(devices).map(([id, device]) => [id, { device_id: device }]),
    ),
    callWS: async (message: { type: string }) => {
      asked.push(message.type);
      if (message.type === 'energy/get_prefs') return prefs;
      if (forecasts instanceof Error) throw forecasts;
      return forecasts;
    },
  }) as unknown as HomeAssistant;

const day = (number: number, hours: Record<number, number>): ForecastDay => ({
  day: number,
  at: 0,
  hours: Array.from({ length: 24 }, (_unused, hour) => hours[hour] ?? 0),
});

describe('a forecast sensor’s days', () => {
  it('files its hours on the house’s clock, and leaves another day’s to that day', () => {
    const forecast = sensorForecast(
      view({
        wh_hours: {
          '2026-09-18T09:00:00+14:00': 400, // the house's 09:00 today
          '2026-09-17T23:00:00+00:00': 300, // 13:00 in the house, today
          '2026-09-17T09:00:00+14:00': 999, // yesterday there
        },
      }),
      NOW,
      ZONE,
    );
    expect(forecast?.unit).toBe('Wh');
    const today = forecast?.days.find((filed) => filed.day === 20260918);
    expect(today?.hours[9]).toBe(400);
    expect(today?.hours[13]).toBe(300);
    expect(today?.hours.reduce((a, b) => a + b, 0)).toBe(700);
    expect(forecast?.days.map((filed) => filed.day)).toEqual([20260917, 20260918]);
  });

  it('reads Solcast’s rows in kWh, and a plain list of 24 as the day the card shows', () => {
    const solcast = sensorForecast(
      view({
        detailedHourly: [
          { period_start: at(0, 9), pv_estimate: 1.2 },
          { period_start: at(0, 10), pv_estimate: '2.5' },
        ],
      }),
      NOW,
      ZONE,
    );
    expect(solcast?.unit).toBe('kWh');
    expect(solcast?.days[0]?.hours.slice(9, 11)).toEqual([1.2, 2.5]);
    const tomorrow = tomorrowOf(house({}, {}), NOW);
    const list = sensorForecast(
      view({ forecast: Array.from({ length: 24 }, (_u, h) => h) }, 'Wh'),
      tomorrow,
      ZONE,
    );
    expect(list).toEqual({
      unit: 'Wh',
      days: [
        { day: 20260919, at: tomorrow.getTime(), hours: Array.from({ length: 24 }, (_u, h) => h) },
      ],
    });
  });

  it('carries none where no attribute holds the day asked: a sensor of today’s hours says nothing of tomorrow', () => {
    const todays = view({ wh_hours: { [at(0, 9)]: 400 } });
    expect(sensorForecast(todays, NOW, ZONE)).not.toBeNull();
    expect(sensorForecast(todays, tomorrowOf(house({}, {}), NOW), ZONE)).toBeNull();
    expect(sensorForecast(view({}), NOW, ZONE)).toBeNull();
  });
});

describe('the entries that forecast what a card reads', () => {
  const none = (): undefined => undefined;

  it('counts Solcast once: one entry for the site, linked to both arrays', () => {
    const { sources } = readPrefs(
      dashboard([
        ['sensor.east', ['solcast']],
        ['sensor.west', ['solcast']],
      ]),
    );
    expect(forecastEntries(sources, ['sensor.east', 'sensor.west'], none)).toEqual(['solcast']);
  });

  it('adds Forecast.Solar’s planes: an entry each, for the arrays the card reads', () => {
    const { sources } = readPrefs(
      dashboard([
        ['sensor.east', ['plane_east']],
        ['sensor.west', ['plane_west'], 'sensor.west_power'],
      ]),
    );
    expect(forecastEntries(sources, ['sensor.east', 'sensor.west'], none)).toEqual([
      'plane_east',
      'plane_west',
    ]);
    // a card of one roof reads that roof's forecast; an array is known by its power sensor too
    expect(forecastEntries(sources, ['sensor.east'], none)).toEqual(['plane_east']);
    expect(forecastEntries(sources, ['sensor.west_power'], none)).toEqual(['plane_west']);
  });

  it('knows an inverter’s day counter by its device, and a meter the dashboard does not know by nothing', () => {
    const { sources } = readPrefs(dashboard([['sensor.lifetime', ['solcast']]]));
    const deviceOf = (id: string): string | undefined =>
      ({ 'sensor.lifetime': 'inverter', 'sensor.today': 'inverter', 'sensor.car': 'wallbox' })[id];
    expect(forecastEntries(sources, ['sensor.today'], deviceOf)).toEqual(['solcast']);
    expect(forecastEntries(sources, ['sensor.car'], deviceOf)).toEqual([]);
    expect(forecastEntries(sources, ['sensor.helper'], deviceOf)).toEqual([]);
    // a forecast day of such a meter is the house's whole forecast
    expect(forecastEntries(sources, ['sensor.helper'], deviceOf, true)).toEqual(['solcast']);
  });

  it('adds what the entries expect, instant by instant', () => {
    const total = summed(
      {
        a: { wh_hours: { [at(0, 9)]: 400, [at(0, 10)]: 600, nonsense: 5 } },
        b: { wh_hours: { [at(0, 9)]: 100 } },
        c: { wh_hours: { [at(0, 9)]: 999 } },
      },
      ['a', 'b', 'missing'],
    );
    expect([...total]).toEqual([
      [Date.parse(at(0, 9)), 500],
      [Date.parse(at(0, 10)), 600],
    ]);
  });
});

describe('Home Assistant’s forecast for a card', () => {
  it('sums two planes hour by hour, half hours in theirs, from today’s midnight on', async () => {
    const asked: string[] = [];
    const hass = house(
      dashboard([
        ['sensor.east', ['plane_east']],
        ['sensor.west', ['plane_west']],
      ]),
      {
        plane_east: { wh_hours: { [at(-1, 12)]: 900, [at(0, 9)]: 400, [at(1, 9)]: 500 } },
        plane_west: { wh_hours: { [at(0, 9)]: 100, [at(0, 9, 30)]: 50, [at(0, 14)]: 700 } },
      },
      asked,
    );
    const forecast = await houseForecast(hass, ['sensor.east', 'sensor.west'], false, NOW);
    expect(forecast?.unit).toBe('Wh');
    expect(forecast?.days.map((filed) => filed.day)).toEqual([20260918, 20260919]);
    expect(forecast?.days[0]?.hours[9]).toBe(550);
    expect(forecast?.days[0]?.hours[14]).toBe(700);
    expect(forecast?.days[1]?.hours[9]).toBe(500);
    expect(asked).toEqual(['energy/get_prefs', 'energy/solar_forecast']);
  });

  it('asks Home Assistant for no forecast where none is linked to what the card reads', async () => {
    const asked: string[] = [];
    const hass = house(dashboard([['sensor.east', []]]), {}, asked);
    expect(await houseForecast(hass, ['sensor.east'], true, NOW)).toBeNull();
    expect(asked).toEqual(['energy/get_prefs']);
  });

  it('asks once an hour of the clock for every card of a house, and again where it could not be read', async () => {
    const asked: string[] = [];
    const hass = house({}, { solcast: { wh_hours: {} } }, asked);
    const first = await fetchSolarForecast(hass, 10 * HOUR + 5);
    expect(await fetchSolarForecast(hass, 11 * HOUR - 1)).toBe(first);
    expect(asked).toHaveLength(1);
    await fetchSolarForecast(hass, 11 * HOUR);
    expect(asked).toHaveLength(2);
    const failing: string[] = [];
    const down = house({}, new Error('no energy'), failing);
    expect(await fetchSolarForecast(down, 10 * HOUR)).toBeNull();
    await Promise.resolve();
    expect(await fetchSolarForecast(down, 10 * HOUR + 1)).toBeNull();
    expect(failing).toHaveLength(2);
  });
});

describe('the days a forecast holds ahead', () => {
  it('names tomorrow by the house’s date, whatever its clock does at midnight', () => {
    const hass = house({}, {});
    expect(dayOf(NOW, ZONE)).toBe(20260918);
    expect(dayOf(tomorrowOf(hass, NOW), ZONE)).toBe(20260919);
  });

  it('gives every day after today, in order', () => {
    const days = [
      day(20260918, { 9: 400, 18: 100 }),
      day(20260919, { 9: 500, 18: 120 }),
      day(20260920, { 9: 300, 18: 90 }),
    ];
    expect(daysAhead(days, 20260918).map((filed) => filed.day)).toEqual([20260919, 20260920]);
    expect(daysAhead(days, 20260920)).toEqual([]);
  });

  it('leaves out a last day cut short, where the forecast’s reach ends in its morning', () => {
    const days = [
      day(20260918, { 9: 400, 18: 100 }),
      day(20260919, { 9: 500, 18: 120 }),
      day(20260920, { 7: 60, 8: 310 }),
    ];
    expect(daysAhead(days, 20260918).map((filed) => filed.day)).toEqual([20260919]);
    // an hour earlier than the day before is a clock change, or the season: the day counts
    const turned = [...days.slice(0, 2), day(20260920, { 9: 300, 17: 90 })];
    expect(daysAhead(turned, 20260918).map((filed) => filed.day)).toEqual([20260919, 20260920]);
    // tomorrow alone is whole: nothing says otherwise
    expect(daysAhead(days.slice(1, 2), 20260918).map((filed) => filed.day)).toEqual([20260919]);
  });
});
