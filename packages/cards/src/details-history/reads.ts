import { isActiveState, type HassEntity } from '@fluvy/core';
import { momentOf, numberOf } from '../chart/data/attribute.js';
import type { StatRow } from '../chart/data/statistics.js';

/*
 * What the details dialog's history reads of an entity, pure, so the block and its tests share it: the kind of history
 * it has, the windows its chips offer, a meter's gains and its day so far from the recorder's buckets, where its total
 * was reset (the line breaks there), and the stretches a thing spent in each state. The block (`view.ts`) asks the
 * recorder and draws.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * How an entity's history reads: a measure's line (a temperature, a power), a meter's (`total`, `total_increasing`:
 * what it gained, or its running total), or the stretches it spent in each state (a door, a lamp, a select). Numeric as
 * Home Assistant's own block tells it: a number's domain, or a unit or a state class.
 */
export type Kind = 'measure' | 'counter' | 'states';

const NUMBERS = new Set(['counter', 'input_number', 'number']);

export function kindOf(entityId: string, stateObj: HassEntity | undefined): Kind {
  const attributes = stateObj?.attributes ?? {};
  const numeric =
    NUMBERS.has(entityId.slice(0, entityId.indexOf('.'))) ||
    'unit_of_measurement' in attributes ||
    'state_class' in attributes;
  if (!numeric) return 'states';
  const stateClass = attributes['state_class'];
  return stateClass === 'total' || stateClass === 'total_increasing' ? 'counter' : 'measure';
}

/**
 * The windows the chips offer (hours): the house's (12 from the factory), a day and a week, each once, shortest first.
 */
export const windowsOf = (house: number): number[] =>
  [...new Set([house, 24, 168])].sort((a, b) => a - b);

/**
 * The recorder's buckets a line of a window reads: five minutes through two days (Home Assistant's dialog reads them
 * for its day), the hour beyond — a week of five minutes would be two thousand points for a plot that draws ninety.
 */
export const linePeriod = (hours: number): '5minute' | 'hour' => (hours > 48 ? 'hour' : '5minute');

/** A bucket's length (ms). */
export const PERIOD = { '5minute': 5 * MINUTE, hour: HOUR } as const;

/** What a meter's bars stand for: an hour each through a day, a day each beyond (never more than 24 in a window). */
export const slotOf = (hours: number): number => (hours > 24 ? DAY : HOUR);

/**
 * A reading of the recorder's, held from `t` (a bucket's start, a state's moment); its bucket's ends where it has them.
 */
export interface Read {
  readonly t: number;
  readonly v: number;
  readonly low?: number;
  readonly high?: number;
}

/** A meter's bucket: its start, what it gained across it (its `change`), and its state at its end. */
export interface Gained {
  readonly t: number;
  readonly change: number | null;
  readonly state: number | null;
}

/** A measure's buckets as readings: each mean at its bucket's start, with the ends it moved between. */
export const meansOf = (rows: readonly StatRow[]): Read[] =>
  rows.flatMap((row): Read[] => {
    const t = momentOf(row.start);
    const v = numberOf(row.mean);
    if (t === null || v === null) return [];
    const low = numberOf(row.min);
    const high = numberOf(row.max);
    return [{ t, v, ...(low !== null && high !== null ? { low, high } : {}) }];
  });

/** A meter's buckets, read: their start, their change and their state, oldest first. */
export const gainedOf = (rows: readonly StatRow[]): Gained[] =>
  rows.flatMap((row): Gained[] => {
    const t = momentOf(row.start);
    return t === null ? [] : [{ t, change: numberOf(row.change), state: numberOf(row.state) }];
  });

/**
 * What a meter gained since its last bucket compiled: the reading now less its state then — a fall is a reset where it
 * only grows (`increase`), and what it shows since is the gain. Nothing where either is unknown.
 */
export const gainSince = (state: number | null, live: number | null, increase: boolean): number =>
  state === null || live === null ? 0 : increase && live < state ? live : live - state;

