import { allocate } from '../energy-model/allocate.js';
import type { Totals } from '../energy-model/allocate.js';

/**
 * The house's power by source over a day (the energy card's `sources` variant): every five-minute bucket of the
 * Energy dashboard's meters allocated the way Home Assistant allocates an hour, stacked from the sun up — what the
 * house used from each origin above the zero line, what left for the grid below it.
 */

export type Layer = 'solar' | 'battery' | 'gas' | 'vehicle' | 'grid';
/** Bottom to top: the sun first (the house's own), the grid last. */
export const LAYERS: readonly Layer[] = ['solar', 'battery', 'gas', 'vehicle', 'grid'];

export interface StackPoint {
  /** Where the bucket sits on the day: 0 at midnight, 1 at the next. */
  readonly at: number;
  /** Average power over the bucket, kW, by origin. */
  readonly used: Readonly<Record<Layer, number>>;
  readonly exported: number;
}

/** Buckets of energy (kWh) into average power (kW) by origin, placed on the day by their start. */
export function stackOf(
  buckets: ReadonlyArray<{ readonly start: number; readonly totals: Totals }>,
  dayStart: number,
  minutes = 5,
): StackPoint[] {
  const perHour = 60 / minutes;
  return buckets.map((b) => {
    const a = allocate(b.totals);
    return {
      at: (b.start + (minutes * 60_000) / 2 - dayStart) / 86_400_000,
      used: {
        solar: a.usedSolar * perHour,
        battery: a.usedBattery * perHour,
        gas: a.usedGenerator * perHour,
        vehicle: a.usedVehicle * perHour,
        grid: a.usedGrid * perHour,
      },
      exported: (a.solarToGrid + a.batteryToGrid) * perHour,
    };
  });
}

export interface StackShape {
  readonly layers: ReadonlyArray<{
    readonly key: Layer;
    readonly area: string;
    readonly line: string;
  }>;
  readonly exported: { readonly area: string; readonly line: string } | null;
  /** Where zero is, and the top of the tallest stack (for the cursor's dot). */
  readonly zero: number;
  readonly y: (kw: number) => number;
  readonly x: (at: number) => number;
}

const pt = (x: number, y: number): string => `${x.toFixed(1)},${y.toFixed(1)}`;

/**
 * The areas in a `width` × `height` box: one kW scale for above and below zero (the zero line sits where the day's
 * peak use and peak export divide the height), `top` px kept free above the tallest point.
 */
export function stackShape(
  points: readonly StackPoint[],
  width: number,
  height: number,
  top = 12,
): StackShape {
  const total = (p: StackPoint): number => LAYERS.reduce((sum, k) => sum + p.used[k], 0);
  const up = Math.max(0.1, ...points.map(total));
  const down = Math.max(0, ...points.map((p) => p.exported));
  const k = (height - top) / (up + down);
  const zero = top + up * k;
  const x = (at: number): number => Math.min(1, Math.max(0, at)) * width;
  const y = (kw: number): number => zero - kw * k;
  const layers = LAYERS.filter((key) => points.some((p) => p.used[key] > 0)).map((key) => {
    const below = (p: StackPoint): number =>
      LAYERS.slice(0, LAYERS.indexOf(key)).reduce((sum, l) => sum + p.used[l], 0);
    const upper = points.map((p) => pt(x(p.at), y(below(p) + p.used[key])));
    const lower = points.map((p) => pt(x(p.at), y(below(p)))).reverse();
    return { key, area: `M${upper.join(' L')} L${lower.join(' L')} Z`, line: upper.join(' ') };
  });
  const exported =
    down > 0
      ? (() => {
          const edge = points.map((p) => pt(x(p.at), y(-p.exported)));
          const axis = points.map((p) => pt(x(p.at), zero)).reverse();
          return { area: `M${edge.join(' L')} L${axis.join(' L')} Z`, line: edge.join(' ') };
        })()
      : null;
  return { layers, exported, zero, y, x };
}
