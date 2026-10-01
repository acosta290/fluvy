import { FluvyEnergyDevicesCard } from '../../../../packages/cards/src/energy-devices/energy-devices-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-energy-devices-card'))
  customElements.define('fluvy-energy-devices-card', FluvyEnergyDevicesCard);

/**
 * Where it goes, nested (1.4): the approved figure's day — 13.4 kWh through the house's meter, 11.0 of it through the
 * heat pump, the car and the kitchen, the kitchen's oven and dishwasher inside its 2.1. What nobody measures is said:
 * 0.5 kWh of the kitchen, 2.4 of the house (82 % measured).
 */
const NOW = '2026-09-17T21:47:12';

type Attributes = Record<string, unknown>;
const today = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});
const power = (name: string, unit: 'W' | 'kW' = 'W'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'power',
  state_class: 'measurement',
});

const kitchen = (extra: Record<string, unknown> = {}) => [
  { entity: 'sensor.nd_heat_pump', name: 'Heat pump', icon: 'heater' },
  { entity: 'sensor.nd_car', name: 'Car', icon: 'car' },
  { entity: 'sensor.nd_kitchen', name: 'Kitchen', icon: 'plug' },
  { entity: 'sensor.nd_oven', name: 'Oven', icon: 'flame', parent: 'sensor.nd_kitchen' },
  {
    entity: 'sensor.nd_dishwasher',
    name: 'Dishwasher',
    icon: 'plug',
    parent: 'sensor.nd_kitchen',
    ...extra,
  },
];

/** The Energy dashboard's day in four buckets (night, morning, afternoon, evening), kWh each. */
const DAY = Date.parse('2026-09-16T22:00:00Z');
const buckets = (values: readonly number[]): { start: number; end: number; change: number }[] =>
  values.map((change, i) => ({
    start: DAY + i * 6 * 3600_000,
    end: DAY + (i + 1) * 6 * 3600_000,
    change,
  }));
const STATS: Record<string, { start: number; end: number; change: number }[]> = {
  // the house: 6.0 in from the grid, 8.0 from the sun, 0.6 back out: 13.4 used
  'sensor.nd_grid_in': buckets([2.4, 0.6, 0.2, 2.8]),
  'sensor.nd_grid_out': buckets([0, 0.2, 0.4, 0]),
  'sensor.nd_solar': buckets([0, 3.2, 4.8, 0]),
  'sensor.nd_heat_pump_total': buckets([1.6, 1.0, 0.9, 1.6]),
  'sensor.nd_car_total': buckets([3.8, 0, 0, 0]),
  'sensor.nd_kitchen_total': buckets([0.1, 0.6, 0.4, 1.0]),
  'sensor.nd_oven_total': buckets([0, 0.3, 0, 0.6]),
  'sensor.nd_dishwasher_total': buckets([0, 0.1, 0.2, 0.4]),
};

