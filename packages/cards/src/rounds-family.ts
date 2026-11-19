import { entriesOf, type LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { EMPTY, ROW } from './shared/heights.js';

/*
 * The Rounds card (#224), announced at start and defined when its chunk lands (`rounds-cards.ts`), as the template
 * card is: what the card picker lists, how tall the card is at a 360 column, and how its rounds stand in lines, which
 * the card draws by — without the card itself. Every page carries this file: it stays tiny.
 */

/** Where a round's line stands: its cells, as many a line and as many lines, each line's height and the gap under it. */
export interface RoundsGrid {
  readonly perLine: number;
  readonly lines: number;
  /** A cell's least width: the round alone (44), or 64 with a name or a state under it. */
  readonly cell: number;
  readonly line: number;
  readonly gap: number;
}

/** The rounds' 8 between cells, and the least cell of a round with words under it. */
const GAP = 8;
const WORDED = 64;

/** The rounds a config lists: its `items`, else Home Assistant's `entities` (the card reads them alike). */
const listed = (config: LovelaceCardConfig): unknown[] | undefined =>
  (config['items'] ?? config['entities']) as unknown[] | undefined;

/**
 * A config's rounds in `width`: as many a line as hold their cells 8 apart (`columns` asks for fewer), the lines
 * balanced where it asks for none (seven are four and three); a line 44 tall, 64 where a round says its state under
 * its glyph (the `labels` layout, or a round's own `show_state`), 20 more for the names under them (`show_names`, 4 and
 * their 16), the lines 8 apart, 16 where words stand under them.
 */
export function roundsGrid(config: LovelaceCardConfig, width: number): RoundsGrid {
  const entries = entriesOf<{ entity: string; show_state?: unknown }>(listed(config));
  const labels = config['variant'] === 'labels';
  const states = entries.some((entry) =>
    typeof entry === 'object' && entry.show_state !== undefined
      ? entry.show_state === true
      : labels,
  );
  const named = config['show_names'] === true;
  const cell = named || states ? WORDED : 44;
  const most = Math.max(1, Math.floor((width + GAP) / (cell + GAP)));
  const asked = Math.floor(Number(config['columns']));
  const columns = asked >= 1 ? Math.min(asked, most) : most;
  const lines = Math.ceil(entries.length / columns);
  return {
    perLine: asked >= 1 ? columns : Math.ceil(entries.length / Math.max(1, lines)),
    lines,
    cell,
    line: (states ? 64 : 44) + (named ? 20 : 0),
    gap: named || states ? 16 : GAP,
  };
}

/**
 * The card at a 360 column, from its config alone: its head where it has a title (44 and the 16 under it), then its
 * rounds in their lines across the 320 (`roundsGrid`), or the empty panel and its hint; or a 60 row each (`row`), 8
 * under the head as every list's, else 8 into the card's padding at each end.
 */
export const roundsHeight = (config: LovelaceCardConfig): number => {
  const head = config['title'] ? 60 : 0;
  const count = entriesOf(listed(config)).length;
  if (!count) return 40 + head + EMPTY + 12;
  if (config['variant'] === 'row') return (head ? 92 : 24) + count * ROW;
  const { lines, line, gap } = roundsGrid(config, 320);
  return 40 + head + lines * line + (lines - 1) * gap;
};

export const ROUNDS_FAMILY: readonly FamilyEntry[] = [['fluvy-rounds-card', roundsHeight]];
