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
 * legend under the axis), and four and six at half a section and in a narrow column; compact, tiles, empty, out of
 * reach and half a section; and at noon (#158), three rooms' day so far, a room beside the price of both days, the
 * panels' power over the solar forecast as columns, and two units on one chart (a price's columns under a temperature,
 * a power beside a humidity), full, compact and as tiles. And #264: the supply's voltage in and out of a voltage
 * optimiser beside the house's power, a readout each (the reporter's picture), each voltage with thresholds of its own;
 * the house's power over a day with its lowest and highest points; four rooms' readouts with theirs; at half a section,
 * where the readouts give way to the legend's lines; out of reach; and the supply read every half minute, a surge and
 * a sag of half a minute each that the line's points average away, said by the figures of its lowest and highest.
 */

const QUARTER = 15 * 60_000;
const HOUR = 4 * QUARTER;
/** The sheets' midnight: Thursday's, and Friday's. */
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
const TOMORROW = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1).getTime();
const NOW_ISO = NOW.toISOString();
/** Thursday's noon: half of today has happened. */
const NOON_ISO = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 12).toISOString();

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

/** How high the sun stands at an hour of the day, 0 at night: what the panels make and what is forecast follow it. */
const sun = (h: number): number => Math.max(0, Math.sin(((h % 24) - 7) * (Math.PI / 13)));

