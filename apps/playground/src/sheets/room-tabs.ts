import { resolveLanguage, wordsIn, type HomeAssistant, type LovelaceCardConfig } from '@fluvy/core';
import { moreHost } from '../../../../packages/cards/src/strategy/caps.js';
import { findEnergyRoles } from '../../../../packages/cards/src/strategy/energy-roles.js';
import { HomeRegistry } from '../../../../packages/cards/src/strategy/home-registry.js';
import { templateById, viewsOf } from '../../../../packages/cards/src/strategy/templates.js';
import type {
  CardStyle,
  StrategyContext,
  TemplateId,
} from '../../../../packages/cards/src/strategy/types.js';
import { NOW, type FrameSpec, type SheetSpec } from '../scenes.js';

/*
 * A room as a tab (1.22, #202), on a house of twelve rooms over two floors and a garden: the Rooms dashboard with its
 * rooms as tabs ("All rooms", then a tab a room: its page without the way back), and the rooms of the Lights and the
 * Climate dashboards (a tab a room that holds some: its page's own lights and scenes, or its thermostats, fans and
 * readings). Each frame is a view as its strategy writes it for this house, its columns one under the other; the
 * dashboards themselves, under their header's tabs and with their first tab (Home's view of each), are the automatic
 * mode's (`?dashboard=auto&template=rooms&options={"rooms_as":"tabs"}&house=room-tabs&view=room-rt_living`). The house is the
 * frames' own, so no other sheet, nor the automatic dashboard of them all, gains a room. Light and dark are the
 * page's (`&mode=dark`).
 */

