import { FluvyExpanderCard } from '../../../../packages/cards/src/expander/expander-card.js';
import { FluvyMediaCard } from '../../../../packages/cards/src/media/media-card.js';
import { FluvyTemplateCard } from '../../../../packages/cards/src/template/template-card.js';
import type { StateSeed } from '../hass.js';
import { defineCardWrapper } from '../hui-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as ambient } from './ambient.js';
import { sheet as calendar } from './calendar.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the web sheet does; the
// cards it holds are Home Assistant's to build, whose wrapper is not here: the playground's stands in
if (!customElements.get('fluvy-expander-card'))
  customElements.define('fluvy-expander-card', FluvyExpanderCard);
if (!customElements.get('fluvy-media-card'))
  customElements.define('fluvy-media-card', FluvyMediaCard);
if (!customElements.get('fluvy-template-card'))
  customElements.define('fluvy-template-card', FluvyTemplateCard);
defineCardWrapper();

const EXPANDER = 'custom:fluvy-expander-card';

type Attributes = Record<string, unknown>;
/** A lamp that dims, lit at `level` % (or off). */
const lamp = (name: string, level?: number): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['brightness'],
  ...(level === undefined
    ? {}
    : { color_mode: 'brightness', brightness: Math.round((level / 100) * 255) }),
});
const reading = (name: string, unit: string, device_class: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class,
  state_class: 'measurement',
});
/* supported_features bits of media_player: pause, volume, mute, previous, next, on, off, play, stop */
const SPEAKER = 1 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 4096;

/** Album art as a data URI: the playground never reaches out to the network. */
const ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6f5e"/><stop offset="1" stop-color="#e2b96a"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="72" cy="66" r="42" fill="#ffffff" opacity="0.22"/><circle cx="168" cy="186" r="66" fill="#000000" opacity="0.12"/></svg>',
  );

const STATES: readonly StateSeed[] = [
  ['light.ex_terrace', 'on', lamp('Terrace', 60)],
  ['light.ex_path', 'off', lamp('Path')],
  ['light.ex_pergola', 'off', lamp('Pergola')],
  ['switch.ex_lawn', 'off', { friendly_name: 'Lawn' }],
  ['switch.ex_beds', 'on', { friendly_name: 'Beds' }],
  ['switch.ex_fountain', 'off', { friendly_name: 'Fountain' }],
  ['sensor.ex_soil', '41', reading('Soil moisture', '%', 'moisture')],
  ['sensor.ex_garden_temperature', '18.4', reading('Outside', '°C', 'temperature')],
  ['sensor.ex_rain', '0.6', reading('Rain today', 'mm', 'precipitation')],
  ['binary_sensor.ex_garden_door', 'off', { friendly_name: 'Garden door', device_class: 'door' }],
  [
    'binary_sensor.ex_garage_door',
    'on',
    { friendly_name: 'Garage door', device_class: 'garage_door' },
  ],
  ['light.ex_garage', 'on', lamp('Ceiling', 100)],
  ['switch.ex_charger', 'off', { friendly_name: 'Charger' }],
  ['light.ex_guest', 'off', lamp('Guest')],
  ['light.ex_attic', 'off', lamp('Attic')],
  ['switch.ex_heater', 'off', { friendly_name: 'Sauna' }],
  ['switch.ex_dehumidifier', 'on', { friendly_name: 'Pump' }],
  [
    'media_player.ex_living',
    'playing',
    {
      friendly_name: 'Living room',
      supported_features: SPEAKER,
      media_title: 'Harvest Moon',
      media_artist: 'Neil Young',
      entity_picture: ART,
      volume_level: 0.34,
      is_volume_muted: false,
    },
  ],
  [
    'media_player.ex_kitchen',
    'paused',
    { friendly_name: 'Kitchen speaker', supported_features: SPEAKER, volume_level: 0.2 },
  ],
  [
    'media_player.ex_bedroom',
    'off',
    { friendly_name: 'Bedroom speaker', supported_features: SPEAKER },
  ],
  ['media_player.ex_tv', 'off', { friendly_name: 'Television', supported_features: SPEAKER }],
];

