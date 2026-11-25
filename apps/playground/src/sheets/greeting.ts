import { parseBackground, type LovelaceCardConfig } from '@fluvy/core';
import type { SheetSpec } from '../scenes.js';
import { DUNES } from './background.js';
import { sheet as extras } from './home-extras.js';

/*
 * The greeting beyond its words (1.26, #260), on the home sheet's house (Marta, her picture, the evening's weather):
 * without its avatar and without its name; its weather and its date as buttons of their own; and a line of quick
 * actions under it, as a room's and a car's — a lamp, the blinds, the front door's lock, a scene, the speaker and a
 * reading — across the column: at rest each in the middle of its share of it, saying their states each a key or a
 * pill as wide as its share, more than a phone's column holds, and on the page's backgrounds, where a round at rest
 * is a disc of the card's fill. And the top of an automatic
 * dashboard's view whose greeting is hidden (discussion #208): the views' chips first, or the cards themselves.
 */

/** The greeting is frozen on the sheet's evening (the `_now` test hook), so every render says the same thing. */
const EVENING = '2026-09-17T21:47:12';

type Placed = LovelaceCardConfig & { cols?: number };

const hello = (config: Record<string, unknown> = {}): Placed => ({
  type: 'custom:fluvy-hello-card',
  _now: EVENING,
  person: 'person.marta',
  weather: 'weather.flat',
  ...config,
});

/** An evening's quick actions: the hall's lamp, the blinds, the front door, a scene, the speaker. */
const QUICK = [
  'light.gr_hall',
  'cover.gr_blinds',
  'lock.gr_front_door',
  { entity: 'scene.gr_evening', icon: 'fluvy:moon' },
  'media_player.gr_speaker',
];
/** With what they say: the hall's temperature after them. */
const SAID = [...QUICK.slice(0, 3), 'sensor.gr_temperature'];

/** What an automatic dashboard's view opens with under a hidden greeting: a room's heading and its lights. */
const VIEW: Placed[] = [
  { type: 'custom:fluvy-heading-card', title: 'Hall', icon: 'fluvy:bulb' },
  { type: 'custom:fluvy-tile-card', entity: 'light.gr_hall', cols: 6 },
  { type: 'custom:fluvy-tile-card', entity: 'light.gr_desk', cols: 6 },
];
/** The views as chips, as the dashboard writes them under the greeting (`greeting_tabs: show`). */
const TABS: Placed = {
  type: 'custom:fluvy-chips-card',
  chips: [
    { label: 'Home', icon: 'fluvy:home', path: '/' },
    { label: 'Rooms', icon: 'fluvy:rooms', path: '/fluvy-auto/rooms' },
    { label: 'Climate', icon: 'fluvy:thermo', path: '/fluvy-auto/climate' },
    { label: 'Energy', icon: 'fluvy:bolt', path: '/fluvy-auto/energy' },
  ],
};

export const sheet: SheetSpec = {
  on: [extras],
  states: [
    [
      'light.gr_hall',
      'on',
      {
        friendly_name: 'Hall',
        supported_color_modes: ['color_temp'],
        color_mode: 'color_temp',
        brightness: 153,
        color_temp_kelvin: 2700,
        rgb_color: [255, 167, 87],
      },
    ],
    ['light.gr_desk', 'off', { friendly_name: 'Desk lamp', supported_color_modes: ['brightness'] }],
    [
      'cover.gr_blinds',
      'open',
      { friendly_name: 'Blinds', current_position: 70, supported_features: 15 },
    ],
    ['lock.gr_front_door', 'locked', { friendly_name: 'Front door' }],
    ['scene.gr_evening', '2026-09-17T20:14:00+00:00', { friendly_name: 'Evening' }],
    [
      'media_player.gr_speaker',
      'playing',
      { friendly_name: 'Speaker', volume_level: 0.35, supported_features: 21389 },
    ],
    [
      'sensor.gr_temperature',
      '21.4',
      { friendly_name: 'Temperature', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    ['switch.gr_pump', 'unavailable', { friendly_name: 'Garden pump' }],
    ['fan.gr_fan', 'off', { friendly_name: 'Fan', percentage: 0 }],
  ],
  frames: [
    // the avatar hidden (the automatic dashboards' option too): the greeting is then the card's button
    {
      title: 'Avatar hidden, name hidden',
      cards: [
        hello({ show_avatar: false }),
        hello({ show_name: false }),
        hello({ show_name: false, show_avatar: false, show_weather: false }),
      ],
    },
    // its weather opens its details and its date a calendar's view: each a 44 target of its own, the avatar still
    // the card's
    {
      title: 'Weather and date that answer',
      cards: [
        hello({
          weather_tap_action: { action: 'more-info' },
          date_tap_action: { action: 'navigate', navigation_path: '/calendar' },
        }),
        hello({
          show_avatar: false,
          weather: 'weather.clouds',
          weather_tap_action: { action: 'navigate', navigation_path: '/fluvy-auto/climate' },
          weather_hold_action: { action: 'more-info' },
        }),
      ],
    },
    {
      title: 'Quick actions',
      cards: [hello({ quick_actions: QUICK })],
    },
    {
      title: 'Quick actions · their states',
      cards: [
        hello({ quick_actions: SAID, show_quick_states: true }),
        hello({ quick_actions: SAID, show_quick_states: true, quick_state_position: 'beside' }),
      ],
    },
    // more than the column holds give way from the end, the one that would say its state among them: the rest stay
    // rounds, in the middle of the line a key's height keeps; one out of reach stays a dashed ring
    {
      title: 'Quick actions · many, one out of reach',
      cards: [
        hello({
          quick_actions: [
            'switch.gr_pump',
            ...QUICK,
            'light.gr_desk',
            'fan.gr_fan',
            { entity: 'sensor.gr_temperature', show_state: true },
          ],
        }),
        hello({ show_avatar: false, quick_actions: ['switch.gr_pump', 'light.gr_desk'] }),
      ],
    },
    // one alone says its state: every cell a key, its glyph on the keys' line, the reading's words under its own
    {
      title: 'Quick actions · one says its state',
      cards: [
        hello({
          quick_actions: [
            'light.gr_hall',
            'lock.gr_front_door',
            { entity: 'sensor.gr_temperature', show_state: true },
          ],
        }),
      ],
    },
    // on a picture and on a deep colour, see-through cards under it: a round at rest is a disc of the card's fill
    {
      title: 'Quick actions · on a picture',
      width: 360,
      background: parseBackground({ type: 'image', image: DUNES, dim: 40 }),
      cards: [
        hello({ quick_actions: SAID, show_quick_states: true }),
        { type: 'custom:fluvy-tile-card', entity: 'light.gr_hall', cols: 6, card_opacity: 70 },
        { type: 'custom:fluvy-tile-card', entity: 'light.gr_desk', cols: 6, card_opacity: 70 },
      ],
    },
    {
      title: 'Quick actions · on a deep colour',
      width: 360,
      background: parseBackground({ type: 'color', colors: ['#1d4ed8', '#60a5fa'] }),
      cards: [
        hello({
          quick_actions: QUICK,
          weather_tap_action: { action: 'more-info' },
        }),
        { type: 'custom:fluvy-tile-card', entity: 'light.gr_hall', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'light.gr_desk', cols: 6 },
      ],
    },
    // discussion #208: a view whose greeting is hidden opens with the views' chips where they are asked for, else
    // with its cards, each on the frame's own top
    {
      title: 'Greeting hidden · the views’ chips first',
      cards: [TABS, ...VIEW],
    },
    {
      title: 'Greeting hidden · the cards first',
      cards: VIEW,
    },
  ],
};
