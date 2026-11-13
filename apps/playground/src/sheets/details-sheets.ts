// its chunk lands the first time a sheet opens: the playground defines the sheets from their module
import '../../../../packages/cards/src/details/open.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

/**
 * Fluvy's own details sheets (1.20, #162), each docked in its frame as a phone draws it (`_docked`) and, at the foot of
 * the sheet, as a wide screen's dialog (`_docked: wide`): a light (a colour bulb with effects, a white one, one that
 * is off, one that only switches), a thermostat (heating with presets, an air conditioner with its fan and its swing,
 * a range, a water heater, a humidifier), a cover (a blind with its tilt, a garage door, a valve), a player (a
 * speaker playing, a television) and a fan (three speeds with its rows, a purifier, one that only switches); each
 * kind out of reach; and the tiles that open them (`?sheets=fluvy`), with one whose action keeps Home Assistant's
 * dialog and a sensor, which has no sheet.
 */

type Attributes = Record<string, unknown>;

/* supported_features bits */
const LIGHT_EFFECT = 4;
const CLIMATE = { TARGET: 1, RANGE: 2, FAN: 8, PRESET: 16, SWING: 32, OFF: 128, ON: 256 };
const COVER_ALL = 1 | 2 | 4 | 8;
const COVER_TILT = 16 | 32 | 128;
const SPEAKER = 1 | 4 | 8 | 16 | 32 | 128 | 256 | 2048 | 16384 | 65536;
const TELEVISION = 4 | 8 | 128 | 256 | 2048;
const FAN_ALL = 1 | 2 | 4 | 8;

