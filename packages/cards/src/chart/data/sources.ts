import type { EntityView, HomeAssistant } from '@fluvy/core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  momentOf,
  numberOf,
  readList,
  usualList,
  type ListKeys,
  type Reading,
} from './attribute.js';
import { remember, statisticsDuring, type StatPeriod, type StatType } from './statistics.js';

/*
 * Where a Chart card's series come from: a sensor's history (the recorder's states), its long-term statistics (a
 * bucket an hour, a day …: their mean, min, max, sum or change), a list in its attributes (`attribute.ts`), or a
 * weather's forecast (`weather/subscribe_forecast`, as the weather card subscribes) — each read as readings in time,
 * which the card lays on its window's slots.
 */

export type Source = 'history' | 'statistics' | 'attribute' | 'forecast';
export const SOURCES: readonly Source[] = ['history', 'statistics', 'attribute', 'forecast'];
export const STATS = ['mean', 'min', 'max', 'sum', 'change'] as const satisfies readonly StatType[];
export type Stat = (typeof STATS)[number];
export const PERIODS = ['hour', 'day', 'week', 'month'] as const satisfies readonly StatPeriod[];
export type Period = (typeof PERIODS)[number];

/** What a series says of where it is read from (the card's `series[]` item, as the sources read it). */
export interface SourceKeys extends ListKeys {
  readonly entity: string;
  readonly source?: Source | undefined;
  readonly attribute?: string | undefined;
  readonly stat?: Stat | undefined;
  readonly period?: Period | undefined;
}

/**
 * Where a series is read from: the one named, else by its entity — a weather's forecast; an attribute named, or one
 * of the usual lists its attributes hold (a price's, a solar forecast's); else its history.
 */
export function sourceOf(item: SourceKeys, attributes?: Readonly<Record<string, unknown>>): Source {
  if (item.source && SOURCES.includes(item.source)) return item.source;
  if (item.entity.startsWith('weather.')) return 'forecast';
  return item.attribute || (attributes && usualList(attributes)) ? 'attribute' : 'history';
}

/** The stat a sensor's statistics are read by where the card names none: what a meter gained, else the mean. */
export const statOf = (stateClass: unknown): Stat =>
  stateClass === 'total' || stateClass === 'total_increasing' ? 'change' : 'mean';

/** The bucket statistics are read in where the card names none: an hour through a week, a day beyond. */
export const periodOf = (hours: number): Period => (hours <= 7 * 24 ? 'hour' : 'day');

/** The length of a statistic's bucket, the reading's slot (a month is read as its 30 days). */
export const PERIOD_MS: Readonly<Record<Period, number>> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/** One row of `history/history_during_period` in its minimal form: the state and when it was written (seconds). */
interface RawState {
  readonly s: string;
  readonly lu: number;
}

/**
 * A sensor's history over a window as readings: each state where it is a number (a word or an empty state is a gap,
 * never a zero), kept five minutes for every card that reads the same sensor and window.
 */
export function historyReadings(
  hass: HomeAssistant,
  id: string,
  start: number,
  end: number,
): Promise<Reading[]> {
  const minute = 60_000;
  const key = `history|${id}|${Math.floor(start / minute)}|${Math.floor(end / (5 * minute))}`;
  return remember(key, () =>
    hass
      .callWS<Record<string, RawState[]>>({
        type: 'history/history_during_period',
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: [id],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })
      .then((result) =>
        (result?.[id] ?? []).flatMap((row): Reading[] => {
          const v = numberOf(row.s);
          return v === null || !Number.isFinite(row.lu) ? [] : [{ t: row.lu * 1000, v }];
        }),
      ),
  );
}

/**
 * A statistic's buckets as readings: each at its start, held to its end, by `stat` — with its bucket's min and max
 * where a band is drawn (a measurement's; a meter keeps none).
 */
export async function statisticsReadings(
  hass: HomeAssistant,
  id: string,
  window: { readonly start: number; readonly end: number },
  period: Period,
  stat: Stat,
  band: boolean,
): Promise<Reading[]> {
  const types: StatType[] = band && stat === 'mean' ? ['mean', 'min', 'max'] : [stat];
  const rows = (await statisticsDuring(hass, { ids: [id], ...window, period, types }))[id] ?? [];
  return rows.flatMap((row): Reading[] => {
    const t = momentOf(row.start);
    const v = numberOf(row[stat]);
    if (t === null || v === null) return [];
    const end = momentOf(row.end) ?? t + PERIOD_MS[period];
    const low = numberOf(row.min);
    const high = numberOf(row.max);
    return [
      { t, v, end, ...(types.length > 1 && low !== null && high !== null ? { low, high } : {}) },
    ];
  });
}

