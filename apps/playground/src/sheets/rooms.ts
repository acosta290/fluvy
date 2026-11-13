import {
  resolveLanguage,
  wordsIn,
  type AreaRegistryEntry,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { FluvyMapCard } from '../../../../packages/cards/src/map/map-card.js';
import { FluvyRoomCard } from '../../../../packages/cards/src/room/room-card.js';
import { moreHost } from '../../../../packages/cards/src/strategy/caps.js';
import { HomeRegistry } from '../../../../packages/cards/src/strategy/home-registry.js';
import { roomSections } from '../../../../packages/cards/src/strategy/rooms.js';
import type { StrategyContext } from '../../../../packages/cards/src/strategy/types.js';
import type { StateSeed } from '../hass.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-room-card')) customElements.define('fluvy-room-card', FluvyRoomCard);
if (!customElements.get('fluvy-map-card')) customElements.define('fluvy-map-card', FluvyMapCard);

/** A drawing stands in for the living room's photo: the playground fetches nothing. */
const PHOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c7a8"/><stop offset="1" stop-color="#8c6f4e"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><rect x="40" y="110" width="150" height="50" rx="10" fill="#5b4632"/><circle cx="250" cy="70" r="30" fill="#f3e6c8" opacity="0.8"/></svg>',
)}`;

const room = (config: Record<string, unknown>) => ({ type: 'custom:fluvy-room-card', ...config });

/*
 * #39's house: four areas, each one temperature and one humidity sensor and nothing else. Garden and guest WC plain;
 * the kitchen's two diagnostic and named in its area's settings; the living room's two hidden. Around it: a sensor
 * that comes late (its registry entry here, its state added by the rooms suite), a thermostat alone, a dead sensor
 * first, and entries the registry has and the house has no state for.
 */
const reading = (id: string, value: string, kind: 'temperature' | 'humidity'): StateSeed => [
  id,
  value,
  {
    friendly_name: id.slice(id.indexOf('.') + 1).replace(/_/g, ' '),
    device_class: kind,
    unit_of_measurement: kind === 'temperature' ? '°C' : '%',
  },
];
const READINGS: readonly StateSeed[] = [
  reading('sensor.rm_garten_temperature', '16.4', 'temperature'),
  reading('sensor.rm_garten_humidity', '92', 'humidity'),
  reading('sensor.rm_gaste_wc_temperature', '22.1', 'temperature'),
  reading('sensor.rm_gaste_wc_humidity', '53', 'humidity'),
  reading('sensor.rm_kuche_temperature', '21.3', 'temperature'),
  reading('sensor.rm_kuche_humidity', '48', 'humidity'),
  reading('sensor.rm_wohnzimmer_temperature', '20.5', 'temperature'),
  reading('sensor.rm_wohnzimmer_humidity', '45', 'humidity'),
  reading('sensor.rm_hall_a_temperature', 'unavailable', 'temperature'),
  reading('sensor.rm_hall_b_temperature', '19.8', 'temperature'),
];
const entry = (entity_id: string, area_id: string, more: Record<string, unknown> = {}) =>
  [entity_id, { entity_id, area_id, ...more }] as const;
/*
 * #76's garage, as the reporter described it: a temperature and humidity sensor (one device), a smoke detector, a leak
 * sensor and a garage door — the room's page reaches all five, of which the card counts the door (#95: a sensor is no
 * device).
 */
const GARAGE: readonly StateSeed[] = [
  reading('sensor.rm_garage_temperature', '12.5', 'temperature'),
  reading('sensor.rm_garage_humidity', '71', 'humidity'),
  [
    'binary_sensor.rm_garage_smoke',
    'off',
    { friendly_name: 'Smoke detector', device_class: 'smoke' },
  ],
  [
    'binary_sensor.rm_garage_leak',
    'off',
    { friendly_name: 'Leak sensor', device_class: 'moisture' },
  ],
  [
    'cover.rm_garage_door',
    'closed',
    {
      friendly_name: 'Garage door',
      device_class: 'garage',
      current_position: 0,
      supported_features: 3,
    },
  ],
];
const GARAGE_ENTITIES = {
  'sensor.rm_garage_temperature': {
    entity_id: 'sensor.rm_garage_temperature',
    device_id: 'rm-garage-climate',
  },
  'sensor.rm_garage_humidity': {
    entity_id: 'sensor.rm_garage_humidity',
    device_id: 'rm-garage-climate',
  },
  'binary_sensor.rm_garage_smoke': {
    entity_id: 'binary_sensor.rm_garage_smoke',
    area_id: 'rm_garage',
  },
  'binary_sensor.rm_garage_leak': {
    entity_id: 'binary_sensor.rm_garage_leak',
    area_id: 'rm_garage',
  },
  'cover.rm_garage_door': { entity_id: 'cover.rm_garage_door', area_id: 'rm_garage' },
};
const GARAGE_DEVICE = {
  id: 'rm-garage-climate',
  name: 'Garage climate',
  name_by_user: null,
  area_id: 'rm_garage',
  model: null,
  manufacturer: null,
  via_device_id: null,
};
const GARAGE_AREA = { area_id: 'rm_garage', name: 'Garage', icon: 'mdi:garage' };

/*
 * #95's kitchen: two lights, and a dishwasher of an integration the appliance card does not read (an ESPHome build),
 * its options switches beside its programme, its zone, its delay and its rounds — the card counts the two lights.
 */
const dishwasher = (
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): StateSeed => [`${id.split('.')[0]}.rm_dishwasher_${id.split('.')[1]}`, state, attributes];
const GALLEY: readonly StateSeed[] = [
  ['light.rm_galley_ceiling', 'on', { friendly_name: 'Ceiling', supported_color_modes: ['onoff'] }],
  [
    'light.rm_galley_counter',
    'off',
    { friendly_name: 'Counter', supported_color_modes: ['onoff'] },
  ],
  dishwasher('switch.power', 'on', { friendly_name: 'Dishwasher Power' }),
  dishwasher('switch.extra_dry', 'on', { friendly_name: 'Dishwasher Extra dry' }),
  dishwasher('switch.sanitize', 'off', { friendly_name: 'Dishwasher Sanitize' }),
  dishwasher('switch.storm_wash', 'on', { friendly_name: 'Dishwasher Storm wash' }),
  dishwasher('select.course', 'Eco', {
    friendly_name: 'Dishwasher Course',
    options: ['Eco', 'Auto', 'Quick'],
  }),
  dishwasher('select.zone', 'All', { friendly_name: 'Dishwasher Zone', options: ['All', 'Upper'] }),
  dishwasher('number.delay_start', '0', {
    friendly_name: 'Dishwasher Delay start',
    min: 0,
    max: 24,
    step: 1,
    unit_of_measurement: 'h',
  }),
  dishwasher('button.start', 'unknown', { friendly_name: 'Dishwasher Start' }),
  dishwasher('button.pause', 'unknown', { friendly_name: 'Dishwasher Pause' }),
  dishwasher('sensor.remaining', '42', {
    friendly_name: 'Dishwasher Remaining',
    unit_of_measurement: 'min',
  }),
  dishwasher('binary_sensor.door', 'off', {
    friendly_name: 'Dishwasher Door',
    device_class: 'door',
  }),
];
const GALLEY_ENTITIES = Object.fromEntries(
  GALLEY.map(([entity_id]) => [
    entity_id,
    entity_id.includes('dishwasher')
      ? { entity_id, device_id: 'rm-dishwasher', platform: 'esphome' }
      : { entity_id, area_id: 'rm_galley' },
  ]),
);
const GALLEY_DEVICE = {
  id: 'rm-dishwasher',
  name: 'Dishwasher',
  name_by_user: null,
  area_id: 'rm_galley',
  model: null,
  manufacturer: 'Samsung',
  via_device_id: null,
};
const GALLEY_AREA = { area_id: 'rm_galley', name: 'Open kitchen', icon: 'mdi:stove' };

/*
 * The 1.12 judge's plug: a Tuya plug that files its countdown and its relay's power-on state as no setting, beside its
 * power — the utility room counts it (its one switch, beside what it measures), with its light.
 */
const PLUG = (id: string, state: string, attributes: Record<string, unknown> = {}): StateSeed => [
  id,
  state,
  attributes,
];
const UTILITY: readonly StateSeed[] = [
  PLUG('switch.rm_utility_plug', 'on', { friendly_name: 'Dehumidifier plug' }),
  PLUG('number.rm_utility_plug_countdown', '0', {
    friendly_name: 'Dehumidifier plug Countdown',
    min: 0,
    max: 86400,
    step: 1,
    unit_of_measurement: 's',
  }),
  PLUG('select.rm_utility_plug_relay_status', 'memory', {
    friendly_name: 'Dehumidifier plug Power-on behaviour',
    options: ['off', 'on', 'memory'],
  }),
  PLUG('sensor.rm_utility_plug_power', '182', {
    friendly_name: 'Dehumidifier plug Power',
    device_class: 'power',
    unit_of_measurement: 'W',
  }),
  ['light.rm_utility', 'off', { friendly_name: 'Utility light', supported_color_modes: ['onoff'] }],
];
const UTILITY_ENTITIES = Object.fromEntries(
  UTILITY.map(([entity_id]) => [
    entity_id,
    entity_id.includes('plug')
      ? { entity_id, device_id: 'rm-utility-plug', platform: 'tuya' }
      : { entity_id, area_id: 'rm_utility' },
  ]),
);
const UTILITY_DEVICE = {
  id: 'rm-utility-plug',
  name: 'Dehumidifier plug',
  name_by_user: null,
  area_id: 'rm_utility',
  model: 'Smart plug',
  manufacturer: 'Tuya',
  via_device_id: null,
};

/*
 * The 1.13 judge's sunroom: roller blinds, a louvred roof that only tilts and a screen that only takes a position —
 * its blinds' round closes the blinds and tilts the roof shut, and leaves the screen out; its radio plays and can do
 * nothing else, so its round takes no tap.
 */
const SUNROOM: readonly StateSeed[] = [
  ['light.rm_sunroom', 'on', { friendly_name: 'Sunroom', supported_color_modes: ['onoff'] }],
  [
    'cover.rm_sunroom_blinds',
    'open',
    { friendly_name: 'Blinds', current_position: 50, supported_features: 15 },
  ],
  [
    'cover.rm_sunroom_roof',
    'open',
    { friendly_name: 'Louvred roof', current_tilt_position: 70, supported_features: 240 },
  ],
  [
    'cover.rm_sunroom_screen',
    'open',
    { friendly_name: 'Screen', current_position: 100, supported_features: 4 },
  ],
  ['media_player.rm_sunroom_radio', 'playing', { friendly_name: 'Radio', supported_features: 0 }],
];
const SUNROOM_ENTITIES = Object.fromEntries(
  SUNROOM.map(([entity_id]) => entry(entity_id, 'rm_sunroom')),
);

/*
 * #172's lounge, lit by scenes rather than by its lamp: its page leads with them, and its card's rounds may run them.
 */
const LOUNGE: readonly StateSeed[] = [
  ['light.rm_lounge', 'off', { friendly_name: 'Lounge lamp', supported_color_modes: ['onoff'] }],
  [
    'scene.rm_lounge_movie',
    '2026-09-17T20:12:00+00:00',
    { friendly_name: 'Movie night', entity_id: ['light.rm_lounge'] },
  ],
  ['scene.rm_lounge_reading', '2026-09-16T19:40:00+00:00', { friendly_name: 'Reading' }],
  ['scene.rm_lounge_goodnight', 'unknown', { friendly_name: 'Goodnight' }],
  ['scene.rm_lounge_dinner', '2026-09-15T18:02:00+00:00', { friendly_name: 'Dinner' }],
  ['scene.rm_lounge_party', 'unknown', { friendly_name: 'Party' }],
];
const LOUNGE_ENTITIES = Object.fromEntries(
  LOUNGE.map(([entity_id]) => entry(entity_id, 'rm_lounge')),
);
const LOUNGE_AREA = { area_id: 'rm_lounge', name: 'Lounge', icon: 'mdi:sofa' };

/*
 * #170's outdoors, as the reporter's house names it: its temperature and humidity, and two weather integrations that
 * both say 大气压, PM2.5 and 风速 — each row told apart by its device, a label said once left as it was.
 */
const WEATHER_DEVICES = [
  { id: 'rm_shouguang', name: '寿光天气', name_by_user: null, area_id: 'rm_huwai' },
  { id: 'rm_qweather', name: '和风天气', name_by_user: null, area_id: 'rm_huwai' },
];
/** A reading outdoors: on a weather integration's device where one is named, else in the area. */
const outdoor = (
  id: string,
  value: string,
  name: string,
  attributes: Record<string, unknown>,
  device?: string,
) => {
  const seed: StateSeed = [`sensor.${id}`, value, { friendly_name: name, ...attributes }];
  return { seed, device };
};
const OUTDOOR = [
  outdoor('rm_huwai_temperature', '16.2', '户外气温', {
    device_class: 'temperature',
    unit_of_measurement: '°C',
  }),
  outdoor('rm_huwai_humidity', '71', '户外湿度', {
    device_class: 'humidity',
    unit_of_measurement: '%',
  }),
  ...WEATHER_DEVICES.flatMap(({ id, name }) => [
    outdoor(
      `${id}_pressure`,
      '1012',
      `${name} 大气压`,
      { device_class: 'atmospheric_pressure', unit_of_measurement: 'hPa' },
      id,
    ),
    outdoor(
      `${id}_pm25`,
      '38',
      `${name} PM2.5`,
      { device_class: 'pm25', unit_of_measurement: 'µg/m³' },
      id,
    ),
    outdoor(
      `${id}_wind`,
      '9',
      `${name} 风速`,
      { device_class: 'wind_speed', unit_of_measurement: 'km/h' },
      id,
    ),
  ]),
  outdoor('rm_huwai_uv', '3', '紫外线指数', { unit_of_measurement: 'UV index' }),
];
const HUWAI: readonly StateSeed[] = OUTDOOR.map(({ seed }) => seed);
const HUWAI_ENTITIES = Object.fromEntries(
  OUTDOOR.map(({ seed: [entity_id], device }) =>
    device ? [entity_id, { entity_id, device_id: device }] : entry(entity_id, 'rm_huwai'),
  ),
);
const HUWAI_AREA = { area_id: 'rm_huwai', name: '户外', icon: 'mdi:tree' };

/**
 * A room's page as the automatic dashboard lays it out (#76), in the page's language: the way back, then what it
 * holds — in a column, in reading order. Read when the frame is drawn, once the page's words have landed.
 */
const roomPage = (
  area: AreaRegistryEntry,
  seeds: readonly StateSeed[],
  entities: Record<string, unknown>,
  ...devices: readonly { readonly id: string }[]
): LovelaceCardConfig[] => {
  const t = wordsIn(resolveLanguage(new URLSearchParams(location.search).get('lang') ?? 'en'));
  const house = {
    states: Object.fromEntries(
      seeds.map(([entity_id, state, attributes = {}]) => [
        entity_id,
        { entity_id, state, attributes, last_changed: '', last_updated: '' },
      ]),
    ),
    entities,
    devices: Object.fromEntries(devices.map((device) => [device.id, device])),
    areas: { [area.area_id]: area },
    language: 'en',
    user: { id: 'u1', name: 'Marta', is_admin: true },
  } as unknown as HomeAssistant;
  const ctx = {
    home: new HomeRegistry(house),
    t,
    base: '/fluvy-auto',
    style: {},
    hass: house,
    header: 0,
    caps: {},
    more: moreHost(`room-${area.area_id}`, area.name, 'fluvy:home', 3),
  } as unknown as StrategyContext;
  return roomSections(ctx, area, {
    path: '/fluvy-auto/rooms',
    title: t('strategy.all_rooms'),
  }).flatMap((section) => section.cards);
};

/** The reporter's card, each room at half a section. */
const reporter = (area: string) =>
  room({
    area,
    variant: 'photo',
    controls: 'tiles',
    show_count: false,
    show_climate: true,
    path: `/fluvy-auto/room-${area}`,
    cols: 6,
  });

/*
 * #159's living room, as the reporter's phone drew it: "Woonkamer" over its photo, 17.4 °C and 51 %, its lights and
 * its blinds beside the name. In Dutch with `?lang=nl`, where "Temperatuur" would not hold a third of a 328 card.
 */
const WOONKAMER: readonly StateSeed[] = [
  reading('sensor.rm_woonkamer_temperature', '17.4', 'temperature'),
  reading('sensor.rm_woonkamer_humidity', '51', 'humidity'),
];
const woonkamer = (config: Record<string, unknown> = {}) =>
  room({
    area: 'rm_living',
    name: 'Woonkamer',
    temperature_entity: 'sensor.rm_woonkamer_temperature',
    humidity_entity: 'sensor.rm_woonkamer_humidity',
    controls: 'none',
    path: '/fluvy-auto/room-rm_living',
    ...config,
  });
/** Four quick actions: the room's lights, blinds and television, and its plug. */
const FOUR_ACTIONS = ['lights', 'covers', 'media', 'switch.rm_tv_plug'];

export const sheet: SheetSpec = {
  states: [
    [
      'light.rm_ceiling',
      'on',
      { friendly_name: 'Ceiling', brightness: 178, supported_color_modes: ['brightness'] },
    ],
    [
      'light.rm_reading',
      'off',
      { friendly_name: 'Reading lamp', supported_color_modes: ['brightness'] },
    ],
    ['light.rm_shelf', 'on', { friendly_name: 'Shelf', supported_color_modes: ['onoff'] }],
    ['switch.rm_tv_plug', 'on', { friendly_name: 'TV plug', device_class: 'outlet' }],
    [
      'cover.rm_blinds',
      'open',
      { friendly_name: 'Blinds', current_position: 40, supported_features: 15 },
    ],
    // a television's features: it pauses, stops and plays, comes on and goes off, and has a volume
    ['media_player.rm_tv', 'off', { friendly_name: 'Living room TV', supported_features: 21893 }],
    [
      'climate.rm_living',
      'heat',
      {
        friendly_name: 'Living room',
        temperature: 21.5,
        current_temperature: 21.4,
        hvac_action: 'heating',
        hvac_modes: ['heat', 'off'],
      },
    ],
    [
      'sensor.rm_living_temperature',
      '21.4',
      {
        friendly_name: 'Living room temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      },
    ],
    [
      'sensor.rm_living_humidity',
      '46',
      { friendly_name: 'Living room humidity', device_class: 'humidity', unit_of_measurement: '%' },
    ],
    ['sensor.rm_dead', 'unavailable', { friendly_name: 'Loft sensor' }],
    ['light.rm_kitchen', 'off', { friendly_name: 'Kitchen', supported_color_modes: ['onoff'] }],
    ['switch.rm_kettle', 'off', { friendly_name: 'Kettle', device_class: 'outlet' }],
    [
      'sensor.rm_kitchen_temperature',
      '22.8',
      {
        friendly_name: 'Kitchen temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
      },
    ],
    [
      'light.rm_bedroom',
      'off',
      { friendly_name: 'Bedroom', supported_color_modes: ['brightness'] },
    ],
    [
      'fan.rm_bedroom',
      'on',
      { friendly_name: 'Bedroom fan', percentage: 40, supported_features: 1 },
    ],
    ...READINGS,
    ...WOONKAMER,
    ...GARAGE,
    ...GALLEY,
    ...UTILITY,
    ...SUNROOM,
    ...LOUNGE,
    ...HUWAI,
    ['switch.rm_porch', 'unavailable', { friendly_name: 'Porch lantern' }],
    [
      'climate.rm_study',
      'heat',
      {
        friendly_name: 'Study',
        temperature: 21,
        current_temperature: 20.5,
        current_humidity: 44,
        hvac_action: 'heating',
        hvac_modes: ['heat', 'off'],
      },
    ],
    // the den's lights: a blue strip and a red lamp lit, a white one too (#41: a room's lights in their bulbs' colours)
    [
      'light.rm_den_strip',
      'on',
      {
        friendly_name: 'Strip',
        brightness: 255,
        supported_color_modes: ['rgb'],
        color_mode: 'rgb',
        rgb_color: [33, 150, 243],
      },
    ],
    [
      'light.rm_den_lamp',
      'on',
      {
        friendly_name: 'Lamp',
        brightness: 128,
        supported_color_modes: ['hs'],
        color_mode: 'hs',
        hs_color: [4, 78],
        rgb_color: [244, 67, 54],
      },
    ],
    [
      'light.rm_den_ceiling',
      'on',
      {
        friendly_name: 'Ceiling',
        brightness: 200,
        supported_color_modes: ['color_temp'],
        color_mode: 'color_temp',
        color_temp_kelvin: 2700,
        hs_color: [28.4, 65.7],
        rgb_color: [255, 167, 87],
      },
    ],
  ],
  registry: {
    entities: {
      'light.rm_ceiling': { entity_id: 'light.rm_ceiling', area_id: 'rm_living' },
      'light.rm_reading': { entity_id: 'light.rm_reading', area_id: 'rm_living' },
      'light.rm_shelf': { entity_id: 'light.rm_shelf', area_id: 'rm_living' },
      'switch.rm_tv_plug': { entity_id: 'switch.rm_tv_plug', area_id: 'rm_living' },
      'cover.rm_blinds': { entity_id: 'cover.rm_blinds', area_id: 'rm_living' },
      'media_player.rm_tv': { entity_id: 'media_player.rm_tv', area_id: 'rm_living' },
      'climate.rm_living': { entity_id: 'climate.rm_living', area_id: 'rm_living' },
      'sensor.rm_living_temperature': {
        entity_id: 'sensor.rm_living_temperature',
        area_id: 'rm_living',
      },
      'sensor.rm_living_humidity': { entity_id: 'sensor.rm_living_humidity', area_id: 'rm_living' },
      'sensor.rm_dead': { entity_id: 'sensor.rm_dead', area_id: 'rm_living' },
      'light.rm_kitchen': { entity_id: 'light.rm_kitchen', area_id: 'rm_kitchen' },
      'switch.rm_kettle': { entity_id: 'switch.rm_kettle', area_id: 'rm_kitchen' },
      'sensor.rm_kitchen_temperature': {
        entity_id: 'sensor.rm_kitchen_temperature',
        area_id: 'rm_kitchen',
      },
      'light.rm_bedroom': { entity_id: 'light.rm_bedroom', area_id: 'rm_bedroom' },
      'light.rm_den_strip': { entity_id: 'light.rm_den_strip', area_id: 'rm_den' },
      'light.rm_den_lamp': { entity_id: 'light.rm_den_lamp', area_id: 'rm_den' },
      'light.rm_den_ceiling': { entity_id: 'light.rm_den_ceiling', area_id: 'rm_den' },
      'fan.rm_bedroom': { entity_id: 'fan.rm_bedroom', area_id: 'rm_bedroom' },
      ...Object.fromEntries([
        entry('sensor.rm_garten_temperature', 'rm_garten'),
        entry('sensor.rm_garten_humidity', 'rm_garten'),
        entry('sensor.rm_gaste_wc_temperature', 'rm_gaste_wc'),
        entry('sensor.rm_gaste_wc_humidity', 'rm_gaste_wc'),
        entry('sensor.rm_kuche_temperature', 'rm_kuche', { entity_category: 'diagnostic' }),
        entry('sensor.rm_kuche_humidity', 'rm_kuche', { entity_category: 'diagnostic' }),
        entry('sensor.rm_wohnzimmer_temperature', 'rm_wohnzimmer', { hidden: true }),
        entry('sensor.rm_wohnzimmer_humidity', 'rm_wohnzimmer', { hidden: true }),
        entry('sensor.rm_late_temperature', 'rm_late'),
        entry('climate.rm_study', 'rm_study'),
        entry('sensor.rm_hall_a_temperature', 'rm_hall'),
        entry('sensor.rm_hall_b_temperature', 'rm_hall'),
        entry('sensor.rm_store_temperature', 'rm_store'),
        entry('sensor.rm_store_humidity', 'rm_store', { hidden: true }),
      ]),
      ...GARAGE_ENTITIES,
      ...GALLEY_ENTITIES,
      ...UTILITY_ENTITIES,
      ...SUNROOM_ENTITIES,
      ...LOUNGE_ENTITIES,
      ...HUWAI_ENTITIES,
    },
    devices: {
      [GARAGE_DEVICE.id]: GARAGE_DEVICE,
      [GALLEY_DEVICE.id]: GALLEY_DEVICE,
      [UTILITY_DEVICE.id]: UTILITY_DEVICE,
      ...Object.fromEntries(WEATHER_DEVICES.map((device) => [device.id, device])),
    },
    areas: {
      rm_living: {
        area_id: 'rm_living',
        name: 'Living room',
        floor_id: 'rm_ground',
        icon: 'mdi:sofa',
        picture: PHOTO,
      },
      rm_kitchen: {
        area_id: 'rm_kitchen',
        name: 'Kitchen',
        floor_id: 'rm_ground',
        icon: 'mdi:silverware-fork-knife',
      },
      rm_bedroom: {
        area_id: 'rm_bedroom',
        name: 'Bedroom',
        floor_id: 'rm_upstairs',
        icon: 'mdi:bed',
      },
      rm_empty: { area_id: 'rm_empty', name: 'Attic' },
      rm_garten: { area_id: 'rm_garten', name: 'Garten', icon: 'mdi:flower' },
      rm_gaste_wc: { area_id: 'rm_gaste_wc', name: 'Gäste-WC', icon: 'mdi:toilet' },
      rm_kuche: {
        area_id: 'rm_kuche',
        name: 'Küche',
        icon: 'mdi:stove',
        temperature_entity_id: 'sensor.rm_kuche_temperature',
        humidity_entity_id: 'sensor.rm_kuche_humidity',
      },
      rm_wohnzimmer: { area_id: 'rm_wohnzimmer', name: 'Wohnzimmer', icon: 'mdi:sofa' },
      rm_late: { area_id: 'rm_late', name: 'Spare room', icon: 'mdi:bed' },
      rm_study: { area_id: 'rm_study', name: 'Study', icon: 'mdi:desk' },
      rm_hall: { area_id: 'rm_hall', name: 'Hall', icon: 'mdi:door' },
      rm_store: { area_id: 'rm_store', name: 'Storeroom', icon: 'mdi:archive' },
      rm_den: { area_id: 'rm_den', name: 'Den', icon: 'mdi:sofa' },
      rm_garage: GARAGE_AREA,
      rm_galley: GALLEY_AREA,
      rm_utility: { area_id: 'rm_utility', name: 'Utility room', icon: 'mdi:washing-machine' },
      rm_sunroom: { area_id: 'rm_sunroom', name: 'Sunroom', icon: 'mdi:flower' },
      rm_lounge: LOUNGE_AREA,
      rm_huwai: HUWAI_AREA,
    },
    floors: {
      rm_ground: { floor_id: 'rm_ground', name: 'Ground floor', level: 0 },
      rm_upstairs: { floor_id: 'rm_upstairs', name: 'Upstairs', level: 1 },
    },
  },
  frames: [
    // the approved area anatomy: the photo, the readouts, the category rows
    {
      title: 'Room · photo',
      cards: [room({ area: 'rm_living', path: '/fluvy-auto/room-rm_living' })],
    },
    // its controls as compact tiles instead of rows
    {
      title: 'Room · tiles',
      cards: [room({ area: 'rm_living', controls: 'tiles', path: '/fluvy-auto/room-rm_living' })],
    },
    // no picture: the accent's gradient under the pill; no path, so no chevrons
    { title: 'Room · no photo', cards: [room({ area: 'rm_kitchen' })] },
    // the head and the controls
    {
      title: 'Room · tile',
      cards: [
        room({
          area: 'rm_living',
          variant: 'tile',
          controls: 'tiles',
          path: '/fluvy-auto/room-rm_living',
        }),
      ],
    },
    // the arrows asked away (#151): the name has their room, a tap still opens the room
    {
      title: 'Room · tile · no arrow',
      cards: [
        room({
          area: 'rm_living',
          variant: 'tile',
          show_arrow: false,
          path: '/fluvy-auto/room-rm_living',
        }),
      ],
    },
    // a compact tile: two a row
    {
      title: 'Room · rows',
      cards: [
        room({ area: 'rm_living', variant: 'row', cols: 6, path: '/fluvy-auto/room-rm_living' }),
        room({ area: 'rm_bedroom', variant: 'row', cols: 6 }),
      ],
    },
    // an area with nothing in it, and one that is not there
    {
      title: 'Room · empty, missing',
      cards: [room({ area: 'rm_empty' }), room({ area: 'rm_ghost' })],
    },
    // #39 as reported, two a row: the diagnostic sensors the kitchen names are read; the living room's hidden ones are
    // not, and its card keeps the photo, then says why it is empty
    {
      title: 'Room · four areas, two sensors each (#39)',
      cards: ['rm_garten', 'rm_gaste_wc', 'rm_kuche', 'rm_wohnzimmer'].map(reporter),
    },
    // the empty room across the section, photo and tile: the administrator's hint and the way in
    {
      title: 'Room · hidden sensors, why it is empty',
      cards: [
        room({
          area: 'rm_wohnzimmer',
          variant: 'photo',
          show_count: false,
          path: '/fluvy-auto/room-rm_wohnzimmer',
        }),
        room({ area: 'rm_wohnzimmer', variant: 'tile', path: '/fluvy-auto/room-rm_wohnzimmer' }),
      ],
    },
    // the same room for someone who is not an administrator: the panel, no hint
    {
      title: 'Room · hidden sensors, not an administrator',
      cards: [room({ area: 'rm_wohnzimmer', variant: 'tile' })],
      hass: (hass) => ({ ...hass, user: { ...hass.user!, is_admin: false } }),
    },
    // a sensor whose state is not there yet (Home Assistant starting): the rooms suite adds it, the card fills
    {
      title: 'Room · a sensor that arrives late',
      cards: [room({ area: 'rm_late', variant: 'photo', show_count: false })],
    },
    // a thermostat alone: the room's readings are its own
    { title: 'Room · thermostat only', cards: [room({ area: 'rm_study', variant: 'photo' })] },
    // the first sensor dead, the second working: the working one is read
    {
      title: 'Room · unavailable first',
      cards: [room({ area: 'rm_hall', variant: 'photo', show_count: false })],
    },
    // entries the registry has and the house has no state for: empty, and nothing counted
    { title: 'Room · registry without state', cards: [room({ area: 'rm_store' })] },
    // a room's lights in their bulbs' colours (`light_colors`): its tiles each its own, its lights' row the colour of
    // what is lit, by brightness (the white adds none)
    {
      title: 'Room · bulb colours',
      cards: [
        room({ area: 'rm_den', variant: 'tile', controls: 'tiles', light_colors: true }),
        room({ area: 'rm_den', variant: 'tile', light_colors: true }),
      ],
    },
    // #78: a list past its cap ends with the house's fold row, "N more", to a subview of every one — on a card of its
    // own under a list of whole cards, as the last row of a list of rows
    {
      title: 'Room page · a list past its cap (#78)',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          more: 9,
          more_path: '/fluvy-auto/climate-humidity',
        },
        {
          type: 'custom:fluvy-entities-card',
          title: 'Devices',
          rows: ['switch.rm_tv_plug', 'sensor.rm_living_humidity'],
          more: 12,
          more_path: '/fluvy-auto/room-rm_living-devices',
        },
      ],
    },
    // #76: the reporter's garage counts its door (#95: its sensors are no devices)…
    {
      title: 'Room · the reporter’s garage (#76)',
      cards: [room({ area: 'rm_garage', path: '/fluvy-auto/room-rm_garage' })],
    },
    // …and its page reaches all five: the door as a cover, the readings, the smoke and the leak on its Openings card
    {
      title: 'Room page · the reporter’s garage (#76)',
      get cards() {
        return roomPage(GARAGE_AREA, GARAGE, GARAGE_ENTITIES, GARAGE_DEVICE);
      },
    } satisfies FrameSpec,
    // #95: a kitchen counts its two lights, never the dishwasher's options, and fills by them; its tiles are its lights…
    {
      title: 'Room · a kitchen with an appliance’s controls (#95)',
      cards: [
        room({ area: 'rm_galley', path: '/fluvy-auto/room-rm_galley' }),
        room({ area: 'rm_galley', controls: 'tiles', variant: 'tile' }),
        room({ area: 'rm_galley', variant: 'row', cols: 6 }),
      ],
    },
    // …and its page still reaches the dishwasher's controls, as rows under Devices
    {
      title: 'Room page · a kitchen with an appliance’s controls (#95)',
      get cards() {
        return roomPage(GALLEY_AREA, GALLEY, GALLEY_ENTITIES, GALLEY_DEVICE);
      },
    } satisfies FrameSpec,
    // #100: a room's tiles and its row with their names in two lines where one would cut them, each a line taller
    {
      title: 'Room · names in two lines (#100)',
      cards: [
        room({ area: 'rm_living', variant: 'tile', controls: 'tiles', name_lines: 2 }),
        room({
          area: 'rm_bedroom',
          name: 'Rares’ Bedroom',
          variant: 'row',
          name_lines: 2,
          cols: 6,
        }),
        room({ area: 'rm_living', name: 'Technical Room', variant: 'row', name_lines: 2, cols: 6 }),
      ],
    },
    // #95, the promised tuning: the dishwasher's power counted (`include`), the counter light left out (`exclude`)
    {
      title: 'Room · a room’s own include and exclude (#95)',
      cards: [
        room({ area: 'rm_galley', variant: 'row', include: ['switch.rm_dishwasher_power'] }),
        room({
          area: 'rm_galley',
          variant: 'tile',
          exclude: ['light.rm_galley_counter'],
          path: '/fluvy-auto/room-rm_galley',
        }),
      ],
    },
    // a room of sensors alone: its readings, and no row of devices it has none of
    {
      title: 'Room · sensors alone, no devices',
      cards: [
        room({ area: 'rm_garten', variant: 'photo', path: '/fluvy-auto/room-rm_garten' }),
        room({ area: 'rm_garten', variant: 'tile', path: '/fluvy-auto/room-rm_garten' }),
      ],
    },
    // a Tuya plug that files its countdown and power-on behaviour as no setting: its switch counts, as a plug's does
    {
      title: 'Room · a plug with a timer and a power-on behaviour',
      cards: [room({ area: 'rm_utility', variant: 'tile', controls: 'tiles' })],
    },
    // #113: the quick actions at the end of the head, the row and the picture — the room's lights and blinds by default
    {
      title: 'Room · quick actions (#113)',
      cards: [
        room({ area: 'rm_living', variant: 'row' }),
        room({ area: 'rm_bedroom', variant: 'row', quick_actions: ['lights', 'fans'] }),
        room({
          area: 'rm_den',
          variant: 'tile',
          controls: 'none',
          path: '/fluvy-auto/room-rm_den',
        }),
      ],
    },
    // the person's own: an entity with its own name and colour (the kettle on), one that cannot be read, one not
    // there, a set; and the order asked for, as many as the picture and the head hold
    {
      title: 'Room · quick actions of one’s own (#113)',
      hass: (hass) => ({
        ...hass,
        states: {
          ...hass.states,
          'switch.rm_kettle': { ...hass.states['switch.rm_kettle']!, state: 'on' },
        },
      }),
      cards: [
        room({
          area: 'rm_kitchen',
          variant: 'photo',
          quick_actions: [
            { entity: 'switch.rm_kettle', name: 'Kettle', color: '#e2725b' },
            'switch.rm_porch',
            'switch.rm_ghost',
            'lights',
          ],
        }),
        room({
          area: 'rm_living',
          variant: 'tile',
          controls: 'none',
          quick_actions: ['media', 'covers', { group: 'lights', icon: 'mdi:ceiling-light' }],
        }),
      ],
    },
    // #170: a lamp on a plug among the room's lights, as the automatic dashboards list it: the Lights row counts it, and
    // the lights' round switches it as a switch with the rest, its ring counting it whole while it is on
    {
      title: 'Room · a lamp on a plug among its lights (#170)',
      hass: (hass) => ({
        ...hass,
        states: {
          ...hass.states,
          'switch.rm_bedside_lamp': {
            ...hass.states['switch.rm_kettle']!,
            entity_id: 'switch.rm_bedside_lamp',
            state: 'on',
            attributes: { friendly_name: 'Bedside lamp' },
          },
        },
        entities: {
          ...hass.entities,
          'switch.rm_bedside_lamp': { entity_id: 'switch.rm_bedside_lamp', area_id: 'rm_bedroom' },
        } as HomeAssistant['entities'],
      }),
      cards: [
        room({
          area: 'rm_bedroom',
          variant: 'tile',
          lights: ['light.rm_bedroom', 'switch.rm_bedside_lamp'],
          path: '/fluvy-auto/room-rm_bedroom',
        }),
        room({
          area: 'rm_bedroom',
          variant: 'row',
          lights: ['light.rm_bedroom', 'switch.rm_bedside_lamp'],
        }),
      ],
    },
    // half a section: as many rounds as the name leaves room for, none where it leaves none; and none asked for
    {
      title: 'Room · quick actions in half a section (#113)',
      cards: [
        room({ area: 'rm_den', variant: 'photo', controls: 'none', cols: 6 }),
        room({ area: 'rm_kitchen', variant: 'photo', controls: 'none', cols: 6 }),
        room({ area: 'rm_den', variant: 'tile', controls: 'none', cols: 6 }),
        room({
          area: 'rm_living',
          variant: 'tile',
          controls: 'none',
          cols: 6,
          show_quick_actions: false,
        }),
      ],
    },
    // the sunroom: its blinds' round closes the blinds and tilts the roof shut, never the screen; its radio's takes no tap
    {
      title: 'Room · blinds that only tilt among its covers',
      cards: [
        room({
          area: 'rm_sunroom',
          variant: 'tile',
          controls: 'none',
          quick_actions: ['covers', 'media', 'lights'],
          path: '/fluvy-auto/room-rm_sunroom',
        }),
      ],
    },
    // asked first: Home Assistant's dialog asks once for the blinds and the roof alike, and both move at its yes
    {
      title: 'Room · blinds that only tilt among its covers, asked first',
      cards: [
        room({
          area: 'rm_sunroom',
          variant: 'tile',
          controls: 'none',
          quick_actions: [
            { group: 'covers', tap_action: { action: 'toggle', confirmation: true } },
          ],
          path: '/fluvy-auto/room-rm_sunroom',
        }),
      ],
    },
    // an empty list of tiles (an editor that cleared it) is the room's controls, as no list is: declared as drawn
    {
      title: 'Room · an empty list of tiles',
      cards: [
        room({ area: 'rm_living', variant: 'tile', controls: 'tiles', tiles: [] }),
        room({ area: 'rm_kitchen', controls: 'tiles', tiles: [] }),
      ],
    },
    // #159 as reported, a phone's 328: the name at the photo's top leaves its foot to four quick actions and the
    // readouts stand on one row, their labels as icons where a word would not hold its third; under it, the card as it
    // was (the name at the foot beside two actions, the readouts wrapped: two and one in Dutch)
    {
      title: 'Room · the reporter’s card at 328 (#159)',
      width: 328,
      cards: [
        woonkamer({ name_position: 'top', quick_actions: FOUR_ACTIONS }),
        woonkamer({ readout_style: 'wrap' }),
      ],
    },
    // the name at the top: over a photo and over the accent's gradient, with one action, with four, with none
    {
      title: 'Room · the name at the top (#159)',
      cards: [
        woonkamer({ name_position: 'top', quick_actions: FOUR_ACTIONS }),
        room({ area: 'rm_kitchen', variant: 'photo', name_position: 'top', controls: 'none' }),
        woonkamer({ name_position: 'top', show_quick_actions: false, controls: 'rows' }),
      ],
    },
    // …in half a section, where the foot holds two rounds the name left no room for; a long name ends in its ellipsis
    // and an empty room keeps its panel
    {
      title: 'Room · the name at the top in half a section (#159)',
      cards: [
        woonkamer({ name_position: 'top', cols: 6 }),
        woonkamer({ name: 'Conservatory and winter garden', name_position: 'top', cols: 6 }),
        room({ area: 'rm_den', variant: 'photo', controls: 'none', cols: 6 }),
        room({ area: 'rm_empty', variant: 'photo', name_position: 'top', cols: 6 }),
      ],
    },
    // the readouts on one row: the words where every one holds its third, else their icons, then the smaller figure,
    // then the short units; two readouts, and one, keep their own columns
    {
      title: 'Room · readouts on one row (#159)',
      cards: [woonkamer(), woonkamer({ show_count: false }), woonkamer({ show_climate: false })],
    },
    // …in half a section: three hold a row no more, and stand two and one with their icons before one a line
    {
      title: 'Room · readouts on one row in half a section (#159)',
      cards: [woonkamer({ cols: 6 }), woonkamer({ show_count: false, cols: 6 })],
    },
    // the labels asked for one way: always words (the row wraps where they would not hold), always icons, none
    {
      title: 'Room · readout labels as words, icons, none (#159)',
      cards: [
        woonkamer({ readout_labels: 'words' }),
        woonkamer({ readout_labels: 'icons' }),
        woonkamer({ readout_labels: 'none' }),
      ],
    },
    // wrapped, as before 1.19: fewer columns before a word gives way; with icons, by the figures alone
    {
      title: 'Room · readouts wrapped (#159)',
      cards: [
        woonkamer({ readout_style: 'wrap' }),
        woonkamer({ readout_style: 'wrap', cols: 6 }),
        woonkamer({ readout_style: 'wrap', readout_labels: 'icons', cols: 6 }),
      ],
    },
    // a reading out of reach keeps its readout, its icon and its row: a dash where its figure would be
    {
      title: 'Room · a reading out of reach on the row (#159)',
      cards: [
        woonkamer({ temperature_entity: 'sensor.rm_hall_a_temperature', name_position: 'top' }),
        woonkamer({
          temperature_entity: 'sensor.rm_hall_a_temperature',
          readout_labels: 'icons',
          cols: 6,
        }),
        woonkamer({
          temperature_entity: 'sensor.rm_hall_a_temperature',
          readout_labels: 'none',
          cols: 6,
        }),
      ],
    },
    // #172: a room's page leads with its scenes, on one Scenes card, before its lamp; none of them a row of its devices
    {
      title: 'Room page · its scenes first (#172)',
      get cards() {
        return roomPage(LOUNGE_AREA, LOUNGE, LOUNGE_ENTITIES);
      },
    } satisfies FrameSpec,
    // …and its card's rounds run them: a scene has no on or off, so its round is never drawn as on
    {
      title: 'Room · a scene’s round (#172)',
      cards: [
        room({
          area: 'rm_lounge',
          variant: 'tile',
          quick_actions: ['lights', 'scene.rm_lounge_movie', 'scene.rm_lounge_goodnight'],
          path: '/fluvy-auto/room-rm_lounge',
        }),
      ],
    },
    // #170: outdoors, two weather integrations' rows that would read alike, each told apart by its device
    {
      title: 'Room page · rows that would read alike (#170)',
      get cards() {
        return roomPage(HUWAI_AREA, HUWAI, HUWAI_ENTITIES, ...WEATHER_DEVICES);
      },
    } satisfies FrameSpec,
  ],
};
