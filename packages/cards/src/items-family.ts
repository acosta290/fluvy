import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { HEAD, ROW, ROW_COMPACT, rowsOf } from './shared/heights.js';

/**
 * The Items card, announced at start and defined when its chunk lands (`items-cards.ts`), as the template card is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

/** A tile of the `tiles` variant and the gap between tiles; two a row from a 320 content column. */
export const TILE = 76;
export const TILE_GAP = 8;

/** How many rows the card declares (`max_rows`, 1 to 20; five by default): its height, never the list's length. */
export const maxRows = (config: LovelaceCardConfig): number => {
  const asked = Number(config['max_rows']);
  return Number.isFinite(asked) ? Math.min(20, Math.max(1, Math.round(asked))) : 5;
};

/**
 * The Items card at a 360 column: the head, then `max_rows` rows of 60 (`rows`), of 48 (`compact`), or tiles of 76
 * two a row, 8 apart (`tiles`) — whatever the list holds: fewer items, the empty panel and a sensor out of reach keep
 * the size.
 */
export function itemsHeight(config: LovelaceCardConfig): number {
  const n = maxRows(config);
  const variant = config['variant'];
  if (variant === 'compact') return HEAD + ROW_COMPACT * n;
  if (variant === 'tiles') {
    const rows = rowsOf(n, 2);
    return HEAD + rows * TILE + (rows - 1) * TILE_GAP;
  }
  return HEAD + ROW * n;
}

export const ITEMS_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-items-card',
    'Fluvy · Items',
    'The items of a sensor’s list attribute, a row each — flights overhead, departures, deliveries — with a flights preset for FlightRadar24.',
    itemsHeight,
  ],
];
