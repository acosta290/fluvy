import type { ActivityEvent } from './types.js';

/** An entry with the state it changed from (the same entity's previous entry in the whole range). */
export interface ActivityItem {
  readonly event: ActivityEvent;
  readonly from?: string;
  /** Stable for the life of the entry (a row keeps its expanded state across live updates). */
  readonly key: string;
}

/** A row of the timeline: one entry, a burst of many, or one device changing again and again. */
export type ActivityRow =
  | {
      readonly kind: 'event';
      readonly key: string;
      readonly when: number;
      readonly item: ActivityItem;
    }
  | {
      readonly kind: 'burst';
      readonly key: string;
      readonly when: number;
      /** Newest first. */
      readonly items: readonly ActivityItem[];
      /**
       * A restart of Home Assistant: its stop, its start (`when`) and the entities it took down and brought back.
       * A burst without it is a storm of entries (a burst Home Assistant only stopped in also reads as a restart).
       */
      readonly restart: boolean;
    }
  | {
      readonly kind: 'repeat';
      readonly key: string;
      readonly when: number;
      readonly entityId: string;
      readonly items: readonly ActivityItem[];
    };

/** An hour of the timeline, newest first. */
export interface ActivitySection {
  /** The hour's start (ms). */
  readonly start: number;
  /** Entries in the hour (a burst counts all of its). */
  readonly count: number;
  readonly rows: readonly ActivityRow[];
}

/** Entries at most this far apart belong to one burst… */
const BURST_GAP = 20;
/** …of at least this many. */
const BURST_MIN = 25;
/** A device changing at least this many times in a row, within an hour, reads as one row. */
const REPEAT_MIN = 3;
const REPEAT_SPAN = 3600;

export const eventKey = (event: ActivityEvent): string =>
  `${event.when}|${event.entity_id ?? ''}|${event.state ?? ''}|${event.message ?? ''}|${event.name ?? ''}`;

/**
 * Each entry with the state before it. `events` is newest first (as the stream keeps it); the previous state of an
 * entity is its next older entry.
 */
export function withPrevious(events: readonly ActivityEvent[]): ActivityItem[] {
  const last = new Map<string, string>();
  const items: ActivityItem[] = new Array(events.length);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    const id = event.entity_id;
    const from = id && event.state !== undefined ? last.get(id) : undefined;
    if (id && event.state !== undefined) last.set(id, event.state);
    items[i] = { event, key: eventKey(event), ...(from !== undefined ? { from } : {}) };
  }
  return items;
}

/** After Home Assistant starts, its entities come back over minutes (seen: up to eight, in gaps of a minute and more). */
const SETTLE = 600;
/** A start with no stop before it (a crash, or the stop outside the period): its boot is the minute before it. */
const BOOT = 60;
const GONE = new Set(['unknown', 'unavailable']);

const isHome = (item: ActivityItem, message: RegExp): boolean =>
  (item.event.domain ?? '') === 'homeassistant' && message.test(item.event.message ?? '');

/** Nobody did it: no person, no automation or script, no other entity behind it. */
const unattended = (event: ActivityEvent): boolean =>
  !event.context_user_id && !event.context_entity_id && !event.context_event_type;

/**
 * The restarts in a newest-first list: each gathers its stop, what was written while Home Assistant was down, its
 * start, and the entities coming back after it (from `unknown` / `unavailable`, or going there) within SETTLE —
 * never what a person or an automation did meanwhile. A later restart claims first.
 */
function restarts(items: readonly ActivityItem[]): Map<ActivityItem, number> {
  const group = new Map<ActivityItem, number>();
  items.forEach((start, s) => {
    if (!isHome(start, /start/i) || group.has(start)) return;
    const from = start.event.when;
    let stop: number | undefined;
    for (let k = s + 1; k < items.length && from - items[k]!.event.when <= SETTLE; k += 1)
      if (isHome(items[k]!, /stop/i)) {
        stop = items[k]!.event.when;
        break;
      }
    // coming back (or going): from `unknown` / `unavailable`, a first entry, or into them — and nobody did it
    const settling = (item: ActivityItem): boolean =>
      unattended(item.event) &&
      (GONE.has(item.from ?? 'unknown') || GONE.has(item.event.state ?? ''));
    items.forEach((item, k) => {
      if (group.has(item)) return;
      const when = item.event.when;
      // while Home Assistant was down, everything written is its own
      const down =
        stop !== undefined
          ? when >= stop && when <= from
          : when >= from - BOOT && when <= from && settling(item);
      const back = when > from && when - from <= SETTLE && settling(item);
      if (k === s || down || back) group.set(item, s);
    });
  });
  return group;
}

