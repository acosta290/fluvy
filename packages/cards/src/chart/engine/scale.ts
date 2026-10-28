/**
 * The scales a chart is drawn on: the series' own ends (`tight`, a lone curve), the ends with a tenth of air
 * (`air`, several curves compared by eye), and nice numbers (Heckbert's 1 · 2 · 2.5 · 5 times a power of ten, zero a
 * tick where the quantity starts there) wherever a y axis or gridlines are drawn. The unit a set of figures is
 * written in is `shared/units.ts`'s, one rule for every figure.
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
 * it is written with. `plain` passes over a 2.5 that writes a decimal the 5 after it does not, where that 5 fits too
 * (15 · 20 · 25, never 15.0 · 17.5 · 20.0).
 */
function firstNice(least: number, fits: (step: number) => boolean, plain = false): NiceStep {
  let exponent = Math.floor(Math.log10(least));
  for (let round = 0; round < 4; round++, exponent++) {
    const base = 10 ** exponent;
    for (const [fraction, extra] of NICE) {
      const step = fraction * base;
      if (plain && extra && exponent <= 0 && fits(5 * base)) continue;
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
 * A scale from `lo` to `hi` on nice numbers: the smallest nice step whose ticks reach both ends in `intervals` or fewer.
 * It holds zero where `zero` says the quantity starts there (bars standing on it, power, energy, a price, a count — the
 * default, as the history bars' scale has always been), and wherever the readings reach or cross it; a measurement
 * that never does (17 … 23 °C) keeps to its own range (16 · 18 · 20 · 22 · 24) and to whole steps where one fits (a 5
 * rather than a 2.5). Ticks that are all whole are written whole. A scale across zero is widened to whole
 * ticks on both sides of it, so it can need a larger step than its span asks (−5.05 … 2.55 by 2.5 is −7.5 … 5, five
 * intervals; by 5, −10 … 5). A set with nothing in it (both ends zero) is the one tick, zero: the chart then draws its
 * stubs and no scale; a flat measurement is given one either side.
 */
export function niceTicks(lo: number, hi: number, intervals = 4, zero = true): Ticks {
  const from = Number.isFinite(lo) ? lo : 0;
  const to = Number.isFinite(hi) ? hi : 0;
  let low = zero ? Math.min(0, from) : from;
  let high = zero ? Math.max(0, to) : to;
  if (high - low <= 0) {
    if (zero || high === 0) return { min: 0, max: 0, step: 0, ticks: [0], decimals: 0 };
    low -= 1;
    high += 1;
  }
  const lowest = (step: number): number => Math.floor(low / step + 1e-9);
  const highest = (step: number): number => Math.ceil(high / step - 1e-9);
  const { step, decimals } = firstNice(
    (high - low) / intervals,
    (s) => highest(s) - lowest(s) <= intervals,
    !zero,
  );
  const first = lowest(step);
  const count = highest(step) - first;
  const ticks = Array.from({ length: count + 1 }, (_unused, i) =>
    Number(((first + i) * step).toFixed(decimals)),
  );
  return {
    min: ticks[0] ?? 0,
    max: ticks[count] ?? 0,
    step,
    ticks,
    decimals: ticks.every(Number.isInteger) ? 0 : decimals,
  };
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
