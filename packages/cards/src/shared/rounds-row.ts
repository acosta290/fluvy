import { listRow, type IconRef, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { ROW_NAME_MIN } from '../energy/head.js';
import { fitLine } from './fit.js';
import { roundsIn, type RoundSpec, type RoundsHost } from './rounds.js';

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
  /** A figure or a word at its end, before its rounds ("20.5°"). */
  readonly value?: string | undefined;
  readonly rounds: readonly RoundSpec[];
  readonly onTap?: (() => void) | undefined;
  readonly onHold?: (() => void) | undefined;
  /** What a reader hears for the row where its words leave something out. */
  readonly label?: string | undefined;
}

/* a row's circle and the 12 after it, the compact row's smaller one */
const CIRCLE = 44 + 12;
const CIRCLE_COMPACT = 40 + 12;
/** The gap between the row's words and its value (`.fv-row`'s). */
const GAP = 12;

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

/**
 * Whether a list of rows keeps its circles (`rowsKeepIcon`'s rule): every row's words keep what they need beside the
 * circle alone; where one's would not, every row of the list gives its circle to its words.
 */
export const roundsRowsKeepIcon = (
  host: RoundsHost,
  width: number,
  rows: readonly RoundsRowSpec[],
  compact = false,
): boolean =>
  rows.every((row) => width - (compact ? CIRCLE_COMPACT : CIRCLE) >= wordsNeed(host, row, compact));

/**
 * A row in `width`, its circle where the list keeps it (`roundsRowsKeepIcon`), what does not hold beside its words
 * giving way in order: its rounds from the end (`roundsIn`: as many as hold, and the states they say in what they
 * leave), then its value, then — the list's — its circle; its line's segments after the first from the end, then.
 */
export function roundsRow(
  host: RoundsHost,
  width: number,
  row: RoundsRowSpec,
  { compact = false, icon = true }: { readonly compact?: boolean; readonly icon?: boolean } = {},
): TemplateResult {
  // the rounds and the value are laid out beside the circle whether it stands or not: one given away is the words'
  const circle = compact ? CIRCLE_COMPACT : CIRCLE;
  const need = wordsNeed(host, row, compact);
  const valueSlot = (value: string | undefined): number =>
    value ? GAP + host.ruler.width('fv-row__value', value) : 0;
  // the rounds in what the words and the value leave; none there, the value goes where the words would not hold
  const block = roundsIn(host, row.rounds, width - circle - valueSlot(row.value) - need, false);
  const value =
    block.taken || width - circle - valueSlot(row.value) >= need ? row.value : undefined;
  const room = width - (icon ? circle : 0) - valueSlot(value) - block.taken;
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
    trailing: html`${value ? html`<span class="fv-row__value">${value}</span>` : nothing}${block.template}`,
    onTap: row.onTap,
    onHold: row.onHold,
  });
}

/** A list of rows with their rounds, the circles kept or given away by every row together. */
export const roundsRows = (
  host: RoundsHost,
  width: number,
  rows: readonly RoundsRowSpec[],
  compact = false,
): TemplateResult[] => {
  const icon = roundsRowsKeepIcon(host, width, rows, compact);
  return rows.map((row) => roundsRow(host, width, row, { compact, icon }));
};
