import {
  resolveLanguage,
  wordsIn,
  type AreaRegistryEntry,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { moreHost } from '../../../../packages/cards/src/strategy/caps.js';
import { findEnergyRoles } from '../../../../packages/cards/src/strategy/energy-roles.js';
import { HomeRegistry } from '../../../../packages/cards/src/strategy/home-registry.js';
import { roomSections } from '../../../../packages/cards/src/strategy/rooms.js';
import type {
  FluvyStrategyConfig,
  StrategyContext,
} from '../../../../packages/cards/src/strategy/types.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

/*
 * How a list names what it lists (1.22, #200), on a house in the reporter's shape: a dining room with two multi-sensors
 * whose motion Home Assistant calls "Dining table sensor Motion" and "Sideboard sensor Motion", a patio door that is
 * its device's own entity, a window contact of an older integration that writes the whole name, and two outlets that
 * read alike by their own names. The room's page as the automatic dashboard writes it, as it was, by the entities' own
 * names (`names: entity`: "Motion", told apart by their devices only where two read alike) and by the friendly names
 * (`full`); then cards written by hand with their own `names`: a washing machine's entities by theirs, the updates and
 * the batteries by their devices, motion sensors named by their model read by their rooms. The house is the frames'
 * own, so no other sheet, nor the automatic dashboard of them all, gains a room. Light and dark are the page's
 * (`&mode=dark`).
 */

/** The rooms, as Home Assistant keeps them. */
const AREAS = {
  nm_dining: { area_id: 'nm_dining', name: 'Dining room', icon: 'mdi:table-chair' },
  nm_hall: { area_id: 'nm_hall', name: 'Hallway', icon: 'mdi:door' },
  nm_landing: { area_id: 'nm_landing', name: 'Landing', icon: 'mdi:stairs' },
  nm_kitchen: { area_id: 'nm_kitchen', name: 'Kitchen', icon: 'mdi:silverware' },
  nm_utility: { area_id: 'nm_utility', name: 'Utility room', icon: 'mdi:washing-machine' },
} as const;
type Area = keyof typeof AREAS;

/** The devices, each in its room, by the names their integrations gave them. */
const DEVICES: Readonly<Record<string, readonly [name: string, area: Area]>> = {
  nm_table: ['Dining table sensor', 'nm_dining'],
  nm_sideboard_sensor: ['Sideboard sensor', 'nm_dining'],
  nm_patio: ['Patio door', 'nm_dining'],
  nm_window: ['Dining room window', 'nm_dining'],
  nm_bar_cart: ['Bar cart', 'nm_dining'],
  nm_sideboard: ['Sideboard', 'nm_dining'],
  nm_washer: ['Washing machine', 'nm_utility'],
  nm_speaker: ['Kitchen speaker', 'nm_kitchen'],
  nm_hub: ['Hallway hub', 'nm_hall'],
  nm_camera: ['Garden camera', 'nm_hall'],
  nm_p1_hall: ['Aqara P1 4F2A', 'nm_hall'],
  nm_p1_landing: ['Aqara P1 9C07', 'nm_landing'],
  nm_p1_kitchen: ['Aqara P1 B3E1', 'nm_kitchen'],
};

/** When the sensors last changed, by the sheets' clock (19:50): the rest an hour before it. */
const CHANGED: Readonly<Record<string, string>> = {
  'binary_sensor.nm_sideboard_sensor_motion': '2026-09-17T19:48:00Z',
  'binary_sensor.nm_dining_table_sensor_motion': '2026-09-17T19:31:00Z',
  'binary_sensor.nm_dining_room_window_contact': '2026-09-17T19:04:00Z',
  'binary_sensor.nm_patio_door': '2026-09-17T17:12:00Z',
  'binary_sensor.nm_aqara_p1_4f2a_motion': '2026-09-17T19:49:00Z',
  'binary_sensor.nm_aqara_p1_9c07_motion': '2026-09-17T19:22:00Z',
  'binary_sensor.nm_aqara_p1_b3e1_motion': '2026-09-17T18:57:00Z',
};

/**
 * An entity of a device, as Home Assistant names it: its own name after its device's (none: the device's alone), or,
 * `whole`, an older integration's whole name written as its own.
 */
const of = (
  device: string,
  entity_id: string,
  state: string,
  own: string | null,
  attributes: Record<string, unknown> = {},
  whole = false,
) => {
  const [name] = DEVICES[device]!;
  const friendly = whole || !own ? (own ?? name) : `${name} ${own}`;
  return {
    entity: { entity_id, device_id: device, name: whole ? friendly : own },
    state: {
      entity_id,
      state,
      attributes: { friendly_name: friendly, ...attributes },
      last_changed: CHANGED[entity_id] ?? '2026-09-17T18:42:00Z',
      last_updated: CHANGED[entity_id] ?? '2026-09-17T18:42:00Z',
    },
  };
};

const motion = { device_class: 'motion' };
const outlet = { device_class: 'outlet' };
const battery = { device_class: 'battery', unit_of_measurement: '%', state_class: 'measurement' };
const firmware = (installed: string, latest: string) => ({
  installed_version: installed,
  latest_version: latest,
  in_progress: false,
  update_percentage: null,
  supported_features: 1,
});

const THINGS = [
  // the reporter's dining room
  of('nm_table', 'binary_sensor.nm_dining_table_sensor_motion', 'off', 'Motion', motion),
  of('nm_sideboard_sensor', 'binary_sensor.nm_sideboard_sensor_motion', 'on', 'Motion', motion),
  of('nm_patio', 'binary_sensor.nm_patio_door', 'off', null, { device_class: 'door' }),
  of(
    'nm_window',
    'binary_sensor.nm_dining_room_window_contact',
    'on',
    'Dining room window Contact',
    { device_class: 'window' },
    true,
  ),
  of('nm_bar_cart', 'switch.nm_bar_cart_outlet', 'on', 'Outlet', outlet),
  of('nm_sideboard', 'switch.nm_sideboard_outlet', 'off', 'Outlet', outlet),
  of('nm_table', 'sensor.nm_dining_table_sensor_battery', '81', 'Battery', battery),
  of('nm_sideboard_sensor', 'sensor.nm_sideboard_sensor_battery', '64', 'Battery', battery),
  of('nm_patio', 'sensor.nm_patio_door_battery', '18', 'Battery', battery),
  // a washing machine's entities
  of('nm_washer', 'sensor.nm_washing_machine_power', '412', 'Power', {
    device_class: 'power',
    unit_of_measurement: 'W',
    state_class: 'measurement',
  }),
  of('nm_washer', 'sensor.nm_washing_machine_energy', '0.84', 'Energy', {
    device_class: 'energy',
    unit_of_measurement: 'kWh',
    state_class: 'total_increasing',
  }),
  of('nm_washer', 'sensor.nm_washing_machine_program', 'Cotton 40°', 'Program', {
    icon: 'mdi:tshirt-crew',
  }),
  of('nm_washer', 'binary_sensor.nm_washing_machine_door', 'off', 'Door', {
    device_class: 'door',
  }),
  of('nm_washer', 'sensor.nm_washing_machine_time_left', '38', 'Time left', {
    device_class: 'duration',
    unit_of_measurement: 'min',
  }),
  // the house's updates, each its device's "Firmware"
  of(
    'nm_speaker',
    'update.nm_kitchen_speaker_firmware',
    'on',
    'Firmware',
    firmware('1.42', '1.44'),
  ),
  of('nm_hub', 'update.nm_hallway_hub_firmware', 'on', 'Firmware', firmware('8.0.2', '8.0.3')),
  of(
    'nm_camera',
    'update.nm_garden_camera_firmware',
    'off',
    'Firmware',
    firmware('2.6.1', '2.6.1'),
  ),
  // motion sensors named by their model, one a room
  of('nm_p1_hall', 'binary_sensor.nm_aqara_p1_4f2a_motion', 'on', 'Motion', motion),
  of('nm_p1_landing', 'binary_sensor.nm_aqara_p1_9c07_motion', 'off', 'Motion', motion),
  of('nm_p1_kitchen', 'binary_sensor.nm_aqara_p1_b3e1_motion', 'off', 'Motion', motion),
];

/** The house the frames stand on: its states, its entities' and its devices' entries, its rooms. */
const STATES = Object.fromEntries(THINGS.map(({ state }) => [state.entity_id, state]));
const ENTITIES = Object.fromEntries(THINGS.map(({ entity }) => [entity.entity_id, entity]));
const HOUSE_DEVICES = Object.fromEntries(
  Object.entries(DEVICES).map(([id, [name, area_id]]) => [
    id,
    { id, name, name_by_user: null, area_id, model: null, manufacturer: null, via_device_id: null },
  ]),
);
const house = (hass: HomeAssistant): HomeAssistant =>
  ({
    ...hass,
    states: { ...hass.states, ...STATES },
    entities: { ...hass.entities, ...ENTITIES },
    devices: { ...hass.devices, ...HOUSE_DEVICES },
    areas: { ...hass.areas, ...AREAS },
  }) as HomeAssistant;

const ROOM_CARDS: ReadonlySet<string> = new Set([
  'custom:fluvy-openings-card',
  'custom:fluvy-tile-card',
]);

/**
 * The dining room's page as the automatic dashboard writes it, named as the dashboard asks (`names`): its outlets'
 * tiles and its Sensors card, each at the columns the strategy gives it. Read when the frame is drawn, once the page's
 * words have landed.
 */
const diningRoom = (
  names: FluvyStrategyConfig['names'],
): (LovelaceCardConfig & { cols?: number })[] => {
  const t = wordsIn(resolveLanguage(new URLSearchParams(location.search).get('lang') ?? 'en'));
  const hass = {
    states: STATES,
    entities: ENTITIES,
    devices: HOUSE_DEVICES,
    areas: AREAS,
    floors: {},
    language: 'en',
    user: { id: 'u1', name: 'Marta', is_admin: true },
  } as unknown as HomeAssistant;
  const home = new HomeRegistry(
    hass,
    {},
    undefined,
    names === 'entity' || names === 'full' ? names : undefined,
  );
  const ctx = {
    home,
    t,
    base: '/fluvy-auto',
    panelUrl: 'fluvy-auto',
    weather: undefined,
    energy: findEnergyRoles(home, null),
    style: {},
    areas: undefined,
    greetingTabs: false,
    greeting: 'show',
    hass,
    header: 0,
    caps: {},
    more: moreHost('room-nm_dining', 'Dining room', 'mdi:table-chair', 3),
  } satisfies StrategyContext;
  return roomSections(ctx, AREAS.nm_dining as AreaRegistryEntry, {
    path: 'home',
    title: t('strategy.home'),
  })
    .flatMap((section) => section.cards)
    .filter((card) => ROOM_CARDS.has(card.type))
    .map((card) => ({
      ...card,
      ...(typeof card.grid_options?.columns === 'number'
        ? { cols: card.grid_options.columns }
        : {}),
    }));
};

/** A frame on the sheet's own house. */
const frame = (spec: FrameSpec): FrameSpec => ({ hass: house, ...spec });
/** A frame of the dining room's page as the dashboard names it, drawn at half a section's widths too. */
const roomFrame = (title: string, names: FluvyStrategyConfig['names']): FrameSpec => ({
  title,
  hass: house,
  heights: [152, 172],
  get cards() {
    return diningRoom(names);
  },
});

const WASHER = [
  'sensor.nm_washing_machine_power',
  'sensor.nm_washing_machine_energy',
  'sensor.nm_washing_machine_program',
  'binary_sensor.nm_washing_machine_door',
] as const;

export const sheet: SheetSpec = {
  states: [],
  frames: [
    // the reporter's room: as the dashboards named it, by the entities' own names, by the friendly names
    roomFrame('Dashboard · a room, names as they were', undefined),
    roomFrame('Dashboard · a room, entity names', 'entity'),
    roomFrame('Dashboard · a room, full names', 'full'),
    // a device's entities by their own names, an item's own name standing; and its tiles, at half a section
    frame({
      title: 'Entities · names: entity',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Washing machine',
          icon: 'mdi:washing-machine',
          names: 'entity',
          rows: [...WASHER, { entity: 'sensor.nm_washing_machine_time_left', name: 'Ready in' }],
        },
      ],
    }),
    frame({
      title: 'Tiles · names: entity, at half a section',
      heights: [152, 172],
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          names: 'entity',
          columns: 1,
          tiles: WASHER.slice(0, 2),
          cols: 6,
        },
        {
          type: 'custom:fluvy-tiles-card',
          names: 'entity',
          columns: 1,
          tiles: ['binary_sensor.nm_washing_machine_door', 'sensor.nm_washing_machine_time_left'],
          cols: 6,
        },
      ],
    }),
    // what is named by its device: the updates, the batteries
    frame({
      title: 'Updates · names: device',
      cards: [
        {
          type: 'custom:fluvy-updates-card',
          names: 'device',
          show_up_to_date: true,
          entities: [
            'update.nm_kitchen_speaker_firmware',
            'update.nm_hallway_hub_firmware',
            'update.nm_garden_camera_firmware',
          ],
        },
      ],
    }),
    frame({
      title: 'Bars · names: device',
      cards: [
        {
          type: 'custom:fluvy-bars-card',
          title: 'Batteries',
          icon: 'mdi:battery-60',
          names: 'device',
          rows: [
            'sensor.nm_dining_table_sensor_battery',
            'sensor.nm_sideboard_sensor_battery',
            'sensor.nm_patio_door_battery',
          ],
        },
      ],
    }),
    // sensors named by their model, read by their rooms: Home Assistant's parts, as a name takes them
    frame({
      title: 'Openings · names by area and entity',
      cards: [
        {
          type: 'custom:fluvy-openings-card',
          title: 'Motion',
          names: [{ type: 'area' }, { type: 'entity' }],
          entities: [
            'binary_sensor.nm_aqara_p1_4f2a_motion',
            'binary_sensor.nm_aqara_p1_9c07_motion',
            'binary_sensor.nm_aqara_p1_b3e1_motion',
          ],
        },
      ],
    }),
  ],
};
