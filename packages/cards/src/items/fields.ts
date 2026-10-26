import {
  formatDate,
  formatNumber,
  formatTime,
  localize,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import { sameDay } from '../shared/dates.js';
import { fitLine, type TextRuler } from '../shared/fit.js';

/*
 * The items of a list and the fields a card reads off them, without the card: an item is an object of the sensor's
 * list attribute (or of the template's list), read by dot paths; a field is a pattern — a path, or words with
 * `{path}` in them — resolved against an item in the house's own formats. Pure, so the card and its tests share it.
 */

/** An item of the list: an object, read by dot paths (`altitude`, `airport.city`, `legs.0.from`). */
export type Item = Readonly<Record<string, unknown>>;

/**
 * A pattern parsed once: its literal text and its fields in order, a field being the paths it tries in turn
 * (`{a|b}` takes b where a is empty).
 */
export type Pattern = ReadonlyArray<string | readonly string[]>;

/** What a field may ask of its formatting: the digits a number is written with, and a number that is a Unix time. */
export interface FieldFormat {
  readonly digits?: number;
  readonly epoch?: boolean;
}

export type SortOrder = 'ascending' | 'descending';

/** A field in a pattern: `{path}` or `{a|b}`. */
const FIELD = /\{([^{}]+)\}/g;
/** A bare path, the whole pattern: letters, digits, underscores, hyphens and dots. */
const PATH = /^[\w.-]+$/;
/** A date and time as integrations write them (`2026-10-26T14:05:00+00:00`). */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/** A line's segments: " · " between them; one without a letter or a digit is no segment. */
const SEGMENT = ' · ';
const WORDS = /[\p{L}\p{N}]/u;
/** An arrow or a dash left at a segment's edge by a field that said nothing (`AMS →`); a figure's minus is no dash. */
const EDGE = /^[\s→←↔–—]+|[\s→←↔–—]+$/g;

/** A pattern's parts: a bare path is one field; otherwise its text with each `{…}` a field of its paths. */
export function parsePattern(text: string): Pattern {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (PATH.test(trimmed)) return [[trimmed]];
  const parts: Array<string | readonly string[]> = [];
  let at = 0;
  for (const match of trimmed.matchAll(FIELD)) {
    if (match.index > at) parts.push(trimmed.slice(at, match.index));
    parts.push(
      (match[1] ?? '')
        .split('|')
        .map((path) => path.trim())
        .filter(Boolean),
    );
    at = match.index + match[0].length;
  }
  if (at < trimmed.length) parts.push(trimmed.slice(at));
  return parts;
}

/** The value at a dot path of an item (an index into a list reads too); undefined where the path leads nowhere. */
export function valueAt(item: Item, path: string): unknown {
  let value: unknown = item;
  for (const key of path.split('.')) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Readonly<Record<string, unknown>>)[key];
  }
  return value;
}

/** Whether a value says something: nothing, `null` and the empty text do not; a zero does. */
export const present = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/** A moment as a line: its time today, its short date and time otherwise. */
export function formatWhen(hass: HomeAssistant | undefined, date: Date, now = new Date()): string {
  const time = formatTime(hass, date);
  return sameDay(date, now) ? time : `${formatDate(hass, date, 'short')} ${time}`;
}

/**
 * A value as a line in the house's formats: a number with its digits (0 for a whole one, 1 otherwise, or the field's
 * own; a Unix time as a moment), a date and time written in ISO as a moment, a truth as on or off, text as it is;
 * nothing for what is not a line (a list, a dict, nothing at all).
 */
export function formatValue(
  hass: HomeAssistant | undefined,
  value: unknown,
  format: FieldFormat = {},
): string {
  if (typeof value === 'number') {
    if (format.epoch) return formatWhen(hass, new Date(value * 1000));
    return formatNumber(hass, value, {
      digits: format.digits ?? (Number.isInteger(value) ? 0 : 1),
    });
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return ISO_DATE_TIME.test(text) ? formatWhen(hass, new Date(text)) : text;
  }
  if (typeof value === 'boolean') return localize(hass, value ? 'common.on' : 'common.off');
  return '';
}

