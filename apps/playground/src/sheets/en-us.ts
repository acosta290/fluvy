import type { HomeAssistant } from '@fluvy/core';
import type { SheetSpec } from '../scenes.js';
import { sheet as vehicle } from './vehicle.js';

/*
 * #267's two Englishes side by side, on the Vehicle sheet's cars: Home Assistant's English (GB) reads British English,
 * its English in a house in the United States American English (Automatic, as the house's country says). The Haval
 * with its rear right tyre under its threshold and its tyres shown (asked for as each English writes it: `show_tyres`,
 * `show_tires`), a Model S with its boot open, an XC60 with its bonnet up, and a lamp in colour: Tyres and Tires, Boot
 * and Trunk, Bonnet and Hood, Colour and Color. A page in another language (the measurer's sweep) draws both frames in
 * its own.
 */

const CAR = 'custom:fluvy-vehicle-card';
const NOW = '2026-09-17T21:47:12';
/** The page speaks English: each frame speaks its own. */
const english = (new URLSearchParams(location.search).get('lang') ?? 'en').startsWith('en');

/** The house as Home Assistant speaks it in `language`, in `country`, the boot and the bonnet left open. */
const house =
  (language: string, country?: string) =>
  (hass: HomeAssistant): HomeAssistant => {
    const open = (id: string, state: string) => ({ [id]: { ...hass.states[id]!, state } });
    return {
      ...hass,
      ...(english
        ? {
            language,
            locale: { ...hass.locale, language },
            config: { ...hass.config, ...(country ? { country } : {}) },
          }
        : {}),
      states: {
        ...hass.states,
        ...open('cover.model_s_trunk', 'open'),
        ...open('binary_sensor.xc60_hood', 'on'),
      },
    };
  };

/** The cards, the tyres' keys as each English writes them (`show_tires`, `tire_low` read as the card's own). */
const cards = (tyres: 'tyre' | 'tire') => [
  {
    type: CAR,
    device: 'd-haval',
    _now: NOW,
    [`show_${tyres}s`]: true,
    [`${tyres}_low`]: 'sensor.haval_h6_tyre_threshold',
    show_rows: false,
  },
  { type: CAR, device: 'd-model-s', _now: NOW, variant: 'compact', cols: 6 },
  { type: CAR, device: 'd-xc60', _now: NOW, variant: 'compact', energy: 'hybrid', cols: 6 },
  { type: 'custom:fluvy-light-card', entity: 'light.us_sofa' },
];

export const sheet: SheetSpec = {
  on: [vehicle],
  states: [
    [
      'light.us_sofa',
      'on',
      {
        friendly_name: 'Sofa lamp',
        supported_color_modes: ['hs', 'color_temp'],
        color_mode: 'hs',
        brightness: 178,
        hs_color: [28, 62],
        rgb_color: [255, 168, 97],
        min_color_temp_kelvin: 2200,
        max_color_temp_kelvin: 6500,
      },
    ],
  ],
  frames: [
    { title: 'English (United Kingdom)', width: 360, hass: house('en-GB'), cards: cards('tyre') },
    {
      title: 'English (United States) · a house in the US',
      width: 360,
      hass: house('en', 'US'),
      cards: cards('tire'),
    },
  ],
};
