import { houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import { allocate, sumAllocations, type Allocation, type Totals } from './allocate.js';
import type { PrefSource } from './prefs.js';

/**
 * A period's energy from Home Assistant's long-term statistics: the change of every meter per hour (a day) or per day
 * (a week, a month), allocated bucket by bucket and summed — the Energy dashboard's arithmetic, so the figures match.
 */

export type Period = 'day' | 'week' | 'month';
export const PERIODS: readonly Period[] = ['day', 'week', 'month'];

interface StatRow {
  readonly start: number;
  readonly change?: number | null;
}

/** Midnight in the house's time zone (the clock Home Assistant shows), `days` ago. */
export function houseMidnight(hass: HomeAssistant | undefined, now: Date, days = 0): Date {
  const wall = wallClock(now, houseZone(hass));
  const since = ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - since - days * 86_400_000);
}

/** Where a period starts: today's midnight, a week of days, this calendar month's first day. */
export function periodStart(hass: HomeAssistant | undefined, now: Date, period: Period): Date {
  if (period === 'day') return houseMidnight(hass, now);
  if (period === 'week') return houseMidnight(hass, now, 6);
  const wall = wallClock(now, houseZone(hass));
  return houseMidnight(hass, now, wall.day - 1);
}

export interface PeriodEnergy {
  readonly totals: Totals;
  readonly allocation: Allocation;
  /** kWh per statistic over the period (a device, a meter). */
  readonly byStat: ReadonlyMap<string, number>;
  /** Per bucket, oldest first: the chart's bars. */
  readonly buckets: ReadonlyArray<{ readonly start: number; readonly totals: Totals }>;
}

const cache = new Map<string, { at: number; promise: Promise<PeriodEnergy | null> }>();
const TTL = 5 * 60_000;

/**
 * Fetches and allocates a period. Every source's meters (`energyIn` / `energyOut`) take part; `extra` are further
 * statistics to total (devices, gas, water). Resolves `null` when the statistics cannot be read.
 */
export function fetchPeriod(
  hass: HomeAssistant,
  sources: readonly PrefSource[],
  period: Period,
  now: Date,
  extra: readonly string[] = [],
  /** The buckets: an hour for a day and a day otherwise (the Energy dashboard's), or five minutes for a day's curve. */
  step: '5minute' | 'hour' | 'day' = period === 'day' ? 'hour' : 'day',
): Promise<PeriodEnergy | null> {
  const start = periodStart(hass, now, period);
  const ids = [...new Set([...sources.flatMap((s) => [...s.energyIn, ...s.energyOut]), ...extra])];
  // five-minute buckets move every five minutes: the cache keys on the bucket, not the hour
  const beat =
    step === '5minute' ? Math.floor(now.getTime() / 300_000) : start.toISOString().slice(0, 13);
  const key = `${period}|${step}|${beat}|${ids.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  if (!ids.length) return Promise.resolve(null);
  const promise = hass
    .callWS<Record<string, StatRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: ids,
      period: step,
      types: ['change'],
      units: { energy: 'kWh' },
    })
    .then((result) => allocatePeriod(result ?? {}, sources, extra))
    .catch(() => null);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** The bucket-by-bucket allocation (exported for the tests). */
export function allocatePeriod(
  rows: Readonly<Record<string, readonly StatRow[]>>,
  sources: readonly PrefSource[],
  extra: readonly string[] = [],
): PeriodEnergy {
  const starts = [...new Set(Object.values(rows).flatMap((list) => list.map((r) => r.start)))].sort(
    (a, b) => a - b,
  );
  const at = (id: string, start: number): number => {
    const row = rows[id]?.find((r) => r.start === start);
    const v = Number(row?.change ?? 0);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  };
  const sum = (ids: readonly string[], start: number): number =>
    ids.reduce((s, id) => s + at(id, start), 0);
  const of = (kind: PrefSource['kind'], side: 'energyIn' | 'energyOut'): string[] =>
    sources.filter((s) => s.kind === kind).flatMap((s) => s[side]);
  const buckets = starts.map((start) => ({
    start,
    totals: {
      solar: sum(of('solar', 'energyIn'), start),
      fromGrid: sum(of('grid', 'energyIn'), start),
      toGrid: sum(of('grid', 'energyOut'), start),
      fromBattery: sum(of('battery', 'energyIn'), start),
      toBattery: sum(of('battery', 'energyOut'), start),
    },
  }));
  const totals: Totals = buckets.reduce(
    (acc, b) => ({
      solar: acc.solar + b.totals.solar,
      fromGrid: acc.fromGrid + b.totals.fromGrid,
      toGrid: acc.toGrid + b.totals.toGrid,
      fromBattery: acc.fromBattery + b.totals.fromBattery,
      toBattery: acc.toBattery + b.totals.toBattery,
    }),
    { solar: 0, fromGrid: 0, toGrid: 0, fromBattery: 0, toBattery: 0 },
  );
  const byStat = new Map<string, number>();
  for (const id of [...new Set([...Object.keys(rows), ...extra])])
    byStat.set(
      id,
      starts.reduce((s, start) => s + at(id, start), 0),
    );
  return {
    totals,
    allocation: sumAllocations(buckets.map((b) => allocate(b.totals))),
    byStat,
    buckets,
  };
}

export const clearPeriodCache = (): void => cache.clear();
