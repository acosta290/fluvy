import type { SheetSpec } from '../scenes.js';
import { sheet as ambient } from './ambient.js';
import { sheet as cameras } from './cameras.js';
import { cardsOf, sheet as hero } from './hero.js';
import { sheet as home } from './home.js';
import { sheet as homeExtras } from './home-extras.js';
import { sheet as lights } from './lights.js';
import { sheet as media } from './media.js';

/**
 * The README's whole app: a dashboard of three sections whose cards add up to one height, so they end level —
 * three side by side on a desktop beside the sidebar, the first two on a tablet, the first alone on a phone, each
 * screen showing whole cards only. The sections take the page's `width`:
 *   ?dashboard=showcase&frame=1&width=341   1440 × 756, the sidebar beside it
 *   ?dashboard=showcase&width=456           1024 × 756
 *   ?dashboard=showcase&width=348&views=4   412 × 756, the first section in the person's language
 */
export const sheet: SheetSpec = {
  states: [
    ...homeExtras.states,
    ...hero.states,
    ...lights.states,
    ...cameras.states,
    ...ambient.states,
  ],
  registry: {
    entities: {
      ...lights.registry?.entities,
      ...cameras.registry?.entities,
      ...ambient.registry?.entities,
    },
    devices: {
      ...lights.registry?.devices,
      ...cameras.registry?.devices,
      ...ambient.registry?.devices,
    },
    areas: { ...lights.registry?.areas, ...cameras.registry?.areas, ...ambient.registry?.areas },
    floors: {
      ...lights.registry?.floors,
      ...cameras.registry?.floors,
      ...ambient.registry?.floors,
    },
  },
  history: { ...hero.history, ...ambient.history },
  ws: { ...hero.ws, ...ambient.ws },
  ...(hero.api ? { api: hero.api } : {}),
  frames: [
    {
      // 60 + 468 + 76: the greeting and the thermostat in the person's own words, the kitchen's music
      title: 'Home',
      cards: [
        cardsOf(homeExtras, 'A Home')[0]!,
        ...cardsOf(hero, 'Thermostat'),
        cardsOf(media, 'Mini')[0]!,
      ],
    },
    {
      // 3 × 168 + 84: four tiles, two sensors on their day and the room's lights
      title: 'Living room',
      cards: [
        ...cardsOf(home, 'Tiles').slice(0, 4),
        ...cardsOf(ambient, 'Sensors').slice(0, 2),
        ...cardsOf(lights, 'Living room'),
      ],
    },
    {
      // 328 + 292: a camera and who is home
      title: 'Outside',
      cards: [...cardsOf(cameras, 'Cameras · one'), ...cardsOf(ambient, 'Who is home')],
    },
  ],
};
