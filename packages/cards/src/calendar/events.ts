import type { HomeAssistant } from '@fluvy/core';
import { addDays } from '../shared/dates.js';

/**
 * Reading calendars. Home Assistant serves events over REST, one calendar at a time:
 * `GET calendars/<entity_id>?start=…&end=…`. Answers are cached per calendar and window for five
 * minutes and shared by every calendar card on the page, so an agenda, a month and a timeline of the
 * same calendars cost one read between them.
 */

/** What the endpoint answers with. Nothing in it is guaranteed. */
export interface RawEvent {
  readonly summary?: string | null;
  readonly start?: RawEdge | null;
  readonly end?: RawEdge | null;
  readonly location?: string | null;
  readonly description?: string | null;
  readonly uid?: string | null;
  readonly recurrence_id?: string | null;
}

interface RawEdge {
  readonly dateTime?: string | null;
  readonly date?: string | null;
}

export interface CalEvent {
  /** The `calendar.*` entity it came from. */
  readonly calendar: string;
  readonly summary: string;
  readonly location: string;
  readonly start: Date;
  /** Exclusive. An all-day event ends on the local midnight after its last day. */
  readonly end: Date;
  /** A date-only event: it owns whole days, not a span of hours. */
  readonly allDay: boolean;
}

/* ---------- normalising ---------- */

/** `2026-09-19` is LOCAL midnight: `new Date('2026-09-19')` would be UTC and land a day early west of Greenwich. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEdge(edge: RawEdge | null | undefined): { date: Date; allDay: boolean } | null {
  if (typeof edge?.dateTime === 'string') {
    const date = new Date(edge.dateTime);
    return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
  }
  if (typeof edge?.date === 'string') {
    const date = parseDateOnly(edge.date);
    return date ? { date, allDay: true } : null;
  }
  return null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Events the card can draw: anything without a readable start is dropped, never guessed. */
export function toEvents(calendar: string, raw: unknown): CalEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: CalEvent[] = [];
  for (const item of raw as ReadonlyArray<RawEvent | null>) {
    const from = parseEdge(item?.start);
    if (!item || !from) continue;
    const to = parseEdge(item.end);
    // the all-day end date is exclusive already; a missing or backwards end makes a one-day / zero-length event
    const end =
      to && to.date.getTime() > from.date.getTime()
        ? to.date
        : from.allDay
          ? addDays(from.date, 1)
          : from.date;
    events.push({
      calendar,
      summary: text(item.summary),
      location: text(item.location),
      start: from.date,
      end,
      allDay: from.allDay,
    });
  }
  return events;
}

/* ---------- reading ---------- */

interface Entry {
  readonly start: number;
  readonly end: number;
  readonly at: number;
  /** The calendar's `last_updated` when the read was made: a calendar that changed is read again. */
  readonly stamp: string;
  readonly events: Promise<readonly CalEvent[]>;
}

const TTL = 5 * 60_000;
const MAX_WINDOWS = 8; // per calendar
const cache = new Map<string, Entry[]>();

export const stampOf = (hass: HomeAssistant, id: string): string =>
  hass.states[id]?.last_updated ?? '';

function readCalendar(
  hass: HomeAssistant,
  id: string,
  start: Date,
  end: Date,
): Promise<readonly CalEvent[]> {
  const now = Date.now();
  const stamp = stampOf(hass, id);
  const entries = (cache.get(id) ?? []).filter(
    (entry) => entry.stamp === stamp && now - entry.at < TTL,
  );
  // a fresh read of a wider window answers a narrower one: the views ask by day, so more is never wrong
  const hit = entries.find((entry) => entry.start <= start.getTime() && entry.end >= end.getTime());
  if (hit) return hit.events;

  const path = `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const events = (async (): Promise<readonly CalEvent[]> =>
    toEvents(id, await hass.callApi<unknown>('GET', path)))();
  const entry: Entry = { start: start.getTime(), end: end.getTime(), at: now, stamp, events };
  cache.set(id, [...entries, entry].slice(-MAX_WINDOWS));
  // a failed read is not an answer: forget it, so the next attempt asks again
  events.catch(() =>
    cache.set(
      id,
      (cache.get(id) ?? []).filter((other) => other !== entry),
    ),
  );
  return events;
}

export interface Fetched {
  readonly events: readonly CalEvent[];
  /** Calendars whose read failed; the others are still in `events`. */
  readonly failed: readonly string[];
  readonly start: Date;
  readonly end: Date;
}

/** One window, every calendar. A calendar that cannot be read never takes the others down with it. */
export async function fetchEvents(
  hass: HomeAssistant,
  ids: readonly string[],
  start: Date,
  end: Date,
): Promise<Fetched> {
  const events: CalEvent[] = [];
  const failed: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        events.push(...(await readCalendar(hass, id, start, end)));
      } catch {
        failed.push(id);
      }
    }),
  );
  return { events, failed, start, end };
}
