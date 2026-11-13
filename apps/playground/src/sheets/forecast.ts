import { FluvyProductionCard } from '../../../../packages/cards/src/production/production-card.js';
import { house } from '../houses.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-production-card'))
  customElements.define('fluvy-production-card', FluvyProductionCard);

/**
 * Production with Home Assistant's own solar forecast (1.20, #183): a 5.4 kWp roof on Thursday 17 September 2026 at
 * 14:12 — 13.6 kWh so far against the 12.8 the forecast expected by now (+6 %) — tomorrow's hours, and the days
 * ahead. Each frame's house answers `energy/get_prefs` and `energy/solar_forecast` as one kind of house does: Solcast
 * (one entry for the site, half hours, a week ahead and a last day cut short), Forecast.Solar (an entry a plane,
 * today and tomorrow), or none.
 */
const NOW = '2026-09-17T14:12:00';
const HOUR = 3_600_000;

type Attributes = Record<string, unknown>;
const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});

/** A clear day's hours on this roof (kWh, 06:00 to 20:00): 18.4 in all. */
const CLEAR = [0.1, 0.4, 0.9, 1.5, 2.0, 2.4, 2.6, 2.5, 2.2, 1.7, 1.2, 0.6, 0.25, 0.05];
const FIRST_HOUR = 6;
/** What the meter made in each finished hour (kWh), and in the twelve minutes of the hour in progress. */
const MADE = [0, 0, 0, 0, 0, 0, 0.1, 0.5, 1.0, 1.6, 2.1, 2.5, 2.7, 2.6];
const MADE_NOW = 0.5;
/** Each day's weather against a clear one, from today: tomorrow brighter, a grey Sunday, a storm on Tuesday. */
const WEATHER = [
  1, 1.17, 0.67, 1.31, 1.05, 0.52, 0.91, 1.21, 1.12, 0.84, 0.6, 1.02, 1.25, 1.14, 0.95,
];

/** The instant of an hour of the sheet's day, `days` after it, on the page's own clock (the house's). */
const at = (days: number, hour: number, minute = 0): string =>
  new Date(2026, 8, 17 + days, hour, minute).toISOString();

/** A forecast in Wh by instant: `share` of the roof, each day from today for `days`, an hour (or half an hour) a stretch. */
function whHours(days: number, share = 1, halves = false): Record<string, number> {
  const out: Record<string, number> = {};
  for (let day = 0; day < days; day++)
    CLEAR.forEach((kwh, i) => {
      const wh = Math.round(kwh * 1000 * (WEATHER[day] ?? 1) * share);
      if (!halves) out[at(day, FIRST_HOUR + i)] = wh;
      else {
        out[at(day, FIRST_HOUR + i)] = Math.round(wh * 0.5);
        out[at(day, FIRST_HOUR + i, 30)] = wh - Math.round(wh * 0.5);
      }
    });
  return out;
}

/** The Energy dashboard of a house whose arrays' meters are `meters`, each forecast by its config entries. */
const prefs = (meters: Readonly<Record<string, readonly string[]>>) => () => ({
  energy_sources: Object.entries(meters).map(([meter, entries]) => ({
    type: 'solar',
    stat_energy_from: meter,
    config_entry_solar_forecast: entries,
  })),
  device_consumption: [],
});

/** Solcast: the whole site in one entry, in half hours, a week ahead — and an eighth day that ends at 09:00, where its reach stops. */
const solcast = house({
  'energy/get_prefs': prefs({ 'sensor.fc_production': ['solcast'] }),
  'energy/solar_forecast': () => ({
    solcast: {
      wh_hours: {
        ...whHours(8, 1, true),
        [at(8, 6)]: 60,
        [at(8, 7)]: 310,
        [at(8, 8)]: 720,
      },
    },
  }),
});
/** Forecast.Solar: an entry a plane (the east roof 55 %, the west 45 %), today and tomorrow. */
const forecastSolar = house({
  'energy/get_prefs': prefs({
    'sensor.fc_east': ['plane_east'],
    'sensor.fc_west': ['plane_west'],
  }),
  'energy/solar_forecast': () => ({
    plane_east: { wh_hours: whHours(2, 0.55) },
    plane_west: { wh_hours: whHours(2, 0.45) },
  }),
});
/** Open-Meteo: fourteen days ahead, for the widest card. */
const openMeteo = house({
  'energy/get_prefs': prefs({ 'sensor.fc_production': ['open_meteo'] }),
  'energy/solar_forecast': () => ({ open_meteo: { wh_hours: whHours(15) } }),
});
/** A house whose Energy dashboard links no forecast. */
const none = house({ 'energy/get_prefs': prefs({ 'sensor.fc_production': [] }) });

interface Row {
  start: number;
  end: number;
  change: number;
  state: number;
}

