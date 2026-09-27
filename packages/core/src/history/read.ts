import type { Line, Point, Span, Track } from './types.js';

/**
 * A reading holds until the next one: the value in force at `t`, or null before the first reading. This is how a
 * recorder's history works — a sensor that said 20.4 at 09:00 is at 20.4 until it says otherwise.
 */
export function valueAt(points: readonly Point[], t: number): number | null {
  if (points.length === 0 || t < (points[0] as Point).t) return null;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((points[middle] as Point).t <= t) low = middle;
    else high = middle - 1;
  }
  return (points[low] as Point).v;
}

/** The state in force at `t`, or '' before the line's first stretch. */
export function stateAt(spans: readonly Span[], t: number): string {
  for (let index = spans.length - 1; index >= 0; index--) {
    const span = spans[index] as Span;
    if (t >= span.from) return t <= span.to ? span.state : '';
  }
  return '';
}

/** The stretch `t` falls in, with its ends — what a scrubbed state line reads out ("Running · 09:12 → 11:40"). */
export function spanAt(spans: readonly Span[], t: number): Span | null {
  for (const span of spans) if (t >= span.from && t <= span.to) return span;
  return null;
}

/**
 * A track's readings as `count` evenly spaced values across the window, each the value in force at that step (what the
 * curve draws). Steps before the first reading take it, so a curve starts where its data does instead of at zero.
 */
export function sampleTrack(
  track: Pick<Track, 'points'>,
  start: number,
  end: number,
  count: number,
): number[] {
  const points = track.points;
  if (points.length === 0 || count <= 0) return [];
  const step = (end - start) / Math.max(1, count - 1);
  const values: number[] = [];
  let index = 0;
  let last = (points[0] as Point).v;
  // every reading of a stretch decides its two samples: the highest and the lowest it reached, in the order they
  // happened. A curve drawn this way always touches the window's own minimum and maximum — a minute's spike is a
  // spike on the chart, not a number in a readout that the drawing never reaches.
  for (let i = 0; i < count; i += 2) {
    const until = start + Math.min(count - 1, i + 2) * step;
    let low: number | null = null;
    let high: number | null = null;
    let lowAt = 0;
    let highAt = 0;
    while (index < points.length && (points[index] as Point).t <= until) {
      const point = points[index] as Point;
      last = point.v;
      if (low === null || point.v < low) {
        low = point.v;
        lowAt = point.t;
      }
      if (high === null || point.v > high) {
        high = point.v;
        highAt = point.t;
      }
      index++;
    }
    const pair =
      low === null || high === null ? [last, last] : lowAt <= highAt ? [low, high] : [high, low];
    values.push(pair[0] as number);
    if (values.length < count) values.push(pair[1] as number);
  }
  return values.slice(0, count);
}

/** How far into the window an instant sits, 0 … 1 (what a cursor's x is). */
export const fractionOf = (t: number, start: number, end: number): number =>
  end > start ? Math.min(1, Math.max(0, (t - start) / (end - start))) : 0;

/** The instant at a fraction of the window (what a cursor's x means). */
export const timeAt = (fraction: number, start: number, end: number): number =>
  start + Math.min(1, Math.max(0, fraction)) * (end - start);

/** The busiest lines first (a door that opened nine times before one that never moved), then by name. */
export const byActivity = (a: Line, b: Line): number =>
  b.changes - a.changes || a.name.localeCompare(b.name);

/** The tracks that move the most first: a flat setpoint reads under a temperature that swung five degrees. */
export const byRange = (a: Track, b: Track): number =>
  b.max - b.min - (a.max - a.min) || a.name.localeCompare(b.name);
