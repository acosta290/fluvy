import type { FrameSpec, SheetSpec } from '../scenes.js';
import { FluvyCoverCard } from '../../../../packages/cards/src/cover/cover-card.js';
import { BLUE } from './glass.js';
import { LINE } from './line.js';

/**
 * The Cover card's tilt as its slats (1.22, #203, the maintainer's design): the window seen from the room, the blind
 * down, at 0, 50 and 100 % — beside the position at a phone's column, under the commands at 211, 172 and 152 — with
 * its presets, counted as the blind comes down (`direction: down`), on a cover that reports its position turned round
 * (`invert_position`), with its badge hidden, see-through on a view's background, read by its edges (E-ink), out of
 * reach, on a cover with no position and in degrees; and the card as it was, its tilt in steps, unchanged; a cover with
 * no position and its favourites, in steps and as slats.
 */

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the vacuum sheet does
if (!customElements.get('fluvy-cover-card'))
  customElements.define('fluvy-cover-card', FluvyCoverCard);

const COVER = 'custom:fluvy-cover-card';
/* cover: OPEN 1 · CLOSE 2 · SET_POSITION 4 · STOP 8 · OPEN_TILT 16 · CLOSE_TILT 32 · STOP_TILT 64 · SET_TILT_POSITION 128 */
const ALL = 255;
/** Louvres: open, close and stop, and their slats to an angle; no position. */
const LOUVRES = 1 + 2 + 8 + 16 + 32 + 64 + 128;

/** The house's rooms, and the room each blind hangs in. */
const ROOMS: Readonly<Record<string, string>> = {
  ct_office: 'Office',
  ct_kitchen: 'Kitchen',
  ct_bedroom: 'Bedroom',
  ct_living: 'Living room',
  ct_patio: 'Patio',
  ct_study: 'Study',
};
const BLINDS: Readonly<Record<string, string>> = {
  ct_office: 'ct_office',
  ct_office_shut: 'ct_office',
  ct_office_open: 'ct_office',
  ct_office_presets: 'ct_office',
  ct_kitchen: 'ct_kitchen',
  ct_bedroom: 'ct_bedroom',
  ct_living: 'ct_living',
  ct_patio: 'ct_patio',
  ct_study: 'ct_study',
};

/** A blind of the house: open part way, its slats where `tilt` says. */
const blind = (
  id: string,
  name: string,
  position: number,
  tilt: number,
  more: Record<string, unknown> = {},
): SheetSpec['states'][number] => [
  `cover.${id}`,
  'open',
  {
    friendly_name: name,
    device_class: 'blind',
    supported_features: ALL,
    current_position: position,
    current_tilt_position: tilt,
    ...more,
  },
];

/** What the patio's louvres are set to most: their slats' angle, as a cover with no position takes a favourite. */
const LOUVRE_FAVOURITES = [
  { name: 'Shade', tilt: 30 },
  { name: 'Breeze', tilt: 70 },
  { name: 'Open', tilt: 100 },
];

/**
 * The card as its slats, at a width of its own: the frame's, the one card spanning it (a section's twelve columns and
 * their gaps would hold it at 176 at the least; a stack of two in a narrow column draws it at 152).
 */
const slats = (title: string, card: Readonly<Record<string, unknown>>, width = 360): FrameSpec => ({
  title,
  width,
  gap: 0,
  cards: [{ type: COVER, tilt_style: 'slats', ...card }],
});

export const sheet: SheetSpec = {
  states: [
    blind('ct_office', 'Office blind', 65, 50),
    blind('ct_office_shut', 'Office blind', 65, 0),
    blind('ct_office_open', 'Office blind', 65, 100),
    blind('ct_office_presets', 'Office blind', 65, 50),
    blind('ct_kitchen', 'Kitchen blind', 65, 25),
    // an integration that reports 100 % where the blind is down, and its slats shut: 30 here is 70 % open, and 60 is
    // its slats 40 % open
    blind('ct_bedroom', 'Bedroom blind', 30, 60),
    blind('ct_living', 'Living room blind', 80, 50),
    [
      'cover.ct_patio',
      'open',
      {
        friendly_name: 'Patio louvres',
        device_class: 'shade',
        supported_features: LOUVRES,
        current_tilt_position: 70,
      },
    ],
    // out of reach: Home Assistant keeps what it does and loses every live attribute
    [
      'cover.ct_study',
      'unavailable',
      { friendly_name: 'Study blind', device_class: 'blind', supported_features: ALL },
    ],
  ],
  frames: [
    // the release's picture: a phone's column, the slats beside the position
    slats('Slats · half open', { entity: 'cover.ct_office' }),
    slats('Slats · shut', { entity: 'cover.ct_office_shut' }),
    slats('Slats · open', { entity: 'cover.ct_office_open' }),
    slats('Slats · presets, its badge hidden', {
      entity: 'cover.ct_office_presets',
      position_presets: [0, 50, 100],
      tilt_presets: [0, 50, 100],
      show_badge: false,
    }),
    slats('Slats · counted as it comes down', { entity: 'cover.ct_kitchen', direction: 'down' }),
    slats('Slats · a cover that reports it turned round', {
      entity: 'cover.ct_bedroom',
      invert_position: true,
      invert_tilt: true,
      open_label: 'Up',
      closed_label: 'Down',
    }),
    // narrower, under the commands: the word gives way first, then the figure steps down at 152
    slats('Slats · 211', { entity: 'cover.ct_office' }, 211),
    slats('Slats · 172', { entity: 'cover.ct_office', tilt_presets: [0, 50, 100] }, 172),
    slats('Slats · 152', { entity: 'cover.ct_office' }, 152),
    slats('Slats · no position', { entity: 'cover.ct_patio', tilt_presets: [0, 50, 100] }),
    slats('Slats · in degrees', { entity: 'cover.ct_living', tilt_angle: 90 }),
    {
      ...slats('Slats · see-through at 60 %', { entity: 'cover.ct_office', card_opacity: 60 }),
      backdrop: BLUE,
    },
    { ...slats('Slats · E-ink', { entity: 'cover.ct_office' }), palette: LINE },
    slats('Slats · out of reach', { entity: 'cover.ct_study' }),
    // the card as it was: no key asked, its tilt a readout and a stepper; under about 200, where the side column
    // cannot hold the stepper, the tilt now stands under the commands, where it can still be set
    ...[360, 172, 152].map((width): FrameSpec => ({
      title: width === 360 ? 'Steps · as before' : `Steps · ${width}, the tilt under the commands`,
      width,
      gap: 0,
      cards: [{ type: COVER, entity: 'cover.ct_office' }],
    })),
    // louvres with no position and their favourites, in steps and as slats: the favourites under the commands
    {
      title: 'No position · favourites',
      width: 360,
      gap: 0,
      cards: [{ type: COVER, entity: 'cover.ct_patio', favorites: LOUVRE_FAVOURITES }],
    },
    slats('Slats · no position, favourites', {
      entity: 'cover.ct_patio',
      favorites: LOUVRE_FAVOURITES,
    }),
  ],
  registry: {
    entities: Object.fromEntries(
      Object.entries(BLINDS).map(([id, area_id]) => [
        `cover.${id}`,
        { entity_id: `cover.${id}`, area_id },
      ]),
    ),
    areas: Object.fromEntries(
      Object.entries(ROOMS).map(([area_id, name]) => [area_id, { area_id, name }]),
    ),
  },
};
