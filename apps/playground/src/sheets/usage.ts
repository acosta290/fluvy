import type { HomeAssistant } from '@fluvy/core';
import { FluvyEnergyPeriodCard } from '../../../../packages/cards/src/energy-period/energy-period-card.js';
import { FluvyEnergyUsageCard } from '../../../../packages/cards/src/energy-usage/energy-usage-card.js';
import { mockCollection, presetRange, type MockCollection } from '../collection.js';
import { house, type Handler } from '../houses.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';

for (const [tag, element] of [
  ['fluvy-energy-usage-card', FluvyEnergyUsageCard],
  ['fluvy-energy-period-card', FluvyEnergyPeriodCard],
] as const)
  if (!customElements.get(tag)) customElements.define(tag, element);

/**
 * The Energy usage card (#62) on a house of its own: an Energy dashboard with a grid read both ways, an array and a
 * battery, whose meters the recorder keeps hour by hour from January 2025 up to the sheets' moment — every range a day,
 * a week, a month or a year asks for is there, the one before it too. The sun follows the season and the day's sky, the
 * house its evenings, the battery takes the sun's surplus and gives it back after dark. A house on the grid alone,
 * one with no Energy dashboard, and a frame that follows an Energy period strip on a collection of its own.
 *
 * The statistics are answered here rather than seeded (`StatisticSeed` ends at the page's own clock): the cards and the
 * collection read the sheets' moment, so a range and the one before it hold the same figures whatever the day.
 */

const AT = '2026-09-17T21:47:12';
const HOUR = 3_600_000;
const UNTIL = NOW.getTime();
const FIRST = new Date(2025, 0, 1).getTime();

type Attributes = Record<string, unknown>;
const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});

/** A number in 0…1 for a day (and an hour of it): the day's sky and the house's whims, the same on every run. */
const noise = (a: number, b = 0): number => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** What the house's meters gained in each hour of a day (kWh), by meter. */
interface DayHours {
  readonly gridIn: number[];
  readonly gridOut: number[];
  readonly solar: number[];
  readonly batteryOut: number[];
  readonly batteryIn: number[];
  /** The same house on the grid alone: its use. */
  readonly use: number[];
}

const days = new Map<number, DayHours>();

/**
 * A day of the house, hour by hour from its midnight: the sun's arc by the season and the day's sky, the house's use
 * (its mornings, lunch and evenings, more in winter), a 6 kWh battery that takes the surplus up to 1.2 kWh an hour
 * and gives it back from five in the afternoon to seven in the morning down to its reserve, the grid the rest.
 */
function dayHours(midnight: Date): DayHours {
  const key = midnight.getTime();
  const known = days.get(key);
  if (known) return known;
  const yearDay = (key - new Date(midnight.getFullYear(), 0, 1).getTime()) / (24 * HOUR);
  const summer = 0.5 - 0.5 * Math.cos((2 * Math.PI * (yearDay - 15)) / 365);
  const sky = 0.45 + 0.55 * noise(key / HOUR);
  const rise = 8 - 1.6 * summer;
  const set = 17.5 + 3.5 * summer;
  const peak = (0.7 + 2.5 * summer) * sky;
  const out: DayHours = {
    gridIn: [],
    gridOut: [],
    solar: [],
    batteryOut: [],
    batteryIn: [],
    use: [],
  };
  let charge = 1.4;
  for (let h = 0; h < 24; h++) {
    const arc = Math.sin((Math.PI * (h + 0.5 - rise)) / (set - rise));
    const sun = h + 0.5 > rise && h + 0.5 < set ? peak * Math.max(0, arc) : 0;
    const use =
      0.3 +
      0.35 * (1 - summer) +
      (h >= 7 && h < 9 ? 0.75 : 0) +
      (h >= 13 && h < 15 ? 0.45 : 0) +
      (h >= 18 && h < 23 ? 1.05 : 0) +
      0.25 * noise(key / HOUR, h);
    let gridIn = 0;
    let gridOut = 0;
    let batteryIn = 0;
    let batteryOut = 0;
    if (sun >= use) {
      batteryIn = Math.min(sun - use, 1.2, 6 - charge);
      charge += batteryIn;
      gridOut = sun - use - batteryIn;
    } else {
      const need = use - sun;
      if (h >= 17 || h < 7) {
        batteryOut = Math.min(need, 1, Math.max(0, charge - 0.6));
        charge -= batteryOut;
      }
      gridIn = need - batteryOut;
    }
    const kwh = (v: number): number => Math.round(v * 1000) / 1000;
    out.gridIn.push(kwh(gridIn));
    out.gridOut.push(kwh(gridOut));
    out.solar.push(kwh(sun));
    out.batteryOut.push(kwh(batteryOut));
    out.batteryIn.push(kwh(batteryIn));
    out.use.push(kwh(use));
  }
  days.set(key, out);
  return out;
}

