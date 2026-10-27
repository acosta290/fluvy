import { FluvyChartCard } from '../../../../packages/cards/src/chart/chart-card.js';
import type { StateSeed } from '../hass.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the items sheet does
if (!customElements.get('fluvy-chart-card'))
  customElements.define('fluvy-chart-card', FluvyChartCard);

/*
 * The Chart card (#68), on the sheets' evening (Thursday 17 September 2026, 21:47): a Nordpool sensor with today's and
 * tomorrow's quarter-hour prices in `raw_today` and `raw_tomorrow` (`{start, end, value}`, 96 a day, negative at
 * Friday's sunny noon), stepped, its thresholds in their tones and its cheapest and dearest two hours marked; the same
 * sensor in the morning, before tomorrow is published; a Tibber-shaped `prices` map as columns; a Solcast forecast
 * list in kW under a kWh sensor; a weather's hourly forecast (`weather/subscribe_forecast`) after the measured
 * temperature; a sensor's history with its change on yesterday; its statistics' band; four rooms on one chart (the
 * legend under the axis); compact, tiles, empty, out of reach and half a section.
 */

const QUARTER = 15 * 60_000;
const HOUR = 4 * QUARTER;
/** The sheets' midnight: Thursday's, and Friday's. */
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
const TOMORROW = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1).getTime();
const NOW_ISO = NOW.toISOString();

/** A moment as Nordpool writes it: the local time with its offset (`2026-09-17T13:00:00+02:00`). */
function local(t: number): string {
  const date = new Date(t);
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number): string => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/**
 * A day's price at an hour of it (€/kWh): a night's floor, the morning's and the evening's peaks, the sun's dip at
 * noon — on a sunny Friday below zero — and a quarter's own wobble.
 */
const price = (hour: number, sunny: number, quarter: number): number =>
  Math.round(
    (0.105 +
      0.07 * Math.exp(-((hour - 8) ** 2) / 3) +
      0.16 * Math.exp(-((hour - 19.5) ** 2) / 4) -
      sunny * Math.exp(-((hour - 13.5) ** 2) / 5) +
      0.006 * Math.sin(quarter * 1.7)) *
      1000,
  ) / 1000;

/** A day of Nordpool's quarters as `raw_today` lists them: `{start, end, value}`, 96 of them. */
const quarters = (midnight: number, sunny: number) =>
  Array.from({ length: 96 }, (_unused, q) => ({
    start: local(midnight + q * QUARTER),
    end: local(midnight + (q + 1) * QUARTER),
    value: price(q / 4, sunny, q),
  }));
const RAW_TODAY = quarters(TODAY, 0.07);
const RAW_TOMORROW = quarters(TOMORROW, 0.15);
const NOW_PRICE = RAW_TODAY[Math.floor((NOW.getTime() - TODAY) / QUARTER)]?.value ?? 0;

/** Tibber's prices as a map of hours to prices, today and tomorrow. */
const TIBBER = Object.fromEntries(
  Array.from({ length: 48 }, (_unused, h) => [
    local(TODAY + h * HOUR),
    Math.round((price(h % 24, h < 24 ? 0.06 : 0.1, h) * 1.12 + 0.06) * 1000) / 1000,
  ]),
);

/** Solcast's day ahead in half hours (kW, with its tenth and ninetieth percentiles), under a sensor in kWh. */
const SOLCAST = Array.from({ length: 96 }, (_unused, i) => {
  const hour = i / 2;
  const sun = (h: number): number => Math.max(0, Math.sin(((h % 24) - 7) * (Math.PI / 13)));
  const kw = Math.round(5.2 * sun(hour) ** 1.4 * (i < 48 ? 0.85 : 1) * 100) / 100;
  return {
    period_start: local(TODAY + i * 30 * 60_000),
    pv_estimate: kw,
    pv_estimate10: Math.round(kw * 0.72 * 100) / 100,
    pv_estimate90: Math.round(kw * 1.14 * 100) / 100,
  };
});

