import type { HomeAssistant } from '@fluvy/core';
import type { SheetSpec } from '../scenes.js';
import { FluvyVacuumCard } from '../../../../packages/cards/src/vacuum/vacuum-card.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the vacuum's sheet does
if (!customElements.get('fluvy-vacuum-card'))
  customElements.define('fluvy-vacuum-card', FluvyVacuumCard);

const VACUUM = 'custom:fluvy-vacuum-card';

/* vacuum: PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · SEND_COMMAND 256 · LOCATE 512 ·
   START 8192 · CLEAN_AREA 16384 */
const ROBOT = 4 + 8 + 16 + 32 + 64 + 256 + 512 + 8192;
const CLEAN_AREA = 16384;

type Px = readonly [x: number, y: number];

/**
 * The flat, as its robot maps it: 480 × 360, 20 mm a pixel, the dock in the hall at (60, 214), which the robot counts
 * as (25500, 25500), its y running up where the picture's runs down. A place of the picture as the robot counts it.
 */
const robot = ([x, y]: Px): [number, number] => [25500 + (x - 60) * 20, 25500 + (214 - y) * 20];
/** A rectangle of the picture, by two corners, as the robot's zone: the lesser corner first. */
const zone = (a: Px, b: Px): number[] => {
  const [p, q] = [robot(a), robot(b)];
  return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
};

/** The flat's rooms on the picture: the robot's number for each, its name, its corners in turn. */
const FLAT: ReadonlyArray<
  readonly [id: number, name: string, fill: string, corners: readonly Px[]]
> = [
  [
    16,
    'Living room',
    '#a9c4e8',
    [
      [16, 16],
      [256, 16],
      [256, 196],
      [16, 196],
    ],
  ],
  [
    17,
    'Kitchen',
    '#f0d28f',
    [
      [256, 16],
      [464, 16],
      [464, 150],
      [256, 150],
    ],
  ],
  [
    18,
    'Hall',
    '#cdc3e6',
    [
      [16, 196],
      [150, 196],
      [150, 344],
      [16, 344],
    ],
  ],
  [
    19,
    'Study',
    '#b3dbbf',
    [
      [150, 196],
      [256, 196],
      [256, 230],
      [350, 230],
      [350, 344],
      [150, 344],
    ],
  ],
  [
    20,
    'Bathroom',
    '#9fd5d8',
    [
      [256, 150],
      [350, 150],
      [350, 230],
      [256, 230],
    ],
  ],
  [
    21,
    'Bedroom',
    '#efbbae',
    [
      [350, 150],
      [464, 150],
      [464, 344],
      [350, 344],
    ],
  ],
];

const path = (corners: readonly Px[]): string =>
  `M${corners.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/**
 * The map's picture, drawn here: each room in its soft tone, what stands in them a shade darker (the robot never
 * went there), the walls with their doorways, the dock and the robot, and its trail where it is at work. Its ground is
 * clear, as a robot's map is: the plate shows through.
 */
const flat = (at: Px = [60, 226], trail = ''): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">` +
      FLAT.map(([, , fill, corners]) => `<path d="${path(corners)}" fill="${fill}"/>`).join('') +
      // a sofa and a table, the kitchen's counter, a desk, the bath, a bed and a wardrobe
      `<g fill="#1b2430" fill-opacity=".13">` +
      `<rect x="30" y="30" width="84" height="34" rx="8"/><rect x="150" y="96" width="70" height="44" rx="10"/>` +
      `<rect x="270" y="24" width="186" height="22" rx="4"/><rect x="424" y="46" width="32" height="60" rx="4"/>` +
      `<rect x="170" y="306" width="86" height="30" rx="5"/><rect x="264" y="158" width="34" height="64" rx="12"/>` +
      `<rect x="378" y="176" width="78" height="96" rx="8"/><rect x="358" y="304" width="98" height="32" rx="4"/>` +
      `</g>` +
      `<path d="${trail}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      // the walls: the flat's outline, then each inner wall with its doorway left open
      `<g fill="none" stroke="#56606e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M16 16H464V344H16Z"/>` +
      `<path d="M256 16V150M256 150H296M330 150H464M16 196H60M100 196H256M256 190V230M256 230H350"/>` +
      `<path d="M150 196V250M150 290V344M350 150V176M350 216V290M350 326V344"/>` +
      `</g>` +
      `<rect x="48" y="202" width="24" height="12" rx="4" fill="#2f3742"/>` +
      `<circle cx="${at[0]}" cy="${at[1]}" r="9" fill="#fff" stroke="#2f3742" stroke-width="2"/>` +
      `<circle cx="${at[0]}" cy="${at[1]}" r="3" fill="#2f3742"/>` +
      `</svg>`,
  )}`;