/** Each meter, by what of the day it gained. */
const METERS: Readonly<Record<string, keyof DayHours>> = {
  'sensor.eu_grid_in': 'gridIn',
  'sensor.eu_grid_out': 'gridOut',
  'sensor.eu_solar': 'solar',
  'sensor.eu_battery_out': 'batteryOut',
  'sensor.eu_battery_in': 'batteryIn',
  'sensor.eu_g_grid_in': 'use',
};

/** Where a bucket of `period` that holds `t` starts, on the page's calendar. */
const bucketOf = (t: number, period: string): number => {
  const d = new Date(t);
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor(t / HOUR) * HOUR;
};

/**
 * `recorder/statistics_during_period` for the meters above: what each gained in every bucket (`change`) of the
 * window, from the hours the recorder has closed by the sheets' moment — none before 2025, none after 21:00.
 */
const statistics: Handler = (message) => {
  const ids = ((message['statistic_ids'] as string[] | undefined) ?? []).filter(
    (id) => id in METERS,
  );
  const from = Math.max(FIRST, Date.parse(String(message['start_time'])));
  const to = message['end_time'] ? Date.parse(String(message['end_time'])) : UNTIL;
  const period = String(message['period'] ?? 'hour');
  const rows: Record<string, Map<number, number>> = Object.fromEntries(
    ids.map((id) => [id, new Map<number, number>()]),
  );
  // an hour that starts in the window, once it has closed
  for (let t = Math.ceil(from / HOUR) * HOUR; t < to && t + HOUR <= UNTIL; t += HOUR) {
    const at = new Date(t);
    const day = dayHours(new Date(at.getFullYear(), at.getMonth(), at.getDate()));
    const bucket = bucketOf(t, period);
    for (const id of ids) {
      const into = rows[id] as Map<number, number>;
      into.set(
        bucket,
        (into.get(bucket) ?? 0) + (day[METERS[id] as keyof DayHours][at.getHours()] ?? 0),
      );
    }
  }
  return Object.fromEntries(
    ids.map((id) => [
      id,
      [...(rows[id] as Map<number, number>)].map(([start, change]) => ({
        start,
        end: bucketOf(
          start + (period === 'month' ? 32 * 24 : period === 'day' ? 25 : 1) * HOUR,
          period,
        ),
        change: Math.round(change * 1000) / 1000,
      })),
    ]),
  );
};

const PREFS = {
  energy_sources: [
    {
      type: 'grid',
      stat_energy_from: 'sensor.eu_grid_in',
      stat_energy_to: 'sensor.eu_grid_out',
    },
    { type: 'solar', stat_energy_from: 'sensor.eu_solar' },
    {
      type: 'battery',
      stat_energy_from: 'sensor.eu_battery_out',
      stat_energy_to: 'sensor.eu_battery_in',
    },
  ],
  device_consumption: [],
};

const HOUSE: Record<string, Handler> = {
  'energy/get_prefs': () => PREFS,
  'recorder/statistics_during_period': statistics,
};

/** The house with its sun and its battery (the narrow sheet's usage cards read it too). */
export const usageHome = house(HOUSE);

/** The same house on the grid alone: what it used came from the grid, and nothing went back. */
const gridOnly = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      { type: 'grid', stat_energy_from: 'sensor.eu_g_grid_in', stat_energy_to: null },
    ],
  }),
  'recorder/statistics_during_period': statistics,
});

/** No Energy dashboard at all. */
const bare = house({ 'energy/get_prefs': () => ({ energy_sources: [], device_consumption: [] }) });

