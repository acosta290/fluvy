import type { Pt } from './path.js';

/**
 * Arcs and rings, pure: a point on a circle, an arc as a path, the dash that lights a ring's share, the ticks
 * around a dial and where a knob sits on its sweep. Angles in degrees, clockwise from three o'clock as SVG turns.
 */

/** The point at `deg` on a circle of radius `r` about (`cx`, `cy`). */
export const polar = (cx: number, cy: number, r: number, deg: number): Pt => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const px = (n: number): string => n.toFixed(2);

/** An arc from `from` to `to` (degrees, clockwise) on the circle, as an open path. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  const sweep = to - from;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  return `M${px(x0)},${px(y0)} A${r},${r} 0 ${large} ${sweep >= 0 ? 1 : 0} ${px(x1)},${px(y1)}`;
}

/**
 * The dash that lights `share` of a circle of radius `r`: the lit length and the circumference, as a stroke's
 * `dasharray` (a share outside 0 … 1 lights to the nearest end; none lights nothing).
 */
export function arcDash(share: number | null, r: number): string {
  const circumference = 2 * Math.PI * r;
  const lit = share === null || !Number.isFinite(share) ? 0 : Math.min(1, Math.max(0, share));
  return `${(lit * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
}

export interface Tick {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly lit: boolean;
}

export interface RadialTicksOptions {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** How many ticks, the first on `from` and the last at the end of the `sweep`. */
  readonly count: number;
  readonly from: number;
  readonly sweep: number;
  /** A tick's length, by its index (a major every tenth, say); drawn inward from the radius. */
  readonly length: (index: number) => number;
  /** Whether a tick is lit, by its index and its place on the sweep (0 at `from`, 1 at its end). */
  readonly lit: (index: number, place: number) => boolean;
}

/** The ticks around a dial, each from the ring inward by its length, lit as the rule says. */
export function radialTicks(o: RadialTicksOptions): Tick[] {
  const out: Tick[] = [];
  const last = Math.max(1, o.count - 1);
  for (let i = 0; i < o.count; i++) {
    const place = i / last;
    const deg = o.from + o.sweep * place;
    const [x1, y1] = polar(o.cx, o.cy, o.r, deg);
    const [x2, y2] = polar(o.cx, o.cy, o.r - o.length(i), deg);
    out.push({ x1, y1, x2, y2, lit: o.lit(i, place) });
  }
  return out;
}

/** Where a knob sits on a sweep: the point at `fraction` (0 … 1) of it. */
export const knobAt = (
  cx: number,
  cy: number,
  r: number,
  from: number,
  sweep: number,
  fraction: number,
): Pt => polar(cx, cy, r, from + sweep * Math.min(1, Math.max(0, fraction)));
