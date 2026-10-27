import type { Tone } from '@fluvy/ui';

/**
 * What a chart is drawn from: a series of readings evenly spaced across the plot (a `null` is a gap the line
 * breaks at), the window they cover and where "now" falls in it, and the colour each series wears.
 */

/** How a line joins its readings: Catmull-Rom curves, straight segments, or a value held across its slot. */
export type Curve = 'smooth' | 'straight' | 'step';

/** A reading at an instant; `null` is a gap (the recorder had nothing, the forecast ends). */
export interface ChartPoint {
  readonly t: number;
  readonly v: number | null;
}

/** The time a chart covers, and the instant it reads as now (the future begins after it). */
export interface Window {
  readonly start: number;
  readonly end: number;
  readonly now: number;
}

/**
 * The colour of a series: one of the palette's tones, one of the six series colours the palette derives
 * (`series-1` … `series-6`, or the house's saved set's), the accent, or a colour of the person's own.
 */
export type SeriesColour = Tone | `series-${1 | 2 | 3 | 4 | 5 | 6}` | 'accent' | `#${string}`;

/** One series of a chart: its readings evenly spaced across the plot, and how it is drawn apart from the others. */
export interface ChartSeries {
  readonly values: ReadonlyArray<number | null>;
  /** Its colour; none: the chart's own (the tone its wrapper carries). */
  readonly colour?: SeriesColour;
  /** A colour of the person's, as the card's accent sheet keys it (`data-accent`): it wins over `colour`. */
  readonly accent?: string;
  readonly name?: string;
  /** What a summarised reading moved between, drawn as a band behind the line. */
  readonly band?: { readonly low: readonly number[]; readonly high: readonly number[] };
}

/**
 * Readings evenly spaced across a window: each slot ends on `count` equal steps from `start` to `end` and reads the
 * last reading at or before its end — a recorder's reading holds until the next one. A slot before the first reading
 * is a gap, and so is a reading that is itself a gap.
 */
export function evenly(
  points: readonly ChartPoint[],
  window: Pick<Window, 'start' | 'end'>,
  count: number,
): (number | null)[] {
  const out: (number | null)[] = [];
  if (!(count > 0)) return out;
  let index = 0;
  let last: number | null = null;
  for (let i = 0; i < count; i++) {
    const t = window.start + ((i + 1) / count) * (window.end - window.start);
    while (index < points.length && (points[index] as ChartPoint).t <= t) {
      last = (points[index] as ChartPoint).v;
      index++;
    }
    out.push(last !== null && Number.isFinite(last) ? last : null);
  }
  return out;
}

/** The series' value at a fraction of its length, interpolated between the two nearest readings — what the dot at that x stands on. */
export function sampleAt(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0] ?? null;
  const at = Math.min(1, Math.max(0, fraction)) * (values.length - 1);
  const i = Math.min(Math.floor(at), values.length - 2);
  const t = at - i;
  return (values[i] as number) + ((values[i + 1] as number) - (values[i] as number)) * t;
}

/** How a slot's readings make one bar: their mean (a measurement), or what a counter gained (`change`; `increase` for
 * one that only grows, where a fall is a reset and what it shows since is the gain). */
export type BucketRule = 'mean' | 'change' | 'increase';

/**
 * Evenly spaced readings gathered into `count` bars (at most one a reading), each the slot's readings by `rule`: the
 * mean of a measurement's, or the counter's gain across its slot — from the slot before's last reading (the first
 * slot's from its own first) to its own last.
 */
export function bucket(values: readonly number[], count: number, rule: BucketRule): number[] {
  const n = values.length;
  const bars = Math.min(n, Math.max(0, Math.floor(count)));
  return Array.from({ length: bars }, (_unused, k) => {
    const from = Math.floor((k * n) / bars);
    const to = Math.floor(((k + 1) * n) / bars);
    if (rule === 'mean') {
      let sum = 0;
      for (let i = from; i < to; i++) sum += values[i] as number;
      return sum / (to - from);
    }
    const end = values[to - 1] as number;
    const gain = end - (values[Math.max(0, from - 1)] as number);
    return rule === 'increase' && gain < 0 ? end : gain;
  });
}
