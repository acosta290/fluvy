import '../../../../packages/cards/src/alerts-cards.js';
import { defineCardWrapper } from '../hui-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as climate } from './climate.js';
import { sheet as clocks } from './clocks.js';
import { cardsOf } from './hero.js';
import { sheet as home } from './home.js';
import { sheet as media } from './media.js';

// the sidebar's cards are Home Assistant's to build, whose wrapper is not here: the playground's stands in
defineCardWrapper();

/*
 * A dashboard with a sidebar of its own (1.21, #187): `?dashboard=sidebar&side=menu` draws these frames as its view,
 * beside the sidebar the page asks for (`side.ts`). The house is the sheets' own — the tiles, a thermostat and a
 * player, the clock's weather — with a front door left open and a sensor's battery low, for the alerts at the
 * sidebar's foot. As a sheet of its own (`?sheet=sidebar`) the frames are the view's cards, each one of another
 * sheet's.
 */

/** What needs a look: the front door open for twelve minutes, the hallway sensor's battery at 12 %. */
const ATTENTION: readonly StateSeed[] = [
  ['binary_sensor.sb_front_door', 'on', { device_class: 'door', friendly_name: 'Front door' }, 720],
  [
    'sensor.sb_hallway_battery',
    '12',
    {
      device_class: 'battery',
      unit_of_measurement: '%',
      state_class: 'measurement',
      friendly_name: 'Hallway sensor battery',
    },
  ],
];

export const sheet: SheetSpec = {
  states: [...home.states, ...climate.states, ...media.states, ...clocks.states, ...ATTENTION],
  registry: {
    areas: { ...climate.registry?.areas },
    entities: { ...home.registry?.entities, ...climate.registry?.entities },
  },
  ws: { ...clocks.ws, ...media.ws },
  api: (method, path, body, house) => media.api?.(method, path, body, house),
  frames: [
    { title: 'Lights', cards: cardsOf(home, 'Tiles').slice(0, 4) },
    { title: 'Heating', cards: cardsOf(climate, 'Heat') },
    { title: 'Music', cards: cardsOf(media, 'Playing') },
    { title: 'Switches', cards: cardsOf(home, 'Compact tiles') },
  ],
};
