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
 * The room each readout of a row has in `columns` equal columns 16 apart (`fv-cols`): its column, or — the one
 * readout of a shorter last row, which takes the whole row — the whole row.
 */
const roomsOf =
  (width: number, count: number, columns: number) =>
  (index: number): number =>
    count % columns !== 0 && index === count - 1 ? width : (width - 16 * (columns - 1)) / columns;

/**
 * The columns a row of statistics takes so that no label or figure leaves its room: one for each while every label
 * and figure (at the extra-small size) holds in an equal column, else fewer — the caller lets a shorter last row take
 * the whole row, so its one readout is held to the row, not to a column: three in half a column are two and one
 * while the first two hold their halves. The columns are equal and 16 apart (`fv-cols`).
 */
export function statsColumns(ruler: TextRuler, width: number, items: readonly StatText[]): number {
  const widths = items.map(({ label, value, unit }) =>
    Math.max(
      ruler.width('fv-readout__label', label),
      ruler.width('fv-readout fv-readout--xs > fv-readout__value', value, 'fv-unit', unit ?? ''),
    ),
  );
  let columns = Math.max(1, items.length);
  while (columns > 1) {
    const room = roomsOf(width, items.length, columns);
    if (widths.every((wide, index) => wide <= room(index))) break;
    columns -= 1;
  }
  return columns;
}

/**
 * The size a row of statistics fits at: the small readout while every number with its unit fits its room (measured,
 * in the real classes), the extra-small one where a long unit ("µg/m³") on a narrow card would not.
 * The columns are equal and 16 apart (`fv-cols`), a shorter last row's one readout across the row.
 */
export function statsSize(
  ruler: TextRuler,
  width: number,
  items: readonly StatText[],
  columns = items.length,
): StatSize {
  const room = roomsOf(width, items.length, Math.max(1, columns));
  const fits = items.every(
    ({ value, unit }, index) =>
      ruler.width('fv-readout fv-readout--s > fv-readout__value', value, 'fv-unit', unit ?? '') <=
      room(index),
  );
  return fits ? 's' : 'xs';
}

/** A row of statistics laid out: its columns, its readouts' size, and whether its last row is shorter. */
export interface StatsRow {
  readonly columns: number;
  readonly size: StatSize;
  /** The last row holds fewer than `columns` (one, in rows of three at most): it takes the whole row. */
  readonly odd: boolean;
}

/**
 * A row of statistics as one decision, measured, never by a threshold: as many equal columns as hold every label
 * and figure (`statsColumns`), the size every figure fits its room at (`statsSize`), and a shorter last row taking
 * the whole row (`fv-cols--odd`) — three readouts in half a column are two and one, never three cut ones.
 */
export function statsRow(ruler: TextRuler, width: number, items: readonly StatText[]): StatsRow {
  const columns = statsColumns(ruler, width, items);
  return {
    columns,
    size: statsSize(ruler, width, items, columns),
    odd: items.length % columns !== 0,
  };
}

/** How a row writes its labels: in words, as icons (16, in the label's own line), or not at all. */
export type StatLabels = 'words' | 'icons' | 'none';

/** A figure as a readout writes it: its number and its unit, 4 after it or attached to it (`tight`: "21.4°"). */
export interface StatFigure {
  readonly value: string;
  readonly unit?: string;
  readonly tight?: boolean;
}

/** A statistic that can give way to keep its row: its figure as a compact surface writes it ("21.4°", "3/10"). */
export interface GivingStat extends StatText {
  readonly short?: StatFigure | undefined;
}

/** What a card asks of its readouts' row. */
export interface ReadoutsAsk {
  /** Fewer columns before anything else gives way, as `statsRow` lays a row out; else one row while it holds. */
  readonly wrap?: boolean;
  /** Its labels: words while each holds its column on the row, icons where one would not (`auto`); or one way. */
  readonly labels?: 'auto' | StatLabels;
}

/** A row of readouts laid out (`StatsRow`), with how its labels are written and whether its figures are short. */
export interface ReadoutsRow extends StatsRow {
  readonly labels: StatLabels;
  readonly short: boolean;
}

/** What a figure gives way through, in order: its size, then its unit. */
const FIGURES = [
  { size: 's', short: false },
  { size: 'xs', short: false },
  { size: 'xs', short: true },
] as const;

/**
 * A row of readouts that stays one row, measured, never by a threshold: every readout keeps its column (equal, 16
 * apart) and what does not hold gives way in order — the labels' words to their icons, the figures' size (s → xs),
 * then their units ("21.4 °C" → "21.4°", "3 of 10" → "3/10") — the labels and the figures each on their own line, so
 * words that hold stay over a figure that had to shrink. Only where the shortest figures still would not hold do the
 * columns give way, a shorter last row taking the whole row: no label, figure or unit is ever cut. Asked to wrap, the
 * words stay and the columns give way first, as `statsRow` lays every other card's row out.
 */
export function readoutsRow(
  ruler: TextRuler,
  width: number,
  items: readonly GivingStat[],
  { wrap = false, labels = 'auto' }: ReadoutsAsk = {},
): ReadoutsRow {
  const count = items.length;
  const forms: readonly StatLabels[] =
    labels !== 'auto' ? [labels] : wrap ? ['words'] : ['words', 'icons'];
  const figures = wrap ? FIGURES.slice(0, 2) : FIGURES;
  for (let columns = Math.max(1, count); ; columns -= 1) {
    const room = roomsOf(width, count, columns);
    const holds = (wide: (item: GivingStat) => number): boolean =>
      items.every((item, index) => wide(item) <= room(index));
    // an icon's 16 holds wherever a figure does
    const form = forms.find(
      (written) =>
        written !== 'words' || holds(({ label }) => ruler.width('fv-readout__label', label)),
    );
    const figure = figures.find(({ size, short }) =>
      holds((item) => {
        const written: StatFigure = (short && item.short) || item;
        const { value, unit = '', tight = false } = written;
        return ruler.width(
          `fv-readout fv-readout--${size} > fv-readout__value`,
          value,
          tight ? 'fv-unit fv-unit--tight' : 'fv-unit',
          unit,
        );
      }),
    );
    if ((form && figure) || columns === 1) {
      const { size, short } = figure ?? FIGURES[figures.length - 1]!;
      return {
        columns,
        size,
        odd: count % columns !== 0,
        labels: form ?? forms[forms.length - 1]!,
        short,
      };
    }
  }
}