export const sheet: SheetSpec = {
  states: [
    ['sensor.nd_house', '13.4', today('House energy today')],
    ['sensor.nd_heat_pump', '5.1', today('Heat pump energy today')],
    ['sensor.nd_car', '3.8', today('Car charger energy today')],
    ['sensor.nd_kitchen', '2.1', today('Kitchen circuit energy today')],
    ['sensor.nd_oven', '0.9', today('Oven energy today')],
    ['sensor.nd_dishwasher', '0.7', today('Dishwasher energy today')],
    ['sensor.nd_dishwasher_dead', 'unavailable', today('Dishwasher energy today')],
    ['sensor.nd_kettle', '0.3', today('Kettle energy today')],
    ['sensor.nd_counter', '0.5', today('Counter sockets energy today')],

    /* power, now */
    ['sensor.nd_house_power', '2.3', power('House power', 'kW')],
    ['sensor.nd_heat_pump_power', '1200', power('Heat pump power')],
    ['sensor.nd_kitchen_power', '850', power('Kitchen circuit power')],
    ['sensor.nd_oven_power', '600', power('Oven power')],
    ['sensor.nd_kettle_power', '0', power('Kettle power')],

    /* the Energy dashboard's meters (lifetime totals: the card reads their change today) */
    ['sensor.nd_grid_in', '8123.4', today('Grid import')],
    ['sensor.nd_grid_out', '1320.8', today('Grid export')],
    ['sensor.nd_solar', '14022.1', today('Solar production')],
    ['sensor.nd_heat_pump_total', '4211.9', today('Heat pump energy')],
    ['sensor.nd_car_total', '2310.2', today('Car charger energy')],
    ['sensor.nd_kitchen_total', '1802.6', today('Kitchen circuit energy')],
    ['sensor.nd_oven_total', '640.3', today('Oven energy')],
    ['sensor.nd_dishwasher_total', '512.7', today('Dishwasher energy')],
  ],

  ws: {
    'energy/get_prefs': () => ({
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.nd_grid_in',
          stat_energy_to: 'sensor.nd_grid_out',
        },
        { type: 'solar', stat_energy_from: 'sensor.nd_solar' },
      ],
      device_consumption: [
        { stat_consumption: 'sensor.nd_heat_pump_total', name: 'Heat pump' },
        { stat_consumption: 'sensor.nd_car_total' },
        { stat_consumption: 'sensor.nd_kitchen_total', name: 'Kitchen' },
        {
          stat_consumption: 'sensor.nd_oven_total',
          name: 'Oven',
          included_in_stat: 'sensor.nd_kitchen_total',
        },
        {
          stat_consumption: 'sensor.nd_dishwasher_total',
          name: 'Dishwasher',
          included_in_stat: 'sensor.nd_kitchen_total',
        },
      ],
    }),
    'recorder/statistics_during_period': (message) =>
      Object.fromEntries(
        ((message['statistic_ids'] as string[] | undefined) ?? []).map((id) => [
          id,
          STATS[id] ?? [],
        ]),
      ),
  },

  frames: [
    {
      title: 'Where it goes',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Where it goes',
          total: 'sensor.nd_house',
          rows: kitchen(),
        },
      ],
    },
    {
      title: 'No house meter',
      cards: [
        { type: 'custom:fluvy-energy-devices-card', title: 'Where it goes', rows: kitchen() },
      ],
    },
    {
      title: 'From the Energy dashboard',
      cards: [{ type: 'custom:fluvy-energy-devices-card', title: 'Where it goes', _now: NOW }],
    },
    {
      title: 'Power, now',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Power',
          total: 'sensor.nd_house_power',
          rows: [
            { entity: 'sensor.nd_heat_pump_power', name: 'Heat pump', icon: 'heater' },
            { entity: 'sensor.nd_kitchen_power', name: 'Kitchen', icon: 'plug' },
            {
              entity: 'sensor.nd_oven_power',
              name: 'Oven',
              icon: 'flame',
              parent: 'sensor.nd_kitchen_power',
            },
            {
              entity: 'sensor.nd_kettle_power',
              name: 'Kettle',
              icon: 'plug',
              parent: 'sensor.nd_kitchen_power',
            },
          ],
        },
      ],
    },
    {
      title: 'A device unreadable',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Where it goes',
          total: 'sensor.nd_house',
          rows: [
            ...kitchen().slice(0, 4),
            {
              entity: 'sensor.nd_dishwasher_dead',
              name: 'Dishwasher',
              icon: 'plug',
              parent: 'sensor.nd_kitchen',
            },
          ],
        },
      ],
    },
    {
      title: 'Two levels, a parent not listed',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Kitchen',
          sort: false,
          rows: [
            { entity: 'sensor.nd_kitchen', name: 'Kitchen', icon: 'plug' },
            { entity: 'sensor.nd_oven', name: 'Oven', icon: 'flame', parent: 'sensor.nd_kitchen' },
            {
              entity: 'sensor.nd_counter',
              name: 'Counter sockets',
              icon: 'plug',
              parent: 'sensor.nd_kitchen',
            },
            {
              entity: 'sensor.nd_kettle',
              name: 'Kettle',
              icon: 'plug',
              parent: 'sensor.nd_counter',
            },
            // its parent is not on the card: it stands at the top
            { entity: 'sensor.nd_car', name: 'Car', icon: 'car', parent: 'sensor.nd_garage' },
          ],
        },
      ],
    },
    {
      title: 'Long names',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Where the energy of the whole house went today',
          total: 'sensor.nd_house',
          rows: [
            { entity: 'sensor.nd_heat_pump', icon: 'heater' },
            { entity: 'sensor.nd_kitchen', icon: 'plug' },
            { entity: 'sensor.nd_oven', icon: 'flame', parent: 'sensor.nd_kitchen' },
            { entity: 'sensor.nd_dishwasher', icon: 'plug', parent: 'sensor.nd_kitchen' },
          ],
        },
      ],
    },
    {
      title: 'A desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Where it goes',
          total: 'sensor.nd_house',
          rows: kitchen(),
        },
      ],
    },
    {
      title: 'Half a column',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Kitchen',
          cols: 6,
          rows: kitchen().slice(2),
        },
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'House',
          total: 'sensor.nd_house',
          cols: 6,
          rows: kitchen().slice(0, 2),
        },
      ],
    },
  ],
};