/** A meter's hourly rows from the hour the card asks from (23:00 the evening before), `share` of the roof's. */
const meterRows = (message: Record<string, unknown>, share: number): Row[] => {
  const from = Date.parse(String(message['start_time']));
  let state = 1000;
  const out: Row[] = [{ start: from, end: from + HOUR, change: 0, state }];
  MADE.forEach((kwh, i) => {
    const change = Math.round(kwh * share * 1000) / 1000;
    state = Math.round((state + change) * 1000) / 1000;
    out.push({ start: from + (i + 1) * HOUR, end: from + (i + 2) * HOUR, change, state });
  });
  return out;
};
const METERS: Readonly<Record<string, number>> = {
  'sensor.fc_production': 1,
  'sensor.fc_east': 0.55,
  'sensor.fc_west': 0.45,
};
const reading = (share: number): string =>
  String(Math.round((1000 + (MADE.reduce((a, b) => a + b, 0) + MADE_NOW) * share) * 1000) / 1000);

const card = (config: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-production-card',
  entity: 'sensor.fc_production',
  name: 'Production',
  _now: NOW,
  ...config,
});
/** The house's meter over its two roofs: the card reads the forecast of the arrays it shows. */
const planes = {
  arrays: [
    { entity: 'sensor.fc_east', name: 'East' },
    { entity: 'sensor.fc_west', name: 'West' },
  ],
};

export const sheet: SheetSpec = {
  states: [
    ['sensor.fc_production', reading(1), energy('Solar production')],
    ['sensor.fc_east', reading(0.55), energy('East roof energy')],
    ['sensor.fc_west', reading(0.45), energy('West roof energy')],
    ['sensor.fc_asleep', 'unavailable', energy('Garage roof energy')],
    [
      'sensor.fc_template',
      '21.5',
      {
        friendly_name: 'Forecast, both days',
        unit_of_measurement: 'kWh',
        // a template that carries today and tomorrow, as Forecast.Solar's REST sensors do
        wh_hours: whHours(2),
      },
    ],
  ],

  ws: {
    'recorder/statistics_during_period': (message) => {
      const id = ((message['statistic_ids'] as string[] | undefined) ?? [])[0] ?? '';
      const share = METERS[id];
      return share ? { [id]: meterRows(message, share) } : {};
    },
  },

  frames: [
    {
      title: 'Today · Home Assistant’s forecast',
      hass: solcast,
      cards: [card()],
    },
    {
      title: 'Tomorrow',
      hass: solcast,
      cards: [card({ day: 'tomorrow' })],
    },
    {
      title: 'Days ahead',
      hass: solcast,
      cards: [card({ day: 'ahead' })],
    },
    {
      title: 'Tomorrow and the days ahead · soft',
      hass: solcast,
      cards: [card({ day: 'tomorrow', chart: 'soft' }), card({ day: 'ahead', chart: 'soft' })],
    },
    {
      title: 'Tomorrow and the days ahead · columns',
      hass: solcast,
      cards: [
        card({ day: 'tomorrow', chart: 'columns' }),
        card({ day: 'ahead', chart: 'columns' }),
      ],
    },
    {
      title: 'Compact',
      hass: solcast,
      cards: [
        card({ day: 'tomorrow', variant: 'compact' }),
        card({ day: 'ahead', variant: 'compact' }),
      ],
    },
    {
      title: 'Two planes · each its own forecast, added',
      hass: forecastSolar,
      cards: [
        card(planes),
        card({ ...planes, day: 'tomorrow' }),
        card({ ...planes, day: 'ahead' }),
      ],
    },
    {
      title: 'Days ahead · capped to five, no best and lowest',
      hass: solcast,
      cards: [card({ day: 'ahead', days: 5 }), card({ day: 'ahead', days: 3, show_peak: false })],
    },
    {
      title: 'A forecast sensor that carries tomorrow',
      hass: none,
      cards: [
        card({ day: 'tomorrow', forecast_entity: 'sensor.fc_template' }),
        card({ day: 'ahead', forecast_entity: 'sensor.fc_template' }),
      ],
    },
    {
      title: 'No forecast',
      hass: none,
      cards: [card({ day: 'tomorrow' }), card({ day: 'ahead', variant: 'compact' }), card()],
    },
    {
      title: 'The meter out of reach · the forecast stands',
      hass: solcast,
      cards: [
        card({ entity: 'sensor.fc_asleep', name: 'Garage roof', day: 'tomorrow' }),
        card({ entity: 'sensor.fc_asleep', name: 'Garage roof', day: 'ahead' }),
      ],
    },
    {
      title: 'Half a column',
      hass: solcast,
      cards: [card({ day: 'tomorrow', cols: 6 }), card({ day: 'ahead', cols: 6 })],
    },
    {
      title: 'Half a column · compact, and no forecast',
      hass: none,
      cards: [
        card({ day: 'ahead', variant: 'compact', cols: 6 }),
        card({ day: 'tomorrow', cols: 6 }),
      ],
    },
    {
      title: 'A wide section · two weeks ahead',
      width: 1160,
      hass: openMeteo,
      cards: [card({ day: 'ahead' }), card({ day: 'tomorrow', chart: 'soft' })],
    },
  ],
};
