/*
 * A time series a sensor holds in its attributes, read as the integrations write one: a list of entries with a start
 * (and an end) and a value — Nordpool's `raw_today` and `raw_tomorrow` (`{start, end, value}`), ENTSO-E's `prices`
 * (`{time, price}`), Frank Energie's (`{from, till, price}`), Solcast's `detailedForecast` (`{period_start,
 * pv_estimate, pv_estimate10, pv_estimate90}`) — a map of moments to values (Tibber's `prices`, a solar forecast's
 * `watts`), or a plain list of a day's values (Nordpool's `today`: 24 hours, or 96 quarters). The keys are found by
 * their usual names or named by the card (`time_key`, `value_key`); quarters stay quarters, a negative price stays
 * negative, and an empty tomorrow (not published yet) is simply nothing more. Pure, so the card and its tests share it.
 */

/** A reading at `t` (ms), held until `end` where the list says (a price's hour), with its low and high where it has them. */
export interface Reading {
  readonly t: number;
  readonly v: number;
  readonly end?: number;
  readonly low?: number;
  readonly high?: number;
}

/** The keys a card names, where the usual ones are not the list's. */
export interface ListKeys {
  readonly time_key?: string | undefined;
  readonly value_key?: string | undefined;
}

/** The day a plain list of values covers: its start and its length (a day of 23 or 25 hours keeps its own). */
export interface Day {
  readonly start: number;
  readonly length: number;
}

/** The keys an entry's moment goes by, its end's, and its value's, in the order they are tried. */
const TIME_KEYS = [
  'start',
  'startsAt',
  'start_time',
  'from',
  'time',
  'period_start',
  'datetime',
  'date',
  'timestamp',
  'hour',
];
const END_KEYS = ['end', 'endsAt', 'end_time', 'till', 'to', 'period_end'];
const VALUE_KEYS = [
  'value',
  'price',
  'total',
  'pv_estimate',
  'temperature',
  'energy',
  'power',
  'watts',
  'wh',
  'amount',
];
/** The pairs an entry's low and high go by (a day's range, a forecast's, Solcast's tenth and ninetieth percentiles). */
const BANDS: ReadonlyArray<readonly [low: string, high: string]> = [
  ['min', 'max'],
  ['low', 'high'],
  ['templow', 'temperature'],
  ['pv_estimate10', 'pv_estimate90'],
];

/** The attributes tried first where the card names none, in order: the price and forecast lists of the usual integrations. */
const PREFERRED = [
  'raw_today',
  'prices_today',
  'today',
  'prices',
  'forecast',
  'detailedForecast',
  'detailedHourly',
  'watts',
  'wh_period',
];

const DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;

/** A moment as integrations write one: an ISO date (and time), or a Unix time in seconds or milliseconds. */
export function momentOf(raw: unknown): number | null {
  // a number is a moment from 2001 on (an hour's 13 is not one): in seconds, or in milliseconds past them
  if (typeof raw === 'number')
    return Number.isFinite(raw) && raw >= 1e9 ? (raw < 1e11 ? raw * 1000 : raw) : null;
  if (typeof raw !== 'string' || !DATE.test(raw.trim())) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? t : null;
}

/** A value as integrations write one: a number, or a number written as text ("0.123"); nothing else. */
export function numberOf(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || !/\d/.test(raw)) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

type Entry = Readonly<Record<string, unknown>>;

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The first key of `keys` an entry holds with a value `read` can read. */
const keyOf = (
  entry: Entry,
  keys: readonly string[],
  read: (raw: unknown) => number | null,
): string | undefined => keys.find((key) => read(entry[key]) !== null);

/** The value key of an entry: the one named, else the usual ones, else the first number that is not a moment. */
const valueKeyOf = (entry: Entry, named: string | undefined, skip: ReadonlySet<string>) =>
  named ??
  keyOf(entry, VALUE_KEYS, numberOf) ??
  Object.keys(entry).find((key) => !skip.has(key) && numberOf(entry[key]) !== null);

/** A list of entries, each read by the keys the first one goes by (or the card names). */
function entries(list: readonly Entry[], keys: ListKeys): Reading[] {
  const first = list.find(isEntry);
  if (!first) return [];
  const time = keys.time_key ?? keyOf(first, TIME_KEYS, momentOf);
  if (!time) return [];
  const end = keyOf(first, END_KEYS, momentOf);
  const value = valueKeyOf(first, keys.value_key, new Set([time, ...(end ? [end] : [])]));
  if (!value) return [];
  const band = BANDS.find(
    ([low, high]) =>
      low !== value && numberOf(first[low]) !== null && numberOf(first[high]) !== null,
  );
  const out: Reading[] = [];
  for (const entry of list) {
    if (!isEntry(entry)) continue;
    const t = momentOf(entry[time]);
    const v = numberOf(entry[value]);
    if (t === null || v === null) continue;
    const until = end ? momentOf(entry[end]) : null;
    const low = band ? numberOf(entry[band[0]]) : null;
    const high = band ? numberOf(entry[band[1]]) : null;
    out.push({
      t,
      v,
      ...(until !== null && until > t ? { end: until } : {}),
      ...(low !== null && high !== null ? { low, high } : {}),
    });
  }
  return out;
}

