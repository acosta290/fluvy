import { FluvyRoundsCard } from '../../../../packages/cards/src/rounds/rounds-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as roomsCard } from './rooms-card.js';
import { sheet as thermostats } from './thermostats.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the Rounds sheet does
if (!customElements.get('fluvy-rounds-card'))
  customElements.define('fluvy-rounds-card', FluvyRoundsCard);

const ROUNDS = 'custom:fluvy-rounds-card';

/*
 * A round's gauge (#257, requested by @zokmedov): a reading drawn on the round itself — an arc round its edge, an arc
 * from zero, a sector, a flood. The issue's own "Quick picks" first, then every style across its range and past its
 * ends, either side of zero, in its thresholds' colours, on a round that is on, out of reach, in a key and on a row,
 * and inside a room's quick actions, the Rooms card (the rooms sheet's house) and a thermostat's own rounds (the
 * thermostats sheet's).
 */

/** A sensor's reading: its name, its figure, its unit and its class. */
const reading = (
  id: string,
  name: string,
  value: number | string,
  unit: string,
  device_class?: string,
): StateSeed => [
  `sensor.rg_${id}`,
  String(value),
  {
    friendly_name: name,
    unit_of_measurement: unit,
    state_class: 'measurement',
    ...(device_class ? { device_class } : {}),
  },
];

/** A share of a hundred at each stop of its range, and one past its end. */
const STOPS = [0, 25, 50, 100, 140] as const;
/** A room's drift at each stop either side of zero, in °C an hour (the issue's own: −2 to +2). */
const DRIFTS = [-2, -0.24, 0, 1.3, 2] as const;

/** A drift's two bands: cooling under zero, heating from it. */
const DRIFT_BANDS = [
  { value: 0, below: true, tone: 'cool', label: 'Cooling', icon: 'mdi:thermometer-chevron-down' },
  { value: 0, tone: 'heat', label: 'Heating', icon: 'mdi:thermometer-chevron-up' },
];
/** A battery's: fine from 50 %, a warning under 20 %, a danger under 10 %; between them, its own colour. */
const BATTERY_BANDS = [
  { value: 50, tone: 'ok', label: 'Fine' },
  { value: 20, below: true, tone: 'warning', label: 'Low' },
  { value: 10, below: true, tone: 'danger', label: 'Empty soon' },
];

const DRIFT = {
  entity: 'sensor.rg_bedroom_drift',
  gauge: 'zero',
  max: 2,
  decimals: 2,
  thresholds: DRIFT_BANDS,
};

/** The issue's five: a battery's arc, a drift from zero, a tank's sector, a battery's flood and a plain round. */
const QUICK_PICKS = [
  { entity: 'sensor.rg_tablet_battery', gauge: 'arc' },
  DRIFT,
  { entity: 'sensor.rg_hot_water', gauge: 'sector', min: 30, max: 90 },
  { entity: 'sensor.rg_doorbell_battery', gauge: 'fill' },
  'binary_sensor.rg_kitchen_leak',
];
const QUICK = { type: ROUNDS, title: 'Quick picks', items: QUICK_PICKS };

/** A style at every stop of its range, each round named by its reading. */
const across = (gauge: string) => ({
  type: ROUNDS,
  show_names: true,
  items: STOPS.map((stop) => ({ entity: `sensor.rg_stop_${stop}`, gauge })),
});

/** The house's batteries, each a flood in its band's colour: one fine, one in its own, one low, one nearly empty. */
const BATTERIES = ['tablet_battery', 'doorbell_battery', 'remote_battery', 'lock_battery'].map(
  (id) => ({ entity: `sensor.rg_${id}`, gauge: 'fill', thresholds: BATTERY_BANDS }),
);

/** The rooms sheet's house as its frames show it: its rooms, their floors and its dashboards. */
const house = roomsCard.frames.find((frame) => frame.title === 'The house')?.hass;

/** A living room's rounds: its humidity's arc, and its thermostat's own reading between 15 and 25 °C as a flood. */
const ROOM_ROUNDS = [
  { entity: 'sensor.rs_living_humidity', gauge: 'arc', tone: 'water' },
  {
    entity: 'climate.rs_living',
    gauge: 'fill',
    attribute: 'current_temperature',
    min: 15,
    max: 25,
  },
];

