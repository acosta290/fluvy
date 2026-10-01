import type { HomeAssistant } from '@fluvy/core';
import { FluvyEnergySankeyCard } from '../../../../packages/cards/src/sankey/sankey-card.js';
import { FluvyEnergyScoreCard } from '../../../../packages/cards/src/score/score-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as flow } from './flow.js';

if (!customElements.get('fluvy-energy-sankey-card'))
  customElements.define('fluvy-energy-sankey-card', FluvyEnergySankeyCard);
if (!customElements.get('fluvy-energy-score-card'))
  customElements.define('fluvy-energy-score-card', FluvyEnergyScoreCard);

/**
 * Where a day's energy went, and how the house did: the flow sheet's house (its Energy dashboard: a grid with import
 * and export meters, an array, a battery) with its devices, and houses of their own for the hard cases — the grid
 * charging the battery at night, the grid alone, a meter down, no Energy dashboard, statistics that cannot be read.
 */

/** The mock's moment (the flow sheet's): the day's four buckets are all in. */
const NOW = '2026-09-17T21:47:12';

type Attributes = Record<string, unknown>;
type Rows = { start: number; change: number }[];
type Handler = (message: Record<string, unknown>) => unknown;

const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});

/** A day in four buckets (night, morning, afternoon, evening): midnight in Madrid, the mock's zone. */
const DAY = Date.parse('2026-09-16T22:00:00Z');
const buckets = (values: readonly number[]): Rows =>
  values.map((change, i) => ({ start: DAY + i * 6 * 3600_000, change }));

/** The flow sheet's house: 4.1 in, 1.3 out, 11.2 of sun, 2.4 discharged, 3.0 charged; and its devices. */
const DEVICES: Record<string, Rows> = {
  'sensor.sk_heat_pump_energy': buckets([2.0, 0.8, 0.9, 1.4]),
  'sensor.sk_car_energy': buckets([3.0, 0, 0, 0.8]),
  'sensor.sk_kitchen_energy': buckets([0.2, 0.6, 0.5, 0.8]),
  'sensor.sk_oven_energy': buckets([0, 0.3, 0.2, 0.6]),
  'sensor.sk_washer_energy': buckets([0, 0.9, 0, 0]),
  'sensor.sk_fridge_energy': buckets([0.1, 0.1, 0.1, 0.1]),
  'sensor.sk_long_energy': buckets([1.0, 0.5, 0.3, 0.9]),
};

/** Answers the statistics a question asks for from a table (an id the table does not know has no rows). */
const statistics =
  (table: Record<string, Rows>): Handler =>
  (message) =>
    Object.fromEntries(
      ((message['statistic_ids'] as string[] | undefined) ?? []).map((id) => [id, table[id] ?? []]),
    );

/** The grid's fossil energy, hour by hour: 1.8 kWh of the day's 4.1 imported. */
const fossil: Handler = () => ({
  [DAY]: 0.8,
  [DAY + 6 * 3600_000]: 0.3,
  [DAY + 18 * 3600_000]: 0.7,
});

/**
 * A frame's own house: its Energy dashboard and statistics answered here, on a connection of its own (the cards
 * keep a house's preferences per connection), and `entities` as its registry shows them.
 */
function house(ws: Record<string, Handler>, options: { co2?: boolean } = {}) {
  const connection = { subscribeMessage: async () => () => undefined };
  let seen: HomeAssistant['entities'] | undefined;
  let entities: HomeAssistant['entities'] = {};
  return (hass: HomeAssistant): HomeAssistant => {
    if (seen !== hass.entities) {
      seen = hass.entities;
      entities =
        options.co2 === false
          ? Object.fromEntries(
              Object.entries(hass.entities).filter(([, e]) => e.platform !== 'co2signal'),
            )
          : hass.entities;
    }
    return {
      ...hass,
      entities,
      connection: connection as unknown as HomeAssistant['connection'],
      callWS: async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
        const handler = ws[message.type];
        if (!handler) return hass.callWS<T>(message);
        return handler(message) as T;
      },
    };
  };
}

/* ---------- the houses of the hard cases ---------- */