/** One entry of `weather/subscribe_forecast`: its moment, and whatever it forecasts (temperature, rain, wind …). */
export type ForecastEntry = Readonly<Record<string, unknown>> & { readonly datetime: string };
export type ForecastType = 'hourly' | 'daily';

/** A weather's forecast as readings: by `value_key` (its temperature by default), its low and high where it has them. */
export const forecastReadings = (entries: readonly ForecastEntry[], keys: ListKeys): Reading[] =>
  readList(entries, { time_key: 'datetime', value_key: keys.value_key ?? 'temperature' });

/** The units a weather writes its forecast's measures in, by the measure. */
const WEATHER_UNITS: Readonly<Record<string, string>> = {
  temperature: 'temperature_unit',
  templow: 'temperature_unit',
  apparent_temperature: 'temperature_unit',
  dew_point: 'temperature_unit',
  precipitation: 'precipitation_unit',
  wind_speed: 'wind_speed_unit',
  wind_gust_speed: 'wind_speed_unit',
  pressure: 'pressure_unit',
  visibility: 'visibility_unit',
};

/** The unit of a weather's forecast measure: the one the weather says it writes it in, a share's %. */
export function forecastUnit(view: EntityView, key = 'temperature'): string {
  const attribute = WEATHER_UNITS[key];
  if (attribute) return String(view.attr(attribute) ?? '');
  return /humidity|probability|cloud/.test(key) ? '%' : '';
}

interface Subscription {
  cancelled: boolean;
  unsubscribe?: () => void;
}

const release = (subscription: Subscription): void => {
  subscription.cancelled = true;
  subscription.unsubscribe?.();
};

/**
 * The forecasts of a card's weathers, as Home Assistant pushes them: one subscription a weather and kind (hourly for
 * a window of a day or two, daily beyond), released when the card leaves or no longer reads it. `undefined` while
 * asked, `null` where the weather has no such forecast.
 */
export class ForecastFeed implements ReactiveController {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly entries = new Map<string, readonly ForecastEntry[] | null>();
  private connection: unknown;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostDisconnected(): void {
    for (const subscription of this.subscriptions.values()) release(subscription);
    this.subscriptions.clear();
  }

  /** What a weather forecasts of a kind: its entries, `null` for none, `undefined` while asked. */
  get(entity: string, type: ForecastType): readonly ForecastEntry[] | null | undefined {
    return this.entries.get(`${entity}|${type}`);
  }

  /** The subscriptions the card wants now: new ones asked, those no longer wanted let go. */
  sync(
    hass: HomeAssistant | undefined,
    wanted: ReadonlyArray<readonly [string, ForecastType]>,
  ): void {
    const connection = hass?.connection;
    if (!connection) return;
    // another connection (Home Assistant reconnected): everything is asked again on it
    if (connection !== this.connection) {
      this.hostDisconnected();
      this.connection = connection;
    }
    const keys = new Set(wanted.map(([entity, type]) => `${entity}|${type}`));
    for (const [key, subscription] of this.subscriptions)
      if (!keys.has(key)) {
        release(subscription);
        this.subscriptions.delete(key);
      }
    for (const [entity, type] of wanted) {
      const key = `${entity}|${type}`;
      if (this.subscriptions.has(key)) continue;
      const subscription: Subscription = { cancelled: false };
      this.subscriptions.set(key, subscription);
      const answer = (entries: readonly ForecastEntry[] | null): void => {
        if (subscription.cancelled) return;
        this.entries.set(key, entries);
        this.host.requestUpdate();
      };
      connection
        .subscribeMessage<{ forecast?: readonly ForecastEntry[] | null }>(
          (message) => answer(Array.isArray(message?.forecast) ? message.forecast : null),
          { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entity },
        )
        .then((unsubscribe) => {
          subscription.unsubscribe = unsubscribe;
          if (subscription.cancelled) unsubscribe(); // let go while the socket was answering
        })
        .catch(() => answer(null)); // the weather does not offer this forecast: nothing to draw, no noise
    }
  }
}