/** Two days of a room's temperature, half an hour a reading: yesterday, then today up to now. */
const room = (base: number, swing: number): number[] =>
  Array.from({ length: 96 }, (_unused, i) => {
    const hour = (i / 2) % 24;
    return (
      Math.round(
        (base +
          swing * Math.exp(-((hour - 16) ** 2) / 10) -
          0.6 * Math.exp(-((hour - 5) ** 2) / 6) +
          (i < 48 ? -0.5 : 0)) *
          10,
      ) / 10
    );
  });
const LIVING = room(20.4, 2.6);

/** The weather's next hours from the sheets' hour on: a cool night, a warm Friday afternoon. */
const FORECAST = Array.from({ length: 30 }, (_unused, h) => {
  const t = new Date(NOW).setMinutes(0, 0, 0) + (h + 1) * HOUR;
  const hour = new Date(t).getHours();
  return {
    datetime: new Date(t).toISOString(),
    condition: hour > 7 && hour < 20 ? 'sunny' : 'clear-night',
    temperature: Math.round((14.5 + 8 * Math.exp(-((hour - 15) ** 2) / 14)) * 10) / 10,
  };
});

const PRICE = { unit_of_measurement: 'EUR/kWh', state_class: 'measurement' };
const TEMPERATURE = {
  unit_of_measurement: '°C',
  device_class: 'temperature',
  state_class: 'measurement',
};

const sensor = (
  id: string,
  state: string,
  name: string,
  attributes: Record<string, unknown> = {},
): StateSeed => [id, state, { friendly_name: name, ...attributes }];

/** A Chart card frozen on the sheets' moment. */
const card = (extra: Record<string, unknown>) => ({
  type: 'custom:fluvy-chart-card',
  _now: NOW_ISO,
  ...extra,
});

/** The issue's card: Nordpool's prices today and tomorrow, stepped, in their tones, the cheapest and dearest marked. */
const NORDPOOL = card({
  title: 'Electricity price',
  icon: 'bolt',
  series: [{ entity: 'sensor.ch_nordpool', tone: 'ok' }],
  span: 'today+tomorrow',
  chart: 'step',
  thresholds: [
    { tone: 'warning', value: 0.18 },
    { tone: 'danger', value: 0.26 },
  ],
  highlight: 'both',
  highlight_hours: 2,
});

const ROOMS = card({
  title: 'Rooms',
  series: [
    'sensor.ch_living_temperature',
    'sensor.ch_office_temperature',
    'sensor.ch_bedroom_temperature',
    'sensor.ch_kitchen_temperature',
  ],
});

