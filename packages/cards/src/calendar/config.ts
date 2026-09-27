import type { FluvyCardConfig } from '@fluvy/core';
import type { FirstWeekday } from '../shared/dates.js';

export const VIEWS = [
  'agenda',
  'month',
  'week',
  'month-day',
  'timeline',
  'upcoming',
  'tile',
] as const;
export type CalendarView = (typeof VIEWS)[number];

/**
 * The tones a calendar may take, in the order they are handed out. The accent is not among them and
 * never will be: on a calendar the accent means today, the selection, now and the primary action.
 */
export const CALENDAR_TONES = [
  'cool',
  'heat',
  'water',
  'media',
  'grid',
  'fan',
  'dry',
  'solar',
] as const;
export type CalendarTone = (typeof CALENDAR_TONES)[number];

export interface CalendarCardConfig extends FluvyCardConfig {
  /** One or more `calendar.*` entities. */
  entities: readonly string[];
  view?: CalendarView;
  /** Which of the two tiles the `tile` view draws. */
  tile?: 'date' | 'next';
  title?: string;
  /** entity id → tone. Calendars without one take the tones in order; anything else (the accent included) is ignored. */
  tones?: Readonly<Record<string, string>>;
  first_weekday?: FirstWeekday;
  /** `upcoming`: how many days ahead (default 7). */
  days?: number;
  /** `timeline`: the hours drawn (default 8 – 23), widened when the day's events need it. */
  start_hour?: number;
  end_hour?: number;
  /** Test hook: an ISO instant that freezes "now", so a render can be held against the design sheet. */
  _now?: string;
  /** Test hook: an ISO date picked as if tapped (a sheet shows the selected day apart from today). */
  _picked?: string;
}

export const viewOf = (config: CalendarCardConfig | undefined): CalendarView =>
  config?.view && VIEWS.includes(config.view) ? config.view : 'agenda';

const whole = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export const daysOf = (config: CalendarCardConfig | undefined): number =>
  whole(config?.days ?? 7, 7, 1, 31);

/** The configured timeline hours, always a window of at least one hour inside 0 – 24. */
export function hoursOf(config: CalendarCardConfig | undefined): {
  readonly start: number;
  readonly end: number;
} {
  const start = whole(config?.start_hour ?? 8, 8, 0, 23);
  const end = whole(config?.end_hour ?? 23, 23, 1, 24);
  return { start, end: Math.max(start + 1, end) };
}

export function toneOf(config: CalendarCardConfig | undefined, entityId: string): CalendarTone {
  const configured = config?.tones?.[entityId];
  const known = CALENDAR_TONES.find((tone) => tone === configured);
  if (known) return known;
  const index = Math.max(0, config?.entities.indexOf(entityId) ?? 0);
  return CALENDAR_TONES[index % CALENDAR_TONES.length] ?? 'cool';
}