export const sheet: SheetSpec = {
  on: [roomsCard, thermostats],
  states: [
    reading('tablet_battery', 'Wall tablet', 72, '%', 'battery'),
    reading('doorbell_battery', 'Doorbell', 35, '%', 'battery'),
    reading('remote_battery', 'Remote', 16, '%', 'battery'),
    reading('lock_battery', 'Front door lock', 6, '%', 'battery'),
    reading('bedroom_drift', 'Bedroom drift', 0.42, '°C/h'),
    reading('hot_water', 'Hot water', 46, '°C', 'temperature'),
    reading('lounge_humidity', 'Lounge humidity', 48, '%', 'humidity'),
    reading('lounge_co2', 'Lounge CO₂', 640, 'ppm', 'carbon_dioxide'),
    reading('rain_tank', 'Rain tank', 1350, 'L'),
    reading('gone', 'Shed sensor', 'unavailable', '%', 'humidity'),
    reading('words', 'Washer', 'Rinsing', ''),
    reading('valve_bedroom', 'Bedroom valve', 0, '%'),
    reading('valve_kids', 'Kids room valve', 64, '%'),
    [
      'binary_sensor.rg_kitchen_leak',
      'off',
      { friendly_name: 'Kitchen leak', device_class: 'moisture', icon: 'mdi:water-alert' },
    ],
    ...STOPS.map((stop) => reading(`stop_${stop}`, `${stop} %`, stop, '%')),
    ...DRIFTS.map((drift, at) =>
      reading(`drift_${at}`, `${drift}`.replace('-', '−'), drift, '°C/h'),
    ),
    [
      'light.rg_desk_lamp',
      'on',
      {
        friendly_name: 'Desk lamp',
        supported_color_modes: ['brightness'],
        color_mode: 'brightness',
        brightness: 153,
      },
    ],
    [
      'fan.rg_ceiling_fan',
      'on',
      { friendly_name: 'Ceiling fan', percentage: 66, supported_features: 1 },
    ],
    ['switch.rg_heater', 'on', { friendly_name: 'Towel rail', current_power_w: 420 }],
    ['input_number.rg_volume', '7', { friendly_name: 'Doorbell volume', min: 0, max: 10, step: 1 }],
  ],
  frames: [
    // the issue's picture, redrawn: its four styles and a plain round, under its head
    { title: 'Quick picks · the issue’s five', cards: [QUICK] },
    { title: 'Quick picks · no head', cards: [{ type: ROUNDS, items: QUICK_PICKS }] },
    // every style at 0, 25, 50 and 100 % of its range, and past its end, where it stands on it
    { title: 'Arc · across its range', cards: [across('arc')] },
    { title: 'Sector · across its range', cards: [across('sector')] },
    { title: 'Fill · across its range', cards: [across('fill')] },
    // from zero: −2, −0.24, 0, +1.3 and +2 of ±2 °C an hour, cooling to the left and heating to the right
    {
      title: 'From zero · either side of it',
      cards: [
        {
          type: ROUNDS,
          show_names: true,
          items: DRIFTS.map((_, at) => ({ ...DRIFT, entity: `sensor.rg_drift_${at}` })),
        },
      ],
    },
    // a battery's flood in its band's colour: fine from 50 %, low under 20 %, nearly empty under 10 %
    {
      title: 'Thresholds · the house’s batteries',
      cards: [{ type: ROUNDS, title: 'Batteries', icon: 'battery', items: BATTERIES }],
    },
    {
      title: 'Thresholds · the batteries with their names and states',
      cards: [
        {
          type: ROUNDS,
          title: 'Batteries',
          icon: 'battery',
          variant: 'labels',
          show_names: true,
          items: BATTERIES.map((item, at) => ({ ...item, gauge: at % 2 ? 'arc' : 'fill' })),
        },
      ],
    },
    // on a round that is on, the gauge is drawn in the fill's ink: a lamp's brightness, a fan's speed, a plug's power
    {
      title: 'On a lit round',
      cards: [
        {
          type: ROUNDS,
          show_names: true,
          items: [
            { entity: 'light.rg_desk_lamp', gauge: 'arc', attribute: 'brightness', max: 255 },
            { entity: 'fan.rg_ceiling_fan', gauge: 'sector', attribute: 'percentage', max: 100 },
            { entity: 'switch.rg_heater', gauge: 'fill', attribute: 'current_power_w', max: 600 },
            { entity: 'input_number.rg_volume', gauge: 'arc' },
          ],
        },
      ],
    },
    // what a gauge cannot draw: out of reach its dashed ring alone; no number, or no range known, its track alone
    {
      title: 'Out of reach, no number, no range',
      cards: [
        {
          type: ROUNDS,
          show_names: true,
          items: [
            { entity: 'sensor.rg_gone', gauge: 'arc' },
            { entity: 'sensor.rg_words', gauge: 'arc', max: 100 },
            { entity: 'sensor.rg_rain_tank', gauge: 'arc' },
            { entity: 'sensor.rg_rain_tank', gauge: 'zero', name: 'From zero' },
            { entity: 'sensor.rg_rain_tank', gauge: 'fill', max: 2000, name: 'Of 2,000 L' },
          ],
        },
      ],
    },
    // a round's own colour and tone are its gauge's: the round itself stays at rest
    {
      title: 'In a colour of its own',
      cards: [
        {
          type: ROUNDS,
          items: [
            { entity: 'sensor.rg_lounge_humidity', gauge: 'arc', tone: 'water' },
            { entity: 'sensor.rg_lounge_humidity', gauge: 'sector', color: 'purple' },
            { entity: 'sensor.rg_lounge_humidity', gauge: 'fill', color: '#2e7d32' },
            { entity: 'sensor.rg_lounge_co2', gauge: 'arc', max: 2000, tone: 'ok' },
          ],
        },
      ],
    },
    // each saying its state: its key is its gauge's ground — and a row each, its gauge on its circle
    { title: 'Quick picks · labels', cards: [{ ...QUICK, variant: 'labels' }] },
    {
      title: 'Quick picks · labels and names',
      cards: [{ ...QUICK, variant: 'labels', show_names: true }],
    },
    { title: 'Quick picks · rows', cards: [{ ...QUICK, variant: 'row' }] },
    // half a section, on a phone and on a desktop
    {
      title: 'Quick picks · halves',
      cards: [
        { type: ROUNDS, items: QUICK_PICKS, cols: 6 },
        { ...QUICK, variant: 'labels', cols: 6 },
      ],
    },
    {
      title: 'Quick picks · rows in halves',
      cards: [
        { ...QUICK, variant: 'row', cols: 6 },
        { ...QUICK, show_names: true, cols: 6 },
      ],
    },
    // a room's quick actions: its humidity and its thermostat's own reading, plain, under their glyphs and beside
    {
      title: 'A room’s quick actions',
      ...(house ? { hass: house } : {}),
      cards: [
        {
          type: 'custom:fluvy-room-card',
          area: 'rs_living',
          variant: 'row',
          quick_actions: ROOM_ROUNDS,
        },
        {
          type: 'custom:fluvy-room-card',
          area: 'rs_living',
          variant: 'row',
          show_quick_states: true,
          quick_actions: ROOM_ROUNDS,
        },
        {
          type: 'custom:fluvy-room-card',
          area: 'rs_living',
          variant: 'row',
          show_quick_states: true,
          quick_state_position: 'beside',
          quick_actions: ROOM_ROUNDS,
        },
      ],
    },
    // a thermostat's own round: how far its valve is open
    {
      title: 'A thermostat’s rounds',
      cards: [
        {
          type: 'custom:fluvy-thermostats-card',
          thermostats: ['bedroom', 'kids'].map((room) => ({
            entity: `climate.ts_${room === 'kids' ? 'kids_room' : room}`,
            rounds: [{ entity: `sensor.rg_valve_${room}`, gauge: 'arc', tone: 'heat' }],
          })),
        },
      ],
    },
    // the Rooms card: a gauge among each room's rounds
    {
      title: 'The Rooms card',
      ...(house ? { hass: house } : {}),
      cards: [
        {
          type: 'custom:fluvy-rooms-card',
          rooms: [
            { area: 'rs_living', quick_actions: ['lights', ...ROOM_ROUNDS] },
            {
              area: 'rs_kitchen',
              quick_actions: [
                'lights',
                { entity: 'sensor.rs_kitchen_humidity', gauge: 'arc', tone: 'water' },
              ],
            },
          ],
        },
      ],
    },
  ],
};