/** A drawing stands in for a room's photo: the playground fetches nothing. */
const photo = (from: string, to: string, shapes: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/>${shapes}</svg>`,
  )}`;
const LIVING = photo(
  '#e3d2b4',
  '#8f7355',
  '<rect y="150" width="320" height="50" fill="#6b543d" opacity="0.5"/><rect x="36" y="112" width="160" height="48" rx="12" fill="#5b4632"/><rect x="48" y="96" width="136" height="30" rx="10" fill="#6f5740"/><rect x="236" y="60" width="4" height="100" fill="#4a3a2a"/><path d="M216 60h44l-10-30h-24z" fill="#f6ead0"/>',
);
const KITCHEN = photo(
  '#dfe6e0',
  '#8fa39a',
  '<rect y="128" width="320" height="72" fill="#5f736b"/><rect y="120" width="320" height="10" fill="#f1ece2"/><rect x="24" y="24" width="120" height="56" rx="4" fill="#f4f1ea" opacity="0.7"/><path d="M210 0v40" stroke="#3f4d47" stroke-width="2"/><path d="M196 40h28l8 22h-44z" fill="#2f3b36"/><path d="M270 0v52" stroke="#3f4d47" stroke-width="2"/><path d="M256 52h28l8 22h-44z" fill="#2f3b36"/>',
);
const BEDROOM = photo(
  '#cfd3e6',
  '#6f6c94',
  '<rect y="156" width="320" height="44" fill="#4f4c6e" opacity="0.6"/><rect x="60" y="116" width="200" height="50" rx="10" fill="#efe9f4"/><rect x="60" y="88" width="200" height="40" rx="10" fill="#3f3c5c"/><rect x="76" y="108" width="64" height="24" rx="8" fill="#ffffff"/><rect x="180" y="108" width="64" height="24" rx="8" fill="#ffffff"/><circle cx="270" cy="44" r="18" fill="#f6efd6" opacity="0.9"/>',
);
const GARDEN = photo(
  '#cfe3c6',
  '#5f8a5a',
  '<rect y="140" width="320" height="60" fill="#4c7449"/><circle cx="70" cy="96" r="44" fill="#3f6b3f"/><rect x="66" y="120" width="8" height="48" fill="#5a4630"/><circle cx="246" cy="52" r="24" fill="#fbf1c8" opacity="0.9"/><rect x="170" y="126" width="96" height="10" rx="4" fill="#d9c7a8"/><rect x="180" y="136" width="6" height="28" fill="#b9a586"/><rect x="250" y="136" width="6" height="28" fill="#b9a586"/>',
);

/** The house's floors and rooms, in the order Home Assistant keeps them (Settings › Areas). */
const FLOORS = [
  { floor_id: 'rt_ground', name: 'Ground floor', level: 0 },
  { floor_id: 'rt_first', name: 'First floor', level: 1 },
] as const;
const AREAS = [
  {
    area_id: 'rt_living',
    name: 'Living room',
    floor_id: 'rt_ground',
    icon: 'mdi:sofa',
    picture: LIVING,
  },
  {
    area_id: 'rt_kitchen',
    name: 'Kitchen',
    floor_id: 'rt_ground',
    icon: 'mdi:silverware-fork-knife',
    picture: KITCHEN,
  },
  { area_id: 'rt_dining', name: 'Dining room', floor_id: 'rt_ground', icon: 'mdi:table-chair' },
  { area_id: 'rt_hallway', name: 'Hallway', floor_id: 'rt_ground', icon: 'mdi:coat-rack' },
  { area_id: 'rt_study', name: 'Study', floor_id: 'rt_ground', icon: 'mdi:desk' },
  {
    area_id: 'rt_utility',
    name: 'Utility room',
    floor_id: 'rt_ground',
    icon: 'mdi:washing-machine',
  },
  {
    area_id: 'rt_bedroom',
    name: 'Main bedroom',
    floor_id: 'rt_first',
    icon: 'mdi:bed-king',
    picture: BEDROOM,
  },
  { area_id: 'rt_kids', name: 'Kids’ room', floor_id: 'rt_first', icon: 'mdi:teddy-bear' },
  { area_id: 'rt_guest', name: 'Guest room', floor_id: 'rt_first', icon: 'mdi:bed' },
  { area_id: 'rt_bathroom', name: 'Bathroom', floor_id: 'rt_first', icon: 'mdi:shower' },
  { area_id: 'rt_landing', name: 'Landing', floor_id: 'rt_first', icon: 'mdi:stairs' },
  { area_id: 'rt_garden', name: 'Garden', icon: 'mdi:flower', picture: GARDEN },
] as const;
type Area = (typeof AREAS)[number]['area_id'];

/** One thing of the house: the room it is in (none: the house's), its id, its state and what it says of itself. */
type Thing = readonly [
  area: Area | undefined,
  id: string,
  state: string,
  attributes: Record<string, unknown>,
];

/** A bulb that only switches, one that dims and one that goes from warm to cool, each at a level (0: off). */
const ONOFF = { supported_color_modes: ['onoff'], color_mode: 'onoff' };
const dims = (level: number) => ({
  brightness: Math.round(level * 2.55),
  supported_color_modes: ['brightness'],
  color_mode: 'brightness',
});
const white = (level: number, kelvin = 2700) => ({
  brightness: Math.round(level * 2.55),
  supported_color_modes: ['color_temp'],
  color_mode: 'color_temp',
  color_temp_kelvin: kelvin,
  min_color_temp_kelvin: 2200,
  max_color_temp_kelvin: 6500,
});
const light = (
  area: Area,
  id: string,
  name: string,
  level: number,
  attributes: Record<string, unknown> = dims(level),
): Thing => [area, `light.rt_${id}`, level ? 'on' : 'off', { friendly_name: name, ...attributes }];
const lamp = (area: Area, id: string, name: string, on = false): Thing =>
  light(area, id, name, on ? 100 : 0, ONOFF);

/** A scene, and when it last ran (an ISO time), never without. */
const scene = (area: Area | undefined, id: string, name: string, ran = 'unknown'): Thing => [
  area,
  `scene.rt_${id}`,
  ran,
  { friendly_name: name },
];

/** A radiator's thermostat: what it is set to, what it reads, and whether it is calling for heat. */
const thermostat = (
  area: Area,
  id: string,
  name: string,
  target: number,
  current: number,
  humidity?: number,
): Thing => [
  area,
  `climate.rt_${id}`,
  'heat',
  {
    friendly_name: name,
    min_temp: 5,
    max_temp: 30,
    target_temp_step: 0.5,
    hvac_modes: ['off', 'heat', 'auto'],
    supported_features: 1,
    temperature: target,
    current_temperature: current,
    hvac_action: current < target ? 'heating' : 'idle',
    ...(humidity === undefined ? {} : { current_humidity: humidity }),
  },
];

/** A fan at a speed of its three (0: off). */
const fan = (area: Area, id: string, name: string, speed: 0 | 1 | 2 | 3): Thing => [
  area,
  `fan.rt_${id}`,
  speed ? 'on' : 'off',
  {
    friendly_name: name,
    supported_features: 1 + 16 + 32,
    percentage: Math.round((speed * 100) / 3),
    percentage_step: 100 / 3,
  },
];

/** A room's thermometer and hygrometer. */
const reading = (
  area: Area,
  kind: 'temperature' | 'humidity',
  name: string,
  value: number,
): Thing => [
  area,
  `sensor.${area}_${kind}`,
  String(value),
  {
    friendly_name: `${name} ${kind}`,
    device_class: kind,
    unit_of_measurement: kind === 'humidity' ? '%' : '°C',
    state_class: 'measurement',
  },
];
const climateOf = (area: Area, name: string, temperature: number, humidity: number): Thing[] => [
  reading(area, 'temperature', name, temperature),
  reading(area, 'humidity', name, humidity),
];

const THINGS: readonly Thing[] = [
  // the living room: everything a room's page reaches
  light('rt_living', 'living_ceiling', 'Ceiling', 70, white(70, 3000)),
  light('rt_living', 'living_floor', 'Floor lamp', 45, white(45, 2400)),
  light('rt_living', 'living_reading', 'Reading lamp', 0),
  lamp('rt_living', 'living_shelf', 'Shelf lights', true),
  scene('rt_living', 'living_relax', 'Relax', '2026-09-17T18:05:00Z'),
  scene('rt_living', 'living_movie', 'Movie night'),
  scene('rt_living', 'living_bright', 'Bright'),
  thermostat('rt_living', 'living', 'Living room', 21.5, 20.8, 46),
  fan('rt_living', 'living', 'Ceiling fan', 2),
  ...climateOf('rt_living', 'Living room', 20.9, 46),
  [
    'rt_living',
    'cover.rt_living_blinds',
    'open',
    {
      friendly_name: 'Blinds',
      device_class: 'blind',
      current_position: 60,
      supported_features: 15,
    },
  ],
  [
    'rt_living',
    'media_player.rt_living_tv',
    'playing',
    {
      friendly_name: 'Television',
      device_class: 'tv',
      media_title: 'Planet Earth III',
      media_series_title: 'Coasts',
      app_name: 'iPlayer',
      volume_level: 0.28,
      is_volume_muted: false,
      supported_features: 152461,
    },
  ],
  [
    'rt_living',
    'binary_sensor.rt_living_window',
    'off',
    { friendly_name: 'Bay window', device_class: 'window' },
  ],
  // the kitchen
  light('rt_kitchen', 'kitchen_spots', 'Ceiling spots', 85),
  light('rt_kitchen', 'kitchen_island', 'Island pendants', 60, white(60)),
  lamp('rt_kitchen', 'kitchen_counter', 'Counter lights', true),
  lamp('rt_kitchen', 'kitchen_extractor', 'Extractor light'),
  scene('rt_kitchen', 'kitchen_cooking', 'Cooking', '2026-09-17T17:20:00Z'),
  scene('rt_kitchen', 'kitchen_dinner', 'Dinner'),
  ...climateOf('rt_kitchen', 'Kitchen', 22.4, 52),
  // the dining room, the hallway, the study and the utility room
  light('rt_dining', 'dining_pendant', 'Pendant', 50),
  lamp('rt_dining', 'dining_wall', 'Wall lights'),
  scene('rt_dining', 'dining_candlelight', 'Candlelight'),
  lamp('rt_hallway', 'hallway_ceiling', 'Ceiling', true),
  lamp('rt_hallway', 'hallway_porch', 'Porch light'),
  light('rt_study', 'study_desk', 'Desk lamp', 80, white(80, 4000)),
  lamp('rt_study', 'study_ceiling', 'Ceiling'),
  thermostat('rt_study', 'study', 'Study', 20, 20.3),
  reading('rt_study', 'temperature', 'Study', 20.3),
  lamp('rt_utility', 'utility_ceiling', 'Ceiling'),
  reading('rt_utility', 'humidity', 'Utility room', 58),
  // upstairs
  light('rt_bedroom', 'bedroom_ceiling', 'Ceiling', 0),
  light('rt_bedroom', 'bedroom_left', 'Bedside left', 25, white(25, 2200)),
  light('rt_bedroom', 'bedroom_right', 'Bedside right', 0, white(0, 2200)),
  scene('rt_bedroom', 'bedroom_night', 'Good night', '2026-09-16T21:40:00Z'),
  scene('rt_bedroom', 'bedroom_wake', 'Wake up', '2026-09-17T05:30:00Z'),
  thermostat('rt_bedroom', 'bedroom', 'Main bedroom', 18.5, 18.7, 49),
  fan('rt_bedroom', 'bedroom', 'Bedroom fan', 0),
  ...climateOf('rt_bedroom', 'Main bedroom', 18.7, 49),
  light('rt_kids', 'kids_ceiling', 'Ceiling', 0),
  light('rt_kids', 'kids_night', 'Night light', 10, white(10, 2200)),
  thermostat('rt_kids', 'kids', 'Kids’ room', 19.5, 19.1),
  reading('rt_kids', 'temperature', 'Kids’ room', 19.1),
  lamp('rt_guest', 'guest_ceiling', 'Ceiling'),
  lamp('rt_guest', 'guest_bedside', 'Bedside lamp'),
  reading('rt_guest', 'temperature', 'Guest room', 17.8),
  lamp('rt_bathroom', 'bathroom_ceiling', 'Ceiling'),
  light('rt_bathroom', 'bathroom_mirror', 'Mirror light', 0),
  thermostat('rt_bathroom', 'bathroom', 'Bathroom', 22, 21.4),
  fan('rt_bathroom', 'bathroom', 'Extractor fan', 1),
  ...climateOf('rt_bathroom', 'Bathroom', 21.4, 63),
  lamp('rt_landing', 'landing_ceiling', 'Ceiling'),
  // the garden: eight lamps, two more than its list shows
  lamp('rt_garden', 'garden_patio', 'Patio', true),
  lamp('rt_garden', 'garden_pergola', 'Pergola', true),
  lamp('rt_garden', 'garden_path', 'Path'),
  lamp('rt_garden', 'garden_steps', 'Steps'),
  lamp('rt_garden', 'garden_pond', 'Pond'),
  lamp('rt_garden', 'garden_shed', 'Shed'),
  lamp('rt_garden', 'garden_gate', 'Gate'),
  lamp('rt_garden', 'garden_tree', 'Old oak'),
  scene('rt_garden', 'garden_evening', 'Evening outside'),
  ...climateOf('rt_garden', 'Garden', 14.2, 71),
  // the house's own
  scene(undefined, 'leaving', 'Leaving home', '2026-09-17T06:55:00Z'),
  [
    undefined,
    'weather.rt_home',
    'partlycloudy',
    {
      friendly_name: 'Home',
      supported_features: 3,
      temperature: 14,
      temperature_unit: '°C',
      apparent_temperature: 13,
      humidity: 71,
      wind_speed: 9,
      wind_speed_unit: 'km/h',
      wind_bearing: 250,
    },
  ],
];

const STATES = Object.fromEntries(
  THINGS.map(([, entity_id, state, attributes]) => [
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
const HOUSE = {
  states: STATES,
  entities: Object.fromEntries(
    THINGS.map(([area_id, entity_id]) => [
      entity_id,
      { entity_id, ...(area_id ? { area_id } : {}) },
    ]),
  ),
  devices: {},
  areas: Object.fromEntries(AREAS.map((area) => [area.area_id, area])),
  floors: Object.fromEntries(FLOORS.map((floor) => [floor.floor_id, floor])),
};
/** The house the frames stand on: its own things, rooms and floors, in the page's language and mode. */
const house = (hass: HomeAssistant): HomeAssistant => ({ ...hass, ...HOUSE }) as HomeAssistant;

/** The scenes' clock is the sheets': a tile says how long ago its scene ran, whenever the frame is shot. */
const _now = NOW.toISOString();

/** The days ahead, as the weather service forecasts them. */
const DAY = 86_400_000;
const FORECAST = (
  [
    ['partlycloudy', 17, 9],
    ['sunny', 19, 10],
    ['cloudy', 16, 11],
    ['rainy', 14, 10],
    ['partlycloudy', 16, 8],
  ] as const
).map(([condition, temperature, templow], day) => ({
  datetime: new Date(NOW.getTime() + day * DAY).toISOString(),
  condition,
  temperature,
  templow,
}));

/** A day of a reading as the recorder keeps it, an hour apart: round a middle, ending where it reads now. */
const dayOf = (value: number, swing: number): number[] =>
  Array.from(
    { length: 24 },
    (_unused, hour) =>
      Math.round((value + swing * Math.sin(((23 - hour) / 24) * 2 * Math.PI)) * 10) / 10,
  );

/**
 * A view of one of the dashboards as its strategy writes it for this house, with the dashboard's options as its panel
 * sets them: every card of its columns, each at the columns the strategy gives it. Read when the frame is drawn, once
 * the page's words have landed.
 */
function viewCards(
  id: TemplateId,
  path: string,
  style: CardStyle,
): (LovelaceCardConfig & { cols?: number })[] {
  const t = wordsIn(resolveLanguage(new URLSearchParams(location.search).get('lang') ?? 'en'));
  const hass = {
    ...HOUSE,
    language: 'en',
    user: { id: 'u1', name: 'Marta', is_admin: true },
  } as unknown as HomeAssistant;
  const home = new HomeRegistry(hass);
  const template = templateById(id);
  const ctx: StrategyContext = {
    home,
    t,
    base: `/${template.url}`,
    panelUrl: template.url,
    weather: 'weather.rt_home',
    energy: findEnergyRoles(home, null),
    style,
    areas: undefined,
    greetingTabs: false,
    greeting: 'show',
    hass,
    header: 0,
    caps: {},
    more: moreHost(path, '', '', template.columns),
  };
  const view = viewsOf(template, ctx).find((spec) => spec.key === path);
  return (view?.build(ctx) ?? [])
    .flatMap((section) => section.cards)
    .map((card) => ({
      ...card,
      ...(card.type === 'custom:fluvy-scenes-card' ? { _now } : {}),
      ...(typeof card.grid_options?.columns === 'number'
        ? { cols: card.grid_options.columns }
        : {}),
    }));
}

/** A frame of a view of a dashboard, drawn at half a section's widths too. */
const view = (title: string, id: TemplateId, path: string, style: CardStyle = {}): FrameSpec => ({
  title,
  hass: house,
  heights: [152, 172],
  get cards() {
    return viewCards(id, path, style);
  },
});

/** The Rooms dashboard as it is asked for its rooms as tabs. */
const TABS: CardStyle = { roomTabs: true };

export const sheet: SheetSpec = {
  states: [],
  house,
  history: Object.fromEntries(
    THINGS.filter(([, id]) => id.startsWith('sensor.')).map(([, id, state]) => [
      id,
      dayOf(Number(state), id.endsWith('humidity') ? 4 : 0.8),
    ]),
  ),
  ws: {
    // the house's own weather; any other is another sheet's to answer
    'weather/subscribe_forecast': (message) =>
      message['entity_id'] === 'weather.rt_home'
        ? { type: 'daily', forecast: FORECAST }
        : undefined,
  },
  frames: [
    // the Rooms dashboard with its rooms as tabs: "All rooms" first, every room's card under its floor's heading
    view('Rooms · All rooms', 'rooms', 'rooms', TABS),
    // a room's tab: its page, with no way back over it
    view('Rooms · Living room, a tab', 'rooms', 'room-rt_living', TABS),
    view('Rooms · Main bedroom, a tab, scenes as chips', 'rooms', 'room-rt_bedroom', {
      ...TABS,
      sceneChips: true,
      doing: true,
    }),
    // the Lights dashboard's rooms (its first tab is Home's Lights view, the automatic mode's): a room's own scenes
    // and lights
    view('Lights · Living room', 'lights', 'room-rt_living'),
    view('Lights · Kitchen, rows and chips', 'lights', 'room-rt_kitchen', {
      tiles: 'compact',
      sceneChips: true,
    }),
    // a list past its cap ends with its "N more" row, back to the room's tab
    view('Lights · Garden, wall rockers', 'lights', 'room-rt_garden', { switches: 'rocker' }),
    // the Climate dashboard's rooms (its first tab is Home's Climate view): a room's own thermostats, fans and readings
    view('Climate · Living room', 'climate', 'room-rt_living'),
    view('Climate · Bathroom, compact and detailed', 'climate', 'room-rt_bathroom', {
      thermostat: 'compact',
      doing: true,
    }),
    // a room that holds a thermometer alone
    view('Climate · Guest room', 'climate', 'room-rt_guest'),
  ],
};