const GARDEN = [
  'light.ex_terrace',
  'light.ex_path',
  'light.ex_pergola',
  'switch.ex_lawn',
  'switch.ex_beds',
];
const SPEAKERS = ['media_player.ex_living', 'media_player.ex_kitchen', 'media_player.ex_bedroom'];

/** The garden's lights on the precision dimmer and in tiles, its sprinklers as tiles, what the soil says. */
const LIGHT = { type: 'custom:fluvy-light-card', entity: 'light.ex_terrace' };
const SPRINKLERS = {
  type: 'custom:fluvy-tiles-card',
  size: 'compact',
  columns: 2,
  tiles: [
    { entity: 'light.ex_path' },
    { entity: 'light.ex_pergola' },
    { entity: 'switch.ex_lawn', icon: 'drop' },
    { entity: 'switch.ex_beds', icon: 'leaf' },
  ],
};
const SOIL = {
  type: 'custom:fluvy-readouts-card',
  entities: ['sensor.ex_soil', 'sensor.ex_garden_temperature', 'sensor.ex_rain'],
};
const GARDEN_CARDS = [LIGHT, SPRINKLERS, SOIL];

/**
 * The evening the sheets share, Thursday 17 September 2026 at 21:47, on the cards that tell it: a clock with the
 * weather beside its date, the forecast (the ambient sheet's) and the days ahead (the calendar sheet's).
 */
const CLOCK = {
  type: 'custom:fluvy-clock-card',
  face: 'digital',
  weather: 'weather.am_home',
  show_forecast: false,
  _now: '2026-09-17T21:47:12',
};
/** The card of another sheet's frame, by the frame's title. */
const cardOf = (sheet: SheetSpec, title: string): SheetSpec['frames'][number]['cards'][number] => {
  const card = sheet.frames.find((frame) => frame.title === title)?.cards[0];
  if (!card) throw new Error(`expander: no frame "${title}"`);
  return card;
};
const FORECAST = cardOf(ambient, 'Weather');
const AGENDA = cardOf(calendar, 'Upcoming');
/** What the evening's cards read: the weather and its sun, the household's calendars. */
const EVENING: readonly StateSeed[] = [
  ...ambient.states.filter(([id]) => id === 'weather.am_home' || id === 'sun.sun'),
  ...calendar.states.filter(([id]) => /^calendar\.(chores|family|ona|personal|services)$/.test(id)),
];

/**
 * The day at a glance (#186): a clock for a head, the forecast and the days ahead under it. `title` names the button
 * that folds it.
 */
const today = (extra: Record<string, unknown> = {}) => ({
  type: EXPANDER,
  title: 'Today',
  head_cards: [CLOCK],
  remember: 'off',
  cards: [FORECAST, AGENDA],
  ...extra,
});

/** What a card asks of an expander: Home Assistant's `fire-dom-event`, with whom it asks and what. */
const ask = (fluvy_expander: unknown) => ({ action: 'fire-dom-event', fluvy_expander });

/** A view's background behind see-through cards: dusk over the garden. */
const DUSK = 'linear-gradient(160deg, #1f2f4f 0%, #6f5a86 52%, #e39a72 100%)';

/** A garden on one surface: folded unless told otherwise, and nothing kept between two looks at the sheet. */
const garden = (extra: Record<string, unknown> = {}) => ({
  type: EXPANDER,
  title: 'Garden',
  icon: 'leaf',
  entities: GARDEN,
  remember: 'off',
  cards: GARDEN_CARDS,
  ...extra,
});

/** What is seldom used, kept out of the way: tiles under a head. */
const seldom = (extra: Record<string, unknown> = {}) => ({
  type: EXPANDER,
  title: 'Seldom used',
  icon: 'archive',
  tone: 'neutral',
  entities: ['light.ex_guest', 'light.ex_attic', 'switch.ex_heater', 'switch.ex_dehumidifier'],
  remember: 'off',
  cards: [
    {
      type: 'custom:fluvy-tiles-card',
      size: 'compact',
      columns: 2,
      entities: ['light.ex_guest', 'light.ex_attic', 'switch.ex_heater', 'switch.ex_dehumidifier'],
    },
  ],
  ...extra,
});

