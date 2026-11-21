import type { LovelaceCardConfig } from '@fluvy/core';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { sheet as ambient } from './ambient.js';
import { sheet as climate } from './climate.js';
import { sheet as motion } from './devices-motion.js';
import { sheet as security } from './devices-security.js';
import { sheet as media } from './media.js';
import { sheet as slider } from './slider.js';
import { sheet as solar } from './solar.js';

/**
 * Long names in a head (#191): a name in two lines where one would end it in an ellipsis (`name_lines: 2`), balanced,
 * the head a line taller whatever the name says, so a row of cards stays level — the reporter's two inverter arrays,
 * cut alike on one line and read apart on two, in English and as his house names them; every kind of head under a
 * long name as a full card and in half a section; and the player whose column lets its art go, its head the three
 * lines' 64 (#191.1). Every head with its name hidden (`name_lines: 0`, #237), its circle and its line kept.
 */

/** A card of another sheet's frame, as that sheet draws it, its own columns left to this sheet. */
function from(source: SheetSpec, title: string, index = 0): LovelaceCardConfig {
  const card = source.frames.find((f) => f.title === title)?.cards[index];
  if (!card) throw new Error(`head-lines: no card ${index} in "${title}"`);
  return Object.fromEntries(
    Object.entries(card).filter(([key]) => key !== 'cols'),
  ) as LovelaceCardConfig;
}

const W = { unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' };
/**
 * An array's last twelve hours in watts, a half hour apart up to the sheet's evening: the morning's rise, the noon's
 * peak, the sun going down; the last its reading now.
 */
const day = (peak: number): number[] =>
  Array.from({ length: 49 }, (_, i) => Math.round(Math.sin(((i + 2) / 54) * Math.PI) * peak));
const NORTH = day(2100);
const SOUTH = day(3700);

/** The reporter's two arrays: one name each, alike but for the array and its side. */
const ARRAYS = [
  [
    'sensor.inverter_e1_north_power',
    'Inverter E1 North MPPT total power',
    '逆变器 E1 北 MPPT 总功率W',
  ],
  [
    'sensor.inverter_e2_south_power',
    'Inverter E2 South MPPT total power',
    '逆变器 E2 南 MPPT 总功率W',
  ],
] as const;
const arrays = (lines: 1 | 2, words: 1 | 2 = 1): LovelaceCardConfig[] =>
  ARRAYS.map((array) => ({
    type: 'custom:fluvy-energy-card',
    entity: array[0],
    name: array[words],
    variant: 'compact',
    ...(lines === 2 ? { name_lines: 2 } : {}),
  }));

/** Each kind of head under a long name, its name in two lines. */
const HEADS: readonly LovelaceCardConfig[] = [
  { ...from(slider, 'On'), name: 'Dining table pendant over the oak table' },
  { ...from(climate, 'Heat'), name: 'Living room underfloor heating', variant: 'compact' },
  { ...from(motion, 'Blinds'), name: 'Living room blinds by the garden doors' },
  { ...from(ambient, 'Sensors', 2), name: 'Main bedroom temperature by the bed' },
  {
    type: 'custom:fluvy-gauge-card',
    entity: 'sensor.so_solar_power',
    max_entity: 'sensor.so_solar_capacity',
    name: 'Solar inverter output on the garage roof',
  },
].map((card) => ({ ...card, name_lines: 2 }));

/** Each kind of head with its name hidden (#237): its circle, its line and what trails them where they were. */
const NAMELESS: readonly LovelaceCardConfig[] = HEADS.map((card) => ({ ...card, name_lines: 0 }));

/** In half a section, two on a phone's line: the arrays, a lock and a blind, each compact. */
const HALF: readonly LovelaceCardConfig[] = [
  ...arrays(2),
  {
    type: 'custom:fluvy-lock-card',
    entity: 'lock.front_door',
    variant: 'compact',
    name: 'Front door deadbolt',
  },
  { ...from(motion, 'Blinds'), name: 'Kitchen window blind', variant: 'compact' },
].map((card) => ({ ...card, name_lines: 2, cols: 6 }));

const frames: FrameSpec[] = [
  // the reporter's arrays: one line cuts both to the same "Inverter E…", two read the array and its side
  { title: 'Two arrays · one line', cards: arrays(1) },
  { title: 'Two arrays · two lines', cards: arrays(2) },
  // as the reporter's phone draws them at 125 %: a 256 card
  { title: 'Two arrays · two lines, in Chinese', width: 288, cards: arrays(2, 2) },
  { title: 'Every head · two lines', cards: [...HEADS] },
  { title: 'Half a section · two lines', cards: [...HALF], heights: [152, 172] },
  // #237: the same heads with no name, each its 44 still, beside the same cards with theirs
  { title: 'Every head · no name', cards: [...NAMELESS] },
  {
    title: 'Half a section · no name',
    cards: HALF.map((card) => ({ ...card, name_lines: 0 })),
    heights: [152, 172],
  },
  // a column under 296 lets the player's art go: its head is its three lines' 64, the round centred on them
  { title: 'Media · a narrow column', width: 288, cards: [from(media, 'Playing')] },
  { title: 'Media · a narrow column, off', width: 288, cards: [from(media, 'Off')] },
];

export const sheet: SheetSpec = {
  states: [
    ...slider.states,
    ...climate.states,
    ...motion.states,
    ...security.states,
    ...ambient.states,
    ...solar.states,
    ...media.states,
    ['sensor.inverter_e1_north_power', String(NORTH.at(-1)), { friendly_name: ARRAYS[0][1], ...W }],
    ['sensor.inverter_e2_south_power', String(SOUTH.at(-1)), { friendly_name: ARRAYS[1][1], ...W }],
  ],
  registry: {
    entities: { ...security.registry?.entities, ...ambient.registry?.entities },
    devices: { ...security.registry?.devices, ...ambient.registry?.devices },
    areas: { ...security.registry?.areas, ...ambient.registry?.areas },
    floors: { ...security.registry?.floors, ...ambient.registry?.floors },
  },
  history: {
    ...solar.history,
    ...ambient.history,
    'sensor.inverter_e1_north_power': NORTH,
    'sensor.inverter_e2_south_power': SOUTH,
  },
  ws: { ...solar.ws, ...ambient.ws },
  frames,
};
