import type { FrameSpec, SheetSpec } from '../scenes.js';
import { FluvyCoverCard } from '../../../../packages/cards/src/cover/cover-card.js';
import { BLUE } from './glass.js';
import { LINE } from './line.js';

/**
 * The horizontal Cover card (1.25, #244, the reporter's mockup): the position on one row, its readout at the left and
 * the house's ruler across the rest with its ends' words over it, the commands under them as outlined pills. Closed
 * as the mockup draws it, part way, open and on its way; with its tilt under the commands, in steps and as its slats;
 * with presets and favourites, counted as it comes down, its ends in words of its own, a valve, the ruler as a bar and
 * a liquid, out of reach, see-through and read by its edges; and in the narrow columns (266, 211, two halves of a
 * phone's section, 152), where the readout stands over the ruler and the ends' words give way to their figures.
 */

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the vacuum sheet does
if (!customElements.get('fluvy-cover-card'))
  customElements.define('fluvy-cover-card', FluvyCoverCard);

const COVER = 'custom:fluvy-cover-card';
/* cover: OPEN 1 · CLOSE 2 · SET_POSITION 4 · STOP 8 · OPEN_TILT 16 · CLOSE_TILT 32 · STOP_TILT 64 · SET_TILT_POSITION 128 */
const ALL = 255;
/** A window, a shade, a garage door, a valve: open, close, stop and a position. */
const POSITIONED = 1 + 2 + 4 + 8;

/** The house's rooms, and the room each cover is in. */
const ROOMS: Readonly<Record<string, string>> = {
  hz_bedroom: 'Main bedroom',
  hz_living: 'Living room',
  hz_kitchen: 'Kitchen',
  hz_office: 'Office',
  hz_garage: 'Garage',
  hz_garden: 'Garden',
  hz_study: 'Study',
};
const IN: Readonly<Record<string, string>> = {
  'cover.hz_window': 'hz_bedroom',
  'cover.hz_living': 'hz_living',
  'cover.hz_kitchen': 'hz_kitchen',
  'cover.hz_office': 'hz_office',
  'cover.hz_garage': 'hz_garage',
  'valve.hz_garden': 'hz_garden',
  'cover.hz_study': 'hz_study',
};

/** A cover of the house at `position` % open. */
const cover = (
  id: string,
  name: string,
  state: string,
  device_class: string,
  more: Record<string, unknown>,
): SheetSpec['states'][number] => [
  `cover.${id}`,
  state,
  { friendly_name: name, device_class, supported_features: POSITIONED, ...more },
];

/** The horizontal card at the frame's width, or the section's where it has none (a 360: its height is held there). */
const horizontal = (
  title: string,
  card: Readonly<Record<string, unknown>>,
  width?: number,
): FrameSpec => ({
  title: `Horizontal · ${title}`,
  ...(width ? { width } : {}),
  gap: 0,
  cards: [{ type: COVER, variant: 'horizontal', ...card }],
});

const MORNING = [
  { name: 'Morning', position: 60 },
  { name: 'Night', position: 0 },
];

export const sheet: SheetSpec = {
  states: [
    // the mockup's: a bedroom's window, shut
    cover('hz_window', 'Window', 'closed', 'window', { current_position: 0 }),
    cover('hz_living', 'Living room blind', 'open', 'blind', { current_position: 45 }),
    cover('hz_kitchen', 'Kitchen shade', 'open', 'shade', { current_position: 100 }),
    cover('hz_garage', 'Garage door', 'closing', 'garage', { current_position: 30 }),
    cover('hz_office', 'Office blind', 'open', 'blind', {
      supported_features: ALL,
      current_position: 65,
      current_tilt_position: 50,
    }),
    [
      'valve.hz_garden',
      'open',
      {
        friendly_name: 'Garden irrigation',
        device_class: 'water',
        supported_features: POSITIONED,
        current_position: 60,
      },
    ],
    // out of reach: Home Assistant keeps what it does and loses every live attribute
    cover('hz_study', 'Study blind', 'unavailable', 'blind', { supported_features: ALL }),
  ],
  frames: [
    // the release's picture: the mockup's card, closed
    horizontal('closed, as the mockup', { entity: 'cover.hz_window' }),
    horizontal('part open', { entity: 'cover.hz_living' }),
    horizontal('open', { entity: 'cover.hz_kitchen' }),
    horizontal('on its way', { entity: 'cover.hz_garage' }),
    horizontal('its tilt under the commands', { entity: 'cover.hz_office' }),
    horizontal('the tilt as its slats', { entity: 'cover.hz_office', tilt_style: 'slats' }),
    horizontal('presets and favourites', {
      entity: 'cover.hz_living',
      position_presets: [0, 50, 100],
      favorites: MORNING,
    }),
    horizontal('counted as it comes down', { entity: 'cover.hz_living', direction: 'down' }),
    horizontal('its ends in its own words', {
      entity: 'cover.hz_living',
      open_label: 'Up',
      closed_label: 'Down',
    }),
    horizontal('a valve', { entity: 'valve.hz_garden' }),
    horizontal('a bar', { entity: 'cover.hz_living', slider_style: 'bar' }),
    horizontal('a liquid', { entity: 'cover.hz_living', slider_style: 'liquid' }),
    horizontal('out of reach', { entity: 'cover.hz_study' }),
    {
      ...horizontal('see-through at 60 %', { entity: 'cover.hz_living', card_opacity: 60 }),
      backdrop: BLUE,
    },
    { ...horizontal('E-ink', { entity: 'cover.hz_living' }), palette: LINE },
    // narrower: 24 between the readout and the ruler closes to 16, then the readout stands over the ruler and the
    // ends' words give way to their figures
    ...[266, 211, 172, 152].map((width) =>
      horizontal(`${width}`, { entity: 'cover.hz_living' }, width),
    ),
    horizontal('152, its tilt under the commands', { entity: 'cover.hz_office' }, 152),
    horizontal(
      '172, counted as it comes down',
      { entity: 'cover.hz_living', direction: 'down' },
      172,
    ),
    {
      title: 'Horizontal · two halves of a phone’s section',
      width: 360,
      cards: [
        { type: COVER, variant: 'horizontal', entity: 'cover.hz_window', cols: 6 },
        { type: COVER, variant: 'horizontal', entity: 'cover.hz_kitchen', cols: 6 },
      ],
    },
  ],
  registry: {
    entities: Object.fromEntries(
      Object.entries(IN).map(([entity_id, area_id]) => [entity_id, { entity_id, area_id }]),
    ),
    areas: Object.fromEntries(
      Object.entries(ROOMS).map(([area_id, name]) => [area_id, { area_id, name }]),
    ),
  },
};
