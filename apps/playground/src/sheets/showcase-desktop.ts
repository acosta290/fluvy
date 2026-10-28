import { mergeWs, type SheetSpec } from '../scenes.js';
import { sheet as ambient } from './ambient.js';
import { sheet as climate } from './climate.js';
import { sheet as security } from './devices-security.js';
import { cardsOf, sheet as hero } from './hero.js';
import { sheet as home } from './home.js';
import { sheet as homeExtras } from './home-extras.js';
import { sheet as media } from './media.js';
import { sheet as rooms } from './rooms.js';

/** The houses the cards come from; where two say a state, the later one's (the greeting's evening) is kept. */
const SOURCES: readonly SheetSpec[] = [hero, rooms, ambient, security, homeExtras];

/**
 * The README's whole app on a desktop: Home Assistant in Fluvy's floating frame, the sidebar beside a dashboard of
 * three full sections whose cards add up to one height (972), so they end level. The person's home (the greeting,
 * the house's readouts, the living room, who is home); the climate and the energy (the thermostat's dial, the day's
 * energy in the soft style, a light out of reach); the media and the house's safety (the player, the alarm, the
 * openings, the scenes):
 *   ?dashboard=showcase-desktop&frame=1&floating=1&logo=1&flat=1&header=page&actions=menu&views=4&width=384
 *   at 1600 × 1124
 * The cards are the sheets' own, a few drawn another way (the thermostat without its presets and fan, the people as
 * rows, two of the openings, the scenes under their title).
 */
export const sheet: SheetSpec = {
  states: [
    ...SOURCES.flatMap((source) => source.states),
    [
      'sensor.outside_temperature',
      '18',
      { friendly_name: 'Outside', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
  ],
  registry: {
    entities: Object.assign({}, ...SOURCES.map((source) => source.registry?.entities)),
    devices: Object.assign({}, ...SOURCES.map((source) => source.registry?.devices)),
    areas: Object.assign({}, ...SOURCES.map((source) => source.registry?.areas)),
    floors: Object.assign({}, ...SOURCES.map((source) => source.registry?.floors)),
  },
  history: {
    ...Object.assign({}, ...SOURCES.map((source) => source.history)),
    // the evening cooling outside: the readout's arrow is earned from these
    'sensor.outside_temperature': [
      23.1, 22.8, 22.4, 21.9, 21.2, 20.6, 20, 19.5, 19, 18.6, 18.3, 18.1, 18,
    ],
  },
  ws: mergeWs(SOURCES.map((source) => source.ws)),
  ...(hero.api ? { api: hero.api } : {}),
  frames: [
    {
      // 60 + 88 + 436 + 340
      title: 'Home',
      cards: [
        cardsOf(homeExtras, 'A Home')[0]!,
        {
          type: 'custom:fluvy-readouts-card',
          rows: [
            'sensor.outside_temperature',
            { entity: 'sensor.living_temperature', name: 'Inside' },
            // the house's power, as the energy card beside it reads it
            { entity: 'sensor.ef_house_power', name: 'Power' },
          ],
        },
        ...cardsOf(rooms, 'Room · tiles').map((card) => ({
          ...card,
          tiles: [
            { entity: 'light.rm_ceiling' },
            { entity: 'light.rm_reading', name: 'Reading' },
            { entity: 'switch.rm_tv_plug' },
            { entity: 'cover.rm_blinds' },
          ],
        })),
        ...cardsOf(ambient, 'Who is home').map((card) => ({
          ...card,
          variant: 'rows',
          entities: ['person.am_marta', 'person.am_pau', 'person.am_ona', 'person.am_jan'],
        })),
      ],
    },
    {
      // 484 + 380 + 76
      title: 'Climate and energy',
      cards: [
        ...cardsOf(climate, 'Heat').map((card) => ({
          ...card,
          show_presets: false,
          show_fan: false,
        })),
        ...cardsOf(hero, 'Energy'),
        { ...cardsOf(home, 'Tiles')[4]!, size: 'compact' },
      ],
    },
    {
      // 352 + 144 + 220 + 208
      title: 'Media and safety',
      cards: [
        ...cardsOf(media, 'Playing'),
        ...cardsOf(security, 'Alarm · compact'),
        ...cardsOf(ambient, 'Openings · each its own name').map((card) => ({
          ...card,
          rows: (card['rows'] as readonly unknown[]).slice(0, 2),
        })),
        ...cardsOf(ambient, 'Scenes').map((card) => ({ ...card, title: 'Scenes' })),
      ],
    },
  ],
};
