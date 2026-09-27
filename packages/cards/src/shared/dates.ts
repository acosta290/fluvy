import type { HomeAssistant } from '@fluvy/core';

/**
 * Local-date arithmetic. Every function reads and writes the LOCAL fields of a `Date` (year, month,
 * day, hour) — never a slice of an ISO string — so a day starts and ends where the browser's day
 * does, daylight-saving nights included (`new Date(y, m, d + 1)` is always the next local midnight).
 */

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, count: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);

/** First day of the month `count` months away. */
export const addMonths = (date: Date, count: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + count, 1);

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const sameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** 20260917 — orders like the dates do, and keys a map without formatting anything. */
export const dayKey = (date: Date): number =>
  date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();

export const daysInMonth = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/** The same day `count` months away, kept inside that month (Jan 31 + 1 → Feb 28). */
export function shiftMonth(date: Date, count: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + count, 1);
  target.setDate(Math.min(date.getDate(), daysInMonth(target)));
  return target;
}

export const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

/** The instant without its seconds: what a clock that shows minutes is showing. */
export const floorMinute = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());

/**
 * Wall-clock hours of `at` on `day`, 0 … 24: read from the clock's own fields, so 10:00 sits at 10
 * even on the two days a year that are 23 or 25 hours long.
 */
export function wallHours(day: Date, at: Date): number {
  if (at.getTime() <= startOfDay(day).getTime()) return 0;
  if (at.getTime() >= addDays(day, 1).getTime()) return 24;
  return at.getHours() + at.getMinutes() / 60 + at.getSeconds() / 3600;
}

/* ---------- weeks ---------- */

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** What the card accepts: a weekday, or "whatever the language does" (Home Assistant's own default). */
export type FirstWeekday = Weekday | 'language';

interface WeekInfo {
  readonly firstDay?: number;
}
type LocaleWithWeekInfo = Intl.Locale & { readonly weekInfo?: WeekInfo; getWeekInfo?(): WeekInfo };

/** `weekInfo.firstDay` counts 1 = Monday … 7 = Sunday; `Date#getDay()` counts 0 = Sunday … 6 = Saturday. */
function languageFirstDay(language: string): number | null {
  try {
    const locale: LocaleWithWeekInfo = new Intl.Locale(language);
    const first = (
      typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo
    )?.firstDay;
    return typeof first === 'number' && first >= 1 && first <= 7 ? first % 7 : null;
  } catch {
    return null; // an engine without week data, or a language tag it cannot parse
  }
}

const weekdayIndex = (name: unknown): number => WEEKDAYS.indexOf(name as Weekday);

/** The weekday a week starts on (as `getDay()` counts): the card's config, the user's profile, the language, Monday. */
export function firstWeekday(
  hass: HomeAssistant | undefined,
  configured: FirstWeekday | undefined,
): number {
  const fromConfig = weekdayIndex(configured);
  if (fromConfig >= 0) return fromConfig;
  const fromProfile = configured === 'language' ? -1 : weekdayIndex(hass?.locale?.first_weekday);
  if (fromProfile >= 0) return fromProfile;
  return languageFirstDay(hass?.locale?.language ?? hass?.language ?? 'en') ?? 1;
}

/** First day of the week `date` falls in. */
export const weekStart = (date: Date, first: number): Date =>
  addDays(date, -((date.getDay() - first + 7) % 7));

/** The weeks a month grid shows: from the week its 1st falls in to the week its last day falls in (4, 5 or 6 rows). */
export function monthWeeks(
  month: Date,
  first: number,
): { readonly start: Date; readonly end: Date; readonly rows: number } {
  const anchor = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = weekStart(anchor, first);
  const offset = (anchor.getDay() - first + 7) % 7;
  const rows = Math.ceil((offset + daysInMonth(anchor)) / 7);
  return { start, end: addDays(start, rows * 7), rows };
}
