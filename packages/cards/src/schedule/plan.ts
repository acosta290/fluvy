import type { Weekday } from '../shared/dates.js';

/**
 * A heating week as Home Assistant's schedule helper keeps it (`schedule.*`, #229): per weekday, blocks from a time to
 * a time, each with its `data` — `{ preset: comfort }`, which becomes the helper's attributes while the block is on —
 * and nothing between them (the gaps are the plan's base preset, `automation.ts`). Pure: what is read from Home
 * Assistant (a helper's item, `schedule/list` or `schedule/subscribe`; `schedule.get_schedule`'s answer), what the
 * sheet does to it (a block added, moved, removed, a day copied) and what is written back (`helperDays`).
 *
 * A time is minutes since midnight, 0 to 1440 (the day's end, which Home Assistant writes `24:00:00`). A block starts
 * where it starts and ends before its end (Home Assistant's inclusive start, exclusive end); blocks of a day never
 * overlap and never cross midnight.
 */

/** Home Assistant's days as a schedule keys them, Monday first (its `WEEKDAY_TO_CONF`). */
export const DAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** The day's end, in minutes. */
export const DAY_END = 24 * 60;
/** The grid the sheet moves a time on: a quarter of an hour. */
export const STEP = 15;
/** What a block's `data` may hold, as Home Assistant's schema has it (a string, a number, a flag). */
export type Scalar = string | number | boolean;

export interface Block {
  readonly from: number;
  readonly to: number;
  /** The preset the block names (`data.preset`); none in a block written by hand in Home Assistant. */
  readonly preset?: string;
  /** What else its `data` holds, kept as it was read. */
  readonly data?: Readonly<Record<string, Scalar>>;
  /**
   * Its times as Home Assistant wrote them where they hold seconds (a block made by hand there, "06:30:15", or a day
   * that ends "23:59:59"): written back as they were while the block keeps its minute.
   */
  readonly exact?: { readonly from?: string; readonly to?: string };
}

export type Week = Readonly<Record<Weekday, readonly Block[]>>;

/** The key a block's `data` names its preset by: the helper's attribute while the block is on. */
export const PRESET_KEY = 'preset';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** A time as Home Assistant writes one: its hours, its minutes, and its seconds where it has them. */
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/**
 * A time as Home Assistant writes one ('06:30', '06:30:00', '24:00:00', and the day's end as `get_schedule` answers
 * it, '23:59:59.999999'), in whole minutes; seconds are dropped (`exactOf` keeps them). `end`: the time ends a block,
 * so the day's end is one. Nothing for anything else.
 */
