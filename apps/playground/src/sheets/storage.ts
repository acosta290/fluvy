import { FluvyBatteriesCard } from '../../../../packages/cards/src/batteries/batteries-card.js';
import { FluvyEvChargerCard } from '../../../../packages/cards/src/ev-charger/ev-charger-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-batteries-card'))
  customElements.define('fluvy-batteries-card', FluvyBatteriesCard);
if (!customElements.get('fluvy-ev-charger-card'))
  customElements.define('fluvy-ev-charger-card', FluvyEvChargerCard);

/** The mock's moment: "For 2 h 03 min" is counted from it. */
const NOW = '2026-09-17T21:47:12';

type Attributes = Record<string, unknown>;
const power = (name: string, unit: 'W' | 'kW' = 'W'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'power',
  state_class: 'measurement',
});
const level = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: '%',
  device_class: 'battery',
});
const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});
const select = (name: string, options: readonly string[]): Attributes => ({
  friendly_name: name,
  options: [...options],
});

/** Two batteries of 10 kWh charging from the sun: 64 % as one, full in 2 h 10 min. */
const pair = [
  {
    power: 'sensor.st_garage',
    level: 'sensor.st_garage_level',
    capacity: 10,
    name: 'Garage',
  },
  {
    power: 'sensor.st_basement',
    level: 'sensor.st_basement_level',
    capacity: 10,
    name: 'Basement',
  },
];

/** The wallbox of the approved sheet: the sun only, the target by 07:00. */
const wallbox = {
  type: 'custom:fluvy-ev-charger-card',
  entity: 'sensor.st_wallbox',
  level: 'sensor.st_car_level',
  target: 80,
  ready_by: '07:00',
  session_energy: 'sensor.st_session',
  status: 'sensor.st_wallbox_status',
  vehicle: 'Model 3',
  solar_share: 'sensor.st_solar_share',
  mode: 'select.st_wallbox_mode',
  _now: NOW,
};

