/**
 * Bars and columns, pure: a bar in its slot (40 % of it, 2 to 40 wide, corners of 4 at most), a bar as a path
 * rounded at one end or both, the columns of one or several series stacked on a zero line, and how many of a
 * row's date labels hold.
 */

export interface BarGeometry {
  /** A bar's slot: the plot's width over the count. */
  readonly slot: number;
  /** The bar in its slot: 40 % of it, never under 2 nor over 40, on whole pixels. */
  readonly bar: number;
  /** The rounded end's corners: 4, or half the bar when it is thinner. */
  readonly radius: number;
}

export function barGeometry(count: number, width: number): BarGeometry {
  const slot = count > 0 ? width / count : width;
  const bar = Math.max(2, Math.min(40, Math.round(slot * 0.4)));
  return { slot, bar, radius: Math.min(4, bar / 2) };
}

/** Where a bar is rounded: the top of one that rises from the zero line, the foot of one that hangs, or both ends. */
export type Rounded = 'top' | 'bottom' | 'both';

/**
 * A bar as a path: rounded at the top of a bar that rises from the zero line, at the foot of one that hangs from it
 * (so its other end sits flat on the line), or at both ends (a bar that floats clear of its axis). `y` is the bar's
 * top, `height` its whole height; the radius never exceeds half the bar either way.
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  rounded: Rounded,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const f = (n: number): string => String(Math.round(n * 10) / 10);
  const straight = f(width - 2 * r);
  if (rounded === 'top')
    return `M${f(x)},${f(y + r)}a${f(r)},${f(r)} 0 0 1 ${f(r)},-${f(r)}h${straight}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(r)}v${f(height - r)}h-${f(width)}z`;
  if (rounded === 'bottom')
    return `M${f(x)},${f(y)}h${f(width)}v${f(height - r)}a${f(r)},${f(r)} 0 0 1 -${f(r)},${f(r)}h-${straight}a${f(r)},${f(r)} 0 0 1 -${f(r)},-${f(r)}z`;
  return `M${f(x)},${f(y + r)}a${f(r)},${f(r)} 0 0 1 ${f(r)},-${f(r)}h${straight}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(r)}v${f(height - 2 * r)}a${f(r)},${f(r)} 0 0 1 -${f(r)},${f(r)}h-${straight}a${f(r)},${f(r)} 0 0 1 -${f(r)},-${f(r)}z`;
}

/** One drawn segment of a column: its path, which series and slot it is, and what it holds. */
export interface Column {
  readonly d: string;
  readonly series: number;
  readonly slot: number;
  readonly value: number;
  /** Its top edge and height, for a value written over it. */
  readonly y: number;
  readonly height: number;
  readonly x: number;
  readonly width: number;
  /** Above the zero line or hanging from it. */
  readonly sign: 1 | -1;
  /** The outermost segment of its sign in the slot: the one with the rounded end. */
  readonly outer: boolean;
}

export interface ColumnsOptions {
  /** The series, each a value (or nothing) per slot; negatives hang from the zero line. */
  readonly series: ReadonlyArray<ReadonlyArray<number | null>>;
  readonly count: number;
  /** The plot's left edge and width. */
  readonly left: number;
  readonly width: number;
  /** Where a value sits, in px from the drawing's top (the scale's `yOf`). */
  readonly y: (value: number) => number;
  /** Several series on one another (the default), or each from the zero line on its own. */
  readonly stacked?: boolean;
  /** Rounded at the end away from the axis, or at both ends. */
  readonly caps?: 'top' | 'both';
  /** A bar's least height when its value is not zero: a trickle still reads as a bar. */
  readonly least?: number;
}

/**
 * The columns of a chart: one bar per slot for one series; for several, their segments stacked by sign on the zero
 * line (every rise on the rises, every fall on the falls), only the outermost segment of each sign rounded, so the
 * column reads as one bar of parts. A slot with nothing in it draws nothing.
 */
export function columns(o: ColumnsOptions): Column[] {
  const geometry = barGeometry(o.count, o.width);
  const out: Column[] = [];
  const least = o.least ?? 0;
  for (let slot = 0; slot < o.count; slot++) {
    const x = o.left + slot * geometry.slot + (geometry.slot - geometry.bar) / 2;
    const parts: Array<{ series: number; value: number }> = [];
    o.series.forEach((values, series) => {
      const value = values[slot];
      if (value !== null && value !== undefined && Number.isFinite(value) && value !== 0)
        parts.push({ series, value });
    });
    for (const sign of [1, -1] as const) {
      const own = parts.filter((part) => Math.sign(part.value) === sign);
      let acc = 0;
      own.forEach((part, index) => {
        const from = o.stacked === false ? 0 : acc;
        const to = from + part.value;
        acc = to;
        const top = Math.min(o.y(from), o.y(to));
        const bottom = Math.max(o.y(from), o.y(to));
        const height = Math.max(least, bottom - top);
        // a stacked segment keeps its foot on the one below it; a hanging one its head on the zero line
        const y = sign > 0 ? bottom - height : top;
        const outer = o.stacked === false || index === own.length - 1;
        const rounded: Rounded = !outer
          ? 'both'
          : o.caps === 'both'
            ? 'both'
            : sign > 0
              ? 'top'
              : 'bottom';
        const d =
          outer || o.caps === 'both'
            ? barPath(x, y, geometry.bar, height, geometry.radius, rounded)
            : barPath(x, y, geometry.bar, height, 0, 'top');
        out.push({
          d,
          series: part.series,
          slot,
          value: part.value,
          x,
          y,
          width: geometry.bar,
          height,
          sign,
          outer,
        });
      });
    }
  }
  return out;
}

/**
 * Every how many bars a date is written so that neighbours stay `gap` apart: the widest label and its gap over the
 * slot, rounded up (seven days at a 276 plot write every day; thirty write every sixth).
 */
export const thinStep = (widest: number, slot: number, gap = 12): number =>
  slot > 0 ? Math.max(1, Math.ceil((widest + gap) / slot)) : 1;

/**
 * Which bars carry a date at a thinning step: every `step`-th counted from the last, so the most recent day always
 * reads (the one people look for).
 */
export const labelled = (count: number, step: number): boolean[] =>
  Array.from({ length: count }, (_unused, i) => (count - 1 - i) % step === 0);

/** A label as placed: its centre and its width. */
export interface Placed {
  readonly x: number;
  readonly width: number;
}

/** Whether labels placed in order stand `gap` apart (a label kept inside the plot at an end may crowd its neighbour). */
export const labelsApart = (labels: readonly Placed[], gap = 12): boolean =>
  labels.every(
    (label, i) =>
      i === 0 ||
      label.x - label.width / 2 - gap >=
        (labels[i - 1] as Placed).x + (labels[i - 1] as Placed).width / 2,
  );