export const sheet: SheetSpec = {
  states: [
    sensor('sensor.ch_nordpool', String(NOW_PRICE), 'Nordpool', {
      ...PRICE,
      currency: 'EUR',
      raw_today: RAW_TODAY,
      raw_tomorrow: RAW_TOMORROW,
      today: RAW_TODAY.map((entry) => entry.value),
      tomorrow: RAW_TOMORROW.map((entry) => entry.value),
      tomorrow_valid: true,
    }),
    // the same sensor before tomorrow's prices are published (Nordpool publishes them about one in the afternoon)
    sensor('sensor.ch_nordpool_morning', String(NOW_PRICE), 'Nordpool', {
      ...PRICE,
      raw_today: RAW_TODAY,
      raw_tomorrow: [],
      today: RAW_TODAY.map((entry) => entry.value),
      tomorrow: [],
      tomorrow_valid: false,
    }),
    sensor('sensor.ch_tibber', String(TIBBER[local(TODAY + 21 * HOUR)] ?? 0), 'Tibber price', {
      unit_of_measurement: '€/kWh',
      prices: TIBBER,
    }),
    sensor('sensor.ch_solcast_today', '18.4', 'Solar forecast today', {
      unit_of_measurement: 'kWh',
      device_class: 'energy',
      detailedForecast: SOLCAST,
    }),
    [
      'weather.ch_home',
      'clear-night',
      {
        friendly_name: 'Home',
        temperature: 16.8,
        temperature_unit: '°C',
        supported_features: 3,
      },
    ],
    sensor('sensor.ch_living_temperature', '21.4', 'Living room', TEMPERATURE),
    sensor('sensor.ch_office_temperature', '22.9', 'Office', TEMPERATURE),
    sensor('sensor.ch_bedroom_temperature', '19.6', 'Bedroom', TEMPERATURE),
    sensor('sensor.ch_kitchen_temperature', '21.1', 'Kitchen', TEMPERATURE),
    sensor('sensor.ch_cellar_temperature', '14.2', 'Cellar', TEMPERATURE),
    ['sensor.ch_gone', 'unavailable', { friendly_name: 'Nordpool', ...PRICE }],
  ],
  history: {
    'sensor.ch_living_temperature': LIVING,
    'sensor.ch_office_temperature': room(21.6, 3.1),
    'sensor.ch_bedroom_temperature': room(18.9, 1.4),
    'sensor.ch_kitchen_temperature': room(20.2, 2.2),
    'sensor.ch_cellar_temperature': [],
  },
  statistics: {
    'sensor.ch_living_temperature': {
      kind: 'measurement',
      hourly: LIVING.filter((_v, i) => i % 2),
    },
  },
  ws: {
    'weather/subscribe_forecast': (message) =>
      message['entity_id'] === 'weather.ch_home'
        ? {
            type: message['forecast_type'],
            forecast: message['forecast_type'] === 'hourly' ? FORECAST : null,
          }
        : undefined,
  },
  frames: [
    { title: 'Chart · Nordpool', cards: [NORDPOOL] },
    {
      title: 'Chart · Nordpool before tomorrow',
      cards: [{ ...NORDPOOL, series: [{ entity: 'sensor.ch_nordpool_morning', tone: 'ok' }] }],
    },
    {
      title: 'Chart · Tibber',
      cards: [
        card({
          title: 'Tibber',
          series: [{ entity: 'sensor.ch_tibber', attribute: 'prices', kind: 'columns' }],
          span: 'today+tomorrow',
          highlight: 'min',
          highlight_hours: 3,
        }),
      ],
    },
    {
      title: 'Chart · solar forecast',
      cards: [
        card({
          title: 'Solar forecast',
          icon: 'sun',
          series: [{ entity: 'sensor.ch_solcast_today', unit: 'kW', kind: 'area', tone: 'solar' }],
          span: 'today+tomorrow',
          chart: 'soft',
        }),
      ],
    },
    {
      title: 'Chart · measured and forecast',
      cards: [
        card({
          title: 'Temperature',
          series: [
            { entity: 'sensor.ch_living_temperature', name: 'Living room' },
            { entity: 'weather.ch_home', name: 'Outside' },
          ],
          span: 'today+tomorrow',
          chart: 'soft',
        }),
      ],
    },
    {
      title: 'Chart · history',
      cards: [card({ series: ['sensor.ch_living_temperature'] })],
    },
    // the recorder's statistics end on the page's last whole hour: this card reads the page's clock, not the sheets'
    {
      title: 'Chart · statistics',
      cards: [
        {
          type: 'custom:fluvy-chart-card',
          series: [{ entity: 'sensor.ch_living_temperature', source: 'statistics' }],
          chart: 'step',
        },
      ],
    },
    // Solcast's tenth and ninetieth percentiles as the band behind its estimate
    {
      title: 'Chart · forecast band',
      cards: [
        card({
          title: 'Solar forecast',
          series: [{ entity: 'sensor.ch_solcast_today', unit: 'kW', kind: 'band', tone: 'solar' }],
          span: 'today',
          chart: 'band',
          show_head: false,
        }),
      ],
    },
    { title: 'Chart · four rooms', cards: [ROOMS] },
    { title: 'Chart · compact', cards: [{ ...NORDPOOL, variant: 'compact' }] },
    {
      title: 'Chart · tiles',
      cards: [
        { ...NORDPOOL, variant: 'tile', title: 'Price', cols: 6 },
        card({ series: ['sensor.ch_living_temperature'], variant: 'tile', cols: 6 }),
      ],
    },
    {
      title: 'Chart · empty',
      cards: [card({ series: ['sensor.ch_cellar_temperature'] })],
    },
    {
      title: 'Chart · out of reach',
      cards: [card({ series: ['sensor.ch_gone'], span: 'today+tomorrow', chart: 'step' })],
    },
    {
      title: 'Chart · half a section',
      heights: [152, 172],
      cards: [
        { ...NORDPOOL, cols: 6 },
        card({ series: ['sensor.ch_living_temperature'], cols: 6 }),
      ],
    },
  ],
};
