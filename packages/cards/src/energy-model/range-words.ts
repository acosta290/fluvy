import {
  dateFormat,
  houseZone,
  localize,
  strings,
  wallClock,
  type HomeAssistant,
} from '@fluvy/core';
import type { Range } from './period.js';

const p = strings('energy-period');

/**
 * A range in words, as a card following a date picker heads itself: "Today", "Yesterday", "24 Oct", "17 – 23 Sep",
 * "September", "2026", "17 Sep – 3 Oct" — on the house's clock, in its language, the year said only when it is not
 * this one. The end is the last day's last moment (23:59:59.999, as Home Assistant sets it) or a midnight: either way
 * the last day is the one the moment before it falls on.
 */
export function rangeWords(hass: HomeAssistant | undefined, range: Range, now: Date): string {
  const zone = houseZone(hass);
  const language = hass?.language ?? 'en';
  const end = new Date((range.end ?? now).getTime() - 1);
  const first = wallClock(range.start, zone);
  const last = wallClock(end, zone);
  const today = wallClock(now, zone);
  const dayOf = (c: { year: number; month: number; day: number }): number =>
    Date.UTC(c.year, c.month - 1, c.day);
  const year: Intl.DateTimeFormatOptions =
    first.year === today.year && last.year === today.year ? {} : { year: 'numeric' };
  const words = (options: Intl.DateTimeFormatOptions, span = false): string => {
    const format = dateFormat(language, {
      ...options,
      ...year,
      ...(zone ? { timeZone: zone } : {}),
    });
    if (!span) return format.format(range.start);
    return typeof format.formatRange === 'function'
      ? format.formatRange(range.start, end)
      : `${format.format(range.start)} – ${format.format(end)}`;
  };
  if (dayOf(first) === dayOf(last)) {
    if (dayOf(first) === dayOf(today)) return localize(hass, 'common.today');
    if (dayOf(first) === dayOf(today) - 86_400_000) return p(hass, 'yesterday');
    return words({ day: 'numeric', month: 'short' });
  }
  const lastOfMonth = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate() === last.day;
  if (first.day === 1 && lastOfMonth) {
    if (first.year === last.year && first.month === 1 && last.month === 12)
      return String(first.year);
    if (first.year === last.year && first.month === last.month) return words({ month: 'long' });
    return words({ month: 'short' }, true);
  }
  return words({ day: 'numeric', month: 'short' }, true);
}