/** The grid charges the battery at night: its ribbon would cross the sun's into the house in the canonical rows. */
const NIGHT: Record<string, Rows> = {
  'sensor.sk_n_grid_in': buckets([6.0, 0.2, 0, 0.5]),
  'sensor.sk_n_grid_out': buckets([0, 0, 2.0, 0]),
  'sensor.sk_n_solar': buckets([0, 3.0, 6.0, 0]),
  'sensor.sk_n_battery_out': buckets([0, 0, 0, 3.0]),
  'sensor.sk_n_battery_in': buckets([4.0, 0.5, 1.5, 0]),
};
const night = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      {
        type: 'grid',
        stat_energy_from: 'sensor.sk_n_grid_in',
        stat_energy_to: 'sensor.sk_n_grid_out',
      },
      { type: 'solar', stat_energy_from: 'sensor.sk_n_solar' },
      {
        type: 'battery',
        stat_energy_from: 'sensor.sk_n_battery_out',
        stat_energy_to: 'sensor.sk_n_battery_in',
      },
    ],
    device_consumption: [],
  }),
  'recorder/statistics_during_period': statistics(NIGHT),
  'energy/fossil_energy_consumption': fossil,
});

/** The grid alone, with a boiler on its own meter. */
const GRID: Record<string, Rows> = {
  'sensor.sk_g_grid_in': buckets([1.2, 0.8, 1.5, 2.5]),
  'sensor.sk_g_boiler': buckets([0.5, 0.2, 0.4, 1.0]),
};
const gridOnly = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      { type: 'grid', stat_energy_from: 'sensor.sk_g_grid_in', stat_energy_to: null },
    ],
    device_consumption: [{ stat_consumption: 'sensor.sk_g_boiler', name: 'Boiler' }],
  }),
  'recorder/statistics_during_period': statistics(GRID),
  'energy/fossil_energy_consumption': fossil,
});

/** The sun and the grid, no battery, and no CO₂ signal in the house. */
const SUNNY: Record<string, Rows> = {
  'sensor.sk_s_grid_in': buckets([1.4, 0.2, 0, 1.6]),
  'sensor.sk_s_grid_out': buckets([0, 1.1, 2.6, 0]),
  'sensor.sk_s_solar': buckets([0, 3.4, 5.8, 0.2]),
};
const sunny = house(
  {
    'energy/get_prefs': () => ({
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.sk_s_grid_in',
          stat_energy_to: 'sensor.sk_s_grid_out',
        },
        { type: 'solar', stat_energy_from: 'sensor.sk_s_solar' },
      ],
    }),
    'recorder/statistics_during_period': statistics(SUNNY),
  },
  { co2: false },
);

/** A cabin off the grid: the sun and a battery. */
const CABIN: Record<string, Rows> = {
  'sensor.sk_c_solar': buckets([0, 1.8, 2.6, 0]),
  'sensor.sk_c_battery_out': buckets([0.9, 0, 0, 1.2]),
  'sensor.sk_c_battery_in': buckets([0, 0.6, 1.1, 0]),
};
const cabin = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      { type: 'solar', stat_energy_from: 'sensor.sk_c_solar' },
      {
        type: 'battery',
        stat_energy_from: 'sensor.sk_c_battery_out',
        stat_energy_to: 'sensor.sk_c_battery_in',
      },
    ],
  }),
  'recorder/statistics_during_period': statistics(CABIN),
});

/** The grid's import meter went quiet twelve minutes ago: the day's figures stop there, and the head says so. */
const DOWN: Record<string, Rows> = {
  'sensor.sk_d_grid_in': buckets([1.1, 0.4, 0.2, 0.9]),
  'sensor.sk_d_grid_out': buckets([0, 0.8, 1.9, 0]),
  'sensor.sk_d_solar': buckets([0, 3.1, 4.4, 0]),
  'sensor.sk_heat_pump_energy': DEVICES['sensor.sk_heat_pump_energy'] as Rows,
};
const down = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      {
        type: 'grid',
        stat_energy_from: 'sensor.sk_d_grid_in',
        stat_energy_to: 'sensor.sk_d_grid_out',
      },
      { type: 'solar', stat_energy_from: 'sensor.sk_d_solar' },
    ],
    device_consumption: [{ stat_consumption: 'sensor.sk_heat_pump_energy' }],
  }),
  'recorder/statistics_during_period': statistics(DOWN),
  'energy/fossil_energy_consumption': fossil,
});

/** No Energy dashboard at all. */
const bare = house({ 'energy/get_prefs': () => ({ energy_sources: [], device_consumption: [] }) });

