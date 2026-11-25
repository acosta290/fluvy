import type { FrameSpec, SheetSpec } from '../scenes.js';
import { FluvyCoverCard } from '../../../../packages/cards/src/cover/cover-card.js';
import { FluvyMediaCard } from '../../../../packages/cards/src/media/media-card.js';
import { FluvyThermostatCard } from '../../../../packages/cards/src/thermostat/thermostat-card.js';

/**
 * Extra rows on the cards of one device (Discussion #262): a lock's rows (`rows:`) under a light's, a fan's, a
 * cover's, a thermostat's, a player's and a humidity reading's own controls — a select as the house's dropdown (the
 * Hue gradient scene the discussion asks for), a switch, a press of the row's own, a sensor's value. Each at a phone's
 * column and in the narrow ones (266, 211, 172, 152); a row out of reach and one whose entity is gone keep their
 * places; a card out of reach keeps its rows; a bulb that only switches and one that shows its brightness while it is
 * on draw their rows under the head.
 */

// their chunks land after the page has drawn: the sheet defines the cards from their modules, as the cover sheets do
const define = (tag: string, ctor: CustomElementConstructor): void => {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
};
define('fluvy-cover-card', FluvyCoverCard);
define('fluvy-thermostat-card', FluvyThermostatCard);
define('fluvy-media-card', FluvyMediaCard);

const LIGHT = 'custom:fluvy-light-card';
const FAN = 'custom:fluvy-fan-card';
const COVER = 'custom:fluvy-cover-card';
const THERMOSTAT = 'custom:fluvy-thermostat-card';
const MEDIA = 'custom:fluvy-media-card';
const HUMIDITY = 'custom:fluvy-humidity-card';

/** The house's rooms, and the room each thing is in. */
const ROOMS: Readonly<Record<string, string>> = {
  xr_living: 'Living room',
  xr_bedroom: 'Bedroom',
  xr_hallway: 'Hallway',
  xr_bathroom: 'Bathroom',
  xr_porch: 'Porch',
};
const IN: Readonly<Record<string, string>> = {
  'light.xr_sofa_strip': 'xr_living',
  'select.xr_strip_scene': 'xr_living',
  'button.xr_strip_next': 'xr_living',
  'sensor.living_room_light_level': 'xr_living',
  'input_select.living_room_scene': 'xr_living',
  'select.xr_strip_effect': 'xr_living',
  'cover.xr_living_blind': 'xr_living',
  'sensor.xr_window_daylight': 'xr_living',
  'media_player.xr_soundbar': 'xr_living',
  'select.xr_soundbar_input': 'xr_living',
  'switch.xr_soundbar_night': 'xr_living',
  'fan.xr_bedroom': 'xr_bedroom',
  'switch.xr_fan_oscillation': 'xr_bedroom',
  'select.xr_fan_mode': 'xr_bedroom',
  'climate.xr_hallway': 'xr_hallway',
  'switch.xr_hallway_schedule': 'xr_hallway',
  'select.xr_hallway_preset': 'xr_hallway',
  'sensor.xr_bathroom_humidity': 'xr_bathroom',
  'humidifier.xr_dehumidifier': 'xr_bathroom',
  'select.xr_dehumidifier_mode': 'xr_bathroom',
  'sensor.xr_dehumidifier_tank': 'xr_bathroom',
  'light.xr_porch': 'xr_porch',
  'binary_sensor.xr_porch_motion': 'xr_porch',
  'switch.xr_porch_auto': 'xr_porch',
  'light.xr_reading': 'xr_living',
};

/** The Hue gradient strip's scenes, as its integration's select lists them. */
const SCENES = [
  'Savanna sunset',
  'Tropical twilight',
  'Arctic aurora',
  'Spring blossom',
  'Golden pond',
  'Ocean dawn',
];

/** The strip's rows: its gradient scene to choose, the next one at a press, and the room's light level. */
const STRIP_ROWS = [
  'select.xr_strip_scene',
  { entity: 'button.xr_strip_next', icon: 'mdi:skip-next', tap_action: { action: 'toggle' } },
  'sensor.living_room_light_level',
];

/** The strip with its rows: at the frame's width, or the section's where it has none. */
const strip = (title: string, more: Record<string, unknown> = {}, width?: number): FrameSpec => ({
  title: `Light · ${title}`,
  ...(width ? { width } : {}),
  cards: [{ type: LIGHT, entity: 'light.xr_sofa_strip', rows: STRIP_ROWS, ...more }],
});

const FAN_ROWS = ['switch.xr_fan_oscillation', 'select.xr_fan_mode'];
const THERMOSTAT_ROWS = ['switch.xr_hallway_schedule', 'select.xr_hallway_preset'];