/** The last state the buckets know: what the reading now is measured from. */
export const lastState = (buckets: readonly Gained[]): number | null => {
  for (let i = buckets.length - 1; i >= 0; i--) {
    const state = buckets[i]?.state ?? null;
    if (state !== null) return state;
  }
  return null;
};

/**
 * What a meter gained in each slot between `edges` (a slot is `edges[k]` to `edges[k + 1]`): the changes of the buckets
 * that start in it, the running slot's (the last, where `running`) brought up to the reading now by `since`. A slot no
 * bucket starts in is a gap, never a zero: the meter had nothing to say there.
 */
export function gainsIn(
  buckets: readonly Gained[],
  edges: readonly number[],
  running: boolean,
  since: number,
): (number | null)[] {
  const count = edges.length - 1;
  const gains = new Array<number | null>(count).fill(null);
  for (const bucket of buckets) {
    if (bucket.change === null) continue;
    const k = edges.findIndex(
      (edge, i) => i < count && bucket.t >= edge && bucket.t < edges[i + 1]!,
    );
    if (k >= 0) gains[k] = (gains[k] ?? 0) + bucket.change;
  }
  if (running && count > 0) gains[count - 1] = (gains[count - 1] ?? 0) + since;
  return gains;
}

/**
 * A meter's readings as buckets of their own (read from its states, where the recorder keeps no statistics): each what
 * the meter gained since the reading before (`gainSince`: a fall is a reset where it only grows), its state the
 * reading.
 */
export const bucketsOf = (readings: readonly Read[], increase: boolean): Gained[] =>
  readings.map((reading, i) => {
    const before = readings[i - 1]?.v;
    return {
      t: reading.t,
      state: reading.v,
      change: before === undefined ? null : gainSince(before, reading.v, increase),
    };
  });

/**
 * What a meter gained since `from` (the house's midnight): its buckets' changes from then on, and `since` after them.
 */
export function gainedSince(
  buckets: readonly Gained[],
  from: number,
  since: number,
): number | null {
  const after = buckets.filter((bucket) => bucket.t >= from && bucket.change !== null);
  if (!after.length && since === 0) return null;
  return after.reduce((sum, bucket) => sum + (bucket.change as number), since);
}

/** A meter's running total as readings: each state at its bucket's start. */
export const totalsOf = (buckets: readonly Gained[]): Read[] =>
  buckets.flatMap((bucket) => (bucket.state === null ? [] : [{ t: bucket.t, v: bucket.state }]));

/**
 * Where a meter's total was reset, between two of its readings: its state fell while what it gained did not (a
 * bucket's `change` follows the meter's sum, which a reset never takes back) — or, read from its states alone (no
 * change known), wherever a meter that only grows fell. A `total` that may fall (a net meter) falls without a reset.
 */
export function resetsOf(
  readings: readonly (Read & { readonly change?: number | null })[],
  increase: boolean,
): number[] {
  const resets: number[] = [];
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1] as Read;
    const b = readings[i] as Read & { readonly change?: number | null };
    const fell = b.v < a.v;
    const kept =
      b.change === undefined || b.change === null ? increase : b.change > b.v - a.v + 1e-9;
    if (fell && kept) resets.push(b.t);
  }
  return resets;
}

/** A line laid on a window: its values (`null` a gap) and where each stands (a fraction of the window). */
export interface Laid {
  readonly values: readonly (number | null)[];
  readonly at: readonly number[];
}

/**
 * A line broken at each reset (`resets`: fractions of its window): a gap stands at the reset itself, so the line before
 * it never runs into the line after it, and a point drawn as the mean around its time (`mean`) that holds the reset
 * too — the one nearest it, half a step either side — is a gap as well: it would be half one day's total and half the
 * next's.
 */
