import { addDays, dayKey, floorMinute, startOfDay } from '../shared/dates.js';
import type { CalEvent, Fetched } from './events.js';

/** The part of an event that falls on one day — what a row, a block or a dot is drawn from. */
export interface DayEvent {
  readonly event: CalEvent;
  /** Clipped to the day's two midnights. */
  readonly from: Date;
  readonly to: Date;
  /** It owns the whole day: a date-only event, or a span that runs through both midnights. Reads "All day". */
  readonly whole: boolean;
  /** No duration (a reminder): it has a start and nothing else to say. */
  readonly instant: boolean;
  /** Over at `now`. */
  readonly past: boolean;
}

/** All-day first, then by start; ties by title so the order never flickers between reads. */
function inDayOrder(a: DayEvent, b: DayEvent): number {
  if (a.whole !== b.whole) return a.whole ? -1 : 1;
  return (
    a.from.getTime() - b.from.getTime() ||
    a.to.getTime() - b.to.getTime() ||
    a.event.summary.localeCompare(b.event.summary)
  );
}

/**
 * The ONE table of events behind every view. The month's dots, the week's count, the "left" badge,
 * the Tomorrow row, the timeline's blocks, the upcoming list and both tiles all ask this object the
 * same questions about the same data at the same instant — so no two views can disagree.
 */
export class Agenda {
  /** The minute being shown: seconds are dropped, so "In 13 min" and "Now 21:47" agree with each other. */
  readonly now: Date;
  readonly today: Date;
  private readonly events: readonly CalEvent[];
  private readonly from: number;
  private readonly to: number;
  private readonly days = new Map<number, readonly DayEvent[]>();

  constructor(loaded: Fetched | undefined, now: Date) {
    this.now = floorMinute(now);
    this.today = startOfDay(now);
    this.events = loaded?.events ?? [];
    this.from = loaded ? loaded.start.getTime() : NaN;
    this.to = loaded ? loaded.end.getTime() : NaN;
  }

  /** Whether the window that was read holds `day` whole — outside it, "no events" would be a guess. */
  covers(day: Date): boolean {
    return startOfDay(day).getTime() >= this.from && addDays(day, 1).getTime() <= this.to;
  }

  /** Every event that touches `day`, in the order a day is listed: a multi-day event is on each day it covers. */
  on(day: Date): readonly DayEvent[] {
    const key = dayKey(day);
    const known = this.days.get(key);
    if (known) return known;
    const start = startOfDay(day).getTime();
    const end = addDays(day, 1).getTime();
    const now = this.now.getTime();
    const list: DayEvent[] = [];
    for (const event of this.events) {
      const from = event.start.getTime();
      const to = event.end.getTime();
      const instant = to === from;
      if (from >= end || (instant ? from < start : to <= start)) continue;
      const clippedFrom = Math.max(from, start);
      const clippedTo = Math.min(to, end);
      list.push({
        event,
        from: new Date(clippedFrom),
        to: new Date(clippedTo),
        whole: event.allDay || (clippedFrom === start && clippedTo === end),
        instant,
        past: clippedTo <= now,
      });
    }
    list.sort(inDayOrder);
    this.days.set(key, list);
    return list;
  }

  count(day: Date): number {
    return this.on(day).length;
  }

  /** Events of `day` that are not over yet. */
  left(day: Date = this.today): number {
    return this.on(day).filter((item) => !item.past).length;
  }

  /** Events of the `count` days from `first`, day by day, empty days skipped. */
  span(first: Date, count: number): Array<{ readonly day: Date; readonly item: DayEvent }> {
    const rows: Array<{ day: Date; item: DayEvent }> = [];
    for (let index = 0; index < count; index++) {
      const day = addDays(first, index);
      for (const item of this.on(day)) rows.push({ day, item });
    }
    return rows;
  }

  /** The next thing to start: the first event that begins after now, looking `days` ahead. */
  next(days: number): { readonly day: Date; readonly item: DayEvent } | null {
    const now = this.now.getTime();
    let best: { day: Date; item: DayEvent } | null = null;
    for (const row of this.span(this.today, days)) {
      const starts = row.item.event.start.getTime();
      // an event is "next" on the day it starts, not on the later days it runs through
      if (starts <= now || starts !== row.item.from.getTime()) continue;
      if (!best || starts < best.item.event.start.getTime()) best = row;
    }
    return best;
  }
}
