import {
  itemsOf,
  localize,
  selfHide,
  type FluvyCard,
  type FluvyCardConfig,
  type HomeAssistant,
  type MessageKey,
} from '@fluvy/core';
import { emptyState, listSection } from '@fluvy/ui';
import type { TemplateResult } from 'lit';
import { onOff } from './config.js';

/** A config's lists, read alike by every card (core's, where the base card's `watched()` reads them too). */
export { entriesOf, idsOf, itemsOf, listOf, type EntityEntry } from '@fluvy/core';

/**
 * What a card of a list does while the list has nothing to show (#48) — a filter that matches nothing yet
 * (auto-entities), the last entry taken out in the editor: its head and the empty panel in its own words where the
 * list would be, never a configuration error.
 */
export interface EmptyList {
  /** The panel's words in place of the card's own ("No sensors"): what an empty list means here ("All closed"). */
  empty_text?: string;
  /** Hidden while it has nothing to show, back as soon as it has; never in the editor. */
  hide_empty?: boolean;
}

/** The keys every card of a list adds to its own. */
export const EMPTY_KEYS = ['empty_text', 'hide_empty'] as const;

type ListCard = FluvyCard<FluvyCardConfig & EmptyList>;

/**
 * A card of a list says once a render whether it has anything to show: asked to (`hide_empty`), it hides itself while
 * it has not and shows itself again as soon as it has (`selfHide`).
 */
export const hideEmpty = (card: ListCard, empty: boolean): void =>
  selfHide(card, empty && card.config?.hide_empty === true);

/**
 * The same, and with nothing to show the panel it draws where its list would be: its own words (`text`) or the
 * config's, in the page's other fill where no card is around it (`page`).
 */
export function emptyPanel(
  card: ListCard,
  empty: boolean,
  glyph: string,
  text: MessageKey,
  page?: boolean,
): TemplateResult | undefined {
  hideEmpty(card, empty);
  return empty
    ? emptyState(glyph, card.config?.empty_text ?? localize(card.hass, text), '', page)
    : undefined;
}

/* ---------- sections among the rows, and rows on a condition (#157) ---------- */

/**
 * A section among a list's rows as a config writes it: as Home Assistant's entities card does (`type: section` with
 * its `label`, `type: divider`), or in a line (`section: Upstairs`); `line` draws a hairline over its label.
 */
export type SectionEntry =
  | { readonly type: 'section'; readonly label?: string; readonly line?: boolean }
  | { readonly type: 'divider' }
  | { readonly section: string; readonly line?: boolean };

/** A section as a list draws it: its label, a hairline over it where asked; with no label, the hairline alone. */
export interface ListSection {
  readonly label: string;
  readonly line: boolean;
}

/**
 * When a row shows (`show_when`): while its entity's state — or another's (`entity`) — is a number above one, below
 * one or between both, is a word or one of several (`state`), or is none of them (`state_not`); every part given must
 * hold. Data compared with a state, never evaluated: a part that says nothing (no number, no word) asks nothing, and
 * a state that is no number is neither above nor below one.
 */
export interface ShowWhen {
  readonly entity?: string;
  readonly above?: number;
  readonly below?: number;
  readonly state?: string | readonly string[];
  readonly state_not?: string | readonly string[];
}

/** A row of a list whose rows show on a condition. */
export interface ConditionalRow {
  readonly entity: string;
  /** Shown while it holds; the card's `show_rows_when` where the row names none. */
  readonly show_when?: ShowWhen;
}

/** What a card of such a list adds to its own keys: one condition for every row that names none. */
export interface ConditionalRows {
  show_rows_when?: ShowWhen;
}

/** A list's entry laid out: a row of it, or a section. */
export type Listed<T> = T | ListSection;

/** Whether an entry laid out is a row. */
export const isRow = <T extends { readonly entity: string }>(entry: Listed<T>): entry is T =>
  'entity' in entry;

/** Words a config may write as text or as a figure (`section: 2`). */
const said = (text: unknown): text is string | number =>
  typeof text === 'string' || typeof text === 'number';

/**
 * An entry of a list read as a section, when it is one (`SectionEntry`): its words are text, never markup. A row's
 * `label` is read as its `name` (`ITEM_ALIASES`), so a section's may arrive as either.
 */
