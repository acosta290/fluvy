import type { SheetSpec } from '../scenes.js';

/**
 * Double tap and the circle's own actions (#179): a tile, a row and a tab that wait 250 ms for a second tap where a
 * double tap is set (one tap opens, two switch); a tile's circle in every size and a head's circle that answer on their
 * own, buttons beside the card's; a row and a tab that hold. The suite `interactions-actions.mjs` taps, double-taps,
 * holds and keys each of them, and a finger in WebKit once.
 */
export const sheet: SheetSpec = {
  states: [
    [
      'light.tp_desk',
      'on',
      { friendly_name: 'Desk lamp', brightness: 179, supported_color_modes: ['brightness'] },
    ],
    [
      'light.tp_reading',
      'on',
      { friendly_name: 'Reading lamp', brightness: 102, supported_color_modes: ['brightness'] },
    ],
    [
      'light.tp_ceiling',
      'off',
      { friendly_name: 'Living room ceiling', supported_color_modes: ['brightness'] },
    ],
    ['switch.tp_kettle', 'off', { friendly_name: 'Kettle' }],
    ['switch.tp_heater', 'on', { friendly_name: 'Bathroom heater' }],
    ['fan.tp_bedroom', 'off', { friendly_name: 'Bedroom fan' }],
    [
      'sensor.tp_office',
      '21.4',
      { friendly_name: 'Office', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    [
      'sensor.tp_humidity',
      '48',
      { friendly_name: 'Office humidity', unit_of_measurement: '%', device_class: 'humidity' },
    ],
    [
      'sensor.tp_kettle_power',
      '2140',
      { friendly_name: 'Kettle power', unit_of_measurement: 'W', device_class: 'power' },
    ],
  ],
  frames: [
    // one tap opens the lamp, two switch it: the tap waits its 250 ms only here
    {
      title: 'Double tap · tiles',
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          tiles: [
            {
              entity: 'light.tp_desk',
              tap_action: { action: 'more-info' },
              double_tap_action: { action: 'toggle' },
            },
            {
              entity: 'switch.tp_kettle',
              tap_action: { action: 'more-info' },
              double_tap_action: { action: 'toggle' },
              hold_action: { action: 'navigate', navigation_path: '/h/kettle' },
            },
          ],
        },
      ],
    },
    // a large tile's circle opens its details on its own, beside the tile's tap; a circle that is the tile's switch
    // still flips it, and holds on its own
    {
      title: 'Circle · large',
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          size: 'large',
          tiles: [
            {
              entity: 'light.tp_reading',
              tap_action: { action: 'navigate', navigation_path: '/t/reading' },
              icon_tap_action: { action: 'more-info' },
            },
            {
              entity: 'switch.tp_heater',
              show_switch: false,
              readouts: ['sensor.tp_kettle_power'],
              icon_hold_action: { action: 'navigate', navigation_path: '/h/heater' },
            },
          ],
        },
      ],
    },
    // a compact and a mini tile: the whole tile toggles, its circle opens the details
    {
      title: 'Circle · compact and mini',
      cards: [
        {
          type: 'custom:fluvy-tile-card',
          entity: 'fan.tp_bedroom',
          size: 'compact',
          icon_tap_action: { action: 'more-info' },
          cols: 6,
        },
        {
          type: 'custom:fluvy-tile-card',
          entity: 'switch.tp_kettle',
          size: 'mini',
          icon_tap_action: { action: 'more-info' },
          icon_double_tap_action: { action: 'navigate', navigation_path: '/d/kettle' },
          cols: 6,
        },
      ],
    },
    // a head's circle: the head switches the light, its circle opens it
    {
      title: 'Circle · head',
      cards: [
        {
          type: 'custom:fluvy-light-card',
          entity: 'light.tp_ceiling',
          tap_action: { action: 'toggle' },
          icon_tap_action: { action: 'more-info' },
          icon_hold_action: { action: 'navigate', navigation_path: '/h/ceiling' },
        },
      ],
    },
    // rows that hold and double-tap, each its own
    {
      title: 'Rows',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Office',
          rows: [
            {
              entity: 'sensor.tp_office',
              name: 'Temperature',
              secondary: 'none',
              hold_action: { action: 'navigate', navigation_path: '/h/office' },
            },
            {
              entity: 'sensor.tp_humidity',
              name: 'Humidity',
              secondary: 'none',
              double_tap_action: { action: 'navigate', navigation_path: '/d/humidity' },
            },
            { entity: 'light.tp_desk', secondary: 'none' },
          ],
        },
      ],
    },
    // tabs: a still press on the office's switches its lamp; two taps on the kettle's switch it
    {
      title: 'Tabs',
      cards: [
        {
          type: 'custom:fluvy-chips-card',
          chips: [
            { name: 'Home', icon: 'mdi:home', path: '/t/home' },
            {
              name: 'Office',
              icon: 'mdi:desk',
              path: '/t/office',
              hold_action: { action: 'toggle', entity: 'light.tp_desk' },
            },
            {
              name: 'Kettle',
              icon: 'mdi:lightning-bolt',
              entity: 'switch.tp_kettle',
              double_tap_action: { action: 'toggle' },
            },
          ],
        },
      ],
    },
  ],
};