export function breakAt(line: Laid, resets: readonly number[], mean: boolean): Laid {
  const values = [...line.values];
  const at = [...line.at];
  for (const reset of resets) {
    const next = at.findIndex((fraction) => fraction > reset);
    if (next <= 0) continue;
    const before = at[next - 1] as number;
    const after = at[next] as number;
    if (mean) values[reset - before < after - reset ? next - 1 : next] = null;
    at.splice(next, 0, reset);
    values.splice(next, 0, null);
  }
  return { values, at };
}

/** What a window's readings reached: the lowest, the highest (a bucket's own ends where it has them) and the mean. */
export interface Reach {
  readonly min: number;
  readonly max: number;
  /** Time-weighted: an hour at 20° and a minute at 30° average 20.2°, not 25°. */
  readonly average: number;
  /** The first reading and the last: the window's change. */
  readonly first: number;
  readonly last: number;
}

export function reachOf(readings: readonly Read[], start: number, end: number): Reach | null {
  const held = readings.filter(
    (reading, i) => (readings[i + 1]?.t ?? end) > start && reading.t <= end,
  );
  if (!held.length) return null;
  let weighted = 0;
  let time = 0;
  held.forEach((reading, i) => {
    const span = Math.min(held[i + 1]?.t ?? end, end) - Math.max(reading.t, start);
    weighted += reading.v * Math.max(0, span);
    time += Math.max(0, span);
  });
  const last = held[held.length - 1] as Read;
  return {
    min: Math.min(...held.map((reading) => reading.low ?? reading.v)),
    max: Math.max(...held.map((reading) => reading.high ?? reading.v)),
    average: time > 0 ? weighted / time : last.v,
    first: (held[0] as Read).v,
    last: last.v,
  };
}

/** A stretch spent in one state, from `from` to `to` (now, while it lasts). */
export interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly state: string;
}

/** A recorded state, as `history/history_during_period` sends it at its smallest: the state, and when (seconds). */
export interface Recorded {
  readonly s: string;
  readonly lu: number;
}

/**
 * The stretches a thing spent in each state over a window: a run of one state is one stretch, the first clipped to
 * the window's start, the last running to its end — brought up to the state now (`live`, since it last changed), which
 * the recorder may not have sent yet.
 */
export function stretchesOf(
  rows: readonly Recorded[],
  start: number,
  end: number,
  live?: { readonly state: string; readonly since: number },
): Stretch[] {
  const changes = rows.map((row) => ({ state: row.s, at: row.lu * 1000 }));
  const latest = changes[changes.length - 1];
  if (live && (!latest || (live.since > latest.at && live.state !== latest.state)))
    changes.push({ state: live.state, at: live.since });
  const stretches: Stretch[] = [];
  for (const { state, at } of changes) {
    const from = Math.max(start, at);
    if (from >= end) break;
    const previous = stretches[stretches.length - 1];
    if (previous?.state === state) continue;
    if (previous) stretches[stretches.length - 1] = { ...previous, to: from };
    stretches.push({ from, to: end, state });
  }
  return stretches;
}

/** The stretch an instant falls in. */
export const stretchAt = (stretches: readonly Stretch[], t: number): Stretch | undefined =>
  stretches.find((stretch) => t >= stretch.from && t <= stretch.to);

const UNKNOWN = new Set(['unavailable', 'unknown', '']);

/**
 * How long a thing was on (open, playing, home …) in its stretches, with the word for it: where the window holds one
 * active state alone, never for a select's options, each of which would count as on. Nothing where none is.
 */
export function timeOn(
  domain: string,
  stretches: readonly Stretch[],
): { readonly state: string; readonly ms: number } | null {
  const active = stretches.filter(
    (stretch) => !UNKNOWN.has(stretch.state) && isActiveState(domain, stretch.state),
  );
  const states = new Set(active.map((stretch) => stretch.state));
  if (states.size !== 1) return null;
  return {
    state: active[0]?.state as string,
    ms: active.reduce((sum, stretch) => sum + stretch.to - stretch.from, 0),
  };
}
