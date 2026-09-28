import type { TextRuler } from './fit.js';

/** A statistic as a card says it: its label, its number and its unit. */
export interface StatText {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

/** The readout sizes a row of statistics may take: the small one, or the extra-small one where it must. */
export type StatSize = 's' | 'xs';

/**
 * The size a row of statistics fits at: the small readout while the widest number with its unit fits its column
 * (measured, in the real classes), the extra-small one where a long unit ("µg/m³") on a narrow card would not.
 * The columns are equal and 16 apart (`fv-cols`).
 */
export function statsSize(
  ruler: TextRuler,
  width: number,
  items: readonly StatText[],
  columns = items.length,
): StatSize {
  const column = (width - 16 * (columns - 1)) / columns;
  const fits = items.every(
    ({ value, unit }) =>
      ruler.width('fv-readout fv-readout--s > fv-readout__value', value, 'fv-unit', unit ?? '') <=
      column,
  );
  return fits ? 's' : 'xs';
}
