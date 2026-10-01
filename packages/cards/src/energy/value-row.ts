import { readout } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import type { TextRuler } from '../shared/fit.js';

/** A readout's words, for measuring and drawing it. */
export interface Figure {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

/** The readouts' gap in a row: the side one keeps 16 from the value. */
const GAP = 16;

/** A readout's laid-out width in its size: the wider of its label and its figure. */
function widthOf(ruler: TextRuler, size: 'l' | 's', f: Figure): number {
  return Math.max(
    ruler.width('fv-readout__label', f.label),
    ruler.width(`fv-readout fv-readout--${size} > fv-readout__value`, f.value, 'fv-unit', f.unit),
  );
}

/**
 * The value row of the charge cards: the reading (a 40 figure) at the left, what qualifies it (a 20 figure: when it
 * is full, when it is due) at the right on its baseline. When the column cannot hold both side by side (half a
 * phone's), the side one goes under the reading, measured, never squeezed.
 */
export function valueRow(
  ruler: TextRuler,
  width: number,
  main: Figure,
  side: { readonly figure: Figure; readonly drawn?: TemplateResult } | null,
): TemplateResult {
  const stacked =
    side !== null && widthOf(ruler, 'l', main) + GAP + widthOf(ruler, 's', side.figure) > width;
  return html`<div class="ef-top fv-value-row ${stacked ? 'is-stacked' : ''}">
    ${readout({ ...main, size: 'l' })}
    ${
      side
        ? html`<div class="ef-top__side">
            ${side.drawn ?? readout({ ...side.figure, size: 's' })}
          </div>`
        : nothing
    }
  </div>`;
}
