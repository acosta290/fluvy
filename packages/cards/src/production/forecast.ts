import {
  houseZone,
  wallClock,
  type EntityView,
  type HomeAssistant,
  type WallClock,
} from '@fluvy/core';
import { fetchPrefs, fetchSolarForecast, type SolarForecasts } from '../energy-model/house.js';
import { houseMidnight } from '../energy-model/period.js';
import { measureIds, readPrefs, type PrefSource } from '../energy-model/prefs.js';

/**
 * What the sun is expected to make, day by day and hour by hour, read from one of two places.
 *
 * A forecast sensor's attributes, as the integrations publish them: Solcast ships
 * `detailedHourly: [{ period_start, pv_estimate }]` in kWh, Open-Meteo Solar Forecast and the Forecast.Solar templates
 * ship `wh_period` / `wh_hours: { "2026-09-17T07:00:00+02:00": 120 }` in Wh, a template sensor ships a plain list of
 * 24 numbers in its own unit. Anything else gives null: the card then shows the day's total and draws no forecast bars.
 *
 * Home Assistant's own (`energy/solar_forecast`): what the integrations linked to the Energy dashboard's arrays expect,
 * in Wh by the instant each stretch starts (an hour, or Solcast's half hours) — today and tomorrow from Forecast.Solar,
 * a week from Solcast, Open-Meteo's days.
 *
 * Hours and days are the house's: an instant belongs to the hour and the day a clock in the house's zone shows for it.
 */

/** One day of a forecast: its date as a number that orders (20260918), an instant of it, and its 24 hours. */
export interface ForecastDay {
  readonly day: number;
  readonly at: number;
  readonly hours: readonly number[];
}

/** A forecast by day, in order, its amounts in one unit ('' = the unit of the meter it is read beside). */
export interface Forecast {
  readonly days: readonly ForecastDay[];
  readonly unit: string;
}

const HOURS = 24;
const HOUR = 3_600_000;

/** Attribute → the unit its numbers are in ('' = the sensor's own unit). */
const SOURCES: ReadonlyArray<readonly [attribute: string, unit: string]> = [
  ['detailedHourly', 'kWh'],
  ['wh_period', 'Wh'],
  ['wh_hours', 'Wh'],
  ['hourly', ''],
  ['forecast', ''],
];

const TIME_KEYS = ['period_start', 'datetime', 'start', 'time'] as const;
const VALUE_KEYS = ['pv_estimate', 'energy', 'value'] as const;

const asNumber = (raw: unknown): number | null => {
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  return Number.isFinite(value) ? value : null;
};

const pick = (row: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) if (row[key] !== undefined) return row[key];
  return undefined;
};

/** A date on a clock as a number that orders: 17 September 2026 is 20260917. */
const dayNumber = (wall: WallClock): number => wall.year * 10_000 + wall.month * 100 + wall.day;

/** The date an instant falls on in `zone` (the browser's when undefined), as that number. */
export const dayOf = (at: Date | number, zone: string | undefined): number =>
  dayNumber(wallClock(new Date(at), zone));

/** An instant of the day after `now`'s on the house's clock: its noon, whatever a clock change does to its midnight. */
export const tomorrowOf = (hass: HomeAssistant | undefined, now: Date): Date =>
  new Date(houseMidnight(hass, now).getTime() + 36 * HOUR);

/**
 * Instants and what each is expected to make, filed by the house's day and hour: half hours add up in theirs, and a
 * 25-hour day folds its repeated hour. What stands before `from` is left out.
 */
function byDay(
  points: Iterable<readonly [at: number, amount: number]>,
  zone: string | undefined,
  from = -Infinity,
): ForecastDay[] {
  const days = new Map<number, { at: number; hours: number[] }>();
  for (const [at, amount] of points) {
    if (at < from) continue;
    const wall = wallClock(new Date(at), zone);
    const day = dayNumber(wall);
    const filed = days.get(day) ?? { at, hours: new Array<number>(HOURS).fill(0) };
    days.set(day, filed);
    filed.hours[wall.hour] = (filed.hours[wall.hour] ?? 0) + Math.max(0, amount);
  }
  return [...days].sort(([a], [b]) => a - b).map(([day, filed]) => ({ day, ...filed }));
}

