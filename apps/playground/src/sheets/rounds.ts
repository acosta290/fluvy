import { FluvyRoundsCard } from '../../../../packages/cards/src/rounds/rounds-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as lists } from './lists.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the web page sheet does
if (!customElements.get('fluvy-rounds-card'))
  customElements.define('fluvy-rounds-card', FluvyRoundsCard);

const ROUNDS = 'custom:fluvy-rounds-card';

/**
 * The reporter's "Quick picks" (#224), as the issue writes them, on the lists' house: the kitchen light and the
 * washing machine on their plugs, the kitchen window, the hall's motion, the front door's lock and the garden pump's
 * plug, gone since the storm.
 */
const QUICK_PICKS = [
  'switch.kitchen_light',
  'switch.washer',
  'binary_sensor.kitchen_window',
  'binary_sensor.motion_hall',
  'lock.front_door',
  'switch.ghost',
];
/** An evening in the lounge: a lamp at 60 %, the blinds at 70 %, the fan at a third, the TV, a scene and the humidity. */
const LOUNGE = [
  'light.rd_lounge_lamp',
  'cover.rd_lounge_blinds',
  'fan.rd_ceiling_fan',
  'media_player.rd_tv',
  'scene.rd_movie_night',
  'sensor.rd_lounge_humidity',
];
const QUICK = { type: ROUNDS, title: 'Quick picks', items: QUICK_PICKS };

/**
 * The Rounds card (#224): any entities as rounds, lit while on with their ring, the dashed ring out of reach; a tap
 * flips what is safe to flip (a lock locks, and asks before it unlocks), a hold opens the details. Its three layouts —
 * rounds, with their names, with their states, a row each — with a head and without, from the line's start, in its
 * middle and from edge to edge, at a phone's column and in half a section, two locks to tap.
 */
export const sheet: SheetSpec = {
  on: [lists],
  states: [
    ['lock.rd_back_door', 'unlocked', { friendly_name: 'Back door' }],
    [
      'light.rd_lounge_lamp',
      'on',
      {
        friendly_name: 'Lounge lamp',
        supported_color_modes: ['color_temp'],
        color_mode: 'color_temp',
        brightness: 153,
        color_temp_kelvin: 2700,
        rgb_color: [255, 167, 87],
      },
    ],
    [
      'cover.rd_lounge_blinds',
      'open',
      { friendly_name: 'Lounge blinds', current_position: 70, supported_features: 15 },
    ],
    [
      'fan.rd_ceiling_fan',
      'on',
      { friendly_name: 'Ceiling fan', percentage: 33, supported_features: 1 },
    ],
    [
      'media_player.rd_tv',
      'off',
      { friendly_name: 'TV', device_class: 'tv', supported_features: 21437 },
    ],
    ['scene.rd_movie_night', '2026-09-17T18:31:00+00:00', { friendly_name: 'Movie night' }],
    // the docs' own example (the gallery's): a wall tablet low on charge and the lounge's air, each with a gauge
    [
      'sensor.tablet_battery',
      '18',
      {
        friendly_name: 'Wall tablet',
        device_class: 'battery',
        unit_of_measurement: '%',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.lounge_humidity',
      '48',
      {
        friendly_name: 'Lounge humidity',
        device_class: 'humidity',
        unit_of_measurement: '%',
        state_class: 'measurement',
      },
    ],
    [
      'sensor.rd_lounge_humidity',
      '48',
      {
        friendly_name: 'Lounge humidity',
        device_class: 'humidity',
        unit_of_measurement: '%',
        state_class: 'measurement',
      },
    ],
  ],
  frames: [
    // the issue's own: a head that says how many are on, the rounds from the line's start
    { title: 'Quick picks', cards: [QUICK] },
    { title: 'Quick picks · no head', cards: [{ type: ROUNDS, items: QUICK_PICKS }] },
    { title: 'Quick picks · names', cards: [{ ...QUICK, show_names: true }] },
    { title: 'Quick picks · labels', cards: [{ ...QUICK, variant: 'labels' }] },
    {
      title: 'Quick picks · labels and names',
      cards: [{ ...QUICK, variant: 'labels', show_names: true }],
    },
    { title: 'Quick picks · rows', cards: [{ ...QUICK, variant: 'row' }] },
    // half a section on a phone and on a desktop: the rounds take the lines they need, a row each its rounds' way
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
    // a lounge in the evening: a lamp's ring its brightness, the blinds' their position, the fan's its speed; a
    // round's own name, icon and colour, and its state where it asks for it
    {
      title: 'Lounge',
      cards: [
        {
          type: ROUNDS,
          title: 'Lounge',
          icon: 'mdi:sofa',
          show_names: true,
          items: [
            ...LOUNGE.slice(0, 4),
            { entity: 'scene.rd_movie_night', icon: 'film' },
            { entity: 'sensor.rd_lounge_humidity', name: 'Humidity', show_state: true },
          ],
        },
      ],
    },
    // …each saying its state in its key: the lamp's brightness, the blinds' position, the fan's speed, the TV off, the
    // patio door unlocked, the air's humidity; every key as wide as the widest
    {
      title: 'Lounge · labels',
      cards: [
        {
          type: ROUNDS,
          title: 'Lounge',
          icon: 'mdi:sofa',
          variant: 'labels',
          show_names: true,
          items: [
            ...LOUNGE.slice(0, 4),
            { entity: 'lock.rd_back_door', name: 'Patio door' },
            { entity: 'sensor.rd_lounge_humidity', name: 'Humidity' },
          ],
        },
      ],
    },
    // where they stand on their line: in its middle, from edge to edge, three a line
    {
      title: 'Align · center',
      cards: [{ type: ROUNDS, items: LOUNGE.slice(0, 4), align: 'center' }],
    },
    {
      title: 'Align · spread',
      cards: [{ type: ROUNDS, items: LOUNGE.slice(0, 4), align: 'spread' }],
    },
    {
      title: 'Columns · 3',
      cards: [{ type: ROUNDS, items: LOUNGE, columns: 3, show_names: true }],
    },
    // two locks: the back door locks at a tap, the front door asks first
    {
      title: 'Locks',
      cards: [
        {
          type: ROUNDS,
          title: 'Doors',
          icon: 'lock',
          variant: 'labels',
          show_names: true,
          items: ['lock.front_door', 'lock.rd_back_door'],
        },
      ],
    },
    { title: 'Empty', cards: [{ type: ROUNDS, title: 'Quick picks', items: [] }] },
  ],
};
