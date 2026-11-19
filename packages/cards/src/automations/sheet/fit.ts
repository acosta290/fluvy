/**
 * What the sheet fits by measure, as pure arithmetic: whether a tile's value holds its cell (the width its pair of
 * buttons share is `shared/pair.ts`'s). The sheet measures (its ruler) and asks here.
 */

/** A tile's value where it holds its cell, else its shorter form where that holds, else nothing: dropped, never wrapped or cut. */
export const heldValue = (full: string, short: string, fits: (text: string) => boolean): string =>
  fits(full) ? full : short && fits(short) ? short : '';