const DOCKED = flat();
/** The robot at work: out of the hall, up and down the living room. */
const AT_WORK = flat(
  [196, 60],
  'M60 226V250H80V176H40V40H64V176H88V72H112V176H136V40H160V88H184V40H196V60',
);

/** The map's calibration as Xiaomi Cloud Map Extractor says it: the dock, a metre along, a metre up. */
const CALIBRATION = [
  { vacuum: { x: 25500, y: 25500 }, map: { x: 60, y: 214 } },
  { vacuum: { x: 26500, y: 25500 }, map: { x: 110, y: 214 } },
  { vacuum: { x: 25500, y: 26500 }, map: { x: 60, y: 164 } },
];

/** The rooms as the extractor's camera says them: each under its number, its box and its name. */
const OWN_ROOMS = Object.fromEntries(
  FLAT.map(([id, name, , corners]) => {
    const xs = corners.map((corner) => robot(corner)[0]);
    const ys = corners.map((corner) => robot(corner)[1]);
    return [
      id,
      { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), name },
    ];
  }),
);

/** The rooms as a config writes them: each with its outline, the hall and the kitchen with their areas. */
const ROOMS = FLAT.map(([id, name, , corners]) => ({
  id,
  name,
  outline: corners.map(robot),
  ...(id === 17 ? { area: 'mp_kitchen' } : id === 18 ? { area: 'mp_hall' } : {}),
}));

const MAP = { image: 'camera.mp_map', rooms: ROOMS };

/** Three presets: a zone by the cooker, one under the table, and the whole flat. */
const PRESETS = [
  {
    name: 'Cooker',
    zone: zone([270, 50], [420, 140]),
    color: 'teal',
    icon: 'mdi:silverware-fork-knife',
    repeats: 2,
  },
  {
    name: 'Table',
    zone: zone([136, 82], [234, 154]),
    color: 'amber',
    icon: 'mdi:table-chair',
  },
  { name: 'Full clean', icon: 'mdi:home' },
];

const SUCTION = ['quiet', 'standard', 'turbo', 'max'];

const vacuum = (name: string, extra: Record<string, unknown> = {}) => ({
  friendly_name: name,
  supported_features: ROBOT,
  battery_level: 86,
  fan_speed: 'standard',
  fan_speed_list: SUCTION,
  ...extra,
});

const entry = (entity: string, platform: string) =>
  [entity, { entity_id: entity, area_id: 'mp_hall', platform }] as const;

/** An action that takes entities, as Home Assistant describes it; one that does not says no target. */
const TARGETED = { target: { entity: [{ domain: ['vacuum'] }] } };

/** The actions the house's integrations offer: what a robot's ways are read by, beside its entity's platform. */
const SERVICES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  vacuum: {
    start: TARGETED,
    pause: TARGETED,
    stop: TARGETED,
    return_to_base: TARGETED,
    locate: TARGETED,
    send_command: TARGETED,
    clean_area: TARGETED,
  },
  xiaomi_miio: {
    vacuum_clean_zone: TARGETED,
    vacuum_clean_segment: TARGETED,
    vacuum_goto: TARGETED,
  },
  roborock: { set_vacuum_goto_position: TARGETED, set_vacuum_zoned_cleaning: TARGETED },
  mqtt: { publish: {} },
  script: { clean_spot: {} },
};

/** The house with its actions listed, as Home Assistant hands them over (`hass.services`). */
const withServices = (hass: HomeAssistant): HomeAssistant => ({ ...hass, services: SERVICES });

const card = (extra: Record<string, unknown> = {}) => ({
  type: VACUUM,
  entity: 'vacuum.mp_robot',
  map: MAP,
  presets: PRESETS,
  ...extra,
});

/**
 * The Vacuum card's map (#265): the robot's map under the head with its rooms and three presets; two rooms picked,
 * with what to do at the map's foot; a zone waited for, under the finger and marked, a point waited for and picked,
 * the map enlarged; the robot at work; a floor's select between the map and the presets (#262); the presets alone,
 * and the house's areas as presets; the rooms as the map's own entity says them; a Roborock's image with its points
 * and a Valetudo robot's topic; a plain floor plan with an action of the person's own; a square map; no picture, and
 * the robot out of reach; then a 266 column and a 211 one, the least the full card is drawn in (half a section draws
 * the compact card, which has no map).
 */