/** The fewest values a plain list holds to be a day's (two hours each): a colour's three numbers are not one. */
const DAY_VALUES = 12;

/** A day's plain values, spread evenly across it from its midnight: 24 hours, 96 quarters, any count. */
function spread(values: readonly unknown[], day: Day): Reading[] {
  const step = day.length / values.length;
  const out: Reading[] = [];
  values.forEach((raw, i) => {
    const v = numberOf(raw);
    const t = day.start + i * step;
    if (v !== null) out.push({ t, v, end: t + step });
  });
  return out;
}

/**
 * A list as readings, oldest first: entries with a moment and a value, a map of moments to values (or to entries),
 * or — with the day it covers — a plain list of numbers. Anything else reads nothing.
 */
export function readList(raw: unknown, keys: ListKeys = {}, day?: Day): Reading[] {
  let out: Reading[] = [];
  if (Array.isArray(raw)) {
    if (raw.some(isEntry)) out = entries(raw as Entry[], keys);
    else if (
      day &&
      raw.length >= DAY_VALUES &&
      raw.every((v) => v === null || numberOf(v) !== null)
    )
      out = spread(raw, day);
  } else if (isEntry(raw)) {
    for (const [moment, value] of Object.entries(raw)) {
      const t = momentOf(moment);
      const v = isEntry(value)
        ? numberOf(value[valueKeyOf(value, keys.value_key, new Set()) ?? ''])
        : numberOf(value);
      if (t !== null && v !== null) out.push({ t, v });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The attribute that holds tomorrow beside one that holds today (`raw_today` → `raw_tomorrow`), if it says today. */
const tomorrowOf = (name: string): string | undefined =>
  /today/i.test(name)
    ? name.replace(/today/, 'tomorrow').replace(/Today/, 'Tomorrow').replace(/TODAY/, 'TOMORROW')
    : undefined;

/** Two days' readings as one: the later list's own moments win where both say one. */
function merged(first: readonly Reading[], second: readonly Reading[]): Reading[] {
  const after = first.length ? (first[first.length - 1] as Reading).t : -Infinity;
  return [...first, ...second.filter((reading) => reading.t > after)];
}

/**
 * A sensor's series in its attributes: the one named (with its tomorrow where it says today: Nordpool's `raw_today`
 * reads `raw_tomorrow` after it), or — none named — the usual ones of the price and forecast integrations, else the
 * first attribute that reads as one. Its name and its readings; a plain list counts from `today`, tomorrow's from the
 * day after.
 */
export function attributeSeries(
  attributes: Readonly<Record<string, unknown>>,
  name: string | undefined,
  keys: ListKeys,
  today: Day,
  tomorrow: Day,
): { readonly name: string; readonly readings: Reading[] } {
  const read = (attribute: string): Reading[] => {
    const own = readList(attributes[attribute], keys, today);
    const twin = tomorrowOf(attribute);
    return twin && twin in attributes
      ? merged(own, readList(attributes[twin], keys, tomorrow))
      : own;
  };
  if (name) return { name, readings: read(name) };
  const found =
    PREFERRED.find((usual) => usual in attributes && read(usual).length > 1) ??
    timedAttributes(attributes, today)[0];
  return found ? { name: found, readings: read(found) } : { name: '', readings: [] };
}

/** Any day, for a plain list read only to know whether it is one. */
const ANY_DAY: Day = { start: 0, length: 86_400_000 };

/**
 * The usual list an entity's attributes hold, where it holds one (Nordpool's `raw_today`, Solcast's
 * `detailedForecast` …): what makes a sensor named alone read from its attributes, not its history.
 */
export const usualList = (attributes: Readonly<Record<string, unknown>>): string | undefined =>
  PREFERRED.find(
    (usual) => usual in attributes && readList(attributes[usual], {}, ANY_DAY).length > 1,
  );

/** The attributes that read as a series (what the editor offers): two readings or more. */
export function timedAttributes(attributes: Readonly<Record<string, unknown>>, day: Day): string[] {
  return Object.keys(attributes).filter((name) => readList(attributes[name], {}, day).length > 1);
}
