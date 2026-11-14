import { resolveLanguage, wordsIn, type HomeAssistant, type LovelaceCardConfig } from '@fluvy/core';
import { moreHost } from '../../../../packages/cards/src/strategy/caps.js';
import { findEnergyRoles } from '../../../../packages/cards/src/strategy/energy-roles.js';
import { HomeRegistry } from '../../../../packages/cards/src/strategy/home-registry.js';
import type { CardStyle, StrategyContext } from '../../../../packages/cards/src/strategy/types.js';
import { homeView } from '../../../../packages/cards/src/strategy/views/home.js';
import type { StateSeed } from '../hass.js';
import { NOW, type FrameSpec, type SheetSpec } from '../scenes.js';

/*
 * Which room a light or a scene belongs to (1.21, #189), on a house in the reporter's shape: four rooms on two floors,
 * their lights named with their room ("Kitchen Pendant") and their scenes with a word they all share ("Lights
 * Cooking"). The Tiles card by room, by floor and in sections of its own; the Scenes card as chips by room (the
 * reporter's own card, our way), as chips in one list and as tiles by room; a heading as a label; and Home's lights
 * and scenes as the automatic dashboard writes them when it groups by room and draws its scenes as chips. The house is
 * the frames' own, so no other sheet, nor the automatic dashboard of them all, gains a room. Light and dark are the
 * page's (`&mode=dark`).
 */

const TILES = 'custom:fluvy-tiles-card';
const SCENES = 'custom:fluvy-scenes-card';

/** A bulb that only switches, one that dims, and one in a warm colour. */
const ONOFF = { supported_color_modes: ['onoff'], color_mode: 'onoff' };
const dimmer = (brightness: number) => ({
  brightness,
  supported_color_modes: ['brightness'],
  color_mode: 'brightness',
});

/** The house's rooms, in the order Home Assistant keeps them (Settings › Areas), and their floors. */
const AREAS = [
  { area_id: 'br_living', name: 'Living room', floor_id: 'br_ground', icon: 'mdi:sofa' },
  { area_id: 'br_kitchen', name: 'Kitchen', floor_id: 'br_ground', icon: 'mdi:silverware' },
  { area_id: 'br_dining', name: 'Dining room', floor_id: 'br_ground', icon: 'mdi:table-chair' },
  { area_id: 'br_bedroom', name: 'Bedroom', floor_id: 'br_first', icon: 'mdi:bed' },
] as const;
const FLOORS = [
  { floor_id: 'br_ground', name: 'Ground floor', level: 0 },
  { floor_id: 'br_first', name: 'First floor', level: 1 },
] as const;
type Area = (typeof AREAS)[number]['area_id'];

/** A light of a room, named with it as the house names its lights. */
const light = (
  area: Area | undefined,
  id: string,
  name: string,
  state: 'on' | 'off',
  attributes: Record<string, unknown> = ONOFF,
) => ({
  area,
  seed: [`light.br_${id}`, state, { friendly_name: name, ...attributes }] as StateSeed,
});

const LIGHTS = [
  light('br_kitchen', 'kitchen_island_downlight', 'Kitchen Island downlight', 'on', dimmer(178)),
  light('br_kitchen', 'kitchen_island_uplight', 'Kitchen Island uplight', 'off', dimmer(0)),
  light('br_kitchen', 'kitchen_pendant', 'Kitchen Pendant', 'on'),
  light('br_kitchen', 'kitchen_counter', 'Kitchen Counter', 'off'),
  light('br_dining', 'dining_pendant', 'Dining room Pendant', 'on', dimmer(128)),
  light('br_dining', 'dining_wall', 'Dining room Wall lights', 'off'),
  light('br_living', 'living_floor', 'Living room Floor lamp', 'on', dimmer(90)),
  light('br_living', 'living_reading', 'Living room Reading lamp', 'off'),
  light('br_living', 'living_shelf', 'Living room Shelf', 'on'),
  light('br_bedroom', 'bedroom_ceiling', 'Bedroom Ceiling', 'off', dimmer(0)),
  light('br_bedroom', 'bedroom_bedside', 'Bedroom Bedside', 'off'),
  light(undefined, 'porch', 'Porch', 'on'),
];

/** A room's scenes, each "Lights <what>" as the reporter's are; `at`: when it last ran (an ISO time), never without. */
const scene = (area: Area | undefined, id: string, name: string, at = 'unknown') => ({
  area,
  seed: [`scene.br_${id}`, at, { friendly_name: name }] as StateSeed,
});
const lights = (area: Area, room: string, words: readonly string[], ran: Record<string, string>) =>
  words.map((word) =>
    scene(area, `${room}_${word.toLowerCase()}`, `Lights ${word}`, ran[word] ?? 'unknown'),
  );

