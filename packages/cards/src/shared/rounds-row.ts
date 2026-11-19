import { glyph, listRow, type IconRef, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { ROW_NAME_MIN } from '../energy/head.js';
import { fitLine } from './fit.js';
import {
  drawRound,
  roundOf,
  roundsHeld,
  roundsIn,
  roundsTaken,
  type RoundSpec,
  type RoundsBlock,
  type RoundsHost,
} from './rounds.js';

/*
 * A list row with rounds at its end (1.23): a room's lights and blinds beside its name, a thermostat's own rounds, an
 * entity of the Rounds card. The 60 list row (48 compact) — its circle, its name over its line, a value — and its
 * rounds after them, each its own tap and hold (`rounds.ts`). A row never stacks: what does not hold gives way, in
 * order, and its height stays its config's.
 */

/** One row: the list row's own parts, and its rounds. */
export interface RoundsRowSpec {
  /** Its circle's glyph, or a template of its own (a picture). */
  readonly icon: IconRef | string | TemplateResult;
  readonly tone?: Tone;
  /** Its own colour (`data-accent`, the card's accent sheet's). */
  readonly accent?: string | undefined;
  readonly title: string;
  /** The title is a name (a room's, a device's): it may end in an ellipsis, as names do. */
  readonly name?: boolean;
  /** Its line ("21.4° · 48 %"): its segments after the first give way from the end; the compact row has none. */
  readonly sub?: string | undefined;
  /**
   * A figure or a word at its end, before its rounds ("20.5°"); or a control in its place, drawn by the card, as wide
   * as it says (a thermostat's target between − and +).
   */
  readonly value?: string | RowControl | undefined;
  /**
   * Its rounds, in order; `null` an empty place (a kind of the list's the row lacks: a room without blinds), kept where
   * its list stands its rounds in columns (`roundsRows`' `columns`), passed over where it does not.
   */
  readonly rounds: readonly (RoundSpec | null)[];
  readonly onTap?: (() => void) | undefined;
  readonly onHold?: (() => void) | undefined;
  /** What a reader hears for the row where its words leave something out. */
  readonly label?: string | undefined;
  /** What its rounds read where they are its own (a room's: its lights, its blinds), the list's where it says none. */
  readonly host?: RoundsHost | undefined;
  /** It opens a page: a chevron ends it, after its rounds, where its list draws them (`roundsRows`). */
  readonly opens?: boolean | undefined;
}

/** A control at a row's end in its value's place: what the card draws, and its width. */
export interface RowControl {
  readonly drawn: TemplateResult;
  readonly width: number;
}

/* a row's circle and the 12 after it, the compact row's smaller one */
const CIRCLE = 44 + 12;
const CIRCLE_COMPACT = 40 + 12;
/** The gap between the row's words and its value (`.fv-row`'s). */
const GAP = 12;
/** A row's chevron: its 44 and the 12 before it, less the 8 its ink stands past the column edge. */
const ARROW = 48;

/**
 * What a row's words must keep before anything beside them stays: its name, 96 of it (`ROW_NAME_MIN`, all of a
 * shorter one), and its line's first segment whole.
 */
function wordsNeed(host: RoundsHost, row: RoundsRowSpec, compact: boolean): number {
  const name = host.ruler.width('fv-row__title', row.title);
  const first =
    row.sub && !compact ? host.ruler.width('fv-row__sub', row.sub.split(' · ')[0] ?? '') : 0;
  return Math.max(Math.min(ROW_NAME_MIN, name), first);
}

/** What a row's value takes of its line: its words, or its control, and the 12 before it. */
const valueSlot = (host: RoundsHost, value: RoundsRowSpec['value']): number =>
  !value
    ? 0
    : GAP + (typeof value === 'string' ? host.ruler.width('fv-row__value', value) : value.width);

/**
 * The room before a row's words: its circle and the 12 after it (the compact row's smaller one), which a value of
 * words is laid out beside whether it stands or not (one given away is the words'); none for a control the list gave
 * its circles away to.
 */
const before = (row: RoundsRowSpec, compact: boolean, icon: boolean): number =>
  !icon && typeof row.value === 'object' ? 0 : compact ? CIRCLE_COMPACT : CIRCLE;

/**
 * Whether a list of rows keeps its circles (`rowsKeepIcon`'s rule): every row's words keep what they need beside the
 * circle alone, and beside a control at its end (a card's own, which goes before the circles do); where one's would
 * not, every row of the list gives its circle away.
 */
export const roundsRowsKeepIcon = (
  host: RoundsHost,
  width: number,
  rows: readonly RoundsRowSpec[],
  compact = false,
): boolean =>
  rows.every(
    (row) =>
      width -
        before(row, compact, true) -
        (typeof row.value === 'object' ? valueSlot(host, row.value) : 0) >=
      wordsNeed(host, row, compact),
  );

/**
 * What a row leaves its rounds: `width` less its circle (none for a control the list gave its circles away to, `icon`),
 * its value and what its words must keep. Under 0, its value does not hold either, and gives way (a card with a
 * control there may end its rows in a value of words instead).
 */
export const roundsRoom = (
  host: RoundsHost,
  width: number,
  row: RoundsRowSpec,
  compact = false,
  icon = true,
): number =>
  width - before(row, compact, icon) - valueSlot(host, row.value) - wordsNeed(host, row, compact);

/** A row's rounds as drawn, its empty places passed over. */
const roundsOfRow = (row: RoundsRowSpec): RoundSpec[] =>
  row.rounds.filter((round): round is RoundSpec => round !== null);

/**
 * A row's rounds in its list's columns: its first `places`, each its round or, where the row lacks that kind, its
 * room left empty; plain rounds, a state's pill pushing no column apart (`roundsRows` keeps such a list's packed).
 */
function placesIn(
  host: RoundsHost,
  rounds: readonly (RoundSpec | null)[],
  places: number,
): RoundsBlock {
  if (!places) return { taken: 0, template: nothing };
  return {
    taken: roundsTaken(places),
    template: html`<div class="lt-bulbs rm-quick" data-align="end">
      ${rounds
        .slice(0, places)
        .map((round) =>
          round
            ? drawRound(host, roundOf(host, round), undefined, false)
            : html`<span class="lt-bulbs__place"></span>`,
        )}
    </div>`,
  };
}

/**
 * A row in `width`, its circle where the list keeps it (`roundsRowsKeepIcon`) and its chevron where the list draws
 * them (`arrow`: an empty one's room where it opens nothing, so the rounds of every row end on one line), what does
 * not hold beside its words giving way in order: its rounds from the end (`roundsIn`: as many as hold, and the states
 * they say in what they leave; in its list's columns, as many places as every row holds, `places`), then its value,
 * then — the list's — its circle; its line's segments after the first from the end, then.
 */
export function roundsRow(
  host: RoundsHost,
  width: number,
  row: RoundsRowSpec,
  {
    compact = false,
    icon = true,
    arrow = false,
    places,
  }: {
    readonly compact?: boolean;
    readonly icon?: boolean;
    readonly arrow?: boolean;
    readonly places?: number | undefined;
  } = {},
): TemplateResult {
  const line = width - (arrow ? ARROW : 0);
  // the rounds and the value are laid out beside the circle whether it stands or not (`before`); the rounds in what
  // the words and the value leave (`roundsRoom`), none there, the value going where the words would not hold
  const left = roundsRoom(host, line, row, compact, icon);
  const block =
    places === undefined
      ? roundsIn(row.host ?? host, roundsOfRow(row), left, false)
      : placesIn(row.host ?? host, row.rounds, places);
  const value = block.taken || left >= 0 ? row.value : undefined;
  const room =
    line - (icon ? before(row, compact, icon) : 0) - valueSlot(host, value) - block.taken;
  const sub =
    row.sub && !compact
      ? fitLine(
          row.sub.split(' · ').map((text, index) => ({ text, optional: index > 0 })),
          room,
          (text) => host.ruler.width('fv-row__sub', text),
        )
      : undefined;
  return listRow({
    icon: icon ? row.icon : null,
    tone: row.tone ?? 'neutral',
    accent: row.accent,
    title: row.title,
    name: row.name ?? true,
    ...(sub ? { sub } : {}),
    compact,
    ...(row.label ? { label: row.label } : {}),
    trailing: html`${
      typeof value === 'string'
        ? html`<span class="fv-row__value">${value}</span>`
        : (value?.drawn ?? nothing)
    }${block.template}${
      arrow
        ? html`<span class="fv-row__chevron" aria-hidden="true"
            >${row.opens ? glyph('chevron') : nothing}</span
          >`
        : nothing
    }`,
    onTap: row.onTap,
    onHold: row.onHold,
  });
}

/** Whether a round of a row's says its state (its own `show_state`, else its card's): a pill as wide as its words. */
const saysState = (host: RoundsHost, row: RoundsRowSpec): boolean =>
  roundsOfRow(row).some((round) => round.show_state ?? (row.host ?? host).look?.states ?? false);

/**
 * A list of rows with their rounds, the circles kept or given away by every row together; where it asks (`arrows`),
 * a chevron at the end of each row that opens a page, where every row keeps all its rounds beside one — else none: a
 * chevron gives way before a round, every row's together; and where it asks (`columns`), its rounds in columns, each
 * row's n-th round under the others' (a room's lights under every room's lights), a row that lacks one leaving its
 * place empty: the places some row fills, as many on every row as the tightest holds. A list a round of which says
 * its state keeps its rounds packed, as every list does.
 */
export const roundsRows = (
  host: RoundsHost,
  width: number,
  rows: readonly RoundsRowSpec[],
  compact = false,
  {
    arrows = false,
    columns = false,
  }: { readonly arrows?: boolean; readonly columns?: boolean } = {},
): TemplateResult[] => {
  const icon = roundsRowsKeepIcon(host, width, rows, compact);
  // the columns some row fills, every row's places in them
  const filled =
    columns && !rows.some((row) => saysState(host, row))
      ? [
          ...new Set(rows.flatMap((row) => row.rounds.flatMap((round, at) => (round ? [at] : [])))),
        ].sort((a, b) => a - b)
      : undefined;
  const placed = filled
    ? rows.map((row) => ({ ...row, rounds: filled.map((at) => row.rounds[at] ?? null) }))
    : rows;
  const wanted = (row: RoundsRowSpec): number => filled?.length ?? roundsOfRow(row).length;
  const held = (row: RoundsRowSpec, line: number): number =>
    roundsHeld(roundsRoom(host, line, row, compact, icon));
  const arrow =
    arrows &&
    rows.some((row) => row.opens) &&
    placed.every((row) => held(row, width - ARROW) >= wanted(row));
  const line = width - (arrow ? ARROW : 0);
  const places = filled && Math.min(filled.length, ...placed.map((row) => held(row, line)));
  return placed.map((row) => roundsRow(host, width, row, { compact, icon, arrow, places }));
};
