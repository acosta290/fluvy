import type { CustomPalette } from '@fluvy/tokens/runtime';
import { FluvyRoomCard } from '../../../../packages/cards/src/room/room-card.js';
import { FluvyTemplateCard } from '../../../../packages/cards/src/template/template-card.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

// their chunks land after the page has drawn: the sheet defines the cards from their modules, as the rooms' does
if (!customElements.get('fluvy-template-card'))
  customElements.define('fluvy-template-card', FluvyTemplateCard);
if (!customElements.get('fluvy-room-card')) customElements.define('fluvy-room-card', FluvyRoomCard);

/*
 * A tile's switch as a wall rocker (`switch_style: rocker`, #177) on real cards: a wall of six as a house would hang
 * them — two a row on a phone, six in a row on a wide page — a rocker on, off, on its way and out of reach, beside
 * the toggle it stands in for, with a plug's readings at its foot, down to the 116 a head holds its plate at and
 * under it, where the circle is the switch; a compact tile's at its row's end, with its circle and without; a mini
 * tile, which keeps its circle; a group that says it for its tiles and a tile that answers otherwise; the room
 * card's tiles, the room lights card's and the template card's; and the same wall read by its edges (E-ink) and on a solid fill. Light and
 * dark are the page's (`&mode=dark`), Lite `&lite=1`.
 */

const TILE = 'custom:fluvy-tile-card';
const TILES = 'custom:fluvy-tiles-card';
const TEMPLATE = 'custom:fluvy-template-card';
const ROOM = 'custom:fluvy-room-card';
const LIGHTS = 'custom:fluvy-lights-card';
const ROCKER = { switch_style: 'rocker' } as const;

/** The E-ink palette (`palettes/community/e-ink.fluvy-palette.json`), and the same in ink. */
const LINE: CustomPalette = {
  character: 'soft',
  base: 'neutral',
  accent: '#1f1f1f',
  surface: 'line',
};
const INK: CustomPalette = { ...LINE, surface: 'ink' };

/** A bulb that only switches, and one that dims (at 70 %). */
const ONOFF = { supported_color_modes: ['onoff'], color_mode: 'onoff' };
const DIMMER = { brightness: 178, supported_color_modes: ['brightness'], color_mode: 'brightness' };
/** A cover that opens, closes, stops and takes a position. */
const TRAVELS = 15;

const PUMP = {
  entity: 'switch.tr_pool_pump',
  readouts: ['sensor.tr_pool_pump_power', 'sensor.tr_pool_pump_energy'],
};
/** The wall: what a house switches outdoors, on and off as an evening leaves them. */
const WALL = [
  'light.tr_porch',
  'light.tr_garden',
  'light.tr_driveway',
  'switch.tr_fountain',
  'fan.tr_pergola',
  'cover.tr_awning',
];

