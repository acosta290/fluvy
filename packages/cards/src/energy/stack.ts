import { allocate } from '../energy-model/allocate.js';
import type { Totals } from '../energy-model/allocate.js';

/**
 * The house's power by source over a day (the energy card's `sources` variant), stacked from the sun up: what the house
 * used from each origin above the zero line; what went into the battery and out to the grid below it — Home
 * Assistant's own "Power sources" convention. Each bucket is allocated the way Home Assistant allocates an hour.
 */

export type Layer = 'solar' | 'battery' | 'gas' | 'vehicle' | 'grid';
/** Bottom to top: the sun first (the house's own), the grid last. */
export const LAYERS: readonly Layer[] = ['solar', 'battery', 'gas', 'vehicle', 'grid'];

/** What left the house's use, from the line down: into the battery first, then out to the grid. */
export type Below = 'charged' | 'exported';
export const BELOW: readonly Below[] = ['charged', 'exported'];

export interface StackPoint {
  /** Where the bucket sits on the day: 0 at midnight, 1 at the next. */
  readonly at: number;
  /** Average power over the bucket, kW, by origin. */
  readonly used: Readonly<Record<Layer, number>>;
  /** Average power into the battery (from the sun or the grid), kW. */
  readonly charged: number;
  /** Average power out to the grid (from the sun or the battery), kW. */
  readonly exported: number;
}

type Bucket = { readonly start: number; readonly totals: Totals };

/**
 * Buckets into average power by origin, placed on the day by their middle. `kWh`: energy over the bucket (the meters'
 * change), turned into its average power; `kW`: the bucket is already a power (the power sensors' means).
 */
export function stackOf(
  buckets: readonly Bucket[],
  dayStart: number,
  minutes = 5,
  unit: 'kWh' | 'kW' = 'kWh',
): StackPoint[] {
  const factor = unit === 'kW' ? 1 : 60 / minutes;
  return buckets.map((b) => {
    const a = allocate(b.totals);
    return {
      at: (b.start + (minutes * 60_000) / 2 - dayStart) / 86_400_000,
      used: {
        solar: a.usedSolar * factor,
        battery: a.usedBattery * factor,
        gas: a.usedGenerator * factor,
        vehicle: a.usedVehicle * factor,
        grid: a.usedGrid * factor,
      },
      charged: (a.solarToBattery + a.gridToBattery) * factor,
      exported: (a.solarToGrid + a.batteryToGrid) * factor,
    };
  });
}

/**
 * Five-minute energy buckets summed into longer blocks (15 minutes): meters that tick in coarse steps (0.1 kWh) give
 * five-minute changes that alternate between nothing and a double — over a block the steps even out. A block with no
 * bucket is absent: a gap stays a gap.
 */
export function aggregate(buckets: readonly Bucket[], dayStart: number, minutes = 15): Bucket[] {
  const span = minutes * 60_000;
  const blocks = new Map<number, Record<keyof Totals, number>>();
  for (const b of buckets) {
    const index = Math.floor((b.start - dayStart) / span);
    const into = blocks.get(index) ?? {
      solar: 0,
      fromGrid: 0,
      toGrid: 0,
      fromBattery: 0,
      toBattery: 0,
      generator: 0,
      fromVehicle: 0,
      toVehicle: 0,
    };
    for (const key of Object.keys(into) as (keyof Totals)[]) into[key] += b.totals[key] ?? 0;
    blocks.set(index, into);
  }
  return [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, totals]) => ({ start: dayStart + index * span, totals }));
}

/** The steps a meter counts in (kWh), coarsest first. */
const STEPS = [1, 0.5, 0.1, 0.05, 0.01, 0.005, 0.001] as const;

/**
 * The block meters are drawn in: the shortest of 15, 30 and 60 minutes over which their step does not show. A meter
 * that counts in coarse steps (0.1 kWh) ticks a few times a quarter at a low draw, so its quarters alternate three
 * ticks and four: at the day's median draw a block must hold eight steps or more. The step is the coarsest one every
 * change is a whole number of; a meter finer than a watt-hour has none, and its quarter stands.
 */
export function meterBlock(buckets: readonly Bucket[]): 15 | 30 | 60 {
  const changes = buckets.flatMap((b) => Object.values(b.totals).filter((v) => v > 1e-9));
  const step = STEPS.find((q) => changes.every((v) => Math.abs(v / q - Math.round(v / q)) < 1e-4));
  if (!changes.length || step === undefined) return 15;
  // what the house drew from its sources in each five minutes, as power: its median is the day's usual draw
  const drawn = buckets
    .map(
      ({ totals: t }) =>
        (t.solar + t.fromGrid + t.fromBattery + (t.generator ?? 0) + (t.fromVehicle ?? 0)) * 12,
    )
    .sort((a, b) => a - b);
  const median = drawn[Math.floor(drawn.length / 2)] ?? 0;
  return ([15, 30] as const).find((minutes) => (median * minutes) / 60 / step >= 8) ?? 60;
}

