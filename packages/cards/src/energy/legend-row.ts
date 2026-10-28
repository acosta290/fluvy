import { html, nothing, type TemplateResult } from 'lit';
import { optionGrid } from '@fluvy/ui';
import { legendFold } from '../energy-family.js';
import type { TextRuler } from '../shared/fit.js';

/**
 * The energy cards' legend (Distribution's idiom): a 12 px square in the item's ink, its name 14/500 and its figure
 * 16/600 under it, in equal centred columns. The names are measured in their own class: when one does not fit its
 * column, or two neighbours' would stand closer than 8, the row folds (four into two by two, three or fewer into one
 * a line) rather than cut a word or let two meet.
 */
export interface LegendEntry {
  /** The ink class (`en-ink--solar`), and the item's own colour when it has one. */
  readonly ink: string;
  readonly accent?: string | undefined;
  /** A colour of the palette's the square wears as its ink (`var(--fluvy-graph-3)`): it follows the palette. */
  readonly paint?: string;
  readonly name: string;
  readonly value: string;
  readonly unit: string;
  /** The square of what left (the export, 60 %) or of a second series (45 %). */
  readonly square?: 'out' | 'second';
}

/** The square (12) and the gap to the name (8). */
const LEAD = 20;

/**
 * How many columns the legend takes (`legendFold`), its names measured in their own class: all, or folded when a name
 * — or the widest figure, `figure` — does not fit its column, or two neighbours' names would meet; `gap` is the room
 * between columns.
 */
export function legendColumns(
  names: readonly string[],
  width: number,
  ruler: TextRuler,
  figure = 0,
  gap = 0,
): number {
  return legendFold(
    names.map((name) => LEAD + ruler.width('en-legend__name', name)),
    width,
    figure,
    gap,
  );
}

export function energyLegend(
  items: readonly LegendEntry[],
  width: number,
  ruler: TextRuler,
): TemplateResult | typeof nothing {
  if (!items.length) return nothing;
  const columns = legendColumns(
    items.map((item) => item.name),
    width,
    ruler,
  );
  const folded = columns < items.length;
  // a name up to two pixels wider than its column overhangs it rather than end in an ellipsis
  const widest = Math.max(
    0,
    ...items.map((item) => LEAD + ruler.width('en-legend__name', item.name)),
  );
  const slack = !folded && widest > width / columns;
  // a folded legend's last row splits the width among its own, as option tiles do (five in three: 2·2·2, then 3·3)
  const grid = folded ? optionGrid(items.length, columns) : undefined;
  // each item is centred in its column: its edges fall where the column's middle puts them (`data-align`)
  return html`<div
    class="en-legend"
    data-align="center"
    style=${
      folded || slack
        ? [
            grid
              ? `grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr));grid-auto-flow:row;row-gap:12px`
              : '',
            slack ? '--en-slack:2px' : '',
          ]
            .filter(Boolean)
            .join(';')
        : nothing
    }
  >
    ${items.map(
      (item, index) =>
        html`<span
          class="en-legend__item"
          data-accent=${item.accent ?? nothing}
          style=${grid ? `grid-column:span ${grid.spans[index] ?? 1}` : nothing}
          ><span class="en-legend__name"
            ><i
              class="en-sq ${item.ink} ${item.square ? `is-${item.square}` : ''}"
              style=${item.paint ? `--ink:${item.paint}` : nothing}
            ></i
            ><span class="en-legend__text">${item.name}</span></span
          ><span class="en-legend__value"
            >${item.value}${item.unit ? html`<span class="en-unit">${item.unit}</span>` : nothing}</span
          ></span
        >`,
    )}
  </div>`;
}