/** Home Assistant's own cards beside one of Fluvy's: the player, the speakers as its entities card lists them. */
const media = (extra: Record<string, unknown> = {}) => ({
  type: EXPANDER,
  title: 'Media',
  icon: 'speaker',
  tone: 'media',
  entities: SPEAKERS,
  remember: 'off',
  expanded: true,
  cards: [
    { type: 'custom:fluvy-media-card', entity: 'media_player.ex_living', variant: 'mini' },
    { type: 'entities', title: 'Speakers', entities: [...SPEAKERS, 'media_player.ex_tv'] },
    { type: 'markdown', content: 'The television switches itself off at midnight.' },
  ],
  ...extra,
});

/**
 * The Expander card (#180): any cards under a head that folds — on one surface with the head, the cards drawing none
 * of their own (Fluvy's, and Home Assistant's through its `--ha-card-*`), or each on its own under a head that stands
 * on the page; folded and open, in columns, nested, at a phone's column, in half a section and across a desktop;
 * the head's count, its chevron at either end, a head that runs another thing and leaves the fold to a round, a
 * condition that opens it, a card it cannot build, and no cards yet. Since #186: cards for a head (a clock, folded
 * and open, the chevron beside it, at the foot, larger, on the page), the foot under a head of words, a card that
 * opens another by its name, Home Assistant's cards that pad their own way, and see-through over a view's
 * background.
 */