/** Solcast's day ahead in half hours (kW, with its tenth and ninetieth percentiles), under a sensor in kWh. */
const SOLCAST = Array.from({ length: 96 }, (_unused, i) => {
  const kw = Math.round(5.2 * sun(i / 2) ** 1.4 * (i < 48 ? 0.85 : 1) * 100) / 100;
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
/**
 * A room's readings up to Thursday's noon, as the recorder answers a card read then: from yesterday's midnight for its
 * first series (its change is on yesterday), from today's for the others.
 */
const toNoon = (readings: readonly number[], first: boolean): number[] =>
  readings.slice(first ? 0 : 48, 73);
const NOON_ROOMS = [
  'sensor.ch_noon_living_temperature',
  'sensor.ch_noon_office_temperature',
  'sensor.ch_noon_bedroom_temperature',
];
/**
 * The panels' power up to Thursday's noon (kW), half an hour a reading from Wednesday's midnight, a passing cloud in
 * it.
 */
const SOLAR_TO_NOON = Array.from(
  { length: 73 },
  (_unused, i) =>
    Math.round(4.6 * sun(i / 2) ** 1.4 * (0.92 + 0.06 * Math.sin(i * 1.3)) * 100) / 100,
);
/**
 * The house's power up to Thursday's noon (W), half an hour a reading from Wednesday's midnight: the kettle, the oven,
 * lunch.
 */
const POWER_TO_NOON = Array.from({ length: 73 }, (_unused, i) => {
  const hour = (i / 2) % 24;
  return Math.round(
    240 +
      1500 * Math.exp(-((hour - 7.5) ** 2) / 0.4) +
      2200 * Math.exp(-((hour - 19) ** 2) / 0.9) +
      650 * Math.exp(-((hour - 12) ** 2) / 0.6) +
      40 * Math.sin(i * 2.1),
  );
});
/** The bathroom's humidity from Thursday's midnight to noon (%), half an hour a reading: the shower at 07:30. */
const HUMIDITY_TO_NOON = Array.from(
  { length: 25 },
  (_unused, i) =>
    Math.round((54 + 14 * Math.exp(-((i / 2 - 7.5) ** 2) / 0.8) - 0.35 * (i / 2)) * 10) / 10,
);

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

/**
 * The supply's last six hours, five minutes a reading (#264): the grid's voltage at the meter, the house's after its
 * voltage optimiser, and the house's power (kW) — the oven at seven, the kettle at nine.
 */
const FIVE = Array.from({ length: 73 }, (_unused, i) => (i - 72) / 12 + 21.75);
const SUPPLY_IN = FIVE.map(
  (h) =>
    Math.round(
      (245.6 +
        2.2 * Math.sin(h * 2.3) +
        1.2 * Math.sin(h * 7.9) -
        0.8 * Math.cos(h * 13) +
        6.2 * Math.exp(-((h - 20.2) ** 2) / 0.03)) *
        10,
    ) / 10,
);
const SUPPLY_HOUSE = FIVE.map(
  (h) =>
    Math.round(
      (219.8 +
        0.8 * Math.sin(h * 3.1) +
        0.4 * Math.sin(h * 11.3) -
        6.4 * Math.exp(-((h - 19.1) ** 2) / 0.02)) *
        10,
    ) / 10,
);
const SUPPLY_POWER = FIVE.slice(36).map(
  (h) =>
    Math.round(
      (0.32 +
        2.9 * Math.exp(-((h - 19.1) ** 2) / 0.12) +
        2.2 * Math.exp(-((h - 21.05) ** 2) / 0.004) +
        0.08 * Math.sin(h * 17)) *
        100,
    ) / 100,
);
/**
 * The house's power over two days to the sheets' evening (kW), half an hour a reading: night, lunch, the oven;
 * yesterday a tenth more.
 */
const DAY_POWER = Array.from({ length: 97 }, (_unused, i) => {
  const hour = (i / 2 + 21.75) % 24;
  return (
    Math.round(
      (i < 48 ? 1.1 : 1) *
        (0.24 +
          0.5 * Math.exp(-((hour - 7.5) ** 2) / 0.8) +
          5.1 * Math.exp(-((hour - 13) ** 2) / 0.5) +
          2.6 * Math.exp(-((hour - 19) ** 2) / 1.2) +
          0.06 * Math.sin(i * 1.9) -
          0.05 * Math.exp(-((hour - 4) ** 2) / 1.5)) *
        100,
    ) / 100
  );
});

/**
 * The supply's last six hours read every half minute (#264): the voltage at the meter near 246 V with a surge of half a
 * minute to 254.1 V at 20:12, the house's after its optimiser near 220 V with a sag to 212.4 V at 19:31 — a tenth of
 * each point the line is drawn in, which its mean averages away — the hours of the day each reading stands at.
 */
const HALF_MINUTES = Array.from(
  { length: 721 },
  (_unused, i) =>
    NOW.getHours() + NOW.getMinutes() / 60 + NOW.getSeconds() / 3600 + (i - 720) / 120,
);
/** Whether the half minute at an hour of the day is the one read at that minute. */
const onMinute = (h: number, hour: number, minute: number): boolean =>
  Math.round((h - hour - minute / 60) * 120) === 0;
const METER_VOLTAGE = HALF_MINUTES.map(
  (h) =>
    Math.round(
      (onMinute(h, 20, 12)
        ? 254.1
        : 245.9 + 1.1 * Math.sin(h * 2.3) + 0.5 * Math.sin(h * 7.9) - 0.3 * Math.cos(h * 13)) * 10,
    ) / 10,
);
const OPTIMISED_VOLTAGE = HALF_MINUTES.slice(360).map(
  (h) =>
    Math.round(
      (onMinute(h, 19, 31) ? 212.4 : 220.1 + 0.7 * Math.sin(h * 3.1) + 0.3 * Math.sin(h * 11.3)) *
        10,
    ) / 10,
);

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

const FOUR_ROOMS = [
  'sensor.ch_living_temperature',
  'sensor.ch_office_temperature',
  'sensor.ch_bedroom_temperature',
  'sensor.ch_kitchen_temperature',
];
const ROOMS = card({ title: 'Rooms', series: FOUR_ROOMS });

/** Tibber's hours as columns under the office's temperature, today at noon: €/kWh and °C, each on its own scale. */
const PRICE_UNDER_ROOM = card({
  title: 'Price and office',
  series: [
    { entity: 'sensor.ch_tibber', attribute: 'prices', kind: 'columns', name: 'Price' },
    { entity: 'sensor.ch_noon_office_temperature', name: 'Office' },
  ],
  span: 'today',
  chart: 'soft',
  _now: NOON_ISO,
});
/** The house's power beside the bathroom's humidity, today at noon: W and %, each on a scale of its own. */
const POWER_AND_HUMIDITY = card({
  title: 'Power and humidity',
  series: [
    { entity: 'sensor.ch_noon_house_power', name: 'House' },
    { entity: 'sensor.ch_noon_bathroom_humidity', name: 'Bathroom' },
  ],
  span: 'today',
  chart: 'soft',
  _now: NOON_ISO,
});

const VOLTAGE = { unit_of_measurement: 'V', device_class: 'voltage', state_class: 'measurement' };
const POWER_KW = { unit_of_measurement: 'kW', device_class: 'power', state_class: 'measurement' };

/**
 * #264, the reporter's picture: the supply's voltage in and out of the optimiser and the house's power between them,
 * a readout each; each voltage in its own thresholds (the grid's high at the meter, the house's low under it).
 */
const SUPPLY_SERIES = [
  {
    entity: 'sensor.ch_supply_voltage',
    name: 'Input',
    thresholds: [
      { value: 245, tone: 'warning' },
      { value: 253, tone: 'danger' },
    ],
  },
  { entity: 'sensor.ch_house_power', name: 'Power' },
  {
    entity: 'sensor.ch_house_voltage',
    name: 'House',
    thresholds: [{ value: 216, tone: 'warning', below: true }],
  },
];
const SUPPLY = card({
  title: 'Home',
  icon: 'bolt',
  series: SUPPLY_SERIES,
  span: '3h',
  chart: 'soft',
  readouts: true,
});
/** The same, each series' lowest and highest points under its readout. */
const SUPPLY_MARKED = SUPPLY_SERIES.map((item) => ({ ...item, highlight: 'both' }));
const SUPPLY_POINTS = card({ ...SUPPLY, series: SUPPLY_MARKED });
/**
 * The supply read every half minute, each voltage its lowest and highest under its readout, the meter's in its own
 * thresholds: the surge reads 254.1 V in the danger's ink, high over the line's top; the house's highest is its reading
 * now, which the recorder has not sent yet.
 */
const SURGE = card({
  title: 'Home',
  icon: 'bolt',
  series: [
    { ...SUPPLY_SERIES[0], entity: 'sensor.ch_meter_voltage', highlight: 'both' },
    { ...SUPPLY_SERIES[2], entity: 'sensor.ch_optimised_voltage', highlight: 'both' },
  ],
  span: '3h',
  chart: 'soft',
  readouts: true,
});
/** Four rooms' day, a readout each, its lowest and highest points under it. */
const ROOMS_READ = card({
  title: 'Rooms',
  series: FOUR_ROOMS.map((entity) => ({ entity, highlight: 'both' })),
  span: '24h',
  chart: 'soft',
  readouts: true,
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
    sensor('sensor.ch_bathroom_temperature', '23.4', 'Bathroom', TEMPERATURE),
    sensor('sensor.ch_hall_temperature', '18.2', 'Hall', TEMPERATURE),
    // the rooms at Thursday's noon, each reading its line's last
    sensor('sensor.ch_noon_living_temperature', '20.9', 'Living room', TEMPERATURE),
    sensor('sensor.ch_noon_office_temperature', '22.2', 'Office', TEMPERATURE),
    sensor('sensor.ch_noon_bedroom_temperature', '19.2', 'Bedroom', TEMPERATURE),
    sensor('sensor.ch_noon_solar_power', String(SOLAR_TO_NOON.at(-1)), 'Solar power', {
      unit_of_measurement: 'kW',
      device_class: 'power',
      state_class: 'measurement',
    }),
    sensor('sensor.ch_noon_house_power', String(POWER_TO_NOON.at(-1)), 'House', {
      unit_of_measurement: 'W',
      device_class: 'power',
      state_class: 'measurement',
    }),
    sensor('sensor.ch_noon_bathroom_humidity', String(HUMIDITY_TO_NOON.at(-1)), 'Bathroom', {
      unit_of_measurement: '%',
      device_class: 'humidity',
      state_class: 'measurement',
    }),
    ['sensor.ch_gone', 'unavailable', { friendly_name: 'Nordpool', ...PRICE }],
    sensor('sensor.ch_supply_voltage', String(SUPPLY_IN.at(-1)), 'Supply voltage', VOLTAGE),
    sensor('sensor.ch_house_voltage', String(SUPPLY_HOUSE.at(-1)), 'House voltage', VOLTAGE),
    sensor('sensor.ch_house_power', String(SUPPLY_POWER.at(-1)), 'House power', POWER_KW),
    sensor('sensor.ch_day_power', String(DAY_POWER.at(-1)), 'House power', POWER_KW),
    ['sensor.ch_supply_gone', 'unavailable', { friendly_name: 'Supply voltage', ...VOLTAGE }],
    sensor('sensor.ch_meter_voltage', String(METER_VOLTAGE.at(-1)), 'Meter voltage', VOLTAGE),
    // its reading now over every one the recorder has sent
    sensor('sensor.ch_optimised_voltage', '221.6', 'House voltage', VOLTAGE),
  ],
  history: {
    'sensor.ch_living_temperature': LIVING,
    'sensor.ch_office_temperature': room(21.6, 3.1),
    'sensor.ch_bedroom_temperature': room(18.9, 1.4),
    'sensor.ch_kitchen_temperature': room(20.2, 2.2),
    'sensor.ch_cellar_temperature': [],
    'sensor.ch_bathroom_temperature': room(22.8, 2.6),
    'sensor.ch_hall_temperature': room(17.6, 1.1),
    'sensor.ch_noon_living_temperature': toNoon(LIVING, true),
    'sensor.ch_noon_office_temperature': toNoon(room(21.6, 3.1), false),
    'sensor.ch_noon_bedroom_temperature': toNoon(room(18.9, 1.4), false),
    'sensor.ch_noon_solar_power': SOLAR_TO_NOON,
    'sensor.ch_noon_house_power': POWER_TO_NOON,
    'sensor.ch_noon_bathroom_humidity': HUMIDITY_TO_NOON,
    'sensor.ch_supply_voltage': SUPPLY_IN,
    'sensor.ch_house_voltage': SUPPLY_HOUSE.slice(36),
    'sensor.ch_house_power': SUPPLY_POWER,
    'sensor.ch_day_power': DAY_POWER,
    'sensor.ch_meter_voltage': METER_VOLTAGE,
    'sensor.ch_optimised_voltage': OPTIMISED_VOLTAGE,
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
            // the palette's fourth series colour, whatever the palette
            { entity: 'weather.ch_home', name: 'Outside', color: 'graph-4' },
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
    // four rooms and six at half a section and in a narrow column (211, 266: half a wider one): the legend one a row
    // where its columns would cut the names, the plot giving up the lines it takes, the card at its height
    {
      title: 'Chart · rooms at half a section',
      heights: [152, 172, 211, 266],
      cards: [
        { ...ROOMS, cols: 6 },
        card({
          title: 'Rooms',
          series: [...FOUR_ROOMS, 'sensor.ch_bathroom_temperature', 'sensor.ch_hall_temperature'],
          cols: 6,
        }),
      ],
    },
    {
      title: 'Chart · half a section',
      heights: [152, 172],
      cards: [
        { ...NORDPOOL, cols: 6 },
        card({ series: ['sensor.ch_living_temperature'], cols: 6 }),
      ],
    },
    // #158: the readings up to now stand at their own times, whole; only what runs past now is dashed
    {
      title: 'Chart · today at noon',
      cards: [
        card({
          title: 'Temperature',
          series: NOON_ROOMS,
          span: 'today',
          chart: 'classic',
          _now: NOON_ISO,
        }),
      ],
    },
    {
      title: 'Chart · today and tomorrow at noon',
      cards: [
        card({
          title: 'Living room and price',
          series: [
            { entity: 'sensor.ch_noon_living_temperature', name: 'Living room' },
            { entity: 'sensor.ch_nordpool', name: 'Price', curve: 'step' },
          ],
          span: 'today+tomorrow',
          chart: 'soft',
          _now: NOON_ISO,
        }),
      ],
    },
    // the panels' power over Solcast's forecast as columns: now marked once, on the line's end, the hours to come
    // hollow
    {
      title: 'Chart · a line over columns at noon',
      cards: [
        card({
          title: 'Solar power',
          series: [
            { entity: 'sensor.ch_noon_solar_power', name: 'Measured' },
            { entity: 'sensor.ch_solcast_today', unit: 'kW', kind: 'columns', name: 'Forecast' },
          ],
          span: 'today',
          chart: 'soft',
          _now: NOON_ISO,
        }),
      ],
    },
    // two units on one chart: each unit's series on a scale of their own, every series the plot's height; the ticks
    // the columns', else the first series' (a price's columns under a temperature, a power beside a humidity)
    { title: 'Chart · two units', cards: [PRICE_UNDER_ROOM, POWER_AND_HUMIDITY] },
    {
      title: 'Chart · two units, compact and tiles',
      cards: [
        { ...PRICE_UNDER_ROOM, variant: 'compact' },
        { ...PRICE_UNDER_ROOM, variant: 'tile', cols: 6 },
        { ...POWER_AND_HUMIDITY, variant: 'tile', cols: 6 },
      ],
    },
    // #264: a readout each, as the several sensors' card lays them: the reporter's picture, then with each series'
    // lowest and highest points under its readout
    { title: 'Chart · readouts', cards: [SUPPLY] },
    { title: 'Chart · readouts, lowest and highest', cards: [SUPPLY_POINTS] },
    // a lone series' lowest and highest points: dots on its line and pills in the row ("High 5.4 kW · 13:00"); as
    // columns, the two lit with their figures over them
    {
      title: 'Chart · lowest and highest',
      cards: [
        card({
          title: 'House power',
          series: [{ entity: 'sensor.ch_day_power', highlight: 'both' }],
          span: '24h',
          chart: 'soft',
        }),
        card({
          title: 'House power',
          series: [{ entity: 'sensor.ch_day_power', kind: 'columns', highlight: 'both' }],
          span: '24h',
          chart: 'soft',
        }),
      ],
    },
    // two series of one unit, each in thresholds of its own, and a power in its own unit's: the legend's figures in
    // their bands' inks
    {
      title: 'Chart · thresholds of its own',
      cards: [
        card({
          title: 'Supply',
          series: [
            SUPPLY_SERIES[0],
            SUPPLY_SERIES[2],
            {
              entity: 'sensor.ch_house_power',
              name: 'Power',
              thresholds: [{ value: 3, tone: 'danger' }],
            },
          ],
          span: '3h',
          chart: 'soft',
        }),
      ],
    },
    // four series a readout each, two lines of them (the card's 364), and six without their points
    {
      title: 'Chart · four readouts',
      cards: [
        ROOMS_READ,
        card({
          title: 'Rooms',
          series: [...FOUR_ROOMS, 'sensor.ch_bathroom_temperature', 'sensor.ch_hall_temperature'],
          span: '24h',
          chart: 'soft',
          readouts: true,
        }),
      ],
    },
    // at half a section a name would be cut in a column: the readouts give way to the legend's lines, one a row
    {
      title: 'Chart · readouts at half a section',
      heights: [152, 172, 211, 266],
      cards: [
        { ...SUPPLY_POINTS, cols: 6 },
        { ...ROOMS_READ, cols: 6 },
      ],
    },
    // out of reach: the readout keeps its place and says "—", its key in the off ink; a lone series' points are
    // its window's
    {
      title: 'Chart · readouts out of reach',
      cards: [
        card({
          ...SUPPLY_POINTS,
          series: [
            { ...SUPPLY_MARKED[0], entity: 'sensor.ch_supply_gone' },
            ...SUPPLY_MARKED.slice(1),
          ],
        }),
        card({
          title: 'Supply voltage',
          series: [{ entity: 'sensor.ch_supply_gone', highlight: 'both' }],
          span: '3h',
          chart: 'soft',
        }),
      ],
    },
    // a surge and a sag of half a minute, which the line's points average away: the figures are the readings' own,
    // each at its moment, its dot on the line at the point that holds it; the reading now counts
    {
      title: 'Chart · a surge, lowest and highest',
      cards: [
        SURGE,
        card({
          title: 'Supply voltage',
          series: [
            {
              entity: 'sensor.ch_meter_voltage',
              highlight: 'both',
              thresholds: SUPPLY_SERIES[0]?.thresholds,
            },
          ],
          span: '3h',
          chart: 'soft',
        }),
      ],
    },
  ],
};
