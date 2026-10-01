import { FluvyProductionCard } from '../../../../packages/cards/src/production/production-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-production-card'))
  customElements.define('fluvy-production-card', FluvyProductionCard);

/**
 * Production by array (1.4): the approved figure's day at 15:40 — the east roof 5.2 kWh, the west roof 6.0, the
 * house's meter 11.2 against a forecast that expected 10.6 by now (+6 %). Every hour's bar stacks the two roofs; the
 * hours still to come are the forecast, faint.
 */
const NOW = '2026-09-17T15:40:00';
const HOUR = 3_600_000;

type Attributes = Record<string, unknown>;
const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});
const power = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'W',
  device_class: 'power',
  state_class: 'measurement',
});

/** What each roof made in each finished hour (kWh), and in the 40 minutes of the hour in progress. */
const EAST = [0, 0, 0, 0, 0, 0, 0.1, 0.4, 0.8, 1.0, 0.9, 0.7, 0.5, 0.3, 0.2];
const EAST_NOW = 0.3;
const WEST = [0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.1, 1.0];
const WEST_NOW = 0.8;
const BOTH = EAST.map((v, i) => Math.round((v + (WEST[i] ?? 0)) * 10) / 10);
/** The forecast, hour by hour (kWh): 10.0 by 15:00 and 0.6 of the hour after it, 10.6 by 15:40. */
const FORECAST = [
  0, 0, 0, 0, 0, 0, 0.2, 0.5, 1.1, 1.3, 1.4, 1.5, 1.5, 1.3, 1.2, 0.9, 0.8, 0.5, 0.3, 0.1, 0, 0, 0,
  0,
];
const FORECAST_TOTAL = Math.round(FORECAST.reduce((a, b) => a + b, 0) * 10) / 10;

/** A third and a fourth roof: the east and west ones split, for the ramp's four steps. */
const part = (list: readonly number[], share: number): number[] =>
  list.map((v) => Math.round(v * share * 1000) / 1000);

interface Row {
  start: number;
  end: number;
  change?: number;
  state?: number;
  mean?: number;
}

/** Hourly rows from the hour the card asks from (23:00 the evening before for a meter, midnight for power). */
const meterRows = (message: Record<string, unknown>, hours: readonly number[]): Row[] => {
  const from = Date.parse(String(message['start_time']));
  let state = 1000;
  const out: Row[] = [{ start: from, end: from + HOUR, change: 0, state }];
  hours.forEach((change, i) => {
    state = Math.round((state + change) * 1000) / 1000;
    out.push({ start: from + (i + 1) * HOUR, end: from + (i + 2) * HOUR, change, state });
  });
  return out;
};
/** A power sensor's statistics: each finished hour's mean (W), and the five-minute means of the hour in progress. */
const powerRows = (
  message: Record<string, unknown>,
  hours: readonly number[],
  inProgress: number,
): Row[] => {
  const from = Date.parse(String(message['start_time']));
  if (message['period'] === '5minute') {
    // eight five-minute periods compiled since 15:00: their means integrate to what the hour has made so far
    const mean = (inProgress * 1000) / (8 * (5 / 60));
    return Array.from({ length: 8 }, (_u, i) => ({
      start: from + i * 300_000,
      end: from + (i + 1) * 300_000,
      mean,
    }));
  }
  return hours.map((kwh, i) => ({
    start: from + i * HOUR,
    end: from + (i + 1) * HOUR,
    mean: kwh * 1000,
  }));
};

const METERS: Record<string, readonly number[]> = {
  'sensor.ar_total': BOTH,
  'sensor.ar_east': EAST,
  'sensor.ar_west': WEST,
  'sensor.ar_east_a': part(EAST, 0.6),
  'sensor.ar_east_b': part(EAST, 0.4),
  'sensor.ar_west_a': part(WEST, 0.7),
  'sensor.ar_west_b': part(WEST, 0.3),
};
const POWER: Record<string, readonly [readonly number[], number]> = {
  'sensor.ar_east_power': [EAST, EAST_NOW],
  'sensor.ar_west_power': [WEST, WEST_NOW],
};

const reading = (hours: readonly number[], now: number): string =>
  String(Math.round((1000 + hours.reduce((a, b) => a + b, 0) + now) * 1000) / 1000);

export const sheet: SheetSpec = {
  states: [
    ['sensor.ar_total', reading(BOTH, EAST_NOW + WEST_NOW), energy('Solar production')],
    ['sensor.ar_east', reading(EAST, EAST_NOW), energy('East roof energy')],
    ['sensor.ar_west', reading(WEST, WEST_NOW), energy('West roof energy')],
    ['sensor.ar_east_a', reading(part(EAST, 0.6), EAST_NOW * 0.6), energy('East, upper')],
    ['sensor.ar_east_b', reading(part(EAST, 0.4), EAST_NOW * 0.4), energy('East, lower')],
    ['sensor.ar_west_a', reading(part(WEST, 0.7), WEST_NOW * 0.7), energy('West, upper')],
    ['sensor.ar_west_b', reading(part(WEST, 0.3), WEST_NOW * 0.3), energy('Garage roof')],
    ['sensor.ar_east_power', '450', power('East roof power')],
    ['sensor.ar_west_power', '1200', power('West roof power')],
    ['sensor.ar_dead', 'unavailable', energy('Carport roof energy')],
    [
      'sensor.ar_forecast',
      String(FORECAST_TOTAL),
      { friendly_name: 'Forecast today', unit_of_measurement: 'kWh', forecast: FORECAST },
    ],
  ],

  ws: {
    'recorder/statistics_during_period': (message) => {
      const id = ((message['statistic_ids'] as string[] | undefined) ?? [])[0] ?? '';
      const hours = METERS[id];
      if (hours) return { [id]: meterRows(message, hours) };
      const watts = POWER[id];
      if (watts) return { [id]: powerRows(message, watts[0], watts[1]) };
      return {}; // no statistics for anything else
    },
  },

  frames: [
    {
      title: 'Two arrays',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_west', name: 'West' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Two arrays, power sensors',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          arrays: [
            { entity: 'sensor.ar_east_power', name: 'East' },
            { entity: 'sensor.ar_west_power', name: 'West' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Four arrays',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          arrays: ['sensor.ar_east_a', 'sensor.ar_east_b', 'sensor.ar_west_a', 'sensor.ar_west_b'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'An array unreadable',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_dead', name: 'Carport' },
            { entity: 'sensor.ar_nowhere', name: 'Shed' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Compact',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          variant: 'compact',
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_west', name: 'West' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Long names',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Solar production of the whole house',
          forecast_entity: 'sensor.ar_forecast',
          arrays: [
            { entity: 'sensor.ar_east', name: 'East-facing roof over the kitchen' },
            { entity: 'sensor.ar_west', name: 'West-facing roof over the garage' },
            { entity: 'sensor.ar_west_b' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'A desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_west', name: 'West' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Half a column',
      cards: [
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          variant: 'compact',
          cols: 6,
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_west', name: 'West' },
          ],
          _now: NOW,
        },
        {
          type: 'custom:fluvy-production-card',
          entity: 'sensor.ar_total',
          name: 'Production',
          forecast_entity: 'sensor.ar_forecast',
          cols: 6,
          arrays: [
            { entity: 'sensor.ar_east', name: 'East' },
            { entity: 'sensor.ar_west', name: 'West' },
          ],
          _now: NOW,
        },
      ],
    },
  ],
};
