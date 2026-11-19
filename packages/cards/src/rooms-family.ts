import {
  areaContents,
  areasInOrder,
  holdsSomething,
  type AreaRegistryEntry,
  type LovelaceCardConfig,
  type Registries,
} from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { EMPTY, ROW, ROW_COMPACT, rowsOf } from './shared/heights.js';

/*
 * The Rooms card (#225), announced at start and defined when its chunk lands (`rooms-cards.ts`), as the Rounds card
 * is: what the card picker lists, how tall the card is at a 360 column, and which of the house's areas it lists where
 * its config names none. Every page carries this file: it stays tiny.
 */

/** A room's tile (`tiles`): its 16 above and below, its 64 circle, 12, its name's 20 and its line's 16. */
export const ROOM_TILE = 144;

/** The areas the card lists where its config names none: each one with something to show, in the house's order. */
export const houseRooms = (hass: Registries): AreaRegistryEntry[] =>
  areasInOrder(hass).filter((area) => holdsSomething(areaContents(hass, area.area_id)));

/** A config's rooms: its entries that name an area, its id or an entry with `area`. */
export const roomEntries = (list: unknown): unknown[] =>
  Array.isArray(list)
    ? list.filter((entry: unknown) =>
        typeof entry === 'object' && entry !== null
          ? typeof (entry as { area?: unknown }).area === 'string' &&
            (entry as { area: string }).area !== ''
          : typeof entry === 'string' && entry !== '',
      )
    : [];

/**
 * How many rooms the card draws: those its config lists, else the house's (`house`: what it has to show, four where
 * the house is not there to say), `max_rooms` at most.
 */
export function roomCount(config: LovelaceCardConfig, house = 4): number {
  const listed = Array.isArray(config['rooms']) ? roomEntries(config['rooms']).length : house;
  const most = Math.floor(Number(config['max_rooms']));
  return most >= 1 ? Math.min(listed, most) : listed;
}

/**
 * The card at a 360 column from its config, and the house's rooms where it lists none: its head where it shows one
 * (44, and 8 over its rows or 16 over its tiles), then a 60 row a room (48 compact), 8 into the card's padding at each
 * end without a head; or its tiles two a row, 144 tall and 8 apart; or the empty panel and its hint where it has no
 * room.
 */
export const roomsHeight = (config: LovelaceCardConfig, house?: number): number => {
  const head = config['show_head'] !== false;
  const count = roomCount(config, house);
  if (!count) return (head ? 100 : 40) + EMPTY + 12;
  if (config['variant'] === 'tiles') {
    const lines = rowsOf(count, 2);
    return (head ? 100 : 40) + lines * ROOM_TILE + (lines - 1) * 8;
  }
  return (head ? 92 : 24) + count * (config['variant'] === 'compact' ? ROW_COMPACT : ROW);
};

export const ROOMS_FAMILY: readonly FamilyEntry[] = [
  ['fluvy-rooms-card', (config) => roomsHeight(config)],
];
