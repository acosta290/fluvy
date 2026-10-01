import { FluvyMetersCard } from '../../../../packages/cards/src/meters/meters-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-meters-card'))
  customElements.define('fluvy-meters-card', FluvyMetersCard);

/**
 * Water & gas (1.4): the approved figure's house at 21:47 — 84 L of water against a typical 150 L (the mean of its
 * last seven days), 2.7 m³ of gas against the 3.0 m³ its card was given, the leak sensor dry, the main valve open.
 */
const NOW = '2026-09-17T21:47:12';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Attributes = Record<string, unknown>;
const meter = (name: string, unit: string, kind: 'water' | 'gas'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: kind,
  state_class: 'total_increasing',
});
const flow = (name: string, unit: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'volume_flow_rate',
  state_class: 'measurement',
});

interface Row {
  start: number;
  end: number;
  change: number;
  state: number;
}

/**
 * A meter's statistics as the recorder keeps them: from the hour the card asks from (23:00 the evening before), one
 * row per compiled hour — the last one 20:00–21:00 — each ending on the reading `opening` plus what came before.
 */
const hours = (
  message: Record<string, unknown>,
  opening: number,
  changes: readonly number[],
): Row[] => {
  const from = Date.parse(String(message['start_time']));
  let state = opening;
  const out: Row[] = [{ start: from, end: from + HOUR, change: 0.1, state }];
  changes.forEach((change, i) => {
    state = Math.round((state + change) * 1000) / 1000;
    out.push({ start: from + (i + 1) * HOUR, end: from + (i + 2) * HOUR, change, state });
  });
  return out;
};
/** The last seven full days, one row each. */
const days = (message: Record<string, unknown>, changes: readonly number[]): Row[] => {
  const from = Date.parse(String(message['start_time']));
  return changes.map((change, i) => ({
    start: from + i * DAY,
    end: from + (i + 1) * DAY,
    change,
    state: 0,
  }));
};

/** 21 compiled hours of water (80 L), the meter 4 L on since: 84 L today. Its week: a mean of 150 L. */
const WATER_HOURS = [0, 0, 0, 0, 0, 0, 4, 18, 9, 3, 2, 1, 6, 5, 2, 1, 2, 3, 6, 11, 7];
/** 21 compiled hours of gas (2.3 m³), 0.4 m³ since: 2.7 m³ today. */
const GAS_HOURS = [
  0.05, 0.05, 0.05, 0.05, 0.1, 0.1, 0.25, 0.3, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1,
  0.2, 0.25, 0.2, 0.05,
];

const TODAY: Record<string, (message: Record<string, unknown>) => Row[]> = {
  'sensor.mt_water': (m) => hours(m, 48_126, WATER_HOURS),
  'sensor.mt_gas': (m) => hours(m, 1529.7, GAS_HOURS),
  'sensor.mt_water_long': (m) => hours(m, 48_126, WATER_HOURS),
  'sensor.mt_gas_long': (m) => hours(m, 1529.7, GAS_HOURS),
  'sensor.mt_garden': (m) =>
    hours(
      m,
      212.3,
      WATER_HOURS.map((v) => v / 100),
    ),
  'sensor.mt_gas_kwh': (m) =>
    hours(
      m,
      16_402,
      GAS_HOURS.map((v) => v * 10.5),
    ),
};
const WEEK: Record<string, (message: Record<string, unknown>) => Row[]> = {
  'sensor.mt_water': (m) => days(m, [140, 165, 150, 138, 160, 147, 150]),
  'sensor.mt_water_long': (m) => days(m, [140, 165, 150, 138, 160, 147, 150]),
  'sensor.mt_gas_kwh': (m) => days(m, [29, 33, 31, 30, 28, 32, 34]),
  // a meter added three days ago: the mean of the days there are
  'sensor.mt_garden': (m) => days(m, [0.3, 0.9, 0.6]),
};