const SCENE_LIST = [
  ...lights('br_living', 'living', ['Bright', 'Relax', 'TV', 'Movie'], {
    Relax: '2026-09-17T16:30:00Z',
  }),
  ...lights(
    'br_kitchen',
    'kitchen',
    ['Daylight', 'Bright', 'Cooking', 'Dinner', 'Evening', 'Nightlight'],
    { Cooking: '2026-09-17T19:20:00Z', Evening: '2026-09-17T05:40:00Z' },
  ),
  ...lights(
    'br_dining',
    'dining',
    ['Concentrate', 'Read', 'Daylight', 'Cooking', 'Dinner', 'Evening', 'Rest', 'Nightlight'],
    { Concentrate: '2026-09-17T15:45:00Z' },
  ),
  scene(undefined, 'good_night', 'Good night', '2026-09-16T21:10:00Z'),
  scene(undefined, 'leaving_home', 'Leaving home', '2026-09-17T06:55:00Z'),
];

const THINGS = [...LIGHTS, ...SCENE_LIST];
const idsOf = (things: typeof THINGS, area?: Area): string[] =>
  things.filter((thing) => !area || thing.area === area).map(({ seed: [id] }) => id);
const LIGHT_IDS = idsOf(LIGHTS);
const SCENE_IDS = idsOf(SCENE_LIST);

/** The house the frames stand on: its states beside the page's, its own rooms and floors. */
const STATES = Object.fromEntries(
  THINGS.map(({ seed: [entity_id, state, attributes = {}] }) => [
    entity_id,
    {
      entity_id,
      state,
      attributes,
      last_changed: '2026-09-17T19:20:00Z',
      last_updated: '2026-09-17T19:20:00Z',
    },
  ]),
);
const ENTITIES = Object.fromEntries(
  THINGS.map(({ area, seed: [entity_id] }) => [entity_id, { entity_id, area_id: area }]),
);
const HOUSE = {
  entities: ENTITIES,
  devices: {},
  areas: Object.fromEntries(AREAS.map((area) => [area.area_id, area])),
  floors: Object.fromEntries(FLOORS.map((floor) => [floor.floor_id, floor])),
};
const house = (hass: HomeAssistant): HomeAssistant =>
  ({
    ...hass,
    ...HOUSE,
    states: { ...hass.states, ...STATES },
    entities: { ...hass.entities, ...ENTITIES },
  }) as HomeAssistant;

/** The scenes' clock is the sheets': a tile says how long ago its scene ran, whenever the frame is shot. */
const _now = NOW.toISOString();

/**
 * A part of the Home view as the automatic dashboard writes it for this house (`lights`, `scenes`), with the
 * dashboard's options as its panel sets them: each card at the columns the strategy gives it. Read when the frame is
 * drawn, once the page's words have landed.
 */
const homePart = (part: string, style: CardStyle): (LovelaceCardConfig & { cols?: number })[] => {
  const t = wordsIn(resolveLanguage(new URLSearchParams(location.search).get('lang') ?? 'en'));
  const hass = {
    ...HOUSE,
    states: STATES,
    language: 'en',
    user: { id: 'u1', name: 'Marta', is_admin: true },
  } as unknown as HomeAssistant;
  const home = new HomeRegistry(hass);
  const more = moreHost('home', t('strategy.home'), 'fluvy:home', 3);
  homeView({
    home,
    t,
    base: '/fluvy-auto',
    panelUrl: 'fluvy-auto',
    weather: undefined,
    energy: findEnergyRoles(home, null),
    style,
    areas: undefined,
    greetingTabs: false,
    hass,
    header: 0,
    caps: {},
    more,
  } satisfies StrategyContext);
  return (more.parts.find(({ id }) => id === part)?.cards ?? []).map((card) => ({
    ...card,
    // a scene's tile says how long ago it ran by the sheets' clock, whenever the frame is shot
    ...(card.type === SCENES ? { _now } : {}),
    ...(typeof card.grid_options?.columns === 'number' ? { cols: card.grid_options.columns } : {}),
  }));
};

/** A frame on the sheet's own house. */
const frame = (spec: FrameSpec): FrameSpec => ({ hass: house, ...spec });
/** A frame of a part of Home, drawn at half a section's widths too. */
const homeFrame = (title: string, part: string, style: CardStyle): FrameSpec => ({
  title,
  hass: house,
  heights: [152, 172],
  get cards() {
    return homePart(part, style);
  },
});

