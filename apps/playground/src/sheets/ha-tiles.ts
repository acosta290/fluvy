import { defineCardWrapper } from '../hui-card.js';
import type { SheetSpec } from '../scenes.js';

/*
 * Home Assistant's own tile cards under Fluvy's theme (#240): their names and states in Home Assistant's own sizes
 * (14/500 over 12/400, at the person's text size), where the theme had given them our compact tile's 15/600 over
 * 13/500 and cut names a tile holds under Home Assistant's own theme ("Bedside lamps", "Study radiator": whole at a
 * phone's half section now, cut before), two a row on a phone, 172 each. Light and dark are the page's
 * (`&mode=dark`); `&viewtheme=Fluvy` draws them in a view Home Assistant themed with the theme file. Its own entities
 * (`ht_`), each with the icon Home Assistant gives its kind (the playground draws an icon by its name).
 */

// Home Assistant's cards are drawn by the playground's stand-in, as its own `hui-card` would build them
defineCardWrapper();

const HA_TILES = [
  'light.ht_bedside_lamps',
  'climate.ht_study_radiator',
  'cover.ht_bedroom_blind',
  'lock.ht_front_door',
  'water_heater.ht_hot_water_tank',
  'media_player.ht_study_speaker',
] as const;

export const sheet: SheetSpec = {
  states: [
    [
      'light.ht_bedside_lamps',
      'on',
      {
        friendly_name: 'Bedside lamps',
        icon: 'mdi:lamp',
        brightness: 204,
        supported_color_modes: ['brightness'],
        color_mode: 'brightness',
      },
    ],
    [
      'climate.ht_study_radiator',
      'heat',
      {
        friendly_name: 'Study radiator',
        icon: 'mdi:radiator',
        hvac_modes: ['off', 'heat'],
        hvac_action: 'heating',
        temperature: 21,
        current_temperature: 19.5,
        supported_features: 1 + 128 + 256,
      },
    ],
    [
      'cover.ht_bedroom_blind',
      'open',
      {
        friendly_name: 'Bedroom blind',
        icon: 'mdi:blinds-horizontal',
        current_position: 60,
        supported_features: 15,
      },
    ],
    ['lock.ht_front_door', 'locked', { friendly_name: 'Front door', icon: 'mdi:lock' }],
    [
      'water_heater.ht_hot_water_tank',
      'eco',
      {
        friendly_name: 'Hot water tank',
        icon: 'mdi:water-boiler',
        operation_list: ['off', 'eco', 'performance'],
        operation_mode: 'eco',
        temperature: 50,
        current_temperature: 47,
        supported_features: 1 + 2 + 8,
      },
    ],
    [
      'media_player.ht_study_speaker',
      'playing',
      {
        friendly_name: 'Study speaker',
        icon: 'mdi:speaker',
        media_title: 'Harvest Moon',
        volume_level: 0.3,
      },
    ],
  ],
  frames: [
    // Home Assistant's own geometry (its 10 inset, its 36 icon), not ours: drawn for the eye, never audited by the measurer
    {
      title: 'Home Assistant’s tiles · a phone',
      measure: false,
      cards: HA_TILES.map((entity) => ({ type: 'tile', entity, cols: 6 })),
    },
  ],
};
