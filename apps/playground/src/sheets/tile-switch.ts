import { FluvyTemplateCard } from '../../../../packages/cards/src/template/template-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the template sheet does
if (!customElements.get('fluvy-template-card'))
  customElements.define('fluvy-template-card', FluvyTemplateCard);

/*
 * A large tile without its switch (`show_switch`, #160), the design page's frames on real cards: today's switch beside
 * the circle, the circle as the switch (`false`) and the level's figure in the switch's place (`value`) — on, off, on
 * with readings and out of reach — two a row on a phone (172), half a desktop section (152), a tile on its own row,
 * three a row (the circle is the switch there already), a group that says it for its tiles and a tile that answers
 * otherwise, a tile that is its own slider, the entities that set a level, the template card, and the three sizes
 * side by side. Light and dark are the page's (`&mode=dark`).
 */

const TILE = 'custom:fluvy-tile-card';
const TILES = 'custom:fluvy-tiles-card';
const TEMPLATE = 'custom:fluvy-template-card';

type Shown = boolean | 'value';
const WORD = { true: 'switch', false: 'no switch', value: 'value' } as const;
const SHOWN: readonly Shown[] = [true, false, 'value'];

/** A dimmable white bulb at 70 %, as Home Assistant reports it. */
const DIMMER = { brightness: 178, supported_color_modes: ['brightness'], color_mode: 'brightness' };
/** A speaker whose volume is set and muted. */
const SPEAKER = 4 | 8;
const PLUG = {
  entity: 'switch.ts_desk_plug',
  readouts: ['sensor.ts_desk_plug_power', 'sensor.ts_desk_plug_energy'],
};

