import type { HomeAssistant } from '../ha/types.js';

/**
 * Numeric history for the curves. One WebSocket call per entity and window, cached for five
 * minutes and shared between cards, downsampled to the points a 320 px curve can show.
 */

interface RawState {
  s: string;
  lu: number;
}

export interface Series {
  readonly values: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly average: number;
}

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<Series | null> }>();

/** Remembers a fetch for the TTL — unless it fails: a dropped connection must not blank a curve for five minutes. */
function remember(key: string, promise: Promise<Series | null>): Promise<Series | null> {
  const entry = { at: Date.now(), promise };
  if (cache.size >= 200) for (const [k, v] of cache) if (entry.at - v.at >= TTL) cache.delete(k); // stale keys pile up on a wall panel (one per hour per entity)
  cache.set(key, entry);
  promise.then(
    (series) => {
      if (series === null && cache.get(key) === entry) cache.delete(key);
    },
    () => cache.delete(key),
  );
  return promise;
}

export function summarise(values: readonly number[]): Series | null {
  if (values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { values, min, max, average: sum / values.length };
}

/** Time-weighted buckets: each output point is the last known value at the end of its bucket. */
export function resample(
  points: readonly { t: number; v: number }[],
  start: number,
  end: number,
  count: number,
): number[] {
  if (points.length === 0) return [];
  const out: number[] = [];
  let index = 0;
  let last = points[0]!.v;
  for (let i = 0; i < count; i++) {
    const t = start + ((i + 1) / count) * (end - start);
    while (index < points.length && points[index]!.t <= t) {
      last = points[index]!.v;
      index++;
    }
    out.push(last);
  }
  return out;
}

export function fetchHistory(
  hass: HomeAssistant,
  entityId: string,
  hours = 24,
  count = 48,
): Promise<Series | null> {
  const key = `${entityId}|${hours}|${count}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3_600_000);
  const promise = hass
    .callWS<Record<string, RawState[]>>({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [entityId],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    })
    .then((result) => {
      const points = (result?.[entityId] ?? [])
        .map((row) => ({ t: row.lu * 1000, v: /\d/.test(row.s) ? Number(row.s) : NaN })) // `Number('')` is 0: an empty state is a hole, not a zero
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
      return summarise(resample(points, start.getTime(), end.getTime(), count));
    })
    .catch(() => null);
  return remember(key, promise);
}

export interface StatisticsRow {
  start: number;
  end: number;
  change?: number | null;
  mean?: number | null;
  sum?: number | null;
  state?: number | null;
}

/** Long-term statistics (hourly change for energy bars). Returns one number per period, oldest first. */
export function fetchStatistics(
  hass: HomeAssistant,
  entityId: string,
  start: Date,
  period: 'hour' | 'day' = 'hour',
  type: 'change' | 'mean' = 'change',
): Promise<readonly number[] | null> {
  const key = `stat|${entityId}|${start.toISOString().slice(0, 13)}|${period}|${type}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise.then((s) => s?.values ?? null);
  const promise = hass
    .callWS<Record<string, StatisticsRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: [entityId],
      period,
      types: [type],
    })
    .then((result) =>
      summarise(
        (result?.[entityId] ?? [])
          .map((row) => Number(row[type] ?? 0))
          .map((v) => (Number.isFinite(v) ? v : 0)),
      ),
    )
    .catch(() => null);
  return remember(key, promise).then((s) => s?.values ?? null);
}

export const clearHistoryCache = (): void => cache.clear();
