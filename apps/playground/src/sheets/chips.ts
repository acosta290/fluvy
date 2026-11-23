import { parseBackground, type LovelaceCardConfig } from '@fluvy/core';
import type { SheetSpec } from '../scenes.js';
import { DUNES } from './background.js';
import { sheet as extras } from './home-extras.js';

/*
 * The chips card's row as a wall tablet's header draws it (#241): a tab's glyph and words centred in a row that fills
 * its line, a tab of its icon alone (its name said to a screen reader and under the pointer), and plain tabs, no pill
 * at rest, standing on the page in its inks, the open view keeping its pill. Light and dark are the page's
 * (`&mode=dark`); a picture and a deep colour show the page's light ink.
 */

type Placed = LovelaceCardConfig & { cols?: number };

/** The greeting is frozen on the sheet's evening (the `_now` test hook), so every render says the same thing. */
const EVENING = '2026-09-17T21:47:12';

const chips = (config: Record<string, unknown>): Placed => ({
  type: 'custom:fluvy-chips-card',
  ...config,
});

/** The header of the reporter's tablet: two readings, the front door (its icon while it is shut), the room. */
const HEADER = [
  {
    name: "{{ states('sensor.hall_temperature') }} °C",
    icon: 'thermo',
    entity: 'sensor.hall_temperature',
  },
  {
    name: "{{ states('sensor.hall_humidity') }} %",
    icon: 'drop',
    entity: 'sensor.hall_humidity',
  },
  // its words only while it is open: shut, the door's icon alone
  {
    name: "{{ 'Open' if is_state('binary_sensor.front_door', 'on') else '' }}",
    icon: 'door',
    entity: 'binary_sensor.front_door',
  },
  { name: 'Bedroom', icon: 'mdi:bed', path: '/fluvy-home/bedroom' },
];

/** A house's rooms as tabs; the playground's own view (`/`) is the open one. */
const ROOMS = [
  { name: 'Home', icon: 'home', path: '/' },
  { name: 'Living', icon: 'mdi:sofa', path: '/fluvy-home/living' },
  { name: 'Kitchen', icon: 'mdi:stove', path: '/fluvy-home/kitchen' },
  { name: 'Bedroom', icon: 'mdi:bed', path: '/fluvy-home/bedroom' },
];
/** …and by their names alone. */
const ROOM_NAMES = ROOMS.map(({ name, path }) => ({ name, path }));

/** A wall's shortcuts, each in a colour of its own. */
const SHORTCUTS = [
  { name: 'Home', icon: 'home', path: '/' },
  { name: 'Lights', icon: 'bulb', path: '/fluvy-home/lights', color: 'amber' },
  { name: 'Climate', icon: 'thermo', path: '/fluvy-home/climate', color: 'deep-orange' },
  { name: 'Security', icon: 'shield', path: '/fluvy-home/security', color: 'green' },
  { name: 'Cameras', icon: 'camera', path: '/fluvy-home/cameras', color: 'blue' },
];

const greeting: Placed = {
  type: 'custom:fluvy-hello-card',
  _now: EVENING,
  name: 'Marta',
  person: 'person.marta',
};

const PICTURE = parseBackground({ type: 'image', image: DUNES, dim: 40 });
const BLUE = parseBackground({ type: 'color', colors: ['#1d4ed8', '#60a5fa'] });

export const sheet: SheetSpec = {
  states: [
    ...extras.states,
    [
      'sensor.hall_temperature',
      '21.4',
      { friendly_name: 'Hall temperature', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    [
      'sensor.hall_humidity',
      '48',
      { friendly_name: 'Hall humidity', unit_of_measurement: '%', device_class: 'humidity' },
    ],
    ['binary_sensor.front_door', 'off', { friendly_name: 'Front door', device_class: 'door' }],
  ],
  registry: extras.registry,
  frames: [
    // a row that fills its line: each tab's glyph and words in its middle, the shut door's icon alone in its own
    {
      title: 'Chips · centred, a wall’s header (#241)',
      width: 760,
      cards: [chips({ chips: HEADER }), chips({ chips: ROOMS })],
    },
    // every tab its icon alone, its name said and shown under the pointer; then one tab's of its own
    {
      title: 'Chips · icons alone (#241)',
      width: 360,
      cards: [
        chips({ chips: SHORTCUTS, show_name: false }),
        chips({ chips: SHORTCUTS, show_name: false, tint: 'always' }),
        chips({
          chips: HEADER.map((chip) =>
            chip.icon === 'mdi:bed' ? chip : { ...chip, show_name: false },
          ),
        }),
      ],
    },
    // no pill at rest, the open view's pill kept; a colour at rest in the glyph and the words alone
    {
      title: 'Chips · plain (#241)',
      width: 360,
      cards: [
        chips({ chips: ROOM_NAMES, style: 'plain' }),
        chips({ chips: SHORTCUTS, style: 'plain', show_name: false, tint: 'always' }),
        chips({ chips: HEADER, style: 'plain' }),
      ],
    },
    // on a picture and on a deep colour, the plain tabs take the page's light ink, as the greeting does
    {
      title: 'Chips · plain on a picture (#241)',
      width: 360,
      background: PICTURE,
      cards: [
        greeting,
        chips({ chips: ROOM_NAMES, style: 'plain' }),
        chips({ chips: SHORTCUTS, style: 'plain', show_name: false }),
      ],
    },
    {
      title: 'Chips · plain on a deep colour (#241)',
      width: 360,
      background: BLUE,
      cards: [
        greeting,
        chips({ chips: ROOM_NAMES, style: 'plain' }),
        chips({ chips: SHORTCUTS, style: 'plain', show_name: false }),
      ],
    },
    {
      title: 'Chips · plain, a wall’s header (#241)',
      width: 760,
      background: PICTURE,
      cards: [greeting, chips({ chips: HEADER, style: 'plain' })],
    },
  ],
};
