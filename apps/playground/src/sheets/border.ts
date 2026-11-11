import type { LovelaceCardConfig } from '@fluvy/core';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { sheet as climate } from './climate.js';
import { PICTURE, sheet as glass } from './glass.js';
import { cardsOf } from './hero.js';
import { sheet as lights } from './lights.js';
import { sheet as printer } from './printer.js';
import { sheet as rooms } from './rooms.js';

/**
 * A card without its border (1.19, Discussion #171): each card as it is, then the same with `card_border: false` — no
 * hairline round its own surface, whatever colour it wears, a tile's where the card is one or a group of them. The
 * reporter's printer; a tile and a group with a lit one; a card of its own colour, its dividers still in it; a light
 * card lit whole; a room's tiles and a thermostat's wells, which keep theirs; a card out of reach, dashed (its dashes
 * stay) and as when off; see-through over a picture at 50 and 0 % (blurred, the house's; `&blur=0` unblurred). The
 * house's border for every card is `&border=0` (main.ts), under which the last frame's card keeps its own.
 */

/** The card, then the same card without its border. */
const pair = (
  title: string,
  cards: readonly LovelaceCardConfig[],
  backdrop?: string,
): FrameSpec => ({
  title,
  ...(backdrop ? { backdrop } : {}),
  cards: [...cards, ...cards.map((card) => ({ ...card, card_border: false }))],
});

/** The reporter's card: a printer that has finished, its progress and when it finished. */
const PRINTER: LovelaceCardConfig = {
  ...cardsOf(printer, 'Finished · its filament by name')[0]!,
  variant: 'compact',
};

/** A group of tiles, one of them lit. */
const TILES: LovelaceCardConfig = {
  type: 'custom:fluvy-tiles-card',
  tiles: ['light.ceiling', 'light.reading', 'switch.desk_plug', 'cover.blinds'],
};

/** Over a picture: the printer, the tiles, a thermostat. */
const SEE_THROUGH: readonly LovelaceCardConfig[] = [
  PRINTER,
  TILES,
  { type: 'custom:fluvy-thermostat-card', entity: 'climate.living', variant: 'compact' },
];

export const sheet: SheetSpec = {
  states: [...glass.states, ...printer.states],
  registry: {
    entities: { ...glass.registry?.entities, ...printer.registry?.entities },
    devices: { ...glass.registry?.devices, ...printer.registry?.devices },
    areas: glass.registry?.areas ?? {},
    floors: glass.registry?.floors ?? {},
  },
  history: glass.history ?? {},
  statistics: glass.statistics ?? {},
  ws: { ...glass.ws, ...printer.ws },
  ...(glass.api ? { api: glass.api } : {}),
  frames: [
    pair('Printer · with and without its border', [PRINTER]),
    pair('A tile, and a group of tiles with a lit one', [
      { type: 'custom:fluvy-tile-card', entity: 'light.ceiling' },
      TILES,
    ]),
    // its fill a wash of the colour, its dividers in it: the edge alone goes
    pair('A colour of its own', [
      { ...cardsOf(lights, 'Living room')[0]!, card_color: 'indigo' },
      {
        type: 'custom:fluvy-entities-card',
        entities: ['light.ceiling', 'light.reading', 'switch.desk_plug'],
        card_color: 'indigo',
      },
    ]),
    pair('Lit whole', [{ type: 'custom:fluvy-light-card', entity: 'light.lamp', tint: 'on' }]),
    // the card's own edge only: a room's tiles and a thermostat's wells keep theirs
    pair('A room’s tiles and a thermostat’s wells', [
      ...cardsOf(rooms, 'Room · tiles'),
      ...cardsOf(climate, 'Heat'),
    ]),
    // dashed, its dashes stay (the only line of its shape on the page's fill); as when off, no border
    pair('Out of reach · dashed, then as when off', [
      { type: 'custom:fluvy-light-card', entity: 'light.co_gone' },
      { type: 'custom:fluvy-light-card', entity: 'light.co_gone', unavailable: 'quiet' },
    ]),
    pair(
      'See-through · 50',
      SEE_THROUGH.map((card) => ({ ...card, card_opacity: 50 })),
      PICTURE,
    ),
    pair(
      'See-through · 0',
      SEE_THROUGH.map((card) => ({ ...card, card_opacity: 0 })),
      PICTURE,
    ),
    // a card's own border on a house without one (`&border=0`)
    { title: 'Its own border', cards: [{ ...PRINTER, card_border: true }] },
  ],
};
