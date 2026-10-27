import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { HEAD, ROW, ROW_COMPACT, rowsOf } from './shared/heights.js';

/**
 * The Items card, announced at start and defined when its chunk lands (`items-cards.ts`), as the template card is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

/** A tile of the `tiles` variant and the gap between tiles; two a row from a 288 content column (a phone's card). */
export const TILE = 76;
export const TILE_GAP = 8;

/** How many rows the card declares (`max_rows`, 1 to 20; five by default): its height, never the list's length. */
export const maxRows = (config: LovelaceCardConfig): number => {
  const asked = Number(config['max_rows']);
  return Number.isFinite(asked) ? Math.min(20, Math.max(1, Math.round(asked))) : 5;
};

/**
 * The list's box under the head, from the config alone: `max_rows` rows of 60 (`rows`, a value that would not hold
 * beside its name going under it in the same 60), of 48 (`compact`), or tiles of 76 `columns` a row, 8 apart
 * (`tiles`: two in a column of 288 or more, one under it) — whatever the list holds: fewer items, the empty panel and
 * a sensor out of reach keep the size.
 */
export function itemsList(config: LovelaceCardConfig, columns = 2): number {
  const n = maxRows(config);
  const variant = config['variant'];
  if (variant === 'compact') return ROW_COMPACT * n;
  if (variant === 'tiles') {
    const rows = rowsOf(n, columns);
    return rows * TILE + (rows - 1) * TILE_GAP;
  }
  return ROW * n;
}

/** The Items card at a 360 column: the head and the list's box. */
export const itemsHeight = (config: LovelaceCardConfig): number => HEAD + itemsList(config);

export const ITEMS_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-items-card',
    'Fluvy · Items',
    'The items of a sensor’s list attribute, a row each — flights overhead, departures, deliveries — with a flights preset for FlightRadar24.',
    itemsHeight,
  ],
];
