import { chips, type ChipItem } from '@fluvy/ui';
import type { TemplateResult } from 'lit';
import type { RowStyle } from './config.js';
import type { TextRuler } from './fit.js';

/** What a card knows to lay a filled row out: its text ruler and the width the row fills. */
export interface ChipFit {
  readonly ruler: TextRuler;
  readonly width: number;
}

const GAP = 8;
/** A filled chip's pill: 8 each side of its label. */
const SIDES = 16;
/** A chip's glyph and the gap before its label. */
const GLYPH = 24;

/**
 * The columns a filled row takes so that no label is cut: as many as the labels are (three at most in one row of
 * five or six, four or two of four: every row full), the widest label measured in the row's own classes.
 */
function fittedColumns(items: readonly ChipItem[], { ruler, width }: ChipFit): number {
  const widest = Math.max(
    0,
    ...items.map(
      (item) =>
        ruler.width('fv-chips fv-chips--fill > fv-chip > fv-chip__pill', item.label) +
        SIDES +
        (item.glyph ? GLYPH : 0),
    ),
  );
  const count = items.length;
  const candidates = count <= 3 ? [count] : count === 4 ? [4, 2] : [count, 3, 2];
  for (const n of candidates) if ((width - GAP * (n - 1)) / n >= widest) return n;
  return 1;
}

/**
 * A card's row of short choices (modes, presets, sources), in the style its config asks: `full` (the default) —
 * equal chips that fill the row, laid out so no label is cut where the card can measure — or `chips`,
 * content-sized ones. One call, so every card reads `<x>_style` alike.
 */
export const chipRow = (
  items: readonly ChipItem[],
  onSelect: (key: string) => void,
  style: RowStyle = 'full',
  fit?: ChipFit,
): TemplateResult =>
  style === 'full'
    ? chips(items, onSelect, '', true, fit ? fittedColumns(items, fit) : undefined)
    : chips(items, onSelect);
