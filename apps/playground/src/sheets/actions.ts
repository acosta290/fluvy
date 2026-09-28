import type { SheetSpec } from '../scenes.js';

/**
 * A card's actions: `tap_action` answers the icon circle (a tile's whole surface), `hold_action` a still press on the
 * head — both more-info by default, both anything Home Assistant's actions are. A hold never also taps, and a hold
 * on a ruler is still its fine scale.
 */
export const sheet: SheetSpec = {
  states: [
    [
      'light.ac_desk',
      'on',
      { friendly_name: 'Desk lamp', brightness: 153, supported_color_modes: ['brightness'] },
    ],
    ['light.ac_hall', 'on', { friendly_name: 'Hall', supported_color_modes: ['brightness'] }],
    ['switch.ac_heater', 'off', { friendly_name: 'Heater' }],
  ],
  frames: [
    // the defaults: the icon opens the details, so does a hold on the head
    { title: 'Defaults', cards: [{ type: 'custom:fluvy-light-card', entity: 'light.ac_desk' }] },
    // chosen: the icon toggles, a hold goes to the room
    {
      title: 'Toggle and go',
      cards: [
        {
          type: 'custom:fluvy-light-card',
          entity: 'light.ac_hall',
          tap_action: { action: 'toggle' },
          hold_action: { action: 'navigate', navigation_path: '/fluvy-auto/rooms' },
        },
      ],
    },
    // a tile's whole surface: tap toggles, hold navigates; a hold never also toggles
    {
      title: 'Tiles',
      cards: [
        {
          type: 'custom:fluvy-tiles-card',
          tiles: [
            {
              entity: 'switch.ac_heater',
              hold_action: { action: 'navigate', navigation_path: '/fluvy-auto/rooms' },
            },
            { entity: 'light.ac_desk', tap_action: { action: 'none' } },
          ],
        },
      ],
    },
  ],
};
