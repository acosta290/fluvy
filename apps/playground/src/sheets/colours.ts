import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

/**
 * Colour per card: a card's `color` (a Home Assistant colour name or a hex) stands in for the palette's accent
 * inside it — its chart, its lit light, its gauge — derived on the palette the page wears, in its mode.
 */
const sensor = (
  id: string,
  name: string,
  state: string,
  unit: string,
  deviceClass: string,
): StateSeed => [
  `sensor.${id}`,
  state,
  {
    friendly_name: name,
    unit_of_measurement: unit,
    device_class: deviceClass,
    state_class: 'measurement',
  },
];

const walk = (from: number, step: number, n = 24): number[] =>
  Array.from({ length: n }, (_, i) =>
    Number((from + Math.sin(i / 3) * step + (i % 5) * step * 0.1).toFixed(1)),
  );

export const sheet: SheetSpec = {
  states: [
    sensor('co_water', 'Water temperature', '38.5', '°C', 'temperature'),
    sensor('co_pool', 'Pool', '26.1', '°C', 'temperature'),
    sensor('co_oven', 'Oven', '180', '°C', 'temperature'),
    sensor('co_power', 'House power', '640', 'W', 'power'),
    sensor('co_lux', 'Light level', '312', 'lx', 'illuminance'),
    sensor('co_dust', 'Fine dust', '9', 'µg/m³', 'pm25'),
    sensor('co_humidity', 'Cellar humidity', '61', '%', 'humidity'),
    [
      'light.co_lamp',
      'on',
      { friendly_name: 'Reading lamp', brightness: 204, supported_color_modes: ['brightness'] },
    ],
    ['light.co_hall', 'off', { friendly_name: 'Hall', supported_color_modes: ['brightness'] }],
    ['fan.co_fan', 'on', { friendly_name: 'Ceiling fan', percentage: 66, supported_features: 1 }],
    [
      'media_player.co_player',
      'playing',
      {
        friendly_name: 'Kitchen speaker',
        media_title: 'Blue in Green',
        media_artist: 'Miles Davis',
        volume_level: 0.4,
        supported_features: 4,
      },
    ],
  ],
  history: {
    'sensor.co_water': walk(38, 1.2),
    'sensor.co_pool': walk(26, 0.6),
    'sensor.co_oven': walk(160, 25),
    'sensor.co_power': walk(600, 180),
    'sensor.co_lux': walk(300, 120),
    'sensor.co_dust': walk(9, 4),
    'sensor.co_humidity': walk(60, 5),
  },
  frames: [
    // six charts, six colours: a name of Home Assistant's, a hex typed, a grey
    {
      title: 'Six colours',
      width: 412,
      cards: [
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_water',
          variant: 'chart',
          hours: 6,
          color: 'blue',
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_pool',
          variant: 'chart',
          hours: 6,
          color: 'teal',
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_oven',
          variant: 'chart',
          hours: 6,
          color: 'deep-orange',
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_power',
          variant: 'chart',
          hours: 6,
          color: 'purple',
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_lux',
          variant: 'chart',
          hours: 6,
          color: '#c6ff00',
        },
        {
          type: 'custom:fluvy-sensor-card',
          entity: 'sensor.co_dust',
          variant: 'chart',
          hours: 6,
          color: 'grey',
        },
      ],
    },
    // the same chart in the palette's own accent: what a card without a colour is
    {
      title: 'No colour',
      cards: [
        { type: 'custom:fluvy-sensor-card', entity: 'sensor.co_water', variant: 'chart', hours: 6 },
      ],
    },
    // a red card: its lit light turns red (the accent's twin), the fan and the speaker keep their tones
    {
      title: 'Red tiles',
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          color: 'red',
          tiles: ['light.co_lamp', 'fan.co_fan', 'media_player.co_player', 'light.co_hall'],
        },
      ],
    },
    {
      title: 'Plain tiles',
      cards: [{ type: 'custom:fluvy-tiles-card', tiles: ['light.co_lamp', 'fan.co_fan'] }],
    },
    // a gauge's ring is drawn in the accent: an indigo card's is indigo
    {
      title: 'Indigo gauge',
      cards: [
        { type: 'custom:fluvy-gauge-card', entity: 'sensor.co_power', max: 3000, color: 'indigo' },
      ],
    },
    {
      title: 'Red light',
      cards: [{ type: 'custom:fluvy-light-card', entity: 'light.co_lamp', color: 'red' }],
    },
    {
      title: 'Cyan humidity',
      cards: [
        {
          type: 'custom:fluvy-humidity-card',
          entity: 'sensor.co_humidity',
          hours: 6,
          color: 'cyan',
        },
      ],
    },
  ],
};