/** Newest-first entries as rows: restarts first, then bursts (they swallow everything in them), then repeats. */
export function toRows(items: readonly ActivityItem[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const restart = restarts(items);
  // a restart whose only entries are Home Assistant's own (the rest filtered out) is not a group: its entries stay rows
  const gathering = new Map<number, number>();
  for (const [item, start] of restart)
    if ((item.event.domain ?? '') !== 'homeassistant')
      gathering.set(start, (gathering.get(start) ?? 0) + 1);
  for (const [item, start] of [...restart]) if (!gathering.get(start)) restart.delete(item);
  const gathered = new Map<number, ActivityItem[]>();
  for (const [item, start] of restart) {
    const list = gathered.get(start);
    if (list) list.push(item);
    else gathered.set(start, [item]);
  }
  let i = 0;
  while (i < items.length) {
    const own = restart.get(items[i]!);
    if (own !== undefined) {
      // a restart sits at the moment Home Assistant started, holding everything it gathered around it
      if (own === i)
        rows.push({
          kind: 'burst',
          key: `restart|${items[own]!.key}`,
          when: items[own]!.event.when,
          items: gathered.get(own)!.sort((a, b) => b.event.when - a.event.when),
          restart: true,
        });
      i += 1;
      continue;
    }
    // a burst: a run of entries each within BURST_GAP of the next
    let j = i + 1;
    while (
      j < items.length &&
      !restart.has(items[j]!) &&
      items[j - 1]!.event.when - items[j]!.event.when <= BURST_GAP
    )
      j += 1;
    if (j - i >= BURST_MIN) {
      const run = items.slice(i, j);
      rows.push({
        kind: 'burst',
        key: `burst|${run[run.length - 1]!.key}`,
        when: run[0]!.event.when,
        items: run,
        restart: run.some((item) => (item.event.domain ?? '') === 'homeassistant'),
      });
      i = j;
      continue;
    }
    // a repeat: the same entity, entry after entry
    const id = items[i]!.event.entity_id;
    let k = i + 1;
    while (
      id &&
      k < items.length &&
      !restart.has(items[k]!) &&
      items[k]!.event.entity_id === id &&
      items[i]!.event.when - items[k]!.event.when <= REPEAT_SPAN
    )
      k += 1;
    if (id && k - i >= REPEAT_MIN) {
      const run = items.slice(i, k);
      rows.push({
        kind: 'repeat',
        key: `repeat|${run[run.length - 1]!.key}`,
        when: run[0]!.event.when,
        entityId: id,
        items: run,
      });
      i = k;
      continue;
    }
    const item = items[i]!;
    rows.push({ kind: 'event', key: item.key, when: item.event.when, item });
    i += 1;
  }
  return rows;
}

/** Rows by the local hour they start in, newest first. */
export function toSections(rows: readonly ActivityRow[]): ActivitySection[] {
  const sections: { start: number; count: number; rows: ActivityRow[] }[] = [];
  for (const row of rows) {
    const date = new Date(row.when * 1000);
    date.setMinutes(0, 0, 0);
    const start = date.getTime();
    let section = sections[sections.length - 1];
    if (!section || section.start !== start) {
      section = { start, count: 0, rows: [] };
      sections.push(section);
    }
    section.rows.push(row);
    section.count += row.kind === 'event' ? 1 : row.items.length;
  }
  return sections;
}

/** Entries per bucket of `bucket` ms over [start, end), oldest bucket first. */
export function density(
  events: readonly ActivityEvent[],
  start: number,
  end: number,
  bucket = 15 * 60 * 1000,
): number[] {
  const count = Math.max(1, Math.ceil((end - start) / bucket));
  const buckets = new Array<number>(count).fill(0);
  for (const event of events) {
    const index = Math.floor((event.when * 1000 - start) / bucket);
    if (index >= 0 && index < count) buckets[index]! += 1;
  }
  return buckets;
}
