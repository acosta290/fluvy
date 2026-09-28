import type { LovelaceCardConfig } from '@fluvy/core';

/*
 * What every card's `layoutHeight` counts with: the card's padding (20 above and below) and head (44, with 16
 * under it), a list's rows, and how many rows a set of things takes. Heights are measured at a 360 column.
 */

/** The padding and the head: 20 + 44 + 16 + … + 20. */
export const HEAD = 100;
/** A 60 px row (`listRow`), a 48 px compact one, a 76 px bar row. */
export const ROW = 60;
export const ROW_COMPACT = 48;
export const ROW_BAR = 76;
/** A compact device card: the head and one 44 row. */
export const COMPACT = 144;

/** How many things a config lists, under the first of `keys` that is an array. */
export function listLength(config: LovelaceCardConfig, keys: readonly string[]): number {
  for (const key of keys) {
    const value = config[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

/** Rows a set of `count` things takes, `perRow` a row. */
export const rowsOf = (count: number, perRow: number): number => Math.ceil(count / perRow);