export function minutesOf(text: unknown, end = false): number | undefined {
  if (typeof text !== 'string') return undefined;
  const match = TIME.exec(text.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (end && hours === 24 && minutes === 0) return DAY_END;
  if (end && text.trim().startsWith('23:59:59')) return DAY_END;
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/** Minutes as the sheet and the card's words say them: 'HH:MM', the day's end '24:00'. */
export const clockText = (minutes: number): string =>
  `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

/**
 * A time read with seconds ('06:30:15'), as the helper is written ('HH:MM:SS'); nothing for one on the minute, nor for
 * the day's end as `get_schedule` serialises it ('23:59:59.999999', the only time written with a fraction).
 */
function exactOf(text: unknown): string | undefined {
  const match = typeof text === 'string' && !text.includes('.') ? TIME.exec(text.trim()) : null;
  const seconds = match?.[3];
  return match && seconds && seconds !== '00'
    ? `${pad2(Number(match[1]))}:${match[2]}:${seconds}`
    : undefined;
}

/**
 * A block's time as the helper is written: as Home Assistant wrote it while the block keeps that minute (its seconds),
 * else 'HH:MM:00', the day's end '24:00:00'.
 */
function helperTime(block: Block, edge: 'from' | 'to'): string {
  const exact = block.exact?.[edge];
  return exact !== undefined && minutesOf(exact, edge === 'to') === block[edge]
    ? exact
    : `${clockText(block[edge])}:00`;
}

/** A preset's key as a block names it: a string of the person's own, trimmed, never empty, never a control character. */
export const isPresetKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() === value &&
  value.length > 0 &&
  value.length <= 40 &&
  !/\p{Cc}/u.test(value) &&
  !value.includes('{');

/** A block as read: its times, its preset, what else its data holds; nothing where it is not one. */
function blockOf(raw: unknown): Block | undefined {
  if (!isRecord(raw)) return undefined;
  const from = minutesOf(raw['from']);
  const to = minutesOf(raw['to'], true);
  if (from === undefined || to === undefined || to <= from) return undefined;
  const exact = { from: exactOf(raw['from']), to: exactOf(raw['to']) };
  const data = raw['data'];
  if (data !== undefined && !isRecord(data)) return undefined;
  const rest: Record<string, Scalar> = {};
  let preset: string | undefined;
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
      return undefined;
    if (key === PRESET_KEY && isPresetKey(value)) preset = value;
    else rest[key] = value;
  }
  return {
    from,
    to,
    ...(preset !== undefined ? { preset } : {}),
    ...(Object.keys(rest).length ? { data: rest } : {}),
    ...(exact.from || exact.to
      ? {
          exact: {
            ...(exact.from ? { from: exact.from } : {}),
            ...(exact.to ? { to: exact.to } : {}),
          },
        }
      : {}),
  };
}

/** Blocks in the day's order, by their start. */
export const sortDay = (blocks: readonly Block[]): Block[] =>
  [...blocks].sort((a, b) => a.from - b.from || a.to - b.to);

/** A week read from a record keyed by the days (a helper's item, a `get_schedule` answer); nothing where a day is not a list of blocks. */
function weekOf(record: Record<string, unknown>): Week | undefined {
  const week = {} as Record<Weekday, readonly Block[]>;
  for (const day of DAYS) {
    const raw = record[day] ?? [];
    if (!Array.isArray(raw)) return undefined;
    const blocks = raw.map(blockOf);
    if (blocks.some((block) => block === undefined)) return undefined;
    week[day] = sortDay(blocks as Block[]);
  }
  return week;
}

/** A helper as `schedule/list` and `schedule/subscribe` hand it: its id, its name, its icon. */
export interface HelperItem {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly week: Week;
}

/** A helper's item as Home Assistant's collection hands it (`{ id, name, icon?, monday: […], … }`). */
export function helperOf(raw: unknown): HelperItem | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, name, icon } = raw;
  if (typeof id !== 'string' || !id || typeof name !== 'string') return undefined;
  const week = weekOf(raw);
  if (!week) return undefined;
  return { id, name, ...(typeof icon === 'string' && icon ? { icon } : {}), week };
}

/**
 * The week of one schedule from `schedule.get_schedule`'s answer (`{ response: { 'schedule.x': { monday: […] } } }`,
 * or the response alone): any schedule, a YAML one's too, read by anyone.
 */
export function weekOfResponse(answer: unknown, entity: string): Week | undefined {
  const response = isRecord(answer) && isRecord(answer['response']) ? answer['response'] : answer;
  const own = isRecord(response) ? response[entity] : undefined;
  return isRecord(own) ? weekOf(own) : undefined;
}

/* ---------- checking ---------- */

export type DayProblem =
  | { readonly kind: 'time'; readonly block: Block }
  | { readonly kind: 'overlap'; readonly first: Block; readonly second: Block };

/** The first thing wrong with a day's blocks: a time off the day, an end at or before its start, two that overlap. */
export function checkDay(blocks: readonly Block[]): DayProblem | undefined {
  for (const block of blocks)
    if (
      !Number.isInteger(block.from) ||
      !Number.isInteger(block.to) ||
      block.from < 0 ||
      block.to > DAY_END ||
      block.to <= block.from
    )
      return { kind: 'time', block };
  const sorted = sortDay(blocks);
  for (let i = 1; i < sorted.length; i++) {
    const first = sorted[i - 1] as Block;
    const second = sorted[i] as Block;
    if (second.from < first.to) return { kind: 'overlap', first, second };
  }
  return undefined;
}

/** The first day with something wrong, and what. */
export function checkWeek(
  week: Week,
): { readonly day: Weekday; readonly problem: DayProblem } | undefined {
  for (const day of DAYS) {
    const problem = checkDay(week[day]);
    if (problem) return { day, problem };
  }
  return undefined;
}

/* ---------- editing ---------- */

/** A week with one day's blocks replaced (kept in order). */
export const withDay = (week: Week, day: Weekday, blocks: readonly Block[]): Week => ({
  ...week,
  [day]: sortDay(blocks),
});

/** How long a block the sheet adds is, where the day has room for it: two hours. */
const NEW_SPAN = 120;

/**
 * The block "Add" puts on a day: two hours in the first gap from 06:00 that holds them (the day's first free stretch
 * from its morning on), else the longest gap the day has left, else none (the day is full).
 */
export function newBlock(blocks: readonly Block[], preset: string): Block | undefined {
  const sorted = sortDay(blocks);
  const gaps: Array<readonly [number, number]> = [];
  let at = 0;
  for (const block of sorted) {
    if (block.from > at) gaps.push([at, block.from]);
    at = Math.max(at, block.to);
  }
  if (at < DAY_END) gaps.push([at, DAY_END]);
  const morning = 6 * 60;
  for (const [start, end] of gaps) {
    const from = Math.max(start, morning);
    if (end - from >= NEW_SPAN) return { from, to: from + NEW_SPAN, preset };
  }
  const longest = gaps.reduce<readonly [number, number] | undefined>(
    (best, gap) => (!best || gap[1] - gap[0] > best[1] - best[0] ? gap : best),
    undefined,
  );
  if (!longest || longest[1] - longest[0] < STEP) return undefined;
  return { from: longest[0], to: longest[1], preset };
}

/** The week with `from`'s blocks copied onto each of `to` (their own blocks replaced). */
export function copyDay(week: Week, from: Weekday, to: readonly Weekday[]): Week {
  const blocks = week[from];
  return DAYS.reduce<Week>(
    (copy, day) => (day !== from && to.includes(day) ? withDay(copy, day, blocks) : copy),
    week,
  );
}

/** Every block that named one preset names another (a preset renamed, or removed for the base). */
export const renamePreset = (week: Week, from: string, to: string): Week =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      week[day].map((block) => (block.preset === from ? { ...block, preset: to } : block)),
    ]),
  ) as unknown as Week;

/** Whether any block of the week names that preset. */
export const usesPreset = (week: Week, preset: string): boolean =>
  DAYS.some((day) => week[day].some((block) => block.preset === preset));

/** An empty week. */
export const EMPTY_WEEK: Week = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as Week;

/**
 * The week "Create a schedule" starts with: on workdays 06:30–08:30 and 17:00–22:30, on the weekend 08:00–23:00,
 * each in `preset` (Comfort); the rest of the time the base preset (Eco).
 */
export function startWeek(preset: string): Week {
  const workday: readonly Block[] = [
    { from: 6 * 60 + 30, to: 8 * 60 + 30, preset },
    { from: 17 * 60, to: 22 * 60 + 30, preset },
  ];
  const weekend: readonly Block[] = [{ from: 8 * 60, to: 23 * 60, preset }];
  return Object.fromEntries(
    DAYS.map((day) => [day, day === 'saturday' || day === 'sunday' ? weekend : workday]),
  ) as unknown as Week;
}

/** The block on at a minute of a day (its start included, its end not), as Home Assistant's helper reads it. */
export const blockAt = (week: Week, day: Weekday, minute: number): Block | undefined =>
  week[day].find((block) => block.from <= minute && minute < block.to);

/** A change of the preset in force: the preset it changes to (none: the gaps'), how many days on, at what minute. */
export interface Change {
  readonly preset: string | undefined;
  readonly days: number;
  readonly minute: number;
}

/**
 * The next time the preset in force changes after `minute` of `day`: the first start or end of a block, today's
 * still to come and then each day's of the week ahead, where what is on after it is not what is on now — a block's
 * preset as `inForce` reads it (the plan's: a block naming none, or one the plan has not, is the base's), the gaps'
 * as it reads none. A block ending at midnight that the next day's carries on is no change. None where the week never
 * changes it.
 */
export function nextChange(
  week: Week,
  day: Weekday,
  minute: number,
  inForce: (preset: string | undefined) => string | undefined = (preset) => preset,
): Change | undefined {
  const first = DAYS.indexOf(day);
  const at = (offset: number, edge: number): string | undefined => {
    const later = offset + Math.floor(edge / DAY_END);
    return inForce(blockAt(week, DAYS[(first + later) % 7] as Weekday, edge % DAY_END)?.preset);
  };
  const now = at(0, minute);
  // a week on, today's edges before the minute come round again
  for (let offset = 0; offset <= 7; offset++) {
    const edges = week[DAYS[(first + offset) % 7] as Weekday]
      .flatMap((block) => [block.from, block.to])
      .filter((edge) => offset > 0 || edge > minute)
      .sort((a, b) => a - b);
    for (const edge of edges) {
      const preset = at(offset, edge);
      if (preset !== now)
        return { preset, days: offset + Math.floor(edge / DAY_END), minute: edge % DAY_END };
    }
  }
  return undefined;
}

/* ---------- writing ---------- */

/** One block as the helper is written: its times with their seconds (a hand-made one's kept), its data with its preset. */
export interface HelperBlock {
  readonly from: string;
  readonly to: string;
  readonly data?: Readonly<Record<string, Scalar>>;
}

/** The days as `schedule/create` and `schedule/update` take them: every day, its blocks in order. */
export function helperDays(week: Week): Record<Weekday, HelperBlock[]> {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      sortDay(week[day]).map((block) => {
        const data = {
          ...block.data,
          ...(block.preset !== undefined ? { [PRESET_KEY]: block.preset } : {}),
        };
        return {
          from: helperTime(block, 'from'),
          to: helperTime(block, 'to'),
          ...(Object.keys(data).length ? { data } : {}),
        };
      }),
    ]),
  ) as Record<Weekday, HelperBlock[]>;
}

/** Whether two weeks say the same: every day's blocks, their times, presets and data. */
export const sameWeek = (a: Week, b: Week): boolean =>
  JSON.stringify(helperDays(a)) === JSON.stringify(helperDays(b));