/** The wall as one group, two a row. */
const wall = (more: Record<string, unknown> = {}) => ({
  type: TILES,
  size: 'large',
  columns: 2,
  ...ROCKER,
  tiles: WALL,
  ...more,
});
/** A lone tile, half a section. */
const half = (entity: string, more: Record<string, unknown> = {}) => ({
  type: TILE,
  entity,
  ...ROCKER,
  cols: 6,
  ...more,
});
/** The four states of a rocker: on, off, on its way and out of reach. */
const STATES = ['light.tr_porch', 'light.tr_driveway', 'cover.tr_shutters', 'light.tr_shed'];
const states = (title: string, more: Partial<FrameSpec> = {}): FrameSpec => ({
  title,
  heights: [152, 172, 211, 266],
  cards: STATES.map((entity) => half(entity)),
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    ['light.tr_porch', 'on', { friendly_name: 'Porch', ...ONOFF }],
    ['light.tr_garden', 'on', { friendly_name: 'Garden lights', ...DIMMER }],
    ['light.tr_driveway', 'off', { friendly_name: 'Driveway', ...ONOFF }],
    ['switch.tr_fountain', 'on', { friendly_name: 'Fountain' }],
    [
      'fan.tr_pergola',
      'on',
      { friendly_name: 'Pergola fan', percentage: 50, supported_features: 1 },
    ],
    [
      'cover.tr_awning',
      'open',
      { friendly_name: 'Awning', supported_features: TRAVELS, current_position: 100 },
    ],
    [
      'cover.tr_shutters',
      'opening',
      { friendly_name: 'Shutters', supported_features: TRAVELS, current_position: 40 },
    ],
    ['light.tr_shed', 'unavailable', { friendly_name: 'Shed', ...ONOFF }],
    ['switch.tr_pool_pump', 'on', { friendly_name: 'Pool pump', device_class: 'outlet' }],
    [
      'sensor.tr_pool_pump_power',
      '740',
      { friendly_name: 'Pool pump Power', unit_of_measurement: 'W', device_class: 'power' },
    ],
    [
      'sensor.tr_pool_pump_energy',
      '3.2',
      { friendly_name: 'Pool pump Energy', unit_of_measurement: 'kWh', device_class: 'energy' },
    ],
    ['light.tr_path', 'on', { friendly_name: 'Garden path lights', ...DIMMER }],
    ['input_boolean.tr_guests', 'on', { friendly_name: 'Guests' }],
    ['light.tr_terrace', 'on', { friendly_name: 'Terrace', ...ONOFF }],
    ['light.tr_steps', 'off', { friendly_name: 'Steps', ...ONOFF }],
    ['switch.tr_heater', 'on', { friendly_name: 'Heater' }],
    [
      'cover.tr_pergola',
      'closed',
      { friendly_name: 'Pergola', supported_features: TRAVELS, current_position: 0 },
    ],
  ],
  registry: {
    entities: Object.fromEntries(
      ['light.tr_terrace', 'light.tr_steps', 'switch.tr_heater', 'cover.tr_pergola'].map((id) => [
        id,
        { entity_id: id, area_id: 'tr_terrace' },
      ]),
    ),
    areas: { tr_terrace: { area_id: 'tr_terrace', name: 'Terrace', icon: 'mdi:table-chair' } },
  },
  frames: [
    // the wall: two a row on a phone (172 + 16 + 172)
    { title: 'A wall of six', cards: [wall()] },
    // …and six in a row across a desktop's sections, a tile card each at the phone's 172 (for the eye: a band of
    // its own width, which no probe squeezes)
    {
      title: 'Six in a row',
      width: 1112,
      columns: 6,
      measure: false,
      cards: WALL.map((entity) => ({ type: TILE, entity, ...ROCKER, cols: 1 })),
    },
    // on, off, on its way (its bar breathes: a tap stops it there) and out of reach, half a section each
    states('On, off, on its way, out of reach'),
    // half a desktop section (152 + 8 + 152): the rocker beside the toggle it stands in for
    {
      title: '152 · rocker and toggle',
      width: 312,
      gap: 8,
      heights: [152, 172, 211, 266],
      cards: [half('light.tr_porch'), { type: TILE, entity: 'light.tr_porch', cols: 6 }],
    },
    // a plug's readings at its foot; a light that dims has no ruler here, so a long name takes its foot's room
    {
      title: 'Readings · a long name',
      heights: [152, 172, 211, 266],
      cards: [half('switch.tr_pool_pump', PUMP), half('light.tr_path')],
    },
    // three a row on a phone: under 116 the circle is the switch, as with the toggle
    {
      title: 'Three a row',
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 3,
          ...ROCKER,
          tiles: ['light.tr_porch', 'light.tr_driveway', 'switch.tr_fountain'],
        },
      ],
    },
    // a compact tile's rocker at its row's end: two a row its words have the circle's room, one a row it keeps it
    {
      title: 'Compact · two a row',
      cards: [{ type: TILES, columns: 2, ...ROCKER, entities: [...STATES] }],
    },
    {
      title: 'Compact · one a row',
      cards: [
        {
          type: TILES,
          columns: 1,
          ...ROCKER,
          entities: ['light.tr_porch', 'light.tr_driveway', 'cover.tr_shutters'],
        },
      ],
    },
    // a mini tile has no room for a plate: its circle and its tap stay as they are
    {
      title: 'Mini keeps its circle',
      cards: [
        {
          type: TILES,
          size: 'mini',
          ...ROCKER,
          entities: ['light.tr_porch', 'light.tr_driveway', 'switch.tr_fountain'],
        },
      ],
    },
    // the group says it for its tiles, and a tile answers otherwise
    {
      title: 'A group in rockers, one tile a toggle',
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 2,
          ...ROCKER,
          tiles: ['light.tr_porch', { entity: 'light.tr_garden', switch_style: 'toggle' }],
        },
      ],
    },
    {
      title: 'A group in toggles, one tile a rocker',
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 2,
          tiles: [{ entity: 'light.tr_porch', ...ROCKER }, 'light.tr_garden'],
        },
      ],
    },
    // asked not to show its switch, or its level's figure in its place, a tile draws none: the style has nothing to say
    {
      title: 'No switch, no rocker',
      cards: [
        half('light.tr_garden', { show_switch: false }),
        half('light.tr_garden', { show_switch: 'value' }),
      ],
    },
    // out of reach as it rests (`unavailable: quiet`), and a helper that only switches
    {
      title: 'Quiet out of reach · a helper',
      heights: [152, 172, 211, 266],
      cards: [half('light.tr_shed', { unavailable: 'quiet' }), half('input_boolean.tr_guests')],
    },
    // the room card's tiles, each its rocker at its end
    {
      title: 'Room card',
      cards: [{ type: ROOM, area: 'tr_terrace', variant: 'tile', controls: 'tiles', ...ROCKER }],
    },
    // the room lights card's tiles: a room's lights as the plate by its door
    {
      title: 'Room lights card',
      cards: [
        {
          type: LIGHTS,
          name: 'Terrace',
          variant: 'tiles',
          ...ROCKER,
          lights: ['light.tr_terrace', 'light.tr_steps', 'light.tr_porch', 'light.tr_driveway'],
        },
      ],
    },
    // the template card's tile, large and compact
    {
      title: 'Template card',
      cards: [
        {
          type: TEMPLATE,
          entity: 'light.tr_porch',
          variant: 'large',
          name: 'Front door',
          secondary: 'Until sunrise',
          ...ROCKER,
          cols: 6,
        },
        { type: TEMPLATE, entity: 'light.tr_driveway', variant: 'large', ...ROCKER, cols: 6 },
        { type: TEMPLATE, entity: 'switch.tr_fountain', ...ROCKER },
      ],
    },
    // the wall read by its edges: E-ink's line, and the same in ink
    { title: 'E-ink · a wall of six', palette: LINE, cards: [wall()] },
    {
      title: 'E-ink in ink · on, off, on its way, out of reach',
      palette: INK,
      cards: [...states('').cards],
    },
    // on a solid fill, the plate in the fill's ink and its key in the fill itself
    { title: 'Volt · a solid fill', palette: 'volt', cards: [wall()] },
  ],
};
