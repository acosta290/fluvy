import { html, nothing, type TemplateResult } from 'lit';
import { activateKey, optionGrid } from '@fluvy/ui';
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
  /**
   * The square of what left (the export, 60 %), of a second series (45 %), or of a figure worked out rather than
   * metered (its bar's dashed outline).
   */
  readonly square?: 'out' | 'second' | 'dashed';
  /**
   * Its name is only its id's (a device no longer in the house): the fold gives it no more room than its figure, and
   * it ends in an ellipsis in its column, so a device that is away never folds the legend (the owner's rule, 1.9).
   */
  readonly idName?: boolean;
  /** What it names in its card's drawing, lifted while the item is under the pointer or holds the focus. */
  readonly key?: string;
  /** What a tap on it opens (a meter's more-info), in a legend that answers the pointer: the item is a button. */
  readonly open?: () => void;
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

/** The room an item takes in the fold: its square and its name; a name that is only an id's, its figure's. */
const roomOf = (item: LegendEntry, ruler: TextRuler): number =>
  item.idName
    ? ruler.width('en-legend__value', item.value, 'en-unit', item.unit)
    : LEAD + ruler.width('en-legend__name', item.name);

/**
 * The legend; `columns`, where the card's room holds no more rows than it declares (a water card's meters, named by the
 * house), lays it in as many columns, a name that does not hold its column ending in an ellipsis. Given `lift`, its
 * items answer the pointer and the keyboard (the sankey's devices): each is reached by the focus and calls `lift` with
 * its `key` as the pointer or the focus comes, with none as it goes; one that opens something is a button a finger's
 * 44 tall, the others the image of their words.
 */
export function energyLegend(
  items: readonly LegendEntry[],
  width: number,
  ruler: TextRuler,
  columns = legendFold(
    items.map((item) => roomOf(item, ruler)),
    width,
  ),
  lift?: (key?: string) => void,
): TemplateResult | typeof nothing {
  if (!items.length) return nothing;
  const folded = columns < items.length;
  // a name up to two pixels wider than its column overhangs it rather than end in an ellipsis (one wider than that, in
  // the columns a card asks for, ends in one)
  const widest = Math.max(0, ...items.map((item) => roomOf(item, ruler)));
  const column = width / columns;
  const slack = !folded && widest > column && widest <= column + 2;
  // a folded legend's last row splits the width among its own, as option tiles do (five in three: 2·2·2, then 3·3)
  const grid = folded ? optionGrid(items.length, columns) : undefined;
  const rest = lift ? (): void => lift() : undefined;
  // each item is centred in its column: its edges fall where the column's middle puts them (`data-align`)
  return html`<div
    class="en-legend ${lift ? 'en-legend--live' : ''}"
    data-align="center"
    style=${
      folded || slack
        ? [
            grid
              ? `grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr));grid-auto-flow:row;row-gap:${lift ? 8 : 12}px`
              : '',
            slack ? '--en-slack:2px' : '',
          ]
            .filter(Boolean)
            .join(';')
        : nothing
    }
  >
    ${items.map((item, index) => {
      const come = lift ? (): void => lift(item.key) : undefined;
      const open = lift && item.open;
      return html`<span
        class="en-legend__item ${open ? 'fv-row--tap' : ''}"
        data-accent=${item.accent ?? nothing}
        data-key=${item.key ?? nothing}
        data-target=${open ? '' : nothing}
        style=${grid ? `grid-column:span ${grid.spans[index] ?? 1}` : nothing}
        role=${lift ? (open ? 'button' : 'img') : nothing}
        aria-label=${lift && !open ? `${item.name} ${item.value} ${item.unit}`.trim() : nothing}
        tabindex=${lift ? '0' : nothing}
        @pointerenter=${come ?? nothing}
        @pointerleave=${rest ?? nothing}
        @focus=${come ?? nothing}
        @blur=${rest ?? nothing}
        @click=${open || nothing}
        @keydown=${open ? activateKey(open) : nothing}
        ><span class="en-legend__name"
          ><i
            class="en-sq ${item.ink} ${item.square ? `is-${item.square}` : ''}"
            style=${item.paint ? `--ink:${item.paint}` : nothing}
          ></i
          ><span class="en-legend__text" data-name=${item.idName ? '' : nothing}
            >${item.name}</span
          ></span
        ><span class="en-legend__value"
          >${item.value}${item.unit ? html`<span class="en-unit">${item.unit}</span>` : nothing}</span
        ></span
      >`;
    })}
  </div>`;
}