export const sheet: SheetSpec = {
  states: [
    ['sensor.mt_water', '48210', meter('Water meter', 'L', 'water')],
    ['sensor.mt_water_flow', '6', flow('Water flow', 'L/min')],
    ['sensor.mt_gas', '1532.4', meter('Gas meter', 'm³', 'gas')],
    ['sensor.mt_gas_flow', '0.4', flow('Gas flow', 'm³/h')],
    [
      'binary_sensor.mt_leak',
      'off',
      { friendly_name: 'Leak sensor', device_class: 'moisture' },
      432,
    ],
    ['valve.mt_main', 'open', { friendly_name: 'Main valve', device_class: 'water' }],

    /* the hard ones */
    ['sensor.mt_water_dead', 'unavailable', meter('Water meter', 'L', 'water')],
    ['sensor.mt_flow_dead', 'unavailable', flow('Water flow', 'L/min')],
    ['sensor.mt_nostats', '812.5', meter('Well pump meter', 'm³', 'water')],
    [
      'binary_sensor.mt_leak_wet',
      'on',
      { friendly_name: 'Leak under the sink', device_class: 'moisture' },
      30,
    ],
    ['valve.mt_main_closed', 'closed', { friendly_name: 'Main valve', device_class: 'water' }],
    [
      'sensor.mt_pressure',
      '3.1',
      { friendly_name: 'Water pressure', unit_of_measurement: 'bar', device_class: 'pressure' },
    ],

    /* long names, a garden tap in m³ beside the house in litres, gas billed in kWh */
    ['sensor.mt_water_long', '48210', meter('Water meter', 'L', 'water')],
    ['sensor.mt_gas_long', '1532.4', meter('Gas meter', 'm³', 'gas')],
    ['sensor.mt_garden', '213.12', meter('Garden tap', 'm³', 'water')],
    ['sensor.mt_gas_kwh', '16430.35', meter('Gas', 'kWh', 'gas')],
    [
      'binary_sensor.mt_leak_long',
      'off',
      {
        friendly_name: 'Leak sensor under the dishwasher in the kitchen',
        device_class: 'moisture',
      },
      432,
    ],
    [
      'valve.mt_main_long',
      'open',
      { friendly_name: 'Main water valve in the utility room downstairs', device_class: 'water' },
    ],
  ],

  registry: {
    entities: {
      'binary_sensor.mt_leak': { entity_id: 'binary_sensor.mt_leak', area_id: 'mt_kitchen' },
      'binary_sensor.mt_leak_wet': {
        entity_id: 'binary_sensor.mt_leak_wet',
        area_id: 'mt_kitchen',
      },
      'binary_sensor.mt_leak_long': {
        entity_id: 'binary_sensor.mt_leak_long',
        area_id: 'mt_kitchen',
      },
    },
    areas: { mt_kitchen: { area_id: 'mt_kitchen', name: 'Kitchen' } },
  },

  ws: {
    'energy/get_prefs': () => ({
      energy_sources: [
        { type: 'water', stat_energy_from: 'sensor.mt_water' },
        { type: 'gas', stat_energy_from: 'sensor.mt_gas' },
        // an imported statistic: no reading of its own, left out
        { type: 'water', stat_energy_from: 'utility:water_bill' },
      ],
      device_consumption: [],
    }),
    'recorder/statistics_during_period': (message) => {
      const ids = (message['statistic_ids'] as string[] | undefined) ?? [];
      const table = message['period'] === 'day' ? WEEK : TODAY;
      return Object.fromEntries(ids.map((id) => [id, table[id]?.(message) ?? []]));
    },
  },

  frames: [
    {
      title: 'Water & gas',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [
            { entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' },
            { entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 },
          ],
          rows: ['binary_sensor.mt_leak', { entity: 'valve.mt_main', icon: 'sliders' }],
          _now: NOW,
        },
      ],
    },
    {
      title: 'From the Energy dashboard',
      cards: [{ type: 'custom:fluvy-meters-card', _now: NOW }],
    },
    {
      title: 'Gas only',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [{ entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 }],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Rows',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          variant: 'rows',
          meters: [
            { entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' },
            { entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 },
          ],
          rows: [{ entity: 'valve.mt_main', icon: 'sliders' }],
          _now: NOW,
        },
      ],
    },
    {
      title: 'A leak, the valve closed',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [{ entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' }],
          rows: [
            'binary_sensor.mt_leak_wet',
            { entity: 'valve.mt_main_closed', icon: 'sliders' },
            'sensor.mt_pressure',
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Unreadable',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [
            { entity: 'sensor.mt_water_dead', rate: 'sensor.mt_flow_dead', typical: 150 },
            { entity: 'sensor.mt_gas', rate: 'sensor.mt_flow_dead', typical: 3 },
            { entity: 'sensor.mt_nostats', name: 'Well' },
            { entity: 'sensor.mt_nowhere', kind: 'water', name: 'Garden' },
          ],
          rows: ['binary_sensor.mt_nowhere'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Three meters, three units',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [
            { entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow', name: 'House' },
            { entity: 'sensor.mt_garden', name: 'Garden' },
            { entity: 'sensor.mt_gas_kwh' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Long names',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          title: 'Water and gas in the house and the garden',
          meters: [
            {
              entity: 'sensor.mt_water_long',
              rate: 'sensor.mt_water_flow',
              name: 'Cold water, main line',
            },
            {
              entity: 'sensor.mt_gas_long',
              rate: 'sensor.mt_gas_flow',
              typical: 3,
              name: 'Gas for the boiler and the hob',
            },
          ],
          rows: ['binary_sensor.mt_leak_long', 'valve.mt_main_long'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'A desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [
            { entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' },
            { entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 },
          ],
          rows: ['binary_sensor.mt_leak', { entity: 'valve.mt_main', icon: 'sliders' }],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Half a column',
      cards: [
        {
          type: 'custom:fluvy-meters-card',
          meters: [{ entity: 'sensor.mt_water', rate: 'sensor.mt_water_flow' }],
          cols: 6,
          _now: NOW,
        },
        {
          type: 'custom:fluvy-meters-card',
          meters: [{ entity: 'sensor.mt_gas', rate: 'sensor.mt_gas_flow', typical: 3 }],
          rows: [{ entity: 'valve.mt_main', icon: 'sliders' }],
          cols: 6,
          _now: NOW,
        },
      ],
    },
  ],
};
