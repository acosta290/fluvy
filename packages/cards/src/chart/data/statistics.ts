import type { HomeAssistant } from '@fluvy/core';

/*
 * What the recorder is asked for a chart, kept a while: one cache for every chart card of the page, so two cards of
 * one sensor and one window ask once, and a card drawn again within five minutes asks nothing. A read that fails is
 * forgotten at once — a dropped connection must not blank a chart for five minutes.
 */

const FRESH = 5 * 60_000;
const cache = new Map<string, { readonly at: number; readonly promise: Promise<unknown> }>();

/** The answer to `key` read within five minutes, else `read` asked again and kept. */
export function remember<T>(key: string, read: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < FRESH) return hit.promise as Promise<T>;
  // stale keys pile up on a wall panel left on for days (one an hour a sensor): they go as new ones come
  if (cache.size >= 200) for (const [k, v] of cache) if (now - v.at >= FRESH) cache.delete(k);
  const entry = { at: now, promise: read() };
  cache.set(key, entry);
  entry.promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return entry.promise;
}

/** The buckets the recorder keeps a statistic in, and what each holds. */
export type StatPeriod = '5minute' | 'hour' | 'day' | 'week' | 'month';
export type StatType = 'mean' | 'min' | 'max' | 'sum' | 'change' | 'state';

/** One bucket of a statistic, as `recorder/statistics_during_period` sends it (its start in ms, or ISO before 2023.3). */
export interface StatRow {
  readonly start: number | string;
  readonly end?: number | string;
  readonly mean?: number | null;
  readonly min?: number | null;
  readonly max?: number | null;
  readonly sum?: number | null;
  readonly change?: number | null;
  readonly state?: number | null;
}

const HOUR = 3_600_000;

/**
 * A statistic's buckets over a window, by id: the window's ends taken to the hour (so the cards of one page share a
 * read through the hour), the types and units asked; nothing for an id the recorder does not keep.
 */
export function statisticsDuring(
  hass: HomeAssistant,
  request: {
    readonly ids: readonly string[];
    readonly start: number;
    readonly end: number;
    readonly period: StatPeriod;
    readonly types: readonly StatType[];
  },
): Promise<Readonly<Record<string, readonly StatRow[]>>> {
  const start = Math.floor(request.start / HOUR) * HOUR;
  const end = Math.ceil(request.end / HOUR) * HOUR;
  const ids = [...request.ids].sort();
  const types = [...request.types].sort();
  const key = `stat|${ids.join(',')}|${start}|${end}|${request.period}|${types.join(',')}`;
  return remember(key, () =>
    hass.callWS<Record<string, StatRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      statistic_ids: ids,
      period: request.period,
      types,
    }),
  ).then((rows) => rows ?? {});
}
