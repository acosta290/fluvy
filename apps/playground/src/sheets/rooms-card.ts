import type { HomeAssistant } from '@fluvy/core';
import { FluvyRoomsCard } from '../../../../packages/cards/src/rooms/rooms-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the Rounds sheet does
if (!customElements.get('fluvy-rooms-card'))
  customElements.define('fluvy-rooms-card', FluvyRoomsCard);

const ROOMS = 'custom:fluvy-rooms-card';

/*
 * The Rooms card (#225, requested by @xoatrash): an English house of six rooms on two floors, each with its sensors,
 * its lights, most with a thermostat and blinds — an evening at 21:47, the living room's floor lamp at 60 % and its
 * heating on, the kids' night light dimmed, the bathroom's towel rail warming. The house has Fluvy's Rooms dashboard,
 * so every room opens its page there.
 */

const AREAS = [
  { area_id: 'rs_living', name: 'Living room', floor_id: 'rs_ground', icon: 'mdi:sofa' },
  { area_id: 'rs_kitchen', name: 'Kitchen', floor_id: 'rs_ground', icon: 'mdi:stove' },
  { area_id: 'rs_office', name: 'Office', floor_id: 'rs_ground', icon: 'mdi:desk' },
  { area_id: 'rs_bedroom', name: 'Bedroom', floor_id: 'rs_first', icon: 'mdi:bed' },
  { area_id: 'rs_kids', name: 'Kids room', floor_id: 'rs_first', icon: 'mdi:teddy-bear' },
  { area_id: 'rs_bathroom', name: 'Bathroom', floor_id: 'rs_first', icon: 'mdi:shower' },
] as const;
const FLOORS = [
  { floor_id: 'rs_ground', name: 'Ground floor', level: 0 },
  { floor_id: 'rs_first', name: 'First floor', level: 1 },
] as const;
type Area = (typeof AREAS)[number]['area_id'];

/** A reading of a room's: its sensor, in its class and unit. */
const reading = (id: string, value: string, kind: 'temperature' | 'humidity'): StateSeed => [
  `sensor.${id}`,
  value,
  {
    friendly_name: `${id.replace(/^rs_|_/g, ' ').trim()}`,
    device_class: kind,
    unit_of_measurement: kind === 'temperature' ? '°C' : '%',
    state_class: 'measurement',
  },
];

/** A warm white lamp at a level (a share of 255), off, or unplugged (`unavailable`). */
const lamp = (id: string, name: string, brightness = 0, state?: 'unavailable'): StateSeed => [
  `light.${id}`,
  state ?? (brightness ? 'on' : 'off'),
  {
    friendly_name: name,
    supported_color_modes: ['color_temp'],
    ...(brightness
      ? {
          color_mode: 'color_temp',
          brightness,
          color_temp_kelvin: 2700,
          hs_color: [28.4, 65.7],
          rgb_color: [255, 167, 87],
        }
      : {}),
  },
];

/** A room's thermostat: heating to `target` from `current`, idle at it, or off. */
const thermostat = (
  id: string,
  name: string,
  mode: 'heat' | 'off',
  current: number,
  target: number,
  action: 'heating' | 'idle' | 'off',
): StateSeed => [
  `climate.${id}`,
  mode,
  {
    friendly_name: name,
    hvac_modes: ['off', 'heat'],
    hvac_action: action,
    current_temperature: current,
    temperature: mode === 'off' ? null : target,
    min_temp: 7,
    max_temp: 30,
    target_temp_step: 0.5,
    supported_features: 385,
  },
];

/** A room's blinds, at a position (100 open, 0 closed). */
const blinds = (id: string, name: string, position: number): StateSeed => [
  `cover.${id}`,
  position ? 'open' : 'closed',
  {
    friendly_name: name,
    device_class: 'blind',
    current_position: position,
    supported_features: 15,
  },
];

