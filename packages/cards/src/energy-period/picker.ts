import { houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import { firstWeekday } from '../shared/dates.js';

/**
 * What the Energy period card moves an Energy date picker's collection to, as Home Assistant's own picker moves it
 * (`hui-energy-period-selector`, `calcDateRange`, `shiftDateRange`): whole days from midnight to the last moment of
 * the last day, on the house's clock (the server's zone where the profile says so, else the browser's), a week from
 * the first weekday the profile or the language names.
 */

/** Home Assistant's words for the presets its picker remembers (`DateRange`): the card writes the same ones. */
export type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year';

/** A span's grain: what ‹ and › walk it by, and which of the card's periods it is. */
export type Grain = 'day' | 'week' | 'month' | 'year';
export type PeriodKey = Grain | 'custom';
export const PERIOD_KEYS: readonly PeriodKey[] = ['day', 'week', 'month', 'year', 'custom'];

/** The preset a grain's chip picks: its current day, week, month or year. */
export const GRAIN_PRESET: Readonly<Record<Grain, Preset>> = {
  day: 'today',
  week: 'this_week',
  month: 'this_month',
  year: 'this_year',
};

/** A picker's span: from a midnight to the last moment of its last day (23:59:59.999, as Home Assistant ends one). */
export interface Span {
  readonly start: Date;
  readonly end: Date;
}

/** A calendar day; a month or a day past its end is the next one's (`Date.UTC`'s arithmetic). */
interface Day {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const dayOf = (hass: HomeAssistant | undefined, at: Date): Day => {
  const { year, month, day } = wallClock(at, houseZone(hass));
  return { year, month, day };
};

/** A day as a count of days, to compare and subtract days whatever the clocks do. */
const serial = ({ year, month, day }: Day): number => Date.UTC(year, month - 1, day) / 86_400_000;

/**
 * The midnight a calendar day starts at on the house's clock: in the server's zone, the instant whose wall clock reads
 * that midnight (found as an offset is: from the date read as UTC, less what the zone's clock shows past it — twice,
 * for the day a clock changes); in the browser's, its own `Date`.
 */
export function midnightOf(hass: HomeAssistant | undefined, { year, month, day }: Day): Date {
  const zone = houseZone(hass);
  if (!zone) return new Date(year, month - 1, day);
  const wanted = Date.UTC(year, month - 1, day);
  let at = wanted;
  for (let pass = 0; pass < 2; pass++) {
    const w = wallClock(new Date(at), zone);
    const shown = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    if (shown === wanted) break;
    at -= shown - wanted;
  }
  return new Date(at);
}

/** `count` whole days from `first`. */
const days = (hass: HomeAssistant | undefined, first: Day, count: number): Span => ({
  start: midnightOf(hass, first),
  end: new Date(midnightOf(hass, { ...first, day: first.day + count }).getTime() - 1),
});

/** `count` whole months from the first of `first`'s month. */
const months = (hass: HomeAssistant | undefined, first: Day, count: number): Span => ({
  start: midnightOf(hass, { ...first, day: 1 }),
  end: new Date(midnightOf(hass, { ...first, month: first.month + count, day: 1 }).getTime() - 1),
});

/** A preset's span, on the house's clock at `now`. */
export function presetSpan(hass: HomeAssistant | undefined, preset: Preset, now: Date): Span {
  const today = dayOf(hass, now);
  switch (preset) {
    case 'today':
      return days(hass, today, 1);
    case 'yesterday':
      return days(hass, { ...today, day: today.day - 1 }, 1);
    case 'this_week': {
      const weekday = new Date(serial(today) * 86_400_000).getUTCDay();
      const back = (weekday - firstWeekday(hass, undefined) + 7) % 7;
      return days(hass, { ...today, day: today.day - back }, 7);
    }
    case 'this_month':
      return months(hass, today, 1);
    case 'this_year':
      return months(hass, { ...today, month: 1 }, 12);
  }
}

/** A span read as whole days (its first and last), or undefined when it does not start and end on a day's edge. */
function wholeDays(
  hass: HomeAssistant | undefined,
  span: Span,
): { first: Day; last: Day; count: number } | undefined {
  const first = dayOf(hass, span.start);
  const last = dayOf(hass, span.end);
  const whole =
    span.start.getTime() === midnightOf(hass, first).getTime() &&
    span.end.getTime() + 1 === midnightOf(hass, { ...last, day: last.day + 1 }).getTime();
  return whole ? { first, last, count: serial(last) - serial(first) + 1 } : undefined;
}

const lastOfMonth = (day: Day): boolean =>
  new Date(Date.UTC(day.year, day.month, 0)).getUTCDate() === day.day;

/** Whole months a span of whole days covers (from a 1st to a month's last day), else 0. */
const monthsOf = (first: Day, last: Day): number =>
  first.day === 1 && lastOfMonth(last)
    ? (last.year - first.year) * 12 + last.month - first.month + 1
    : 0;

/**
 * The span before (−1) or after (+1), by the span's own length as Home Assistant walks it: whole months by as many
 * months, whole days by as many days, anything else by its length in time.
 */
export function shiftSpan(hass: HomeAssistant | undefined, span: Span, direction: 1 | -1): Span {
  const whole = wholeDays(hass, span);
  if (!whole) {
    const length = (span.end.getTime() - span.start.getTime() + 1) * direction;
    return {
      start: new Date(span.start.getTime() + length),
      end: new Date(span.end.getTime() + length),
    };
  }
  const { first, count } = whole;
  const spanMonths = monthsOf(first, whole.last);
  if (spanMonths)
    return months(hass, { ...first, month: first.month + direction * spanMonths }, spanMonths);
  return days(hass, { ...first, day: first.day + direction * count }, count);
}

/** Which period a span is: a day, a week from the first weekday, a month, a calendar year — else `custom`. */
export function grainOf(hass: HomeAssistant | undefined, span: Span): PeriodKey {
  const whole = wholeDays(hass, span);
  if (!whole) return 'custom';
  const { first, last, count } = whole;
  if (count === 1) return 'day';
  if (
    count === 7 &&
    new Date(serial(first) * 86_400_000).getUTCDay() === firstWeekday(hass, undefined)
  )
    return 'week';
  const spanMonths = monthsOf(first, last);
  if (spanMonths === 1) return 'month';
  if (spanMonths === 12 && first.month === 1) return 'year';
  return 'custom';
}

export const sameSpan = (a: Span, b: Span): boolean =>
  a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

/** The span holds `now`: there is nothing after it to walk to yet. */
export const holdsNow = (span: Span, now: Date): boolean =>
  span.start.getTime() <= now.getTime() && now.getTime() <= span.end.getTime();

/**
 * The days a person chose on the date grid (`FluvyDates`, the browser's calendar: from a midnight to the midnight after
 * the last day) as the house's whole days.
 */
export function chosenDays(hass: HomeAssistant | undefined, start: number, end: number): Span {
  const local = (at: Date): Day => ({
    year: at.getFullYear(),
    month: at.getMonth() + 1,
    day: at.getDate(),
  });
  const first = local(new Date(start));
  const last = local(new Date(end - 1));
  return days(hass, first, serial(last) - serial(first) + 1);
}

/** A span's days as the date grid draws them: the browser's midnights, the end the midnight after its last day. */
export function gridDays(
  hass: HomeAssistant | undefined,
  span: Span,
): { start: number; end: number } {
  const first = dayOf(hass, span.start);
  const last = dayOf(hass, span.end);
  return {
    start: new Date(first.year, first.month - 1, first.day).getTime(),
    end: new Date(last.year, last.month - 1, last.day + 1).getTime(),
  };
}

/** Where Home Assistant keeps the preset a collection reopens on (`getEnergyDefaultPeriodStorageKey`). */
export const storageKey = (key: string): string => `energy-default-period-_${key}`;
