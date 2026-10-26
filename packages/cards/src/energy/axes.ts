import { niceTicks } from '../chart/engine/scale.js';
import { scaleFor, scaleNamed } from '../shared/units.js';

/**
 * A stacked energy chart's power scale (1.9, issue #49): the chart engine's nice ticks, in watts below a kilowatt,
 * with a fourth tick for the charge's quarters. How a scale is drawn — the gridlines, the ticks, the unit — is the
 * engine's (`chart/engine/axis.ts`), one look for every chart.
 */

/** A stacked energy chart's power scale: its ticks (kW, lowest first, zero among them) and how they are written. */
export interface PowerScale {
  readonly ticks: readonly number[];
  /** The unit the labels read in: the one asked, else watts below a kilowatt and kilowatts from there. */
  readonly unit: string;
  /** Watts in that unit: what a tick in kW is brought to for its label. */
  readonly divisor: number;
  /** The labels' decimals, in that unit. */
  readonly decimals: number;
  /** How many ticks lie above zero: the charge's scale divides 0–100 % among them. */
  readonly above: number;
}

/**
 * The power scale of a stacked energy chart from the day's highest stack `up` and its deepest outflow `down` (kW): the
 * history bars' scale (Heckbert's nice steps, four intervals at most, zero a tick), in the unit asked (`unit`, of the
 * watt ladder), else in watts below a kilowatt. Under the charge's own scale (`charge`: 0 % on the zero line, 100 % on
 * the top tick, labelled on the power's gridlines) a positive half of three intervals gets a fourth on top, so the
 * charge reads 0 · 25 · 50 · 75 · 100 % (or 0 · 50 · 100 %, or 0 · 100 %) on whole lines, never 33 %. That fourth is
 * one of the four: where a tick below zero leaves it no room, the scale takes the next step (−5 … 15 with the charge
 * is −10 … 20, not −5 … 20).
 */
export function powerScale(up: number, down: number, charge: boolean, unit?: string): PowerScale {
  const scale =
    (unit === undefined ? undefined : scaleNamed(unit, 'W')) ??
    scaleFor(Math.max(up, down) * 1000, 'W');
  // a kilowatt in the scale's unit
  const k = 1000 / scale.divisor;
  const thirds = (ticks: readonly number[]): boolean =>
    charge && ticks.filter((t) => t > 0).length === 3;
  const four = niceTicks(-down * k, up * k, 4);
  const nice = thirds(four.ticks) && four.min < 0 ? niceTicks(-down * k, up * k, 3) : four;
  const quarters = thirds(nice.ticks);
  const ticks = quarters
    ? [...nice.ticks, Number((nice.max + nice.step).toFixed(nice.decimals))]
    : nice.ticks;
  return {
    ticks: ticks.map((t) => t / k),
    unit: scale.unit,
    divisor: scale.divisor,
    decimals: nice.decimals,
    above: ticks.filter((t) => t > 0).length,
  };
}