/** The four states of the page: on with its ruler, off, on with readings, out of reach. */
const four = (shown: Shown) => ({
  type: TILES,
  size: 'large',
  columns: 2,
  ...(shown === true ? {} : { show_switch: shown }),
  tiles: ['light.ts_ceiling', 'light.ts_reading', PLUG, 'light.ts_porch'],
});
/** A lone tile, half a section. */
const half = (entity: string, shown: Shown, more: Record<string, unknown> = {}) => ({
  type: TILE,
  entity,
  ...(shown === true ? {} : { show_switch: shown }),
  cols: 6,
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    ['light.ts_ceiling', 'on', { friendly_name: 'Ceiling', ...DIMMER }],
    [
      'light.ts_reading',
      'off',
      { friendly_name: 'Reading', supported_color_modes: ['brightness'] },
    ],
    ['switch.ts_desk_plug', 'on', { friendly_name: 'Desk plug', device_class: 'outlet' }],
    [
      'sensor.ts_desk_plug_power',
      '142',
      { friendly_name: 'Desk plug Power', unit_of_measurement: 'W', device_class: 'power' },
    ],
    [
      'sensor.ts_desk_plug_energy',
      '1.2',
      { friendly_name: 'Desk plug Energy', unit_of_measurement: 'kWh', device_class: 'energy' },
    ],
    [
      'light.ts_porch',
      'unavailable',
      { friendly_name: 'Porch light', supported_color_modes: ['brightness'] },
    ],
    ['light.ts_full', 'on', { friendly_name: 'Kitchen worktop', ...DIMMER, brightness: 255 }],
    [
      'cover.ts_blinds',
      'open',
      { friendly_name: 'Blinds', supported_features: 15, current_position: 65 },
    ],
    ['fan.ts_fan', 'on', { friendly_name: 'Ceiling fan', percentage: 33, supported_features: 1 }],
    [
      'media_player.ts_speaker',
      'playing',
      {
        friendly_name: 'Speaker',
        supported_features: SPEAKER,
        volume_level: 0.3,
        is_volume_muted: true,
      },
    ],
    ['switch.ts_patio', 'on', { friendly_name: 'Patio' }],
    ['switch.ts_kitchen', 'on', { friendly_name: 'Kitchen' }],
    ['switch.ts_hall', 'off', { friendly_name: 'Hall' }],
  ],
  frames: [
    // two a row on a phone: 172 + 16 + 172
    ...SHOWN.map((shown) => ({
      title: `172 · ${WORD[`${shown}`]}`,
      cards: [four(shown)],
    })),
    // half a desktop section: 152 + 8 + 152, where the head held the circle, 8 of air and the switch and no more
    ...SHOWN.map((shown) => ({
      title: `152 · ${WORD[`${shown}`]}`,
      width: 312,
      gap: 8,
      heights: [152, 172, 211, 266],
      cards: [half('light.ts_ceiling', shown), half('light.ts_reading', shown)],
    })),
    // a lone tile card says it for itself: on with readings and out of reach, half a section each
    ...SHOWN.slice(1).map((shown) => ({
      title: `Tile cards · ${WORD[`${shown}`]}`,
      heights: [152, 172, 211, 266],
      cards: [half('switch.ts_desk_plug', shown, PLUG), half('light.ts_porch', shown)],
    })),
    // a tile on its own row: the head's end is far from the circle, the figure at the end as a sensor's reading
    {
      title: 'A row of its own',
      cards: [
        { type: TILE, entity: 'light.ts_ceiling', show_switch: false },
        { type: TILE, entity: 'light.ts_ceiling', show_switch: 'value' },
      ],
    },
    // the widest figure a level says holds beside the circle at every width the figure goes up at
    {
      title: '152 · value at 100 %',
      width: 312,
      gap: 8,
      cards: [half('light.ts_full', 'value'), half('cover.ts_blinds', 'value')],
    },
    // three a row on a phone: under 132 the circle is the switch whatever is asked, and a figure that would not hold
    // beside it stays on the line
    ...SHOWN.map((shown) => ({
      title: `Three a row · ${WORD[`${shown}`]}`,
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 3,
          ...(shown === true ? {} : { show_switch: shown }),
          tiles: ['light.ts_ceiling', 'light.ts_reading', 'switch.ts_patio'],
        },
      ],
    })),
    // the group says it for its tiles, and a tile answers otherwise
    {
      title: 'A group without, one tile with',
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 2,
          show_switch: false,
          tiles: ['light.ts_ceiling', { entity: 'light.ts_reading', show_switch: true }],
        },
      ],
    },
    {
      title: 'A group with, one tile without',
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 2,
          tiles: [{ entity: 'light.ts_ceiling', show_switch: 'value' }, 'light.ts_reading'],
        },
      ],
    },
    // what sets a level: a cover's position, a fan's speed, a muted player's volume; a plug has none to show
    ...SHOWN.slice(1).map((shown) => ({
      title: `Levels · ${WORD[`${shown}`]}`,
      cards: [
        {
          type: TILES,
          size: 'large',
          columns: 2,
          show_switch: shown,
          tiles: ['cover.ts_blinds', 'fan.ts_fan', 'media_player.ts_speaker', 'switch.ts_patio'],
        },
      ],
    })),
    // a tile that is its own slider: the circle switches, the rest of the tile slides
    {
      title: 'Fill',
      cards: [
        half('light.ts_ceiling', false, { slider_style: 'fill' }),
        half('light.ts_ceiling', 'value', { slider_style: 'fill' }),
      ],
    },
    // out of reach as it rests (`unavailable: quiet`), and a tile whose tap switches it (`tap_action: toggle`)
    {
      title: 'Quiet out of reach · tap toggles',
      cards: [
        half('light.ts_porch', false, { unavailable: 'quiet' }),
        half('switch.ts_patio', false, { tap_action: { action: 'toggle' } }),
      ],
    },
    // the template card's large tile
    {
      title: 'Template card',
      cards: [
        {
          type: TEMPLATE,
          entity: 'light.ts_ceiling',
          variant: 'large',
          show_switch: false,
          cols: 6,
        },
        {
          type: TEMPLATE,
          entity: 'light.ts_ceiling',
          variant: 'large',
          show_switch: 'value',
          secondary: 'state',
          cols: 6,
        },
      ],
    },
    // the family: a large tile without its switch, two compacts and three minis are one tile in three sizes
    {
      title: 'The family',
      cards: [
        half('light.ts_ceiling', false),
        {
          type: TILES,
          columns: 1,
          entities: ['switch.ts_patio', 'light.ts_reading'],
          cols: 6,
        },
        {
          type: TILES,
          size: 'mini',
          entities: ['switch.ts_kitchen', 'switch.ts_hall', 'cover.ts_blinds'],
        },
      ],
    },
  ],
};