/**
 * The house again, its connection holding an Energy date picker's collection (`energy_usage`, on today), as Home
 * Assistant keeps one: the strip in the frame drives it, the usage card follows it.
 */
const followHouse = house(HOUSE);
let followed: HomeAssistant | undefined;
const following = (hass: HomeAssistant): HomeAssistant => {
  const view = followHouse(hass);
  followed = view;
  const connection = view.connection as unknown as Record<string, MockCollection | undefined>;
  connection['_energy_usage'] ??= mockCollection(
    () => followed as HomeAssistant,
    'energy_usage',
    presetRange(view, 'today', NOW),
  );
  return view;
};

const usage = (more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-energy-usage-card',
  _now: AT,
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    ['sensor.eu_grid_in', '4182.4', energy('Grid import')],
    ['sensor.eu_grid_out', '2210.9', energy('Grid export')],
    ['sensor.eu_solar', '6904.2', energy('Solar production')],
    ['sensor.eu_battery_out', '1520.7', energy('Battery discharge')],
    ['sensor.eu_battery_in', '1688.3', energy('Battery charge')],
    ['sensor.eu_g_grid_in', '7421.6', energy('Grid import')],
  ],

  frames: [
    { title: 'A day', hass: usageHome, cards: [usage()] },
    { title: 'A week', hass: usageHome, cards: [usage({ period: 'week' })] },
    { title: 'A month', hass: usageHome, cards: [usage({ period: 'month' })] },
    { title: 'A year', hass: usageHome, cards: [usage({ period: 'year' })] },
    {
      title: 'Compare',
      hass: usageHome,
      cards: [usage({ compare: true }), usage({ period: 'week', compare: true })],
    },
    {
      title: 'Compact and mini',
      hass: usageHome,
      cards: [usage({ variant: 'compact' }), usage({ variant: 'mini', period: 'week' })],
    },
    // the same day as the house used it and as its meters measured it: the morning's sun mostly charges the battery,
    // so the sun's columns are the house's share of it on the first card and all of it on the second
    {
      title: 'Metered flows',
      hass: usageHome,
      cards: [usage(), usage({ mode: 'flows' })],
    },
    {
      title: 'Solar alone, flows',
      hass: usageHome,
      cards: [
        usage({ mode: 'flows', sources: ['solar'] }),
        usage({ mode: 'flows', sources: ['solar'], period: 'week', compare: true }),
      ],
    },
    { title: 'A taller plot', hass: usageHome, cards: [usage({ plot_height: 240 })] },
    {
      title: 'A taller compact plot',
      hass: usageHome,
      cards: [usage({ variant: 'compact', plot_height: 160, mode: 'flows', period: 'week' })],
    },
    {
      title: 'Styles',
      hass: usageHome,
      cards: [
        usage({ chart: 'soft', period: 'week' }),
        // `columns` is classic's look, not offered: a config that still names it draws classic
        usage({ chart: 'columns', period: 'month' }),
      ],
    },
    // the person's own: the grid first, named and coloured; the sun off; no returns, no legend, no scale
    {
      title: 'Sources of their own',
      hass: usageHome,
      cards: [
        usage({
          title: 'Where it came from',
          sources: [
            { type: 'grid', name: 'Utility', color: '#7c5cff' },
            { type: 'battery', name: 'Powerwall' },
            { type: 'solar', show: false },
          ],
        }),
        usage({ max_sources: 2, show_axis: false, show_grid: false, period: 'week' }),
        usage({ show_returns: false, show_legend: false, show_period: false }),
      ],
    },
    { title: 'Grid only', hass: gridOnly, cards: [usage(), usage({ period: 'week' })] },
    { title: 'No Energy dashboard', hass: bare, cards: [usage(), usage({ variant: 'compact' })] },
    // an Energy period strip on the frame's own collection: ‹ › and Compare move the card
    {
      title: 'Following',
      hass: following,
      cards: [
        {
          type: 'custom:fluvy-energy-period-card',
          collection_key: 'energy_usage',
          show_compare: true,
          _now: AT,
        },
        usage({ collection_key: 'energy_usage' }),
      ],
    },
    {
      title: 'A phone',
      width: 328,
      hass: usageHome,
      cards: [usage(), usage({ variant: 'compact', period: 'month' }), usage({ variant: 'mini' })],
    },
  ],
};
