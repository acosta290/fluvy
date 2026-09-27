/**
 * Geometry of a flow link: the cubic the sheet draws, and the same curve as points a dot can be
 * carried along by a `transform` animation — which the compositor runs without the main thread.
 */

export type Point = readonly [x: number, y: number];

export interface Cubic {
  readonly from: Point;
  readonly c1: Point;
  readonly c2: Point;
  readonly to: Point;
}

const at = (curve: Cubic, t: number): Point => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * curve.from[0] + b * curve.c1[0] + c * curve.c2[0] + d * curve.to[0],
    a * curve.from[1] + b * curve.c1[1] + c * curve.c2[1] + d * curve.to[1],
  ];
};

/** The same curve travelled the other way (a link that exports, a battery that charges). */
export const reversed = (curve: Cubic): Cubic => ({
  from: curve.to,
  c1: curve.c2,
  c2: curve.c1,
  to: curve.from,
});

const f = (n: number): string => n.toFixed(1);

/** SVG path data, to one decimal as the sheet writes it. */
export const pathData = (c: Cubic): string =>
  `M${f(c.from[0])},${f(c.from[1])} C${f(c.c1[0])},${f(c.c1[1])} ${f(c.c2[0])},${f(c.c2[1])} ${f(c.to[0])},${f(c.to[1])}`;

const FINE = 96;

/** `count + 1` points of the cubic at equal parameter steps (fine enough to be resampled by arc length). */
export function cubicPoints(curve: Cubic, count = FINE): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= count; i++) out.push(at(curve, i / count));
  return out;
}

/** Points of a circular arc from `from` to `to` degrees (clockwise on screen when `to > from`), ends included. */
export function arcPoints(
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  count = 12,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const a = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * `count + 1` points along a polyline, equally spaced by arc length: a dot stepped through them moves
 * at one speed however the line bends. Also returns the length, which decides how many dots fit.
 */
export function alongPoints(
  fine: readonly Point[],
  count: number,
): { points: Point[]; length: number } {
  const first = fine[0] ?? [0, 0];
  const lengths: number[] = [];
  let total = 0;
  let previous: Point = first;
  for (const point of fine) {
    total += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    lengths.push(total);
    previous = point;
  }
  const points: Point[] = [];
  let j = 0;
  const last = fine.length - 1;
  for (let k = 0; k <= count; k++) {
    const target = (total * k) / count;
    while (j < last - 1 && (lengths[j + 1] ?? total) < target) j++;
    const a = fine[j] ?? first;
    const b = fine[j + 1] ?? a;
    const start = lengths[j] ?? 0;
    const span = (lengths[j + 1] ?? total) - start;
    const t = span > 0 ? (target - start) / span : 0;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { points, length: total };
}

/** The cubic as equally spaced points, by arc length. */
export const along = (curve: Cubic, count: number): { points: Point[]; length: number } =>
  alongPoints(cubicPoints(curve), count);

/**
 * One `@keyframes` rule that carries a box of `size` px (centred on the path) from the tail to the
 * arrowhead. It fades in off the tail and out before the arrowhead, so neither end shows it popping.
 */
export function travelKeyframes(name: string, points: readonly Point[], size: number): string {
  const last = Math.max(1, points.length - 1);
  const stops = points.map(([x, y], i) => {
    const percent = (i / last) * 100;
    const opacity = percent < 12 ? percent / 12 : percent > 80 ? (100 - percent) / 20 : 1;
    return `${percent.toFixed(2)}%{transform:translate(${(x - size / 2).toFixed(2)}px,${(y - size / 2).toFixed(2)}px);opacity:${opacity.toFixed(2)}}`;
  });
  return `@keyframes ${name}{${stops.join('')}}`;
}

/** The polyline without its last `px` of length: a trail that stops short of what sits at the end. */
export function trimEnd(points: readonly Point[], px: number): Point[] {
  if (points.length < 2) return [...points];
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      (lengths[i - 1] as number) +
        Math.hypot(
          (points[i] as Point)[0] - (points[i - 1] as Point)[0],
          (points[i] as Point)[1] - (points[i - 1] as Point)[1],
        ),
    );
  const total = lengths[lengths.length - 1] as number;
  const cut = Math.max(0, total - px);
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if ((lengths[i] as number) <= cut) {
      out.push(points[i] as Point);
      continue;
    }
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const span = (lengths[i] as number) - (lengths[i - 1] as number);
    const t = span > 0 ? (cut - (lengths[i - 1] as number)) / span : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    break;
  }
  return out.length >= 2 ? out : [...points];
}