export const sheet: SheetSpec = {
  states: [
    /* two batteries */
    ['sensor.st_garage', '-2200', power('Garage battery power')],
    ['sensor.st_garage_level', '72', level('Garage battery')],
    ['sensor.st_basement', '-1.12', power('Basement battery power', 'kW')],
    ['sensor.st_basement_level', '56', level('Basement battery')],

    /* one battery, discharging toward its reserve */
    ['sensor.st_one', '1200', power('Home battery power')],
    ['sensor.st_one_level', '81', level('Home battery')],

    /* one charging while the other discharges: the net charges */
    ['sensor.st_mix_a', '-800', power('Garage battery power')],
    ['sensor.st_mix_a_level', '48', level('Garage battery')],
    ['sensor.st_mix_b', '500', power('Shed battery power')],
    ['sensor.st_mix_b_level', '90', level('Shed battery')],

    /* one power unreadable, one level unreadable */
    ['sensor.st_down_a', 'unavailable', power('Garage battery power')],
    ['sensor.st_down_a_level', '66', level('Garage battery')],
    ['sensor.st_down_b', '-300', power('Basement battery power')],
    ['sensor.st_down_b_level', '52', level('Basement battery')],
    ['sensor.st_blind', '-400', power('Home battery power')],
    ['sensor.st_blind_level', 'unavailable', level('Home battery')],

    /* the Energy dashboard's two batteries */
    ['sensor.st_dash_a', '-1500', power('Powerwall power')],
    ['sensor.st_dash_a_level', '58', level('Powerwall')],
    ['sensor.st_dash_b', '-500', power('Garage battery power')],
    ['sensor.st_dash_b_level', '44', level('Garage battery')],
    ['sensor.st_dash_a_in', '3.1', energy('Powerwall in')],
    ['sensor.st_dash_a_out', '2.2', energy('Powerwall out')],

    /* modes */
    [
      'select.st_battery_mode',
      'self_use',
      select('Battery mode', ['self_use', 'backup', 'force_charge']),
    ],
    [
      'input_select.st_battery_program',
      'Self-consumption',
      select('Battery program', ['Self-consumption', 'Backup', 'Time of use', 'Feed-in first']),
    ],

    /* the wallbox */
    ['sensor.st_wallbox', '7.4', power('Wallbox power', 'kW')],
    ['sensor.st_car_level', '64', level('Model 3 battery')],
    ['sensor.st_session', '12.4', energy('Wallbox session energy')],
    ['sensor.st_wallbox_status', 'charging', { friendly_name: 'Wallbox status' }, 7380],
    [
      'sensor.st_solar_share',
      '96',
      { friendly_name: 'Wallbox solar share', unit_of_measurement: '%' },
    ],
    ['select.st_wallbox_mode', 'solar', select('Wallbox mode', ['off', 'solar', 'fast'])],

    /* the car powers the house */
    ['sensor.st_v2h', '-2.4', power('Bidirectional charger power', 'kW')],
    ['sensor.st_v2h_level', '58', level('Leaf battery')],
    ['sensor.st_v2h_status', 'discharging', { friendly_name: 'Charger status' }, 2400],

    /* plugged in, waiting */
    ['sensor.st_idle', '0', power('Garage charger power')],
    ['sensor.st_idle_level', '41', level('ID.4 battery')],
    ['sensor.st_idle_status', 'connected', { friendly_name: 'Garage charger status' }, 900],

    /* the target and the time from entities */
    ['sensor.st_ent', '11000', power('Driveway charger power')],
    ['sensor.st_ent_level', '35', level('Taycan battery')],
    [
      'number.st_ent_limit',
      '90',
      { friendly_name: 'Charge limit', unit_of_measurement: '%', min: 50, max: 100 },
    ],
    [
      'sensor.st_ent_ready',
      '2026-09-18T05:30:00+00:00',
      { friendly_name: 'Departure', device_class: 'timestamp' },
    ],
    ['select.st_evcc_mode', 'pv', select('Charging mode', ['off', 'pv', 'minpv', 'now'])],
    ['select.st_paused_mode', 'off', select('Wallbox mode', ['off', 'solar', 'fast'])],
    ['sensor.st_paused', '0', power('Garage charger power')],
    ['sensor.st_paused_status', 'Paused', { friendly_name: 'Garage charger status' }],

    /* unreadable */
    ['sensor.st_dead', 'unavailable', power('Carport charger power')],
    ['sensor.st_dead_level', '77', level('Car battery')],
    ['sensor.st_blind_car', '3.6', power('Carport charger power', 'kW')],
    ['sensor.st_blind_car_level', 'unavailable', level('Car battery')],
  ],

  ws: {
    'energy/get_prefs': () => ({
      energy_sources: [
        {
          type: 'battery',
          stat_energy_from: 'sensor.st_dash_a_out',
          stat_energy_to: 'sensor.st_dash_a_in',
          stat_rate: 'sensor.st_dash_a',
          stat_soc: 'sensor.st_dash_a_level',
          capacity: 13.5,
        },
        {
          type: 'battery',
          stat_rate: 'sensor.st_dash_b',
          stat_soc: 'sensor.st_dash_b_level',
          capacity: 5,
        },
      ],
      device_consumption: [],
    }),
  },

  frames: [
    /* ---------------------------------------------------------------- batteries */
    {
      title: 'Batteries',
      cards: [{ type: 'custom:fluvy-batteries-card', batteries: pair, reserve: 20 }],
    },
    {
      title: 'One battery',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [{ power: 'sensor.st_one', level: 'sensor.st_one_level', capacity: 13.5 }],
          reserve: 20,
        },
      ],
    },
    {
      title: 'From the Energy dashboard',
      cards: [{ type: 'custom:fluvy-batteries-card' }],
    },
    {
      title: 'Charging and discharging at once',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [
            { power: 'sensor.st_mix_a', level: 'sensor.st_mix_a_level', capacity: 10 },
            { power: 'sensor.st_mix_b', level: 'sensor.st_mix_b_level', capacity: 5 },
          ],
        },
      ],
    },
    {
      title: 'No capacity',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [
            { power: 'sensor.st_mix_a', level: 'sensor.st_mix_a_level' },
            { power: 'sensor.st_mix_b', level: 'sensor.st_mix_b_level' },
          ],
        },
      ],
    },
    {
      title: 'A power unavailable',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [
            { power: 'sensor.st_down_a', level: 'sensor.st_down_a_level', capacity: 10 },
            { power: 'sensor.st_down_b', level: 'sensor.st_down_b_level', capacity: 10 },
          ],
          reserve: 10,
        },
      ],
    },
    {
      title: 'The charge unavailable',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [{ power: 'sensor.st_blind', level: 'sensor.st_blind_level', capacity: 10 }],
          reserve: 20,
        },
      ],
    },
    {
      title: 'A missing sensor',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [
            ...pair,
            { power: 'sensor.st_gone', level: 'sensor.st_gone_level', name: 'Shed' },
          ],
        },
      ],
    },
    {
      title: 'Its mode',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: pair,
          reserve: 20,
          mode: 'select.st_battery_mode',
        },
      ],
    },
    {
      title: 'Four programs',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [{ power: 'sensor.st_one', level: 'sensor.st_one_level', capacity: 13.5 }],
          mode: 'input_select.st_battery_program',
        },
      ],
    },
    {
      title: 'Long names',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          title: 'Storage in the garage and the basement',
          batteries: [
            { ...pair[0], name: 'The garage battery beside the workbench' },
            { ...pair[1], name: 'The basement battery under the stairs' },
          ],
          reserve: 20,
        },
      ],
    },
    {
      title: 'Batteries · a desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: pair,
          reserve: 20,
          mode: 'select.st_battery_mode',
        },
      ],
    },
    {
      title: 'Batteries · half a column',
      cards: [
        {
          type: 'custom:fluvy-batteries-card',
          batteries: pair,
          reserve: 20,
          mode: 'select.st_battery_mode',
          cols: 6,
        },
        {
          type: 'custom:fluvy-batteries-card',
          batteries: [{ power: 'sensor.st_one', level: 'sensor.st_one_level', capacity: 13.5 }],
          reserve: 20,
          cols: 6,
        },
      ],
    },

    /* ---------------------------------------------------------------- the car */
    {
      title: 'Car charger',
      cards: [wallbox],
    },
    {
      title: 'The car powers the house',
      cards: [
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_v2h',
          name: 'Carport',
          level: 'sensor.st_v2h_level',
          status: 'sensor.st_v2h_status',
          vehicle: 'Leaf',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Plugged in, waiting',
      cards: [
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_idle',
          level: 'sensor.st_idle_level',
          target: 80,
          ready_by: '07:30',
          status: 'sensor.st_idle_status',
          vehicle: 'ID.4',
          _now: NOW,
        },
      ],
    },
    {
      title: 'The target and the time from entities',
      cards: [
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_ent',
          level: 'sensor.st_ent_level',
          target: 'number.st_ent_limit',
          ready_by: 'sensor.st_ent_ready',
          mode: 'select.st_evcc_mode',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Just the power',
      cards: [{ type: 'custom:fluvy-ev-charger-card', entity: 'sensor.st_wallbox', _now: NOW }],
    },
    {
      title: 'The charger unavailable',
      cards: [
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_dead',
          level: 'sensor.st_dead_level',
          target: 80,
          _now: NOW,
        },
      ],
    },
    {
      title: 'The car’s charge unavailable',
      cards: [
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_blind_car',
          level: 'sensor.st_blind_car_level',
          target: 80,
          session_energy: 'sensor.st_session',
          _now: NOW,
        },
      ],
    },
    {
      title: 'A missing charger',
      cards: [
        { type: 'custom:fluvy-ev-charger-card', entity: 'sensor.st_nowhere', _now: NOW },
        { type: 'custom:fluvy-ev-charger-card', _now: NOW },
      ],
    },
    {
      title: 'The car · long names',
      cards: [
        {
          ...wallbox,
          name: 'The wallbox on the north wall of the garage',
          vehicle: 'Volkswagen ID. Buzz Pro long wheelbase',
        },
      ],
    },
    {
      title: 'The car · a desktop column',
      width: 392,
      cards: [wallbox],
    },
    {
      title: 'The car · half a column',
      cards: [
        { ...wallbox, cols: 6 },
        {
          type: 'custom:fluvy-ev-charger-card',
          entity: 'sensor.st_v2h',
          name: 'Carport',
          level: 'sensor.st_v2h_level',
          status: 'sensor.st_v2h_status',
          vehicle: 'Leaf',
          _now: NOW,
          cols: 6,
        },
      ],
    },
    {
      title: 'The car · paused, half a column',
      cards: [
        {
          ...wallbox,
          entity: 'sensor.st_paused',
          status: 'sensor.st_paused_status',
          mode: 'select.st_paused_mode',
          cols: 6,
        },
      ],
    },
  ],
};
