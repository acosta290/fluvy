/**
 * What the History page reads: a window of time holding one numeric track per entity (grouped by what they measure)
 * and one line of states per entity that is not a number. Times are milliseconds.
 */

/** A reading at an instant. */
export interface Point {
  readonly t: number;
  readonly v: number;
}

/** What a statistic knows about a period: the band the value moved in (drawn behind its mean). */
export interface Band {
  readonly t: number;
  readonly low: number;
  readonly high: number;
}

/** One entity's numbers through the window. */
export interface Track {
  readonly entityId: string;
  readonly name: string;
  readonly unit: string;
  readonly deviceClass: string;
  readonly points: readonly Point[];
  /** Where a statistic's mean came from: its lowest and highest in each period. */
  readonly band?: readonly Band[];
  readonly min: number;
  readonly max: number;
  /** Time-weighted: an hour at 20° and a minute at 30° average 20.2°, not 25°. */
  readonly average: number;
  /** The last reading in the window (null when the entity had none). */
  readonly last: number | null;
  /** The numbers are a statistic's means, not readings. */
  readonly summarised: boolean;
}

/** A stretch in one state, from `from` to `to` (the window's end while it is still in it). */
export interface Span {
  readonly from: number;
  readonly to: number;
  readonly state: string;
}

/** One entity's states through the window. */
export interface Line {
  readonly entityId: string;
  readonly name: string;
  readonly domain: string;
  readonly spans: readonly Span[];
  /** How many times it changed: what puts the busiest lines first. */
  readonly changes: number;
}

/** Everything measured in the same unit (and device class): one chart. */
export interface Group {
  readonly unit: string;
  readonly deviceClass: string;
  readonly tracks: readonly Track[];
  readonly min: number;
  readonly max: number;
}

/** The window the page draws. */
export interface HistoryWindow {
  readonly start: number;
  readonly end: number;
  readonly groups: readonly Group[];
  readonly lines: readonly Line[];
  /** Entities asked for that the window holds nothing of (deleted, never recorded, quiet). */
  readonly empty: readonly string[];
}

/** A raw state as `history/stream` sends it: state, last updated (seconds), last changed. */
export interface RawState {
  readonly s: string;
  readonly lu: number;
  readonly lc?: number;
  readonly a?: Record<string, unknown>;
}

export type RawHistory = Record<string, readonly RawState[]>;

/** How a window is read: its own states, or the recorder's long-term statistics. */
export type HistoryPeriod = 'raw' | 'hour' | 'day';

const DAY = 86_400_000;

/**
 * How to read a window: its own states up to two days, hourly statistics up to a month, daily beyond that — the
 * recorder keeps statistics long after it has purged the states themselves.
 */
export function periodFor(start: number, end: number): HistoryPeriod {
  const span = end - start;
  if (span <= 2 * DAY) return 'raw';
  // an hour a point reads a week well; a month of them is a comb, so a wider window is read day by day
  return span <= 8 * DAY ? 'hour' : 'day';
}