export function sectionOf(entry: unknown): ListSection | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined;
  const { type, section, label, name, line } = entry as Readonly<Record<string, unknown>>;
  if (type === 'divider') return { label: '', line: true };
  if (type !== 'section' && !said(section)) return undefined;
  const words = [section, label, name].find(said);
  return { label: words === undefined ? '' : String(words).trim(), line: line === true };
}

/**
 * A list as it is laid out: its rows as items (`itemsOf`) and the sections between them, in its order; a section
 * that says nothing (no label yet, no hairline) is none.
 */
export const listedOf = <T extends { readonly entity: string }>(list: unknown): Listed<T>[] =>
  (Array.isArray(list) ? list : []).flatMap((entry: unknown) => {
    const [row] = itemsOf<T>([entry]);
    const section = row ? undefined : sectionOf(entry);
    return row ?? (section && (section.label || section.line) ? section : []);
  });

/**
 * What a list draws of what it lays out: the rows that show; a section's label while a row shows under it, before
 * the next label or hairline (which ends it, so a label never stands over another part's rows); and a hairline alone
 * only between rows that show, once — never first or last.
 */
export function shownOf<T extends { readonly entity: string }>(
  listed: readonly Listed<T>[],
  shows: (row: T) => boolean,
): Listed<T>[] {
  const drawn: Listed<T>[] = [];
  // the sections since the last row that shows: what the next one stands under
  let waiting: ListSection[] = [];
  for (const entry of listed) {
    if (!isRow(entry)) waiting.push(entry);
    else if (shows(entry)) {
      const line = waiting.find((section) => !section.label);
      const last = waiting.at(-1);
      if (line && drawn.length) drawn.push(line);
      if (last?.label) drawn.push(last);
      waiting = [];
      drawn.push(entry);
    }
  }
  return drawn;
}

/** The states a condition names: one or several; a YAML dashboard's unquoted `on` and `off` are the words (`onOff`). */
export const statesOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((word: unknown) => word !== undefined && word !== null)
    .map((word: unknown) => String(onOff(word)));

/** A bound as a number: NaN where the config gives none, or what is no number. */
const boundOf = (value: unknown): number =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;

/**
 * Whether a condition holds for the entity `id` (or the one it names): none always does. An entity the house does
 * not hold reads as out of reach, as its row says it is.
 */
export function holds(
  hass: HomeAssistant | undefined,
  id: string,
  when: ShowWhen | undefined,
): boolean {
  if (typeof when !== 'object' || when === null) return true;
  const other = when.entity;
  const state =
    hass?.states[typeof other === 'string' && other ? other : id]?.state ?? 'unavailable';
  const number = state.trim() ? Number(state) : NaN;
  const above = boundOf(when.above);
  const below = boundOf(when.below);
  const is = statesOf(when.state);
  return (
    (Number.isNaN(above) || number > above) &&
    (Number.isNaN(below) || number < below) &&
    (!is.length || is.includes(state)) &&
    !statesOf(when.state_not).includes(state)
  );
}

/**
 * What a card's list draws now: of its rows, those whose condition holds — their own, else the card's for every row
 * (`every`: its `show_rows_when`) — and the sections over them (`shownOf`).
 */
export const drawnOf = <T extends ConditionalRow>(
  hass: HomeAssistant | undefined,
  list: unknown,
  every?: ShowWhen,
): Listed<T>[] =>
  shownOf(listedOf<T>(list), (row) => holds(hass, row.entity, row.show_when ?? every));

/** The other entities a list's conditions read: watched with its rows'. */
export const conditionIds = (rows: readonly ConditionalRow[], every?: ShowWhen): string[] =>
  [every, ...rows.map((row) => row.show_when)].flatMap((when) =>
    typeof when?.entity === 'string' && when.entity ? [when.entity] : [],
  );

/**
 * A list as drawn, in its order: each row that shows as `row` draws it (told its place among them), with the list's
 * sections between them.
 */
export const withSections = <T extends { readonly entity: string }>(
  drawn: readonly Listed<T>[],
  row: (row: T, index: number) => TemplateResult,
): TemplateResult[] => {
  let next = 0;
  return drawn.map((entry) =>
    isRow(entry) ? row(entry, next++) : listSection(entry.label, entry.line),
  );
};