/** Every room's things, each in its area. */
const THINGS: readonly (readonly [Area | undefined, StateSeed])[] = [
  ['rs_living', lamp('rs_living_floor', 'Floor lamp', 153)],
  ['rs_living', lamp('rs_living_ceiling', 'Ceiling light')],
  ['rs_living', thermostat('rs_living', 'Living room', 'heat', 21.4, 21.5, 'heating')],
  ['rs_living', blinds('rs_living_blinds', 'Living room blinds', 70)],
  ['rs_living', reading('rs_living_temperature', '21.4', 'temperature')],
  ['rs_living', reading('rs_living_humidity', '48', 'humidity')],
  [
    'rs_living',
    [
      'media_player.rs_tv',
      'off',
      { friendly_name: 'TV', device_class: 'tv', supported_features: 21437 },
    ],
  ],
  ['rs_kitchen', lamp('rs_kitchen_spots', 'Kitchen spots', 255)],
  ['rs_kitchen', blinds('rs_kitchen_blinds', 'Kitchen blinds', 0)],
  ['rs_kitchen', reading('rs_kitchen_temperature', '20.7', 'temperature')],
  ['rs_kitchen', reading('rs_kitchen_humidity', '57', 'humidity')],
  ['rs_office', lamp('rs_office_desk', 'Desk lamp')],
  ['rs_office', thermostat('rs_office', 'Office', 'heat', 20.2, 20, 'idle')],
  ['rs_office', blinds('rs_office_blinds', 'Office blinds', 100)],
  ['rs_office', reading('rs_office_temperature', '20.2', 'temperature')],
  ['rs_office', reading('rs_office_humidity', '44', 'humidity')],
  ['rs_bedroom', lamp('rs_bedroom_bedside', 'Bedside lamp')],
  ['rs_bedroom', thermostat('rs_bedroom', 'Bedroom', 'off', 18.9, 18, 'off')],
  ['rs_bedroom', blinds('rs_bedroom_blinds', 'Bedroom blinds', 0)],
  ['rs_bedroom', reading('rs_bedroom_temperature', '18.9', 'temperature')],
  ['rs_bedroom', reading('rs_bedroom_humidity', '52', 'humidity')],
  ['rs_kids', lamp('rs_kids_night', 'Night light', 51)],
  ['rs_kids', thermostat('rs_kids', 'Kids room', 'heat', 21.6, 22, 'heating')],
  ['rs_kids', reading('rs_kids_temperature', '21.6', 'temperature')],
  ['rs_kids', reading('rs_kids_humidity', '49', 'humidity')],
  ['rs_bathroom', lamp('rs_bathroom_mirror', 'Mirror light')],
  ['rs_bathroom', thermostat('rs_bathroom', 'Towel rail', 'heat', 22.8, 23, 'heating')],
  ['rs_bathroom', reading('rs_bathroom_temperature', '22.8', 'temperature')],
  ['rs_bathroom', reading('rs_bathroom_humidity', '61', 'humidity')],
  // out of reach: a humidity sensor whose battery ran out, a lamp unplugged (in no room: a room names them itself)
  [undefined, reading('rs_landing_humidity', 'unavailable', 'humidity')],
  [undefined, lamp('rs_landing_lamp', 'Landing lamp', 0, 'unavailable')],
];
const STATES: StateSeed[] = THINGS.map(([, seed]) => seed);

/** The dashboards the house has: Fluvy's Rooms dashboard among them, where every room has its page. */
const PANELS: HomeAssistant['panels'] = {
  lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
  'fluvy-rooms': {
    component_name: 'lovelace',
    url_path: 'fluvy-rooms',
    title: 'Fluvy · Rooms',
    icon: 'fluvy:rooms',
  },
};

/** The house the frames stand on: its six rooms on their two floors alone, and its dashboards. */
const house = (hass: HomeAssistant): HomeAssistant =>
  ({
    ...hass,
    areas: Object.fromEntries(AREAS.map((area) => [area.area_id, area])),
    floors: Object.fromEntries(FLOORS.map((floor) => [floor.floor_id, floor])),
    panels: PANELS,
  }) as HomeAssistant;

/** The reporter's house as the issue drew it, its rooms in German (shot with `&lang=de`). */
const GERMAN: Readonly<Record<Area, string>> = {
  rs_living: 'Wohnzimmer',
  rs_kitchen: 'Küche',
  rs_office: 'Büro',
  rs_bedroom: 'Elternzimmer',
  rs_kids: 'Kinderzimmer',
  rs_bathroom: 'Badezimmer',
};
const houseInGerman = (hass: HomeAssistant): HomeAssistant => {
  const own = house(hass);
  return {
    ...own,
    areas: Object.fromEntries(
      AREAS.map((area) => [area.area_id, { ...area, name: GERMAN[area.area_id] }]),
    ),
  } as HomeAssistant;
};

