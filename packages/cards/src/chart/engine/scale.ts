/**
 * The scales a chart is drawn on: the series' own ends (`tight`, a lone curve), the ends with a tenth of air
 * (`air`, several curves compared by eye), and nice numbers (Heckbert's 1 · 2 · 2.5 · 5 times a power of ten,
 * zero always a tick) wherever a y axis or gridlines are drawn; and the unit a set of figures is written in.
 */

/** The ends of a scale, lowest first. */
export interface Scale {
  readonly min: number;
  readonly max: number;
}

/** A lone series' own ends. A flat series has none to speak of: it is drawn through the middle (`flat`). */
export interface TightScale extends Scale {
  readonly flat: boolean;
}

/** The series' own min and max, as a lone curve is drawn: the curve fills its plot top to bottom. */
export function tightScale(values: readonly number[]): TightScale {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, flat: true };
  return { min, max, flat: min === max };
}

/**
 * The scale a chart's series share: their ends with a tenth of the range as air, and a flat series centred instead
 * of drawn on the floor. `zero` keeps the floor at zero for what only grows from it (power, rain).
 */
export function airScale(series: ReadonlyArray<ReadonlyArray<number | null>>, zero = false): Scale {
  let min = Infinity;
  let max = -Infinity;
  for (const values of series)
    for (const v of values) {
      if (v === null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  const air = (max - min) / 10;
  return { min: zero && min >= 0 ? 0 : min - air, max: max + air };
}

/** Heckbert's nice fractions, in the order they are tried within a decade. */
const NICE: ReadonlyArray<readonly [fraction: number, extraDecimal: 0 | 1]> = [
  [1, 0],
  [2, 0],
  [2.5, 1],
  [5, 0],
];

export interface NiceStep {
  readonly step: number;
  /** The decimals the step needs when written (0.5 → 1, 2.5 → 1, 25 → 0). */
  readonly decimals: number;
}

/**
 * The smallest of Heckbert's steps from `least` up that `fits`: 1, 2, 2.5 or 5 times a power of ten, with the decimals
 * it is written with.
 */
function firstNice(least: number, fits: (step: number) => boolean): NiceStep {
  let exponent = Math.floor(Math.log10(least));
  for (let round = 0; round < 4; round++, exponent++) {
    const base = 10 ** exponent;
    for (const [fraction, extra] of NICE) {
      const step = fraction * base;
      // 2.5 keeps its half only up to the units (0.25, 2.5); 25 and 250 are whole
      if (fits(step))
        return { step, decimals: Math.max(0, -exponent) + (exponent <= 0 ? extra : 0) };
    }
  }
  return { step: 10 ** exponent, decimals: Math.max(0, -exponent) };
}

/** The smallest nice step that spans `span` in `intervals` steps or fewer: 35.4 → 10, 16.8 → 5, 203 → 100. */
export function niceStep(span: number, intervals = 4): NiceStep {
  if (!(span > 0) || !Number.isFinite(span)) return { step: 1, decimals: 0 };
  return firstNice(span / intervals, (step) => Math.ceil(span / step - 1e-9) <= intervals);
}

export interface Ticks extends Scale {
  readonly step: number;
  /** From the lowest tick to the highest, zero among them. */
  readonly ticks: readonly number[];
  /** The decimals the tick labels are written with. */
  readonly decimals: number;
}

/**
 * A scale from `lo` to `hi` that always holds zero: the smallest nice step whose ticks reach both ends in `intervals`
 * or fewer. A signed scale is widened to whole ticks on both sides of zero, so it can need a larger step than its span
 * asks (−5.05 … 2.55 by 2.5 is −7.5 … 5, five intervals; by 5, −10 … 5). A set with nothing in it (both ends zero) is
 * the one tick, zero: the chart then draws its stubs and no scale.
 */
export function niceTicks(lo: number, hi: number, intervals = 4): Ticks {
  const low = Math.min(0, Number.isFinite(lo) ? lo : 0);
  const high = Math.max(0, Number.isFinite(hi) ? hi : 0);
  if (high - low <= 0) return { min: 0, max: 0, step: 0, ticks: [0], decimals: 0 };
  const lowest = (step: number): number => Math.floor(low / step + 1e-9);
  const highest = (step: number): number => Math.ceil(high / step - 1e-9);
  const { step, decimals } = firstNice(
    (high - low) / intervals,
    (s) => highest(s) - lowest(s) <= intervals,
  );
  const first = lowest(step);
  const count = highest(step) - first;
  const ticks = Array.from({ length: count + 1 }, (_unused, i) =>
    Number(((first + i) * step).toFixed(decimals)),
  );
  return { min: ticks[0] ?? 0, max: ticks[count] ?? 0, step, ticks, decimals };
}

/** The plot's band on the y axis: where the scale's top and its floor are, in px from the drawing's top. */
export interface PlotBox {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where a value sits in a plot, in px from the drawing's top: the scale's top on `box.top`, its floor on
 * `box.bottom`, a reading past the scale on its edge (never outside the plot), and a flat scale through the middle.
 */
export function yOf(value: number, scale: Scale, box: PlotBox): number {
  const span = box.bottom - box.top;
  if (scale.max === scale.min) return box.top + span / 2;
  const clamped = Math.min(scale.max, Math.max(scale.min, value));
  return box.top + (1 - (clamped - scale.min) / (scale.max - scale.min)) * span;
}

/** The unit a set of figures is written in, and what each is divided by to be. */
export interface UnitScale {
  readonly unit: string;
  readonly divisor: number;
}

const SCALABLE = /^(Wh|W|VA)$/;

/**
 * One unit for a set of figures in a base unit (W, Wh, VA): the largest decides — 3 200 W and 400 W read as
 * "3.2 kW" and "0.4 kW", never as "3.2 kW" beside "400 W" — up to gigawatts; any other unit passes through.
 */
export function unitScale(peak: number, base: string): UnitScale {
  const size = Math.abs(peak);
  if (!SCALABLE.test(base) || !Number.isFinite(size)) return { unit: base, divisor: 1 };
  if (size >= 1e9) return { unit: `G${base}`, divisor: 1e9 };
  if (size >= 1e6) return { unit: `M${base}`, divisor: 1e6 };
  if (size >= 1e3) return { unit: `k${base}`, divisor: 1e3 };
  return { unit: base, divisor: 1 };
}