/** Album art as a data URI: the playground never reaches out to the network. */
const art = (from: string, to: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="72" cy="66" r="42" fill="#ffffff" opacity="0.22"/><circle cx="168" cy="186" r="66" fill="#000000" opacity="0.12"/></svg>`,
  );

const HOUR = 3_600_000;

/** A day of states as the recorder keeps them: each state from so many hours before the window's end, oldest first. */
const states =
  (...stretches: ReadonlyArray<readonly [ago: number, state: string]>) =>
  (end: number): { s: string; lu: number }[] =>
    stretches.map(([ago, state]) => ({ s: state, lu: (end - ago * HOUR) / 1000 }));

/** A day of a room's temperature, a reading every ten minutes, as a climate's attributes carry it. */
const temperatures =
  (state: string, attribute: string, middle: number, swing: number) =>
  (end: number): { s: string; lu: number; a: Attributes }[] =>
    Array.from({ length: 145 }, (_unused, i) => {
      const t = end - (144 - i) * (HOUR / 6);
      // a day's slow wave, ending where the entity stands now
      const value = middle + swing * Math.sin(((144 - i) / 144) * 2 * Math.PI);
      return { s: state, lu: t / 1000, a: { [attribute]: Math.round(value * 10) / 10 } };
    });

/** What the recorder has of each entity of the sheet. */
const HISTORY: Readonly<Record<string, (end: number) => unknown[]>> = {
  'light.dt_floor': states([24, 'off'], [15.5, 'on'], [14, 'off'], [4.5, 'on']),
  'light.dt_ceiling': states([24, 'on'], [22.5, 'off'], [3, 'on']),
  'light.dt_reading': states([24, 'off'], [5, 'on'], [2, 'off']),
  'light.dt_fairy': states([24, 'off'], [6, 'on']),
  'climate.dt_living': temperatures('heat', 'current_temperature', 20.8, 1.1),
  'climate.dt_bedroom': temperatures('cool', 'current_temperature', 26.1, 1.6),
  'climate.dt_study': temperatures('heat_cool', 'current_temperature', 22.3, 0.9),
  'water_heater.dt_tank': temperatures('eco', 'current_temperature', 49, 5),
  'humidifier.dt_nursery': temperatures('on', 'current_humidity', 44, 6),
  'cover.dt_blind': states([24, 'closed'], [14.5, 'open'], [1.5, 'closed'], [0.5, 'open']),
  'cover.dt_garage': states(
    [24, 'closed'],
    [13.6, 'open'],
    [13.4, 'closed'],
    [3.2, 'open'],
    [3, 'closed'],
  ),
  'valve.dt_garden': states([24, 'closed'], [15, 'open'], [14.5, 'closed']),
  'media_player.dt_kitchen': states([24, 'idle'], [13, 'playing'], [12, 'idle'], [2.5, 'playing']),
  'media_player.dt_tv': states([24, 'off'], [3.5, 'on']),
  'fan.dt_ceiling': states([24, 'on'], [16, 'off'], [5, 'on']),
  'fan.dt_purifier': states([24, 'off'], [9, 'on']),
};

const light = (name: string, attributes: Attributes): Attributes => ({
  friendly_name: name,
  ...attributes,
});

const sheetOf = (tag: string, entity: string, docked: true | 'wide' = true) => ({
  type: `custom:fluvy-details-${tag}`,
  entity,
  _docked: docked,
});

/** A frame of one sheet: a phone's, or a wide screen's dialog (always 392: the dialog's own width). */
const frame = (
  title: string,
  tag: string,
  entity: string,
  wide = false,
): SheetSpec['frames'][number] => ({
  title,
  ...(wide ? { width: 392 } : {}),
  cards: [sheetOf(tag, entity, wide ? 'wide' : true)],
});

const STATES: readonly StateSeed[] = [
  [
    'light.dt_floor',
    'on',
    light('Floor lamp', {
      supported_color_modes: ['hs', 'color_temp'],
      color_mode: 'hs',
      brightness: 184,
      rgb_color: [255, 166, 87],
      hs_color: [28, 66],
      min_color_temp_kelvin: 2000,
      max_color_temp_kelvin: 6500,
      effect_list: ['None', 'Candle', 'Fireplace', 'Sunrise', 'Colour loop'],
      effect: 'None',
      supported_features: LIGHT_EFFECT,
    }),
  ],
  [
    'light.dt_ceiling',
    'on',
    light('Ceiling', {
      supported_color_modes: ['color_temp'],
      color_mode: 'color_temp',
      brightness: 115,
      color_temp_kelvin: 3000,
      rgb_color: [255, 180, 107],
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
    }),
  ],
  [
    'light.dt_reading',
    'off',
    light('Reading lamp', {
      supported_color_modes: ['hs', 'color_temp'],
      min_color_temp_kelvin: 2000,
      max_color_temp_kelvin: 6500,
    }),
  ],
  ['light.dt_fairy', 'on', light('Fairy lights', { supported_color_modes: ['onoff'] })],
  [
    'light.dt_gone',
    'unavailable',
    light('Garden string', { supported_color_modes: ['hs', 'color_temp'] }),
  ],
  [
    'climate.dt_living',
    'heat',
    {
      friendly_name: 'Thermostat',
      temperature: 21.5,
      current_temperature: 20.8,
      current_humidity: 46,
      min_temp: 15,
      max_temp: 30,
      target_temp_step: 0.5,
      hvac_modes: ['off', 'heat', 'cool', 'auto'],
      hvac_action: 'heating',
      preset_modes: ['eco', 'comfort', 'away', 'boost'],
      preset_mode: 'comfort',
      supported_features: CLIMATE.TARGET | CLIMATE.PRESET | CLIMATE.OFF | CLIMATE.ON,
    },
  ],
  [
    'climate.dt_bedroom',
    'cool',
    {
      friendly_name: 'Air conditioner',
      temperature: 24,
      current_temperature: 26.1,
      min_temp: 16,
      max_temp: 30,
      target_temp_step: 1,
      hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'],
      hvac_action: 'cooling',
      fan_modes: ['auto', 'low', 'medium', 'high'],
      fan_mode: 'auto',
      swing_modes: ['off', 'vertical', 'horizontal', 'both'],
      swing_mode: 'vertical',
      preset_modes: ['none', 'eco', 'sleep'],
      preset_mode: 'none',
      supported_features:
        CLIMATE.TARGET | CLIMATE.FAN | CLIMATE.PRESET | CLIMATE.SWING | CLIMATE.OFF | CLIMATE.ON,
    },
  ],
  [
    'climate.dt_study',
    'heat_cool',
    {
      friendly_name: 'Study',
      target_temp_low: 20,
      target_temp_high: 24,
      current_temperature: 22.3,
      min_temp: 15,
      max_temp: 30,
      target_temp_step: 0.5,
      hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      hvac_action: 'idle',
      supported_features: CLIMATE.TARGET | CLIMATE.RANGE | CLIMATE.OFF | CLIMATE.ON,
    },
  ],
  [
    'climate.dt_gone',
    'unavailable',
    {
      friendly_name: 'Attic',
      min_temp: 15,
      max_temp: 30,
      hvac_modes: ['off', 'heat', 'cool'],
      preset_modes: ['eco', 'comfort'],
      supported_features: CLIMATE.TARGET | CLIMATE.PRESET,
    },
  ],
  [
    'water_heater.dt_tank',
    'eco',
    {
      friendly_name: 'Water heater',
      temperature: 52,
      current_temperature: 49,
      min_temp: 40,
      max_temp: 65,
      operation_list: ['off', 'eco', 'electric', 'performance'],
    },
  ],
  [
    'humidifier.dt_nursery',
    'on',
    {
      friendly_name: 'Humidifier',
      humidity: 50,
      current_humidity: 44,
      min_humidity: 30,
      max_humidity: 70,
      available_modes: ['normal', 'sleep', 'baby'],
      mode: 'sleep',
    },
  ],
  [
    'cover.dt_blind',
    'open',
    {
      friendly_name: 'Blind',
      device_class: 'blind',
      current_position: 65,
      current_tilt_position: 40,
      supported_features: COVER_ALL | COVER_TILT,
    },
  ],
  [
    'cover.dt_garage',
    'closed',
    { friendly_name: 'Garage door', device_class: 'garage', supported_features: 1 | 2 | 8 },
  ],
  [
    'cover.dt_gone',
    'unavailable',
    { friendly_name: 'Awning', device_class: 'awning', supported_features: COVER_ALL },
  ],
  [
    'valve.dt_garden',
    'closed',
    {
      friendly_name: 'Garden water',
      device_class: 'water',
      current_position: 0,
      supported_features: COVER_ALL,
    },
  ],
  [
    'media_player.dt_kitchen',
    'playing',
    {
      friendly_name: 'Kitchen speaker',
      media_title: 'Weightless',
      media_artist: 'Marconi Union',
      entity_picture: art('#8a6a3a', '#e0cba4'),
      volume_level: 0.32,
      is_volume_muted: false,
      source_list: ['Spotify', 'Radio', 'Line-in', 'Bluetooth'],
      source: 'Spotify',
      sound_mode_list: ['Music', 'Speech', 'Night'],
      sound_mode: 'Music',
      supported_features: SPEAKER,
    },
  ],
  [
    'media_player.dt_tv',
    'on',
    {
      friendly_name: 'Television',
      device_class: 'tv',
      volume_level: 0.18,
      is_volume_muted: true,
      source_list: ['HDMI 1', 'HDMI 2', 'Netflix', 'YouTube', 'Live TV'],
      source: 'Netflix',
      supported_features: TELEVISION,
    },
  ],
  [
    'media_player.dt_gone',
    'unavailable',
    { friendly_name: 'Patio speaker', supported_features: SPEAKER },
  ],
  [
    'fan.dt_ceiling',
    'on',
    {
      friendly_name: 'Ceiling fan',
      percentage: 66.66,
      percentage_step: 33.33,
      oscillating: true,
      direction: 'forward',
      preset_modes: ['auto', 'breeze', 'sleep'],
      preset_mode: null,
      supported_features: FAN_ALL,
    },
  ],
  [
    'fan.dt_purifier',
    'on',
    {
      friendly_name: 'Air purifier',
      percentage: 40,
      percentage_step: 1,
      preset_modes: ['auto', 'night'],
      preset_mode: 'auto',
      supported_features: 1 | 8,
    },
  ],
  ['fan.dt_extractor', 'off', { friendly_name: 'Extractor', supported_features: 0 }],
  // a kind with no sheet of its own: its details stay Home Assistant's
  [
    'sensor.dt_outside',
    '14.2',
    { friendly_name: 'Outside', device_class: 'temperature', unit_of_measurement: '°C' },
  ],
  [
    'fan.dt_gone',
    'unavailable',
    { friendly_name: 'Attic fan', percentage_step: 25, supported_features: FAN_ALL },
  ],
];

const AREAS: Readonly<Record<string, string>> = {
  'light.dt_floor': 'dt_living',
  'light.dt_ceiling': 'dt_kitchen',
  'light.dt_reading': 'dt_bedroom',
  'light.dt_fairy': 'dt_terrace',
  'light.dt_gone': 'dt_garden',
  'climate.dt_living': 'dt_living',
  'climate.dt_bedroom': 'dt_bedroom',
  'water_heater.dt_tank': 'dt_utility',
  'humidifier.dt_nursery': 'dt_nursery',
  'cover.dt_blind': 'dt_bedroom',
  'cover.dt_gone': 'dt_terrace',
  'media_player.dt_kitchen': 'dt_kitchen',
  'media_player.dt_tv': 'dt_living',
  'fan.dt_ceiling': 'dt_bedroom',
  'fan.dt_purifier': 'dt_living',
  'fan.dt_extractor': 'dt_kitchen',
};

export const sheet: SheetSpec = {
  states: STATES,
  registry: {
    entities: Object.fromEntries(
      Object.entries(AREAS).map(([entity_id, area_id]) => [entity_id, { entity_id, area_id }]),
    ),
    areas: {
      dt_living: { area_id: 'dt_living', name: 'Living room' },
      dt_kitchen: { area_id: 'dt_kitchen', name: 'Kitchen' },
      dt_bedroom: { area_id: 'dt_bedroom', name: 'Bedroom' },
      dt_nursery: { area_id: 'dt_nursery', name: 'Nursery' },
      dt_terrace: { area_id: 'dt_terrace', name: 'Terrace' },
      dt_garden: { area_id: 'dt_garden', name: 'Garden' },
      dt_utility: { area_id: 'dt_utility', name: 'Utility room' },
    },
  },
  ws: {
    // each entity's day as the recorder keeps it: its states, and a thermostat's with what it measured
    'history/history_during_period': (message) => {
      const ids = (message['entity_ids'] as readonly string[]).filter((id) => HISTORY[id]);
      if (!ids.length) return undefined;
      const end = Date.parse(String(message['end_time']));
      return Object.fromEntries(ids.map((id) => [id, HISTORY[id]?.(end) ?? []]));
    },
  },
  frames: [
    frame('Light', 'light', 'light.dt_floor'),
    frame('Light · a white bulb', 'light', 'light.dt_ceiling'),
    frame('Light · off', 'light', 'light.dt_reading'),
    frame('Light · one that only switches', 'light', 'light.dt_fairy'),
    frame('Climate', 'climate', 'climate.dt_living'),
    frame('Climate · an air conditioner', 'climate', 'climate.dt_bedroom'),
    frame('Climate · a range', 'climate', 'climate.dt_study'),
    frame('Water heater', 'climate', 'water_heater.dt_tank'),
    frame('Humidifier', 'climate', 'humidifier.dt_nursery'),
    frame('Cover', 'cover', 'cover.dt_blind'),
    frame('Cover · a garage door', 'cover', 'cover.dt_garage'),
    frame('Valve', 'cover', 'valve.dt_garden'),
    frame('Media', 'media', 'media_player.dt_kitchen'),
    frame('Media · a television', 'media', 'media_player.dt_tv'),
    frame('Fan', 'fan', 'fan.dt_ceiling'),
    frame('Fan · a purifier', 'fan', 'fan.dt_purifier'),
    frame('Fan · one that only switches', 'fan', 'fan.dt_extractor'),
    frame('Light · out of reach', 'light', 'light.dt_gone'),
    frame('Climate · out of reach', 'climate', 'climate.dt_gone'),
    frame('Cover · out of reach', 'cover', 'cover.dt_gone'),
    frame('Media · out of reach', 'media', 'media_player.dt_gone'),
    frame('Fan · out of reach', 'fan', 'fan.dt_gone'),
    frame('Light · a wide screen', 'light', 'light.dt_floor', true),
    frame('Climate · a wide screen', 'climate', 'climate.dt_living', true),
    frame('Cover · a wide screen', 'cover', 'cover.dt_blind', true),
    frame('Media · a wide screen', 'media', 'media_player.dt_kitchen', true),
    frame('Fan · a wide screen', 'fan', 'fan.dt_ceiling', true),
    {
      title: 'Tiles that open them',
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          columns: 2,
          tiles: [
            { entity: 'light.dt_floor', tap_action: { action: 'more-info' } },
            { entity: 'climate.dt_living' },
            { entity: 'cover.dt_blind', tap_action: { action: 'more-info' } },
            { entity: 'media_player.dt_kitchen', tap_action: { action: 'more-info' } },
            { entity: 'fan.dt_ceiling', tap_action: { action: 'more-info' } },
            {
              entity: 'light.dt_ceiling',
              tap_action: { action: 'more-info', details: 'home-assistant' },
            },
            { entity: 'sensor.dt_outside' },
          ],
        },
      ],
    },
  ],
};