/** Each room with its lights', its thermostat's and its blinds' rounds, where it has them. */
const HOUSE = { type: ROOMS, default_actions: ['lights', 'climate', 'covers'] };

/**
 * The Rooms card (#225): every room of the house in its order, a row each — its glyph, its name, its temperature and
 * humidity, its rounds — as rows, compact rows and tiles, with and without its head, a room's own rounds, name and
 * colour, half a section, out of reach and empty. Shot at a phone's column and on a desktop, light and dark, and in
 * German (`&lang=de`).
 */
export const sheet: SheetSpec = {
  states: STATES,
  registry: {
    entities: Object.fromEntries(
      THINGS.flatMap(([area, [entity_id]]) =>
        area ? [[entity_id, { entity_id, area_id: area }] as const] : [],
      ),
    ),
  },
  ws: {
    // the Rooms dashboard's configuration: its strategy alone, as Fluvy's settings make it
    'lovelace/config': (message) =>
      message['url_path'] === 'fluvy-rooms'
        ? { strategy: { type: 'custom:fluvy-rooms' } }
        : undefined,
  },
  frames: [
    // the issue's own: every room, its lights, its thermostat and its blinds at its end
    { title: 'The house', hass: house, cards: [HOUSE] },
    { title: 'The house · tiles', hass: house, cards: [{ ...HOUSE, variant: 'tiles' }] },
    { title: 'The house · compact', hass: house, cards: [{ ...HOUSE, variant: 'compact' }] },
    // the issue's picture: the reporter's rooms in German, as its mockup draws them
    { title: 'The house · in German', hass: houseInGerman, cards: [HOUSE] },
    {
      title: 'The house · how many are on',
      hass: house,
      cards: [{ ...HOUSE, show_count: true, show_average: false }],
    },
    // no head, the rooms alone; three at most
    {
      title: 'The house · no head, three rooms',
      hass: house,
      cards: [{ ...HOUSE, show_head: false, max_rooms: 3 }],
    },
    // the reporter's own picks: a room's own rounds, name, icon and colour
    {
      title: 'Rooms of their own',
      hass: house,
      cards: [
        {
          type: ROOMS,
          title: 'Upstairs',
          rooms: [
            {
              area: 'rs_kids',
              name: 'Mia’s room',
              color: 'pink',
              quick_actions: ['lights', 'climate'],
            },
            {
              area: 'rs_bedroom',
              quick_actions: ['covers', { entity: 'light.rs_bedroom_bedside', icon: 'mdi:lamp' }],
            },
            'rs_bathroom',
          ],
          default_actions: ['lights', 'climate'],
        },
      ],
    },
    {
      title: 'Rooms of their own · living room',
      hass: house,
      cards: [
        {
          type: ROOMS,
          show_head: false,
          rooms: [
            {
              area: 'rs_living',
              quick_actions: [
                'lights',
                { entity: 'media_player.rs_tv', icon: 'mdi:television' },
                'covers',
                'climate',
              ],
            },
          ],
        },
      ],
    },
    // half a section on a phone and on a desktop: the rounds give way from the end, the circles last, as tall as
    // their config says at any width
    {
      title: 'The house · halves',
      hass: house,
      heights: [152, 172],
      cards: [
        { ...HOUSE, max_rooms: 3, cols: 6 },
        { ...HOUSE, variant: 'compact', max_rooms: 3, cols: 6 },
      ],
    },
    // the tiles one a row under a column of 320
    {
      title: 'The house · tiles in halves',
      hass: house,
      cards: [
        { ...HOUSE, variant: 'tiles', max_rooms: 3, cols: 6 },
        { ...HOUSE, variant: 'tiles', max_rooms: 2, show_head: false, cols: 6 },
      ],
    },
    // a sensor out of reach says "—" in its place, an unplugged lamp's round is the dashed ring, an area gone is a row
    {
      title: 'Out of reach',
      hass: house,
      cards: [
        {
          type: ROOMS,
          title: 'Landing',
          rooms: [
            {
              area: 'rs_bathroom',
              humidity_entity: 'sensor.rs_landing_humidity',
              quick_actions: ['light.rs_landing_lamp', 'climate'],
            },
            { area: 'rs_attic', name: 'Attic' },
          ],
        },
      ],
    },
    { title: 'Empty', hass: house, cards: [{ type: ROOMS, rooms: [] }] },
  ],
};
