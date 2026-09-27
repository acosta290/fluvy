/**
 * Naming the period a page shows: "Today · Thursday", "Last 7 days", "17 – 19 September", "Since 17 Sep, 09:00".
 * Both pages (Activity, History) head their content with it, in the house's language and its clock.
 */
import { dateFormat } from '@fluvy/core';
import { firstFit } from '@fluvy/ui';
import { dayRange, sameRange, shiftRange, DAY, type ActivityRange } from './range.js';

const MINUTE = 60_000;

/** "17 September" (with its year when it is not this one). */
export function dayMonth(
  language: string,
  ms: number,
  month: 'long' | 'short',
  now = Date.now(),
): string {
  const date = new Date(ms);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month };
  if (date.getFullYear() !== new Date(now).getFullYear()) options.year = 'numeric';
  return dateFormat(language, options).format(date);
}

/** What a page calls the parts of a period; each page passes its own words. */
export interface PeriodWords {
  readonly today: string;
  readonly yesterday: string;
  readonly period: string;
  readonly week: string;
  /** "Last 24 hours" — exactly the last day, up to now (what a more-info's history link opens). */
  readonly lastDay: string;
  readonly days: (n: number) => string;
  readonly since: (when: string) => string;
}

export interface PeriodOptions {
  readonly range: ActivityRange;
  readonly now: number;
  readonly language: string;
  readonly words: PeriodWords;
  /** A time of day as the house writes it. */
  readonly time: (ms: number) => string;
  /** The room the eyebrow has, in px (0 or absent: it is not measured, and keeps its fullest wording). */
  readonly room?: number;
  readonly family?: string;
  /** The name of the one entity the page is narrowed to: it heads the period instead of naming it. */
  readonly named?: string | undefined;
}

export interface PeriodTitle {
  /** The small line over the title: what kind of period this is. */
  readonly eyebrow: string;
  readonly title: string;
  /** The title where a phone's line cannot hold it. */
  readonly short: string;
  /** The period is a range of hours, not whole days (its ends carry times). */
  readonly range: boolean;
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The period's name: a day says which one, a week says so, a range of hours says its ends. */
export function describePeriod(o: PeriodOptions): PeriodTitle {
  const { start, end } = o.range;
  const today = dayRange(new Date(o.now));
  const short = (ms: number, month: 'long' | 'short'): string =>
    dayMonth(o.language, ms, month, o.now);
  if (sameRange(o.range, dayRange(new Date(start)))) {
    const title = short(start, 'long');
    const day = dateFormat(o.language, { weekday: 'long' }).format(start);
    // "Today · Thursday", or "Today" alone when the line cannot hold both
    const lead =
      start === today.start
        ? o.words.today
        : start === shiftRange(today, -1).start
          ? o.words.yesterday
          : '';
    const both = `${lead} · ${day}`;
    const eyebrow = !lead
      ? capital(day)
      : !o.room
        ? both
        : firstFit([both, lead], o.room, {
            size: 13,
            weight: 600,
            ...(o.family ? { family: o.family } : {}),
          });
    return { eyebrow: o.named ?? eyebrow, title, short: short(start, 'short'), range: false };
  }
  const last = end - 1;
  const days = Math.round((end - start) / DAY);
  const whole = new Date(start).getHours() === 0 && new Date(end).getHours() === 0;
  // a window whose end is now (or a minute either side of it) is open: one that ends later is not "the last day",
  // it is a window into a future the recorder has nothing for, and it must say so
  const open = Math.abs(end - o.now) <= MINUTE;
  // what a more-info's history link opens: exactly the last day, up to now
  if (open && Math.abs(end - start - DAY) <= MINUTE) {
    const title = o.words.lastDay;
    return { eyebrow: o.named ?? o.words.period, title, short: title, range: false };
  }
  const title = whole
    ? `${short(start, 'short')} – ${short(last, 'short')}`
    : open
      ? o.words.since(`${short(start, 'short')}, ${o.time(start)}`)
      : `${short(start, 'short')} ${o.time(start)} – ${short(last, 'short')} ${o.time(end)}`;
  const eyebrow =
    whole && end === today.end && days === 7
      ? o.words.week
      : whole
        ? o.words.days(days)
        : o.words.period;
  return { eyebrow: o.named ?? eyebrow, title, short: title, range: !whole && !open };
}
