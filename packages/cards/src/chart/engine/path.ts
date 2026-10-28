import type { Curve } from './model.js';

/**
 * The paths a chart's lines are made of, pure: one Catmull-Rom (tension 1/6, as every curve of the house has been
 * drawn since 1.0), straight joins, steps that hold a value across its slot, the area under a line and the band a
 * summary moved in, every coordinate written to two decimals. A gap in the readings breaks the line: a new `M`.
 */

/** A point of the plot in px, or a gap. */
export type Pt = readonly [x: number, y: number];

const px = (n: number): string => n.toFixed(2);

/** The points of a run (between gaps) as one open path. */
function runPath(points: readonly Pt[], curve: Curve): string {
  const [first] = points;
  if (!first) return '';
  let d = `M${px(first[0])},${px(first[1])}`;
  if (curve === 'step') {
    for (const [x, y] of points.slice(1)) d += ` H${px(x)} V${px(y)}`;
    return d;
  }
  if (curve === 'straight') {
    for (const [x, y] of points.slice(1)) d += ` L${px(x)},${px(y)}`;
    return d;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? (points[i] as Pt);
    const p1 = points[i] as Pt;
    const p2 = points[i + 1] as Pt;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const;
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const;
    d += ` C${px(c1[0])},${px(c1[1])} ${px(c2[0])},${px(c2[1])} ${px(p2[0])},${px(p2[1])}`;
  }
  return d;
}

/** The runs of points between gaps, each with the index its first point has in the whole. */
export function runsOf(points: ReadonlyArray<Pt | null>): Array<{ at: number; points: Pt[] }> {
  const runs: Array<{ at: number; points: Pt[] }> = [];
  let run: { at: number; points: Pt[] } | null = null;
  points.forEach((point, index) => {
    if (point === null) run = null;
    else if (run === null) runs.push((run = { at: index, points: [point] }));
    else run.points.push(point);
  });
  return runs;
}

/**
 * The line through the points: a run of two or more readings draws, a gap starts a new one, a lone reading between
 * gaps draws nothing (a dot is its card's to place). Fewer than two readings in all is no line at all.
 */
export function linePath(points: ReadonlyArray<Pt | null>, curve: Curve): string {
  return runsOf(points)
    .filter((run) => run.points.length > 1)
    .map((run) => runPath(run.points, curve))
    .join(' ');
}

/** A coordinate as short as it is exact to two decimals: the area's way back to its start ("0", not "0.00"). */
const short = (n: number): string => String(Number(n.toFixed(2)));

/**
 * The area under the points, closed on `floor`: one closed shape per run, so a gap leaves the floor bare where the
 * line is, nothing where there is no line. The closing is written as the house has always written it — the run's end
 * to two decimals, its start as short as it goes — and the floor as `written` (two decimals; a lone classic curve
 * writes its height bare, as 1.0 did), so a classic chart's paths are byte for byte what they were.
 */
export function areaPath(
  points: ReadonlyArray<Pt | null>,
  curve: Curve,
  floor: number,
  written = px(floor),
): string {
  return runsOf(points)
    .filter((run) => run.points.length > 1)
    .map((run) => {
      const first = run.points[0] as Pt;
      const last = run.points[run.points.length - 1] as Pt;
      return `${runPath(run.points, curve)} L${px(last[0])},${written} L${short(first[0])},${written} Z`;
    })
    .join(' ');
}

/**
 * The band a summarised series moved in: its highs across and its lows back, closed — drawn behind the mean, so an
 * hour that swung between 18 and 24 says so instead of pretending it was 21 all along.
 */
export function bandPath(low: readonly Pt[], high: readonly Pt[]): string {
  const count = Math.min(low.length, high.length);
  if (count < 2) return '';
  let d = `M${px((high[0] as Pt)[0])},${px((high[0] as Pt)[1])}`;
  for (let i = 1; i < count; i++) d += ` L${px((high[i] as Pt)[0])},${px((high[i] as Pt)[1])}`;
  for (let i = count - 1; i >= 0; i--) d += ` L${px((low[i] as Pt)[0])},${px((low[i] as Pt)[1])}`;
  return `${d} Z`;
}

const bez = (a: number, b: number, c: number, e: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
};

/**
 * Where the drawn line actually is at an x: the same segments `linePath` writes, solved for that x. A cursor's dot
 * reads this, never the raw series — the line is drawn from samples, and a dot placed on a value the line does not
 * pass through hangs off it. Null in a gap, past the ends, or where there is no line.
 */
export function yAt(points: ReadonlyArray<Pt | null>, curve: Curve, x: number): number | null {
  const run = runsOf(points).find(
    (r) =>
      r.points.length > 1 &&
      x >= (r.points[0] as Pt)[0] &&
      x <= (r.points[r.points.length - 1] as Pt)[0],
  );
  if (!run) return null;
  const pts = run.points;
  const last = pts.length - 1;
  let i = 0;
  while (i < last - 1 && x >= (pts[i + 1] as Pt)[0]) i++;
  const p1 = pts[i] as Pt;
  const p2 = pts[i + 1] as Pt;
  if (curve === 'step') return x >= p2[0] ? p2[1] : p1[1];
  const width = p2[0] - p1[0] || 1;
  if (curve === 'straight') return p1[1] + ((p2[1] - p1[1]) * (x - p1[0])) / width;
  // the segment's control points, as linePath builds them
  const p0 = pts[i - 1] ?? p1;
  const p3 = pts[i + 2] ?? p2;
  const cx1 = p1[0] + (p2[0] - p0[0]) / 6;
  const cx2 = p2[0] - (p3[0] - p1[0]) / 6;
  const cy1 = p1[1] + (p2[1] - p0[1]) / 6;
  const cy2 = p2[1] - (p3[1] - p1[1]) / 6;
  // x moves with t nearly linearly on evenly spaced samples: four Newton passes land on it
  let t = (x - p1[0]) / width;
  for (let pass = 0; pass < 4; pass++) {
    const fx = bez(p1[0], cx1, cx2, p2[0], t) - x;
    const u = 1 - t;
    const dx = 3 * u * u * (cx1 - p1[0]) + 6 * u * t * (cx2 - cx1) + 3 * t * t * (p2[0] - cx2) || 1;
    t = Math.min(1, Math.max(0, t - fx / dx));
  }
  return bez(p1[1], cy1, cy2, p2[1], t);
}

/**
 * What has happened and what is forecast: the points up to `index` and from it on, the split point in both so the
 * forecast's line starts where the past's ends. A step holds its reading across its slot, so its past runs on to where
 * the next slot begins (the points of a step carry that slot's end: `index + 1`), and its forecast starts there.
 * Nothing is forecast when the index is the last reading.
 */
export function splitAt(
  points: ReadonlyArray<Pt | null>,
  index: number,
  curve: Curve,
): { readonly past: Array<Pt | null>; readonly future: Array<Pt | null> } {
  // a step's points end on the last slot's end, one past its last reading
  const last = points.length - (curve === 'step' ? 2 : 1);
  const at = Math.min(last, Math.max(0, index));
  if (at >= last) return { past: [...points], future: [] };
  if (curve !== 'step') return { past: points.slice(0, at + 1), future: points.slice(at) };
  const held = points[at];
  const next = points[at + 1];
  if (!held || !next) return { past: points.slice(0, at + 1), future: points.slice(at + 1) };
  const edge: Pt = [next[0], held[1]];
  return { past: [...points.slice(0, at + 1), edge], future: [edge, ...points.slice(at + 1)] };
}
