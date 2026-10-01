import { wallClock, type EntityView, type WallClock } from '@fluvy/core';

/**
 * A forecast sensor's day, hour by hour, as the integrations publish it in their attributes:
 * Solcast ships `detailedHourly: [{ period_start, pv_estimate }]` in kWh, Open-Meteo Solar Forecast
 * and the Forecast.Solar templates ship `wh_period` / `wh_hours: { "2026-09-17T07:00:00+02:00": 120 }`
 * in Wh, a template sensor ships a plain list of 24 numbers in its own unit. Anything else gives
 * null: the card then shows the day's total and draws no forecast bars. Hours are the house's: an instant belongs
 * to the hour and the day a clock in the house's zone shows for it.
 */

export interface HourlyForecast {
  readonly hours: readonly number[];
  readonly unit: string;
}

const HOURS = 24;

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

/** The hour of `day` an ISO instant falls in on the house's clock, or null when it is another day (or no date). */
const hourOf = (raw: unknown, day: WallClock, zone: string | undefined): number | null => {
  if (typeof raw !== 'string') return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const wall = wallClock(date, zone);
  if (wall.year !== day.year || wall.month !== day.month || wall.day !== day.day) return null;
  return wall.hour;
};

const pick = (row: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) if (row[key] !== undefined) return row[key];
  return undefined;
};

function parse(raw: unknown, day: WallClock, zone: string | undefined): number[] | null {
  if (
    Array.isArray(raw) &&
    raw.length === HOURS &&
    raw.every((entry) => asNumber(entry) !== null)
  ) {
    return raw.map((entry) => Math.max(0, asNumber(entry) ?? 0));
  }
  const hours = new Array<number>(HOURS).fill(0);
  const pairs: Array<[unknown, unknown]> = Array.isArray(raw)
    ? raw
        .filter(
          (entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object',
        )
        .map((row) => [pick(row, TIME_KEYS), pick(row, VALUE_KEYS)])
    : raw !== null && typeof raw === 'object'
      ? Object.entries(raw)
      : [];
  let seen = false;
  for (const [time, amount] of pairs) {
    const hour = hourOf(time, day, zone);
    const value = asNumber(amount);
    if (hour === null || value === null) continue;
    hours[hour] = (hours[hour] ?? 0) + Math.max(0, value);
    seen = true;
  }
  return seen ? hours : null;
}

/** Today's forecast hour by hour: `now` in the house's `zone` (`houseZone(hass)`; the browser's when undefined). */
export function hourlyForecast(
  view: EntityView,
  now: Date,
  zone: string | undefined,
): HourlyForecast | null {
  const day = wallClock(now, zone);
  for (const [attribute, unit] of SOURCES) {
    const hours = parse(view.attr(attribute), day, zone);
    if (hours) return { hours, unit: unit || view.unit };
  }
  return null;
}