/** An attribute's dated amounts: rows that carry a time and a value, or a map of times to values. */
function dated(raw: unknown): Array<[at: number, amount: number]> {
  const pairs: Array<[unknown, unknown]> = Array.isArray(raw)
    ? raw
        .filter(
          (entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object',
        )
        .map((row) => [pick(row, TIME_KEYS), pick(row, VALUE_KEYS)])
    : raw !== null && typeof raw === 'object'
      ? Object.entries(raw)
      : [];
  return pairs.flatMap(([time, amount]) => {
    const at = typeof time === 'string' ? Date.parse(time) : NaN;
    const value = asNumber(amount);
    return Number.isNaN(at) || value === null ? [] : [[at, value]];
  });
}

/**
 * A forecast sensor's days: those of its first attribute that carries `day` (an instant of the day the card shows; a
 * plain list of 24 numbers is that day's), or null when none does.
 */
export function sensorForecast(
  view: EntityView,
  day: Date,
  zone: string | undefined,
): Forecast | null {
  const wanted = dayOf(day, zone);
  for (const [attribute, unit] of SOURCES) {
    const raw = view.attr(attribute);
    const days =
      Array.isArray(raw) && raw.length === HOURS && raw.every((entry) => asNumber(entry) !== null)
        ? [
            {
              day: wanted,
              at: day.getTime(),
              hours: raw.map((entry) => Math.max(0, asNumber(entry) ?? 0)),
            },
          ]
        : byDay(dated(raw), zone);
    if (days.some((filed) => filed.day === wanted)) return { days, unit: unit || view.unit };
  }
  return null;
}

/**
 * The config entries that forecast what a card reads: those of the Energy dashboard's arrays among its sensors (an
 * array's energy meter or its power sensor), else of the arrays on their devices (an inverter's day counter beside the
 * lifetime one the dashboard reads), else — where `whole` says so — of every array. Each entry once: a forecast of the
 * whole site linked to two arrays (Solcast) counts once, each plane's own (Forecast.Solar) adds.
 */
export function forecastEntries(
  sources: readonly PrefSource[],
  ids: readonly string[],
  deviceOf: (id: string) => string | undefined,
  whole = false,
): string[] {
  const arrays = sources.filter((source) => source.kind === 'solar');
  const read = (source: PrefSource): string[] => [
    ...source.energyIn,
    ...measureIds(source.measure),
  ];
  const devices = new Set(ids.flatMap((id) => deviceOf(id) ?? []));
  const own = [
    arrays.filter((source) => read(source).some((id) => ids.includes(id))),
    arrays.filter((source) => read(source).some((id) => devices.has(deviceOf(id) ?? ''))),
    whole ? arrays : [],
  ].find((linked) => linked.length);
  return [...new Set((own ?? []).flatMap((source) => source.forecast ?? []))];
}

/** Those entries' forecasts as one: what they expect of each instant, added. */
export function summed(forecasts: SolarForecasts, entries: readonly string[]): Map<number, number> {
  const total = new Map<number, number>();
  for (const entry of entries)
    for (const [time, amount] of Object.entries(forecasts[entry]?.wh_hours ?? {})) {
      const at = Date.parse(time);
      if (!Number.isNaN(at) && Number.isFinite(amount))
        total.set(at, (total.get(at) ?? 0) + amount);
    }
  return total;
}

/**
 * Home Assistant's forecast for what a card reads (`ids`: its meter and its arrays), from the day `now` falls on: null
 * where no forecast is linked to them (most houses: Home Assistant is then not asked), or it cannot be read.
 */
export async function houseForecast(
  hass: HomeAssistant,
  ids: readonly string[],
  whole: boolean,
  now: Date,
): Promise<Forecast | null> {
  const entries = forecastEntries(
    readPrefs(await fetchPrefs(hass)).sources,
    ids,
    (id) => hass.entities?.[id]?.device_id,
    whole,
  );
  const forecasts = entries.length ? await fetchSolarForecast(hass) : null;
  const days = byDay(
    summed(forecasts ?? {}, entries),
    houseZone(hass),
    houseMidnight(hass, now).getTime(),
  );
  return days.length ? { days, unit: 'Wh' } : null;
}

/** The last hour of a day the forecast expects anything of (-1: none). */
const lastLit = (hours: readonly number[]): number =>
  hours.reduce((last, amount, hour) => (amount > 0 ? hour : last), -1);

/**
 * The days after `today` (`dayOf`) a forecast holds whole, in order. Its last day counts only where it runs as late
 * into its day as the one before it does, an hour's grace given (a clock change): a forecast that ends in a morning —
 * Solcast's reach, a week from the hour it was asked — would say a dark day.
 */
export function daysAhead(days: readonly ForecastDay[], today: number): ForecastDay[] {
  const ahead = days.filter((filed) => filed.day > today);
  const [before, last] = days.slice(-2);
  if (before && last && last.day > today && lastLit(last.hours) < lastLit(before.hours) - 1)
    ahead.pop();
  return ahead;
}