export const sheet: SheetSpec = {
  states: [...STATES, ...EVENING],
  ...(ambient.ws ? { ws: ambient.ws } : {}),
  ...(calendar.api ? { api: calendar.api } : {}),
  frames: [
    { title: 'Garden · folded', cards: [garden()] },
    { title: 'Garden · open', cards: [garden({ expanded: true })] },
    // the reporter's case: what is seldom used, out of the way until it is asked for
    { title: 'Seldom used · folded and open', cards: [seldom(), seldom({ expanded: true })] },
    // Home Assistant's own cards wear no surface inside, and take the head's column
    { title: 'Media · Home Assistant’s cards', cards: [media()] },
    // no surface: the head on the page, the cards on their own
    {
      title: 'Plain · open',
      cards: [garden({ style: 'plain', expanded: true })],
    },
    { title: 'Plain · folded', cards: [garden({ style: 'plain' })] },
    // an expander inside another: on the outer one's surface it folds as a part of it
    {
      title: 'Nested',
      cards: [
        {
          type: EXPANDER,
          title: 'Outside',
          icon: 'home',
          subtitle: 'Garden and garage',
          remember: 'off',
          expanded: true,
          cards: [
            garden({ expanded: true, cards: [SPRINKLERS] }),
            {
              type: EXPANDER,
              title: 'Garage',
              icon: 'garage',
              entities: ['light.ex_garage', 'switch.ex_charger'],
              remember: 'off',
              cards: [
                {
                  type: 'custom:fluvy-tiles-card',
                  size: 'compact',
                  entities: ['light.ex_garage', 'switch.ex_charger'],
                },
              ],
            },
          ],
        },
      ],
    },
    // its own words on the line, the count after them; its circle's own colour, and its surface's wash
    {
      title: 'Its line · its colours',
      cards: [
        garden({ subtitle: 'Back of the house', icon_color: 'green' }),
        garden({
          title: 'Garden at night',
          subtitle: '{{ states("sensor.ex_garden_temperature") }} °C',
          card_color: 'teal',
          icon: 'moon',
          show_summary: false,
        }),
      ],
    },
    // the card's colour is its circle's and that of the cards it holds that name none: a group in one colour
    {
      title: 'A group in its colour',
      cards: [garden({ expanded: true, color: 'green', cards: [SPRINKLERS, SOIL] })],
    },
    // the chevron at the start, none at all, no circle, no count
    {
      title: 'Chevron · circle',
      cards: [
        garden({ chevron_position: 'start' }),
        garden({ show_chevron: false }),
        garden({ show_icon: 'never', show_summary: false }),
      ],
    },
    // a head that goes somewhere leaves the fold to its chevron, a round of its own
    {
      title: 'A tap of its own',
      cards: [
        garden({ tap_action: { action: 'navigate', navigation_path: '/lovelace/garden' } }),
        garden({
          style: 'plain',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/garden' },
        }),
      ],
    },
    // it opens by itself while the garage door is open
    {
      title: 'Opens by itself',
      cards: [
        {
          type: EXPANDER,
          title: 'Garage',
          icon: 'garage',
          subtitle: 'Open while its door is',
          remember: 'off',
          open_when: { entity: 'binary_sensor.ex_garage_door', state: 'on' },
          cards: [
            {
              type: 'custom:fluvy-tiles-card',
              size: 'compact',
              entities: ['light.ex_garage', 'switch.ex_charger'],
            },
          ],
        },
      ],
    },
    // two in a section's halves: the head gives way in its order, the count first
    {
      title: 'Half pairs',
      heights: [152, 172],
      cards: [
        { ...garden(), cols: 6 },
        { ...seldom(), cols: 6 },
      ],
    },
    {
      title: 'Half pairs · plain',
      heights: [152, 172],
      cards: [
        { ...garden({ style: 'plain' }), cols: 6 },
        { ...seldom({ style: 'plain', chevron_position: 'start' }), cols: 6 },
      ],
    },
    // a quarter and a third of a section: the chevron gives way before the name is a stump, the count says its least
    {
      title: 'Quarters',
      cards: [
        { ...garden(), cols: 3 },
        { ...seldom(), cols: 3 },
        { ...garden({ style: 'plain' }), cols: 3 },
        { ...garden({ show_chevron: false }), cols: 3 },
      ],
    },
    {
      title: 'Thirds',
      cards: [
        { ...garden(), cols: 4 },
        { ...seldom(), cols: 4 },
        { ...garden({ style: 'plain' }), cols: 4 },
      ],
    },
    // side by side where the width holds them: two on a phone, three across a desktop
    {
      title: 'Columns 2',
      cards: [
        garden({
          title: 'Watering',
          icon: 'drop',
          tone: 'water',
          entities: ['switch.ex_lawn', 'switch.ex_beds'],
          expanded: true,
          columns: 2,
          cards: [
            {
              type: 'custom:fluvy-tiles-card',
              size: 'compact',
              columns: 1,
              tiles: [
                { entity: 'switch.ex_lawn', icon: 'drop' },
                { entity: 'switch.ex_beds', icon: 'leaf' },
              ],
            },
            SOIL,
          ],
        }),
      ],
    },
    {
      title: 'Columns 3 · 1400',
      width: 1400,
      cards: [garden({ expanded: true, columns: 3 })],
    },
    {
      title: 'Plain · columns 3 · 1400',
      width: 1400,
      cards: [garden({ style: 'plain', expanded: true, columns: 3 })],
    },
    // a card that cannot be built says so in its place; one hidden by its own conditions leaves no gap
    {
      title: 'A card it cannot build · a hidden one',
      cards: [
        garden({
          expanded: true,
          cards: [
            { type: 'custom:fluvy-light-card' },
            {
              ...SPRINKLERS,
              visibility: [
                { condition: 'state', entity: 'binary_sensor.ex_garden_door', state: 'on' },
              ],
            },
            SOIL,
          ],
        }),
      ],
    },
    { title: 'No cards yet', cards: [garden({ expanded: true, cards: [] })] },
    // every card it holds hidden (the garden door is shut), the open expander hides too; the folded one cannot know
    {
      title: 'Hidden with its cards',
      cards: [
        garden({
          title: 'While the door is open',
          expanded: true,
          cards: [
            {
              ...SPRINKLERS,
              visibility: [
                { condition: 'state', entity: 'binary_sensor.ex_garden_door', state: 'on' },
              ],
            },
          ],
        }),
        garden({ title: 'Folded' }),
      ],
    },
    // as the person left it, on this device: what the other frames switch off, so two looks at the sheet agree
    { title: 'Remembers', cards: [seldom({ title: 'Left open', remember: 'device' })] },
    // cards for a head (#186): a clock where the title would stand, there while it is folded; the chevron a round
    // of its own beside it
    { title: 'Clock head · folded', cards: [today()] },
    { title: 'Clock head · open', cards: [today({ expanded: true })] },
    // the chevron at the foot: the clock has the head's whole width, and what folds it says so
    {
      title: 'Clock head · Show more',
      cards: [today({ chevron_position: 'bottom' })],
    },
    {
      title: 'Clock head · Show less',
      cards: [today({ chevron_position: 'bottom', expanded: true, cards: [FORECAST] })],
    },
    // on a wall: the forecast and the days ahead side by side under the clock, the round a hand finds
    {
      title: 'Clock head · wall',
      width: 760,
      cards: [today({ expanded: true, columns: 2, chevron_size: 'large' })],
    },
    // no surface: the clock keeps its own, the round stands beside it on the page
    {
      title: 'Clock head · plain',
      cards: [today({ style: 'plain' }), today({ style: 'plain', chevron_position: 'bottom' })],
    },
    // two tiles for a head, each on its own surface, and what folds them under them
    {
      title: 'Two tiles for a head',
      cards: [
        today({
          style: 'plain',
          columns: 2,
          chevron_position: 'bottom',
          head_cards: [
            { ...CLOCK, variant: 'tile', weather: undefined },
            { ...CLOCK, variant: 'tile' },
          ],
          cards: [FORECAST],
        }),
      ],
    },
    // the foot under a head of words, on its surface and on the page; open, it follows what it holds
    {
      title: 'A foot',
      cards: [
        garden({ chevron_position: 'bottom' }),
        garden({ chevron_position: 'bottom', style: 'plain' }),
        seldom({ chevron_position: 'bottom', expanded: true }),
      ],
    },
    // in a section's halves the foot keeps its words while the column holds either of them, and its chevron alone
    // says the same where it does not
    {
      title: 'Half pairs · foot',
      heights: [152, 172],
      cards: [
        { ...garden({ chevron_position: 'bottom' }), cols: 6 },
        { ...seldom({ chevron_position: 'bottom', chevron_size: 'large' }), cols: 6 },
      ],
    },
    // a larger chevron, for a hand at a wall: the mark at either end, the round, the foot
    {
      title: 'Large chevron',
      cards: [
        garden({ chevron_size: 'large' }),
        garden({ chevron_size: 'large', chevron_position: 'start' }),
        garden({
          chevron_size: 'large',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/garden' },
        }),
        garden({ chevron_size: 'large', chevron_position: 'bottom' }),
      ],
    },
    // opened from another card: a tile that asks for it by its name, and the clock itself, which asks the expander
    // that holds it; no chevron at all
    {
      title: 'Opened from another card',
      cards: [
        {
          type: 'custom:fluvy-template-card',
          name: 'Forecast',
          secondary: 'Open it under the clock',
          icon: 'cloudSun',
          tap_action: ask({ id: 'forecast', action: 'toggle' }),
        },
        today({
          id: 'forecast',
          show_chevron: false,
          head_cards: [{ ...CLOCK, tap_action: ask('toggle') }],
          cards: [FORECAST],
        }),
      ],
    },
    // Home Assistant's cards that do not pad by its 16 (#186): a heading's words and a picture in the column, a tile
    // in it on its own surface, as a tile of Fluvy's
    {
      title: 'Home Assistant’s heading, tile and picture',
      cards: [
        garden({
          title: 'Terrace',
          icon: 'home',
          entities: ['light.ex_terrace', 'light.ex_path'],
          expanded: true,
          cards: [
            { type: 'heading', heading: 'Lights' },
            { type: 'tile', entity: 'light.ex_terrace' },
            { type: 'picture', image: ART },
          ],
        }),
      ],
    },
    // see-through, over a view's background (#186): the surface blurs what shows through, once; what it holds draws
    // no box of its own in it, and the hairline under the head stays
    {
      title: 'See-through',
      backdrop: DUSK,
      cards: [
        garden({
          expanded: true,
          card_opacity: 60,
          cards: GARDEN_CARDS.map((card) => ({ ...card, card_opacity: 60 })),
        }),
      ],
    },
  ],
};