/** An Energy dashboard whose statistics cannot be read (the recorder is down). */
const unread = house({
  'energy/get_prefs': () => ({
    energy_sources: [
      {
        type: 'grid',
        stat_energy_from: 'sensor.sk_u_grid_in',
        stat_energy_to: 'sensor.sk_u_grid_out',
      },
      { type: 'solar', stat_energy_from: 'sensor.sk_u_solar' },
    ],
  }),
  'recorder/statistics_during_period': () => {
    throw new Error('recorder unavailable');
  },
  'energy/fossil_energy_consumption': () => {
    throw new Error('recorder unavailable');
  },
});

const flowPrefs = (flow.ws?.['energy/get_prefs']?.({}) ?? {}) as Record<string, unknown>;
const flowStatistics = flow.ws?.['recorder/statistics_during_period'] ?? (() => ({}));

export const sheet: SheetSpec = {
  states: [
    // the flow sheet's house: its meters are the Energy dashboard's
    ...flow.states,
    ['sensor.sk_heat_pump_energy', '5.1', energy('Heat pump energy')],
    ['sensor.sk_car_energy', '3.8', energy('Car charger energy')],
    ['sensor.sk_kitchen_energy', '2.1', energy('Kitchen energy')],
    ['sensor.sk_oven_energy', '1.1', energy('Oven energy')],
    ['sensor.sk_washer_energy', '0.9', energy('Washing machine energy')],
    ['sensor.sk_fridge_energy', '0.4', energy('Fridge energy')],
    ['sensor.sk_long_energy', '2.7', energy('Underfloor heating in the ground-floor bathroom')],
    [
      'sensor.sk_co2',
      '42',
      {
        friendly_name: 'Grid fossil fuel percentage',
        unit_of_measurement: '%',
        state_class: 'measurement',
      },
    ],
    ['sensor.sk_n_grid_in', '6.7', energy('Grid import')],
    ['sensor.sk_n_grid_out', '2.0', energy('Grid export')],
    ['sensor.sk_n_solar', '9.0', energy('Solar')],
    ['sensor.sk_n_battery_out', '3.0', energy('Battery out')],
    ['sensor.sk_n_battery_in', '6.0', energy('Battery in')],
    ['sensor.sk_g_grid_in', '6.0', energy('Grid import')],
    ['sensor.sk_g_boiler', '2.1', energy('Boiler energy')],
    ['sensor.sk_s_grid_in', '3.2', energy('Grid import')],
    ['sensor.sk_s_grid_out', '3.7', energy('Grid export')],
    ['sensor.sk_s_solar', '9.4', energy('Solar')],
    ['sensor.sk_c_solar', '4.4', energy('Solar')],
    ['sensor.sk_c_battery_out', '2.1', energy('Battery out')],
    ['sensor.sk_c_battery_in', '1.7', energy('Battery in')],
    ['sensor.sk_d_grid_in', 'unavailable', energy('Grid import'), 720],
    ['sensor.sk_d_grid_out', '2.7', energy('Grid export')],
    ['sensor.sk_d_solar', '7.5', energy('Solar')],
    ['sensor.sk_u_grid_in', '2.0', energy('Grid import')],
    ['sensor.sk_u_grid_out', '1.0', energy('Grid export')],
    ['sensor.sk_u_solar', '5.0', energy('Solar')],
  ],

  registry: {
    entities: { 'sensor.sk_co2': { entity_id: 'sensor.sk_co2', platform: 'co2signal' } },
  },

  // the flow sheet's Energy dashboard with its devices (a superset: the flow reads it the same)
  ws: {
    'energy/get_prefs': () => ({
      ...flowPrefs,
      device_consumption: [
        { stat_consumption: 'sensor.sk_heat_pump_energy' },
        { stat_consumption: 'sensor.sk_car_energy', name: 'Car' },
        { stat_consumption: 'sensor.sk_kitchen_energy' },
        { stat_consumption: 'sensor.sk_oven_energy', included_in_stat: 'sensor.sk_kitchen_energy' },
      ],
    }),
    'recorder/statistics_during_period': (message) => {
      const flowRows = flowStatistics(message) as Record<string, Rows>;
      const own = statistics(DEVICES)(message) as Record<string, Rows>;
      return Object.fromEntries(
        Object.keys({ ...flowRows, ...own }).map((id) => [
          id,
          flowRows[id]?.length ? flowRows[id] : own[id],
        ]),
      );
    },
    'energy/fossil_energy_consumption': fossil,
  },

  frames: [
    {
      title: 'Where it went',
      cards: [{ type: 'custom:fluvy-energy-sankey-card', _now: NOW }],
    },
    {
      title: 'Where it went · as approved',
      cards: [{ type: 'custom:fluvy-energy-sankey-card', show_period: false, _now: NOW }],
    },
    {
      title: 'Devices of its own',
      cards: [
        {
          type: 'custom:fluvy-energy-sankey-card',
          title: 'Today',
          max_devices: 3,
          devices: [
            { entity: 'sensor.sk_heat_pump_energy', name: 'Heat pump' },
            { entity: 'sensor.sk_car_energy', name: 'Car' },
            'sensor.sk_kitchen_energy',
            { entity: 'sensor.sk_oven_energy', parent: 'sensor.sk_kitchen_energy' },
            'sensor.sk_washer_energy',
            'sensor.sk_fridge_energy',
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'The grid charges the battery',
      hass: night,
      cards: [{ type: 'custom:fluvy-energy-sankey-card', show_period: false, _now: NOW }],
    },
    {
      title: 'The grid alone',
      hass: gridOnly,
      cards: [{ type: 'custom:fluvy-energy-sankey-card', _now: NOW }],
    },
    {
      title: 'A meter down',
      hass: down,
      cards: [{ type: 'custom:fluvy-energy-sankey-card', show_period: false, _now: NOW }],
    },
    {
      title: 'A device that is not there',
      cards: [
        {
          type: 'custom:fluvy-energy-sankey-card',
          show_period: false,
          devices: ['sensor.sk_heat_pump_energy', 'sensor.sk_nowhere_energy'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Long names',
      cards: [
        {
          type: 'custom:fluvy-energy-sankey-card',
          title: 'Where the house’s energy went today',
          show_period: false,
          devices: [
            'sensor.sk_long_energy',
            { entity: 'sensor.sk_car_energy', name: 'Electric car charger in the garage' },
            'sensor.sk_washer_energy',
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Nothing configured',
      hass: bare,
      cards: [
        { type: 'custom:fluvy-energy-sankey-card', _now: NOW },
        { type: 'custom:fluvy-energy-score-card', _now: NOW },
      ],
    },
    {
      title: 'Statistics that cannot be read',
      hass: unread,
      cards: [
        { type: 'custom:fluvy-energy-sankey-card', show_period: false, _now: NOW },
        { type: 'custom:fluvy-energy-score-card', show_period: false, _now: NOW },
      ],
    },
    {
      title: 'A desktop column',
      width: 392,
      cards: [
        { type: 'custom:fluvy-energy-sankey-card', _now: NOW },
        { type: 'custom:fluvy-energy-score-card', _now: NOW },
      ],
    },
    {
      title: 'Half a column',
      cards: [
        // the flow sheet's half column: a short title of its own, as a card this narrow is given
        {
          type: 'custom:fluvy-energy-sankey-card',
          title: 'Energy',
          show_period: false,
          cols: 6,
          _now: NOW,
        },
        {
          type: 'custom:fluvy-energy-score-card',
          title: 'Score',
          show_period: false,
          cols: 6,
          _now: NOW,
        },
      ],
    },

    /* the score */
    {
      title: 'Energy score',
      cards: [{ type: 'custom:fluvy-energy-score-card', _now: NOW }],
    },
    {
      title: 'Energy score · as approved',
      cards: [{ type: 'custom:fluvy-energy-score-card', show_period: false, _now: NOW }],
    },
    {
      title: 'No battery, no CO₂ signal',
      hass: sunny,
      cards: [{ type: 'custom:fluvy-energy-score-card', show_period: false, _now: NOW }],
    },
    {
      title: 'No sun',
      hass: gridOnly,
      cards: [{ type: 'custom:fluvy-energy-score-card', show_period: false, _now: NOW }],
    },
    {
      title: 'Off grid',
      hass: cabin,
      cards: [
        { type: 'custom:fluvy-energy-score-card', title: 'Cabin', show_period: false, _now: NOW },
      ],
    },
    {
      title: 'The score with a meter down',
      hass: down,
      cards: [{ type: 'custom:fluvy-energy-score-card', show_period: false, _now: NOW }],
    },
    {
      title: 'The night the grid charged the battery',
      hass: night,
      cards: [{ type: 'custom:fluvy-energy-score-card', co2: 'sensor.sk_co2', _now: NOW }],
    },
  ],
};