/** The day's energy (kWh) from its points (kW over `minutes` each): the legend of a curve drawn from power. */
export function integrate(
  points: readonly StackPoint[],
  minutes: number,
): { used: Record<Layer, number>; charged: number; exported: number } {
  const hours = minutes / 60;
  const used: Record<Layer, number> = { solar: 0, battery: 0, gas: 0, vehicle: 0, grid: 0 };
  let charged = 0;
  let exported = 0;
  for (const p of points) {
    for (const key of LAYERS) used[key] += p.used[key] * hours;
    charged += p.charged * hours;
    exported += p.exported * hours;
  }
  return { used, charged, exported };
}

export interface StackShape {
  readonly layers: ReadonlyArray<{
    readonly key: Layer;
    readonly area: string;
    readonly line: string;
  }>;
  /** Below the line, from it down: into the battery, then out to the grid. */
  readonly below: ReadonlyArray<{
    readonly key: Below;
    readonly area: string;
    readonly line: string;
  }>;
  /** Where zero is, and the top of the tallest stack (for the cursor's dot). */
  readonly zero: number;
  readonly y: (kw: number) => number;
  readonly x: (at: number) => number;
}

const pt = (x: number, y: number): string => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Under the line, the tag's room: 12 to it, its 16 line. */
export const BELOW_ROOM = 28;

/**
 * The points split where the data stops: two points further apart than one and a half buckets are not joined (a
 * recorder that was down is not a quiet house). A lone point is drawn across its own bucket.
 */
function runsOf(points: readonly StackPoint[], step: number): StackPoint[][] {
  const runs: StackPoint[][] = [];
  for (const p of points) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (run && last && p.at - last.at <= step * 1.5) run.push(p);
    else runs.push([p]);
  }
  return runs.map((run) =>
    run.length > 1
      ? run
      : [
          { ...(run[0] as StackPoint), at: (run[0] as StackPoint).at - step / 2 },
          { ...(run[0] as StackPoint), at: (run[0] as StackPoint).at + step / 2 },
        ],
  );
}

/**
 * The areas in a `width` × `height` box: one kW scale for above and below zero (the zero line sits where the day's
 * peak use and peak outflow divide the height), `top` px kept free above the tallest point. `step` is one bucket as a
 * fraction of the day.
 */
export function stackShape(
  points: readonly StackPoint[],
  width: number,
  height: number,
  top = 12,
  step = 5 / 1440,
): StackShape {
  const total = (p: StackPoint): number => LAYERS.reduce((sum, k) => sum + p.used[k], 0);
  const up = Math.max(0.1, ...points.map(total));
  const down = Math.max(0, ...points.map((p) => p.charged + p.exported));
  // one kW scale above and below; when anything went out, at least BELOW_ROOM px under the line for its tag (a day that
  // exported a little would otherwise put the tag over the hours)
  let k = (height - top) / (up + down);
  if (down > 0 && down * k < BELOW_ROOM) k = (height - top - BELOW_ROOM) / up;
  const zero = top + up * k;
  const x = (at: number): number => Math.min(1, Math.max(0, at)) * width;
  const y = (kw: number): number => zero - kw * k;
  const runs = runsOf(points, step);
  /** One band per run, between `low` and `high` (kW, signed), as an area and its edge line. */
  const band = (
    low: (p: StackPoint) => number,
    high: (p: StackPoint) => number,
  ): { area: string; line: string } => {
    const areas: string[] = [];
    const lines: string[] = [];
    for (const run of runs) {
      const upper = run.map((p) => pt(x(p.at), y(high(p))));
      const lower = run.map((p) => pt(x(p.at), y(low(p)))).reverse();
      areas.push(`M${upper.join(' L')} L${lower.join(' L')} Z`);
      lines.push(`M${upper.join(' L')}`);
    }
    return { area: areas.join(' '), line: lines.join(' ') };
  };
  const layers = LAYERS.filter((key) => points.some((p) => p.used[key] > 0)).map((key) => {
    const below = (p: StackPoint): number =>
      LAYERS.slice(0, LAYERS.indexOf(key)).reduce((sum, l) => sum + p.used[l], 0);
    return { key, ...band(below, (p) => below(p) + p.used[key]) };
  });
  const under: { key: Below; area: string; line: string }[] = [];
  if (points.some((p) => p.charged > 0))
    under.push({
      key: 'charged',
      ...band(
        () => 0,
        (p) => -p.charged,
      ),
    });
  if (points.some((p) => p.exported > 0))
    under.push({
      key: 'exported',
      ...band(
        (p) => -p.charged,
        (p) => -(p.charged + p.exported),
      ),
    });
  return { layers, below: under, zero, y, x };
}