export const sheet: SheetSpec = {
  states: [
    ['vacuum.mp_robot', 'docked', vacuum('Robot vacuum')],
    ['vacuum.mp_busy', 'cleaning', vacuum('Robot vacuum', { battery_level: 64 })],
    [
      'vacuum.mp_s8',
      'docked',
      vacuum('Roborock S8', {
        supported_features: ROBOT + CLEAN_AREA,
        battery_level: 100,
        fan_speed: 'balanced',
        fan_speed_list: ['quiet', 'balanced', 'turbo', 'max'],
      }),
    ],
    ['vacuum.mp_valetudo', 'docked', vacuum('Valetudo', { battery_level: 92 })],
    ['vacuum.mp_plan', 'idle', vacuum('Downstairs', { battery_level: 71 })],
    [
      'vacuum.mp_gone',
      'unavailable',
      { friendly_name: 'Robot vacuum', supported_features: ROBOT, fan_speed_list: SUCTION },
    ],
    [
      'camera.mp_map',
      'idle',
      {
        friendly_name: 'Robot map',
        entity_picture: DOCKED,
        calibration_points: CALIBRATION,
        rooms: OWN_ROOMS,
      },
    ],
    [
      'camera.robot_map',
      'idle',
      {
        friendly_name: 'Robot map',
        entity_picture: AT_WORK,
        calibration_points: CALIBRATION,
        rooms: OWN_ROOMS,
      },
    ],
    // core's Roborock: an image a map, which says nothing but its picture
    [
      'image.mp_s8_ground_floor',
      '2026-09-17T19:42:10+00:00',
      { friendly_name: 'Roborock S8 Ground floor', entity_picture: DOCKED },
    ],
    ['camera.mp_gone_map', 'unavailable', { friendly_name: 'Robot map' }],
    [
      'select.mp_floor',
      'Ground floor',
      { friendly_name: 'Floor', options: ['Ground floor', 'Upstairs'], icon: 'mdi:stairs' },
    ],
    ['sensor.mp_area', '38', { friendly_name: 'Cleaned area', unit_of_measurement: 'm²' }],
    ['sensor.mp_time', '46', { friendly_name: 'Cleaning time', unit_of_measurement: 'min' }],
  ],
  registry: {
    areas: {
      mp_hall: { area_id: 'mp_hall', name: 'Hall', icon: 'mdi:door' },
      mp_kitchen: { area_id: 'mp_kitchen', name: 'Kitchen', icon: 'mdi:silverware-fork-knife' },
      mp_study: { area_id: 'mp_study', name: 'Study', icon: 'mdi:desk' },
    },
    entities: Object.fromEntries([
      entry('vacuum.mp_robot', 'xiaomi_miio'),
      entry('vacuum.mp_busy', 'xiaomi_miio'),
      entry('vacuum.mp_s8', 'roborock'),
      entry('vacuum.mp_valetudo', 'mqtt'),
      entry('vacuum.mp_plan', 'tuya'),
      entry('vacuum.mp_gone', 'xiaomi_miio'),
    ]),
  },
  // the Roborock's areas, mapped to its segments in its entity's settings
  ws: {
    'config/entity_registry/get': (message) =>
      message['entity_id'] === 'vacuum.mp_s8'
        ? {
            entity_id: 'vacuum.mp_s8',
            platform: 'roborock',
            options: {
              vacuum: {
                area_mapping: { mp_kitchen: ['0_17'], mp_hall: ['0_18'], mp_study: ['0_19'] },
              },
            },
          }
        : undefined,
  },
  frames: [
    { title: 'Map', hass: withServices, cards: [card()] },
    {
      title: 'Map · two rooms picked',
      hass: withServices,
      cards: [card({ _map: { chosen: { kind: 'rooms', rooms: ['16', '17'] } } })],
    },
    // the zone's round tapped: the map waits for its finger, and says so
    {
      title: 'Map · marking a zone',
      hass: withServices,
      cards: [card({ _map: { mode: 'zone' } })],
    },
    {
      title: 'Map · a zone under the finger',
      hass: withServices,
      cards: [
        card({
          _map: {
            mode: 'zone',
            drawing: [
              [176, 214],
              [330, 322],
            ],
          },
        }),
      ],
    },
    {
      title: 'Map · a zone marked',
      hass: withServices,
      cards: [
        card({
          _map: { chosen: { kind: 'zones', presets: [], drawn: zone([176, 214], [330, 322]) } },
        }),
      ],
    },
    {
      title: 'Map · picking a point',
      hass: withServices,
      cards: [card({ _map: { mode: 'point' } })],
    },
    {
      title: 'Map · a point to go to',
      hass: withServices,
      cards: [
        card({
          _map: { mode: 'point', chosen: { kind: 'point', point: robot([408, 118]) } },
        }),
      ],
    },
    {
      title: 'Map · enlarged',
      hass: withServices,
      cards: [card({ _map: { zoom: [2, -300, -20] } })],
    },
    {
      title: 'Map · at work',
      hass: withServices,
      cards: [
        card({
          entity: 'vacuum.mp_busy',
          map: { ...MAP, image: 'camera.robot_map' },
          area_entity: 'sensor.mp_area',
          duration_entity: 'sensor.mp_time',
          show_suction: false,
        }),
      ],
    },
    // #262: a select between the map and the presets, to choose the floor's map
    {
      title: 'Map · a floor’s select',
      hass: withServices,
      cards: [card({ rows: [{ entity: 'select.mp_floor', secondary: 'none' }] })],
    },
    {
      title: 'Map · a preset shown',
      hass: withServices,
      cards: [card({ _map: { chosen: { kind: 'zones', presets: [0] } } })],
    },
    // the presets alone, on a card with no map: rooms by their numbers, and the whole flat
    {
      title: 'Presets',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.mp_robot',
          presets: [
            { name: 'Kitchen', rooms: [17], icon: 'mdi:silverware-fork-knife' },
            { name: 'Bedroom', rooms: [21], icon: 'mdi:bed' },
            { name: 'Hall', rooms: [18], icon: 'mdi:door' },
            { name: 'Full clean', icon: 'mdi:home' },
          ],
        },
      ],
    },
    // Home Assistant's areas as presets: one for each area the robot has mapped
    {
      title: 'Presets · the house’s areas',
      hass: withServices,
      cards: [{ type: VACUUM, entity: 'vacuum.mp_s8', presets: 'areas', show_battery: false }],
    },
    // what the map's own entity says: the rooms' boxes and names, with no rooms written
    {
      title: 'Map · the entity’s own rooms',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.mp_robot',
          map: { image: 'camera.mp_map' },
          show_battery: false,
          show_suction: false,
        },
      ],
    },
    // core's Roborock: its map is an image entity, calibrated by three points of the person's own
    {
      title: 'Map · Roborock',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.mp_s8',
          map: {
            image: 'image.mp_s8_ground_floor',
            calibration: CALIBRATION,
            rooms: ROOMS,
          },
          presets: [
            { name: 'Kitchen', rooms: [17], icon: 'mdi:silverware-fork-knife', color: 'teal' },
            { name: 'Bedrooms', rooms: [19, 21], icon: 'mdi:bed', color: 'purple', repeats: 2 },
          ],
          show_battery: false,
          show_suction: false,
        },
      ],
    },
    {
      title: 'Map · Valetudo',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.mp_valetudo',
          map: { ...MAP, topic: 'valetudo/robot' },
          show_battery: false,
          show_suction: false,
        },
      ],
    },
    // a plain floor plan: a picture's address, measured in its own pixels, the zone handed to a script
    {
      title: 'Map · a floor plan',
      hass: withServices,
      cards: [
        {
          type: VACUUM,
          entity: 'vacuum.mp_plan',
          map: {
            image: DOCKED,
            calibration: 'image',
            controls: ['names', 'zone'],
            zone_action: {
              action: 'perform-action',
              perform_action: 'script.clean_spot',
              data: { zones: '[[selection]]', times: '[[repeats]]' },
            },
          },
          presets: [
            {
              name: 'Around the table',
              zone: [136, 82, 234, 154],
              color: 'amber',
              tap_action: {
                action: 'perform-action',
                perform_action: 'script.clean_spot',
                data: { zones: '[[selection]]', times: '[[repeats]]' },
              },
            },
            { name: 'Full clean' },
          ],
          show_battery: false,
          show_suction: false,
        },
      ],
    },
    {
      title: 'Map · square',
      hass: withServices,
      cards: [
        card({
          map: { ...MAP, aspect_ratio: '1:1' },
          presets: undefined,
          show_battery: false,
          show_suction: false,
        }),
      ],
    },
    {
      title: 'Map · no picture',
      hass: withServices,
      cards: [card({ map: { image: 'camera.mp_gone_map' }, show_battery: false })],
    },
    {
      title: 'Map · unavailable',
      hass: withServices,
      cards: [card({ entity: 'vacuum.mp_gone' })],
    },
    { title: 'Map · a 266 column', width: 266, hass: withServices, cards: [card()] },
    {
      title: 'Map · a 266 column · picked',
      width: 266,
      hass: withServices,
      cards: [card({ _map: { chosen: { kind: 'rooms', rooms: ['16', '17'] } } })],
    },
    { title: 'Map · a 211 column', width: 211, hass: withServices, cards: [card()] },
    {
      title: 'Map · a 211 column · picked',
      width: 211,
      hass: withServices,
      cards: [card({ _map: { chosen: { kind: 'zones', presets: [0] } } })],
    },
    {
      title: 'Map · a 211 column · a point',
      width: 211,
      hass: withServices,
      cards: [card({ _map: { chosen: { kind: 'point', point: robot([408, 118]) } } })],
    },
    {
      title: 'Map · a 211 column · marking a zone',
      width: 211,
      hass: withServices,
      cards: [card({ _map: { mode: 'zone' } })],
    },
  ],
};
