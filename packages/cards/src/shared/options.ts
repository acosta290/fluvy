import { optionColumns } from '@fluvy/ui';

/** An option tile's two sides (12 px of padding each), which its label sits between. */
const SIDES = 24;

/**
 * The columns a row of option tiles takes so that no label is cut: as many as the count suggests
 * (`optionColumns`), one fewer while the longest label — measured in the tile's own class — does not fit
 * a cell's content, never under two (a tile's value would go too narrow; `optionGrid` already splits a
 * shorter last row). `gap` is the row's, or the gap the caller lays a given column count out with.
 */
export function optionColumnsFor(
  labels: readonly string[],
  width: number,
  gap: number | ((columns: number) => number),
  measure: (label: string) => number,
): number {
  const widest = Math.max(0, ...labels.map(measure));
  const cell = (columns: number): number =>
    (width - (typeof gap === 'number' ? gap : gap(columns)) * (columns - 1)) / columns - SIDES;
  let columns = optionColumns(labels.length);
  while (columns > 2 && cell(columns) < widest) columns -= 1;
  return columns;
}
