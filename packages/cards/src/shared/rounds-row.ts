import { glyph, listRow, type IconRef, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { ROW_NAME_MIN } from '../energy/head.js';
import { fitLine } from './fit.js';
import { roundsHeld, roundsIn, type RoundSpec, type RoundsHost } from './rounds.js';

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
  readonly rounds: readonly RoundSpec[];
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

/**
 * A row in `width`, its circle where the list keeps it (`roundsRowsKeepIcon`) and its chevron where the list draws
 * them (`arrow`: an empty one's room where it opens nothing, so the rounds of every row end on one line), what does
 * not hold beside its words giving way in order: its rounds from the end (`roundsIn`: as many as hold, and the states
 * they say in what they leave), then its value, then — the list's — its circle; its line's segments after the first
 * from the end, then.
 */
export function roundsRow(
  host: RoundsHost,
  width: number,
  row: RoundsRowSpec,
  {
    compact = false,
    icon = true,
    arrow = false,
  }: { readonly compact?: boolean; readonly icon?: boolean; readonly arrow?: boolean } = {},
): TemplateResult {
  const line = width - (arrow ? ARROW : 0);
  // the rounds and the value are laid out beside the circle whether it stands or not (`before`); the rounds in what
  // the words and the value leave (`roundsRoom`), none there, the value going where the words would not hold
  const left = roundsRoom(host, line, row, compact, icon);
  const block = roundsIn(row.host ?? host, row.rounds, left, false);
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

/**
 * A list of rows with their rounds, the circles kept or given away by every row together; and, where it asks
 * (`arrows`), a chevron at the end of each row that opens a page, where every row keeps all its rounds beside one —
 * else none: a chevron gives way before a round, every row's together.
 */
export const roundsRows = (
  host: RoundsHost,
  width: number,
  rows: readonly RoundsRowSpec[],
  compact = false,
  { arrows = false }: { readonly arrows?: boolean } = {},
): TemplateResult[] => {
  const icon = roundsRowsKeepIcon(host, width, rows, compact);
  const arrow =
    arrows &&
    rows.some((row) => row.opens) &&
    rows.every(
      (row) => roundsHeld(roundsRoom(host, width - ARROW, row, compact, icon)) >= row.rounds.length,
    );
  return rows.map((row) => roundsRow(host, width, row, { compact, icon, arrow }));
};