/** A field's line: the first of its paths that says something, formatted. */
const fieldText = (
  item: Item,
  paths: readonly string[],
  hass: HomeAssistant | undefined,
  format: FieldFormat,
): string => {
  for (const path of paths) {
    const value = valueAt(item, path);
    if (present(value)) return formatValue(hass, value, format);
  }
  return '';
};

/**
 * A pattern resolved against an item: its fields' lines in its text, then the " · " segments that say nothing let go
 * and an arrow a blank field left at a segment's edge with them, so a line is never a dangling " · " or "AMS →".
 */
export function resolveField(
  item: Item,
  pattern: Pattern,
  hass: HomeAssistant | undefined,
  format: FieldFormat = {},
): string {
  const text = pattern
    .map((part) => (typeof part === 'string' ? part : fieldText(item, part, hass, format)))
    .join('');
  return text
    .split(SEGMENT)
    .map((segment) => segment.replace(EDGE, ''))
    .filter((segment) => WORDS.test(segment))
    .join(SEGMENT);
}

/**
 * The items in the order asked: by a path's value — numbers as numbers, words as the language sorts them (figures
 * inside them as numbers), an item without the value last — else as the sensor lists them. Equal ones keep their
 * order.
 */
export function sortItems(
  items: readonly Item[],
  path: string | undefined,
  order: SortOrder = 'ascending',
): Item[] {
  if (!path) return [...items];
  const sign = order === 'descending' ? -1 : 1;
  const keyed = items.map((item, index) => ({ item, index, key: valueAt(item, path) }));
  keyed.sort((a, b) => {
    const [x, y] = [present(a.key), present(b.key)];
    if (!x || !y) return x === y ? a.index - b.index : x ? -1 : 1;
    const by =
      typeof a.key === 'number' && typeof b.key === 'number'
        ? a.key - b.key
        : String(a.key).localeCompare(String(b.key), undefined, { numeric: true });
    return by ? by * sign : a.index - b.index;
  });
  return keyed.map(({ item }) => item);
}

/** Whether a value is an item: an object that is not a list. */
export const isItem = (value: unknown): value is Item =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value as the items it lists: the objects of a list; nothing of anything else. */
export const asItems = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter(isItem) : [];

/** The names a list attribute usually goes by, tried first where none is named. */
const PREFERRED = ['flights', 'items', 'entries', 'list'];

/** The attributes of an entity that hold a list (what the editor offers as `attribute`). */
export function listAttributes(view: EntityView): string[] {
  return Object.entries(view.stateObj?.attributes ?? {})
    .filter(([, value]) => Array.isArray(value))
    .map(([name]) => name);
}

/**
 * The list attribute an Items card reads: the one named, or — `auto` — the first of the usual names, else the first
 * attribute whose value is a list of objects, else the first list at all (empty: nothing listed yet). Its name and its
 * items.
 */
export function listAttribute(
  view: EntityView,
  name?: string,
): { readonly name: string; readonly items: Item[] } {
  if (name && name !== 'auto') return { name, items: asItems(view.attr(name)) };
  const lists = listAttributes(view);
  const found =
    PREFERRED.find((usual) => lists.includes(usual)) ??
    lists.find((list) => {
      const value = view.attr<unknown[]>(list) ?? [];
      return value.length > 0 && value.every(isItem);
    }) ??
    lists[0];
  return found ? { name: found, items: asItems(view.attr(found)) } : { name: '', items: [] };
}

/** A line's " · " segments fitted to `room`, measured in `cls`: the trailing ones give way before any is cut. */
export function fitSegments(
  ruler: Pick<TextRuler, 'width'>,
  cls: string,
  text: string,
  room: number,
): string {
  return fitLine(
    text.split(SEGMENT).map((segment, index) => ({ text: segment, optional: index > 0 })),
    room,
    (candidate) => ruler.width(cls, candidate),
  );
}

/** A field's name as a label: its underscores and dots as spaces, its first letter up (`aircraft_model` → "Aircraft model"). */
export function labelOf(path: string): string {
  const words = path.replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}