export const sheet: SheetSpec = {
  states: [
    [
      'light.xr_sofa_strip',
      'on',
      {
        friendly_name: 'Sofa gradient strip',
        supported_color_modes: ['xy', 'color_temp'],
        color_mode: 'xy',
        brightness: 178,
        rgb_color: [255, 128, 64],
        min_color_temp_kelvin: 2000,
        max_color_temp_kelvin: 6535,
        effect_list: ['None', 'Candle', 'Fire', 'Prism'],
      },
    ],
    ['select.xr_strip_scene', 'Golden pond', { friendly_name: 'Gradient scene', options: SCENES }],
    ['button.xr_strip_next', '2026-09-17T19:42:00+00:00', { friendly_name: 'Next scene' }],
    [
      'sensor.living_room_light_level',
      '182',
      {
        friendly_name: 'Light level',
        device_class: 'illuminance',
        unit_of_measurement: 'lx',
        state_class: 'measurement',
      },
    ],
    // the docs' example (the gallery's Light card): the ceiling's scenes, a list of the person's own
    [
      'input_select.living_room_scene',
      'Relax',
      {
        friendly_name: 'Scene',
        options: ['Relax', 'Read', 'Concentrate', 'Energise', 'Nightlight'],
      },
    ],
    // out of reach: Home Assistant keeps the select and loses its state
    [
      'select.xr_strip_effect',
      'unavailable',
      { friendly_name: 'Effect', options: ['None', 'Candle', 'Fire', 'Prism'] },
    ],

    [
      'fan.xr_bedroom',
      'on',
      {
        friendly_name: 'Bedroom fan',
        // a speed in three steps, on and off: its oscillation and its mode are entities of their own
        supported_features: 1 + 16 + 32,
        percentage: 67,
        percentage_step: 100 / 3,
      },
    ],
    ['switch.xr_fan_oscillation', 'on', { friendly_name: 'Oscillation' }],
    [
      'select.xr_fan_mode',
      'Natural breeze',
      { friendly_name: 'Mode', options: ['Normal', 'Natural breeze', 'Sleep'] },
    ],

    [
      'cover.xr_living_blind',
      'open',
      {
        friendly_name: 'Living room blind',
        device_class: 'blind',
        supported_features: 1 + 2 + 4 + 8,
        current_position: 45,
      },
    ],
    [
      'sensor.xr_window_daylight',
      '1240',
      {
        friendly_name: 'Daylight',
        device_class: 'illuminance',
        unit_of_measurement: 'lx',
        state_class: 'measurement',
      },
    ],

    [
      'climate.xr_hallway',
      'heat',
      {
        friendly_name: 'Hallway radiator',
        min_temp: 5,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat'],
        temperature: 20.5,
        current_temperature: 19.6,
        hvac_action: 'heating',
      },
    ],
    ['switch.xr_hallway_schedule', 'on', { friendly_name: 'Schedule' }],
    [
      'select.xr_hallway_preset',
      'Comfort',
      { friendly_name: 'Preset', options: ['Comfort', 'Eco', 'Away', 'Boost'] },
    ],

    [
      'media_player.xr_soundbar',
      'playing',
      {
        friendly_name: 'Living room soundbar',
        supported_features: 1 + 4 + 8 + 16 + 32 + 128 + 256 + 1024 + 4096 + 16384,
        volume_level: 0.32,
        is_volume_muted: false,
        media_title: 'Gymnopédie No. 1',
        media_artist: 'Erik Satie',
        media_duration: 300,
        media_position: 112,
        media_position_updated_at: '2026-09-17T19:48:00+00:00',
      },
    ],
    [
      'select.xr_soundbar_input',
      'TV',
      { friendly_name: 'Input', options: ['TV', 'HDMI 1', 'Bluetooth', 'Optical'] },
    ],
    ['switch.xr_soundbar_night', 'off', { friendly_name: 'Night mode' }],

    [
      'sensor.xr_bathroom_humidity',
      '68',
      {
        friendly_name: 'Bathroom humidity',
        device_class: 'humidity',
        unit_of_measurement: '%',
        state_class: 'measurement',
      },
    ],
    [
      'humidifier.xr_dehumidifier',
      'on',
      { friendly_name: 'Dehumidifier', device_class: 'dehumidifier', humidity: 50 },
    ],
    [
      'select.xr_dehumidifier_mode',
      'Laundry',
      { friendly_name: 'Mode', options: ['Auto', 'Continuous', 'Laundry'] },
    ],
    [
      'sensor.xr_dehumidifier_tank',
      '62',
      { friendly_name: 'Water tank', unit_of_measurement: '%', state_class: 'measurement' },
    ],

    ['light.xr_porch', 'on', { friendly_name: 'Porch light', supported_color_modes: ['onoff'] }],
    [
      'binary_sensor.xr_porch_motion',
      'off',
      { friendly_name: 'Porch motion', device_class: 'motion' },
    ],
    ['switch.xr_porch_auto', 'on', { friendly_name: 'Motion lighting' }],
    [
      'light.xr_reading',
      'off',
      {
        friendly_name: 'Reading lamp',
        supported_color_modes: ['color_temp'],
        color_mode: 'color_temp',
        color_temp_kelvin: 2700,
      },
    ],
    // out of reach: the card keeps its anatomy and its rows
    ['light.xr_gone', 'unavailable', { friendly_name: 'Bookshelf strip' }],
  ],
  frames: [
    // the release's picture: the discussion's gradient scene, a press and a reading
    strip('its gradient scene, a press and the light level'),
    {
      title: 'Fan · its oscillation and its mode',
      cards: [{ type: FAN, entity: 'fan.xr_bedroom', rows: FAN_ROWS }],
    },
    {
      title: 'Cover · the daylight at the window',
      cards: [
        { type: COVER, entity: 'cover.xr_living_blind', rows: ['sensor.xr_window_daylight'] },
      ],
    },
    {
      title: 'Thermostat · its schedule and its preset',
      cards: [{ type: THERMOSTAT, entity: 'climate.xr_hallway', rows: THERMOSTAT_ROWS }],
    },
    {
      title: 'Media player · its input and its night mode',
      cards: [
        {
          type: MEDIA,
          entity: 'media_player.xr_soundbar',
          rows: ['select.xr_soundbar_input', 'switch.xr_soundbar_night'],
        },
      ],
    },
    {
      title: 'Humidity · the dehumidifier’s mode and its tank',
      cards: [
        {
          type: HUMIDITY,
          entity: 'sensor.xr_bathroom_humidity',
          humidifier_entity: 'humidifier.xr_dehumidifier',
          rows: [
            'select.xr_dehumidifier_mode',
            { entity: 'sensor.xr_dehumidifier_tank', icon: 'mdi:cup-water' },
          ],
        },
      ],
    },
    {
      title: 'Light · a bulb that only switches, its rows under its head',
      cards: [
        {
          type: LIGHT,
          entity: 'light.xr_porch',
          rows: ['binary_sensor.xr_porch_motion', 'switch.xr_porch_auto'],
        },
      ],
    },
    {
      title: 'Light · its brightness while on, off: its rows under its head',
      cards: [
        {
          type: LIGHT,
          entity: 'light.xr_reading',
          show_brightness: 'when_on',
          rows: ['sensor.living_room_light_level'],
        },
      ],
    },
    strip('a row out of reach and one whose entity is gone', {
      rows: ['select.xr_strip_scene', 'select.xr_strip_effect', 'sensor.xr_strip_gone'],
    }),
    {
      title: 'Light · out of reach, its rows kept',
      cards: [{ type: LIGHT, entity: 'light.xr_gone', rows: STRIP_ROWS }],
    },
    strip('the rows in their own words, colours and lines', {
      rows: [
        { entity: 'select.xr_strip_scene', name: 'Scene', icon: 'mdi:palette', color: 'orange' },
        {
          entity: 'button.xr_strip_next',
          name: 'Next scene',
          icon: 'mdi:skip-next',
          secondary: 'none',
          tap_action: { action: 'toggle' },
        },
        { entity: 'sensor.living_room_light_level', secondary: 'area', tone: 'warning' },
      ],
    }),
    // the narrow columns: the circles give way to the names, a dropdown goes under its name where it would not hold,
    // and in half a section its words break onto a second line rather than be cut
    ...[266, 211].map((width) => strip(`${width}`, {}, width)),
    {
      title: 'Light · two halves of a phone’s section',
      width: 360,
      cards: [
        { type: LIGHT, entity: 'light.xr_sofa_strip', rows: STRIP_ROWS, cols: 6 },
        {
          type: LIGHT,
          entity: 'light.xr_porch',
          rows: ['binary_sensor.xr_porch_motion', 'switch.xr_porch_auto'],
          cols: 6,
        },
      ],
    },
    {
      title: 'Two halves of a phone’s section: a compact thermostat, a light laid out by its width',
      width: 360,
      cards: [
        {
          type: THERMOSTAT,
          entity: 'climate.xr_hallway',
          variant: 'compact',
          rows: THERMOSTAT_ROWS,
          cols: 6,
        },
        { type: LIGHT, entity: 'light.xr_sofa_strip', rows: STRIP_ROWS, cols: 6 },
      ],
    },
    {
      title: 'Media player · the hero, its input under it',
      cards: [
        {
          type: MEDIA,
          entity: 'media_player.xr_soundbar',
          variant: 'hero',
          rows: ['select.xr_soundbar_input'],
        },
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
