import type { HomeAssistant } from '@fluvy/core';
import { rangeOf, stepFor, type Period, type Range, type StatRow, type Step } from './period.js';
import type { PrefSource } from './prefs.js';

/**
 * What the grid cost over a period, from Home Assistant's own money statistics: a connection's `stat_cost` and
 * `stat_compensation`, or — where the Energy dashboard was given a price instead of a cost sensor — the cost sensors
 * Home Assistant makes for it (`energy/info` → `cost_sensors`, keyed by the energy meter). Money is summed as it is
 * recorded: an hour at a negative price takes money off, it is never read as nothing.
 */

export interface EnergyInfo {
  /** Energy meter → the cost (or compensation) sensor Home Assistant made for it. */
  readonly cost_sensors?: Readonly<Record<string, string>>;
}

const TTL = 5 * 60_000;
const infoCache = new WeakMap<object, { at: number; promise: Promise<EnergyInfo | null> }>();

/** `energy/info`, asked once per connection and kept for five minutes; `null` when it cannot be read. */
export function fetchInfo(hass: HomeAssistant): Promise<EnergyInfo | null> {
  const key = (hass.connection as object | undefined) ?? hass;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass.callWS<EnergyInfo>({ type: 'energy/info' }).catch(() => null);
  infoCache.set(key, { at: Date.now(), promise });
  return promise;
}

export interface CostStats {
  /** What importing cost. */
  readonly cost: readonly string[];
  /** What exporting paid. */
  readonly compensation: readonly string[];
}

const unique = (ids: readonly (string | undefined)[]): string[] => [
  ...new Set(ids.filter((id): id is string => typeof id === 'string' && id !== '')),
];

/** The money statistics of the grid connections among `sources`. */
export function costStats(
  sources: readonly PrefSource[],
  info: EnergyInfo | null | undefined,
): CostStats {
  const made = info?.cost_sensors ?? {};
  const grid = sources.filter((s) => s.kind === 'grid');
  return {
    cost: unique(grid.flatMap((s) => (s.cost ? [s.cost] : s.energyIn.map((id) => made[id])))),
    compensation: unique(
      grid.flatMap((s) => (s.compensation ? [s.compensation] : s.energyOut.map((id) => made[id]))),
    ),
  };
}

export interface Money {
  readonly cost: number;
  readonly feedIn: number;
  /** What the grid cost less what it paid. */
  readonly net: number;
}

/** A period's money from the change of each statistic; null when there is none to read. */
export function moneyOf(stats: CostStats, change: ReadonlyMap<string, number>): Money | null {
  if (!stats.cost.length && !stats.compensation.length) return null;
  const sum = (ids: readonly string[]): number =>
    ids.reduce((acc, id) => acc + (change.get(id) ?? 0), 0);
  const cost = sum(stats.cost);
  const feedIn = sum(stats.compensation);
  return { cost, feedIn, net: cost - feedIn };
}

const moneyCache = new Map<string, { at: number; promise: Promise<Map<string, number> | null> }>();

/** The change of each money statistic over a range (signed), cached five minutes; null when unreadable. */
export function fetchMoneyRange(
  hass: HomeAssistant,
  stats: CostStats,
  range: Range,
  step: Step = stepFor(range),
): Promise<Map<string, number> | null> {
  const ids = unique([...stats.cost, ...stats.compensation]);
  if (!ids.length) return Promise.resolve(null);
  const key = `${range.start.toISOString()}|${range.end?.toISOString() ?? ''}|${step}|${ids.join(',')}`;
  const hit = moneyCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass
    .callWS<Record<string, StatRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: range.start.toISOString(),
      ...(range.end ? { end_time: range.end.toISOString() } : {}),
      statistic_ids: ids,
      period: step,
      types: ['change'],
    })
    .then((rows) => changeOf(rows ?? {}, ids))
    .catch(() => null);
  moneyCache.set(key, { at: Date.now(), promise });
  return promise;
}

/** A period's money up to now: `fetchMoneyRange` in an hour's buckets for a day and a day's otherwise. */
export const fetchMoney = (
  hass: HomeAssistant,
  stats: CostStats,
  period: Period,
  now: Date,
): Promise<Map<string, number> | null> =>
  fetchMoneyRange(hass, stats, rangeOf(hass, now, period), period === 'day' ? 'hour' : 'day');

/** The money as a followed collection's statistics carry it (they hold every cost sensor the dashboard knows). */
export const moneyFromStats = (
  stats: CostStats,
  rows: Readonly<Record<string, readonly StatRow[]>>,
): Map<string, number> => changeOf(rows, unique([...stats.cost, ...stats.compensation]));

/** Each statistic's change summed over its rows, as recorded (exported for the tests). */
export function changeOf(
  rows: Readonly<Record<string, readonly StatRow[]>>,
  ids: readonly string[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids)
    out.set(
      id,
      (rows[id] ?? []).reduce((acc, r) => {
        const v = Number(r.change ?? 0);
        return Number.isFinite(v) ? acc + v : acc;
      }, 0),
    );
  return out;
}

/** The house's currency as a symbol ("€", "$", "kr"), in the house's language; "" when none is set. */
export function currencySymbol(hass: HomeAssistant | undefined): string {
  const code = hass?.config?.currency;
  if (!code) return '';
  try {
    return (
      new Intl.NumberFormat(hass?.language ?? 'en', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
}

export const clearMoneyCache = (): void => moneyCache.clear();