export const sheet: SheetSpec = {
  states: [],
  frames: [
    // Home's lights as 1.20 lists them, and by room: each room's under its quiet label, their names short under it
    homeFrame('Home · lights, as they were', 'lights', {}),
    homeFrame('Home · lights by room', 'lights', { byRoom: true }),
    homeFrame('Home · lights by room, as rows', 'lights', { byRoom: true, tiles: 'compact' }),
    // Home's scenes as chips: by room, twelve before their "N more" row; and as tiles by room
    homeFrame('Home · scenes as chips', 'scenes', { sceneChips: true }),
    homeFrame('Home · scenes by room, as tiles', 'scenes', { byRoom: true }),
    // the reporter's own card, our way: every scene of the house as a pill under its room, the last run one filled
    frame({
      title: 'Scenes · chips by room',
      cards: [
        { type: SCENES, title: 'Scenes', variant: 'chips', group_by: 'area', scenes: SCENE_IDS },
      ],
    }),
    // chips in sections of the card's own, a scene with its glyph and one in its colour; and in one list, whole names
    frame({
      title: 'Scenes · chips, sections of its own',
      cards: [
        {
          type: SCENES,
          variant: 'chips',
          scenes: [
            { section: 'Evening' },
            { entity: 'scene.br_living_relax', name: 'Relax', icon: 'mdi:sofa' },
            { entity: 'scene.br_living_movie', name: 'Movie', icon: 'mdi:movie-open' },
            { entity: 'scene.br_kitchen_dinner', name: 'Dinner', color: 'orange' },
            { section: 'Night' },
            'scene.br_good_night',
            { entity: 'scene.br_kitchen_nightlight', name: 'Kitchen nightlight' },
            { entity: 'scene.br_gone', name: 'Garden path' },
          ],
        },
        { type: SCENES, variant: 'chips', scenes: idsOf(SCENE_LIST, 'br_living') },
      ],
    }),
    frame({
      title: 'Scenes · tiles by room',
      cards: [
        {
          type: SCENES,
          title: 'Scenes',
          group_by: 'area',
          scenes: [
            ...idsOf(SCENE_LIST, 'br_living'),
            'scene.br_good_night',
            'scene.br_leaving_home',
          ],
          _now,
        },
      ],
    }),
    // the house's lights on one card, by room: large tiles two a row, an odd one out on a row of its own
    frame({
      title: 'Tiles · by room',
      cards: [{ type: TILES, size: 'large', columns: 2, group_by: 'area', tiles: LIGHT_IDS }],
    }),
    // by floor, A to Z, the names whole
    frame({
      title: 'Tiles · by floor, A to Z, whole names',
      cards: [
        {
          type: TILES,
          group_by: 'floor',
          group_order: 'name',
          short_names: false,
          tiles: LIGHT_IDS,
        },
      ],
    }),
    // sections of the card's own among compact and mini tiles; a name the config gives is never shortened
    frame({
      title: 'Tiles · sections of its own',
      cards: [
        {
          type: TILES,
          tiles: [
            'light.br_porch',
            { section: 'Kitchen' },
            'light.br_kitchen_island_downlight',
            'light.br_kitchen_island_uplight',
            { entity: 'light.br_kitchen_pendant', name: 'Kitchen Pendant' },
            { section: 'Living room' },
            'light.br_living_floor',
            'light.br_living_reading',
          ],
        },
        {
          type: TILES,
          size: 'mini',
          tiles: [
            { section: 'Bedroom' },
            'light.br_bedroom_ceiling',
            'light.br_bedroom_bedside',
            { section: 'Dining room' },
            'light.br_dining_pendant',
            'light.br_dining_wall',
          ],
        },
      ],
    }),
    // a heading as a label, over lone tiles as a dashboard written by hand would group them
    frame({
      title: 'Heading · label',
      heights: [152, 172],
      cards: [
        {
          type: 'custom:fluvy-heading-card',
          title: 'Lights',
          icon: 'fluvy:bulb',
          entities: LIGHT_IDS,
        },
        { type: 'custom:fluvy-heading-card', title: 'Kitchen', heading_style: 'label' },
        {
          type: 'custom:fluvy-tile-card',
          entity: 'light.br_kitchen_pendant',
          name: 'Pendant',
          cols: 6,
        },
        {
          type: 'custom:fluvy-tile-card',
          entity: 'light.br_kitchen_counter',
          name: 'Counter',
          cols: 6,
        },
        { type: 'custom:fluvy-heading-card', title: 'Dining room', heading_style: 'label' },
        {
          type: 'custom:fluvy-tile-card',
          entity: 'light.br_dining_pendant',
          name: 'Pendant',
          cols: 6,
        },
        {
          type: 'custom:fluvy-tile-card',
          entity: 'light.br_dining_wall',
          name: 'Wall lights',
          cols: 6,
        },
      ],
    }),
  ],
};
