import type { LovelaceCardConfig } from '@fluvy/core';
import type { StateSeed } from '../hass.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

/**
 * Exact colours (1.25, #250): the same cards in five colours a person names — Home Assistant's amber, teal and indigo,
 * a pink typed as a hex, and its yellow — first in the palette's tones of them (the house's way, as before), then worn
 * as named (`exact_colors: true`): Home Assistant's own value for a name, a hex as given, the glyphs, the lines, the
 * bars and the fills in it exactly, the words on a fill black or white, a figure written in it nudged only as far as it
 * reads. `&exact=1` asks it of the house instead.
 */
const light = (id: string, name: string, state = 'on'): StateSeed => [
  `light.${id}`,
  state,
  {
    friendly_name: name,
    supported_color_modes: ['brightness'],
    ...(state === 'on' ? { brightness: 204 } : {}),
  },
];
const humidity = (id: string, name: string, value: string): StateSeed => [
  `sensor.${id}`,
  value,
  {
    friendly_name: name,
    unit_of_measurement: '%',
    device_class: 'humidity',
    state_class: 'measurement',
  },
];

/** The five colours, each on a room of its own: three of Home Assistant's names, a hex typed, and its yellow. */
const COLOURS = [
  ['ex_kitchen', 'Kitchen pendant', 'amber', 'Kitchen'],
  ['ex_lounge', 'Reading lamp', 'teal', 'Lounge'],
  ['ex_bedroom', 'Bedside lamp', '#e91e63', 'Bedroom'],
  ['ex_hall', 'Hallway', 'indigo', 'Hall'],
  ['ex_porch', 'Porch light', 'yellow', 'Porch'],
] as const;

/** Colour bulbs lit in a colour of their own: a tile shows the bulb's colour (`light_colors`), exactly where it asks. */
const BULBS = [
  ['ex_strip', 'TV backlight', [255, 64, 129]],
  ['ex_globe', 'Garden globe', [0, 176, 255]],
  ['ex_lantern', 'Lantern', [255, 145, 0]],
  ['ex_nook', 'Reading nook', [124, 77, 255]],
] as const;

const walk = (from: number, step: number, n = 24): number[] =>
  Array.from({ length: n }, (_, i) =>
    Number((from + Math.sin(i / 3) * step + (i % 5) * step * 0.1).toFixed(1)),
  );

/** The tiles: the five lamps lit in their colours, and the study's off in amber (its rest wash). */
const tiles = (exact: boolean): LovelaceCardConfig => ({
  type: 'custom:fluvy-tiles-card',
  tint: 'always',
  tiles: [
    ...COLOURS.map(([id, , color]) => ({ entity: `light.${id}`, color })),
    { entity: 'light.ex_study', color: 'amber' },
  ],
  ...(exact ? { exact_colors: true } : {}),
});

/** The colour bulbs, each tile in what its bulb glows. */
const bulbs = (exact: boolean): LovelaceCardConfig => ({
  type: 'custom:fluvy-tiles-card',
  light_colors: true,
  tiles: BULBS.map(([id]) => `light.${id}`),
  ...(exact ? { exact_colors: true } : {}),
});

/** A lamp in amber, lit (its surface in the colour), the rooms' chips, the rooms' humidity in bars, a chart in teal. */
const others = (exact: boolean): LovelaceCardConfig[] =>
  [
    { type: 'custom:fluvy-light-card', entity: 'light.ex_kitchen', color: 'amber', tint: 'on' },
    {
      type: 'custom:fluvy-chips-card',
      tint: 'always',
      chips: COLOURS.map(([, , color, room], at) => ({
        name: room,
        path: at === 0 ? '/' : `/fluvy-home/${room.toLowerCase()}`,
        color,
      })),
    },
    {
      type: 'custom:fluvy-bars-card',
      title: 'Humidity',
      variant: 'compact',
      rows: COLOURS.map(([id, , color]) => ({ entity: `sensor.${id}_humidity`, color })),
    },
    {
      type: 'custom:fluvy-sensor-card',
      entity: 'sensor.ex_power',
      variant: 'chart',
      hours: 6,
      color: 'teal',
    },
  ].map((card) => (exact ? { ...card, exact_colors: true } : card));

const frames: FrameSpec[] = [
  { title: 'Tiles · the palette’s tones', cards: [tiles(false)] },
  { title: 'Tiles · exact colours', cards: [tiles(true)] },
  // the release's picture: the same tiles side by side, each in a phone's column
  {
    title: 'Side by side',
    width: 736,
    cards: [
      { ...tiles(false), cols: 6 },
      { ...tiles(true), cols: 6 },
    ],
  },
  // a lit bulb's own colour follows the card: the palette's tone of it, or what the bulb glows
  {
    title: 'Colour bulbs side by side',
    width: 736,
    cards: [
      { ...bulbs(false), cols: 6 },
      { ...bulbs(true), cols: 6 },
    ],
  },
  { title: 'Light, chips, bars and a chart · the palette’s tones', cards: others(false) },
  { title: 'Light, chips, bars and a chart · exact colours', cards: others(true) },
  // a narrow column: the words on the fills, the bars' figures and the chips still read
  { title: 'Narrow 266 · exact colours', width: 266, cards: [tiles(true), ...others(true)] },
];

export const sheet: SheetSpec = {
  states: [
    ...COLOURS.map(([id, name]) => light(id, name)),
    light('ex_study', 'Study lamp', 'off'),
    ...BULBS.map(([id, name, rgb]): StateSeed => [
      `light.${id}`,
      'on',
      {
        friendly_name: name,
        supported_color_modes: ['hs', 'color_temp'],
        color_mode: 'hs',
        brightness: 230,
        rgb_color: rgb,
      },
    ]),
    humidity('ex_kitchen_humidity', 'Kitchen humidity', '52'),
    humidity('ex_lounge_humidity', 'Lounge humidity', '44'),
    humidity('ex_bedroom_humidity', 'Bedroom humidity', '47'),
    humidity('ex_hall_humidity', 'Hall humidity', '39'),
    humidity('ex_porch_humidity', 'Porch humidity', '71'),
    [
      'sensor.ex_power',
      '640',
      {
        friendly_name: 'House power',
        unit_of_measurement: 'W',
        device_class: 'power',
        state_class: 'measurement',
      },
    ],
  ],
  history: { 'sensor.ex_power': walk(600, 180) },
  frames,
};
