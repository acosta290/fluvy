import { icon, rulerLabels, unitSpan } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import type { Labels } from './axis.js';
import type { TextRuler } from './fit.js';
import type { Reading } from './value-row.js';

/*
 * A level across (1.25, #244; 1.26, #258): one row for a figure and the ruler that sets it — the readout at the start
 * in a column of its own, the ruler beside it taking the rest of the column, its ends' words over its ends on the
 * readout's label line; the readout over the ruler where the column cannot hold the two side by side. The horizontal
 * Cover card's position, and what a details sheet draws in its dial's place: one rule, measured with the ruler of
 * whoever draws it. Its sheet is `@fluvy/ui/styles/across`.
 */

/** Between a figure's unit and the word after it (`.cv-said`). */
const SAID_GAP = 8;
/**
 * The gaps between the readout and its ruler, best first, and the least the ruler keeps beside the readout: 128, a
 * pixel a percent between the knob's stops (its 36 stops 14 in from each end).
 */
const GAPS = [24, 16] as const;
const LEAST = 128;

/** A readout's figure with its unit, at `size`; `tight`, a unit attached to it (`saidReadout`'s degree sign). */
export const figureWidth = (
  ruler: TextRuler,
  size: 'm' | 's',
  reading: Reading,
  tight = false,
): number =>
  ruler.width(
    `fv-readout fv-readout--${size} > fv-readout__value`,
    reading.value,
    tight ? 'fv-unit fv-unit--tight' : 'fv-unit',
    reading.unit ?? '',
  );

/** A readout's label. */
export const labelWidth = (ruler: TextRuler, text: string): number =>
  ruler.width('fv-readout > fv-readout__label', text);

/** A word said after a figure, with the gap before it (`.cv-said`). */
export const saidWidth = (ruler: TextRuler, word: string): number =>
  word ? SAID_GAP + ruler.width('fv-unit cv-said', word) : 0;

/**
 * A readout with what it says in words after its figure (#203: the slats' "Partly open", a position counted "down"),
 * in the unit's ink: the readout's own anatomy, the word where its column holds it, a degree sign attached to its
 * figure ("45°"), and its label as `glyph` where the column cannot hold its words (read out still).
 */
export const saidReadout = (
  label: string,
  size: 'm' | 's',
  value: string | TemplateResult,
  unit: string,
  said: string,
  glyph?: string,
): TemplateResult =>
  html`<div class="fv-readout fv-readout--${size}">
    ${
      glyph
        ? html`<p class="fv-readout__label fv-readout__label--icon">
            ${icon(glyph)}<span class="fv-sr" data-measure="skip">${label}</span>
          </p>`
        : html`<p class="fv-readout__label">${label}</p>`
    }
    <p class="fv-readout__value">
      <span>${value}</span
      >${unit ? unitSpan(unit, unit === '°') : nothing}${said ? html`<span class="fv-unit cv-said">${said}</span>` : nothing}
    </p>
  </div>`;

/** What a level says in its readout, and every figure it can say. */
export interface LevelReadout {
  readonly label: string;
  /** The label where the column cannot hold its words: a glyph, its words read out still. */
  readonly glyph: string;
  /** The figure it says now (a word, a dash), its unit where it has one, and a word after them where one follows. */
  readonly value: string | TemplateResult;
  readonly unit: string;
  readonly said: string;
  /** Every figure it can say, each with its unit: it is laid out for the widest, never for the one it says now. */
  readonly figures: readonly Reading[];
}

const widest = (ruler: TextRuler, size: 'm' | 's', figures: readonly Reading[]): number =>
  Math.max(...figures.map((reading) => figureWidth(ruler, size, reading)));

/**
 * A level's readout in a column: at m where the column holds its widest figure, a size smaller where it does not;
 * the word after its figure where the column holds it too; its label a glyph where its words are wider than the
 * column.
 */
export function levelReadout(ruler: TextRuler, column: number, o: LevelReadout): TemplateResult {
  const size = widest(ruler, 'm', o.figures) <= column ? 'm' : 's';
  const worded =
    o.said !== '' && widest(ruler, size, o.figures) + saidWidth(ruler, o.said) <= column;
  return saidReadout(
    o.label,
    size,
    o.value,
    o.unit,
    worded ? o.said : '',
    labelWidth(ruler, o.label) > column ? o.glyph : undefined,
  );
}

/** A row's fit: the readout's column, the gap after it, and the ruler's length. */
export interface AcrossFit {
  readonly column: number;
  readonly gap: number;
  readonly length: number;
}

/**
 * The row's fit in a column `width` wide, measured, never a width threshold: the readout in a column as wide as its
 * widest figure (`said` after it, where a word follows) or its label, on the 4 grid, and the ruler beside it taking
 * the rest, 24 from it, else 16, where the ruler keeps 128; the word gives way first. Where not even that holds (half
 * a section, a narrow column), none: the readout stands over the ruler at the column's width, as a light's level does.
 */
export function acrossFit(
  ruler: TextRuler,
  width: number,
  label: string,
  figures: readonly Reading[],
  said = '',
): AcrossFit | null {
  const figure = widest(ruler, 'm', figures);
  const words = labelWidth(ruler, label);
  const after = saidWidth(ruler, said);
  for (const word of after ? [after, 0] : [0]) {
    const column = Math.ceil(Math.max(words, figure + word) / 4) * 4;
    for (const gap of GAPS) {
      const length = width - column - gap;
      if (length >= LEAST) return { column, gap, length };
    }
  }
  return null;
}

/** Whether a ruler `length` long holds two words at its ends 8 apart, measured in the ruler words' own type. */
export const endsHold = (ruler: TextRuler, length: number, start: string, end: string): boolean =>
  ruler.width('fv-axis', start) + ruler.width('fv-axis', end) + 8 <= length;

/**
 * The row: the readout (`fit`: beside the ruler, in its column; none: over it) and the ruler under its ends' words,
 * each at its fraction of the ruler.
 */
export const acrossRow = (
  fit: AcrossFit | null,
  readout: TemplateResult,
  ends: Labels,
  ruler: TemplateResult,
): TemplateResult =>
  html`<div
    class="cv-across ${!fit ? 'cv-across--stacked' : fit.gap === 16 ? 'cv-across--close' : ''}"
    style=${fit ? `--cv-column:${fit.column}px` : nothing}
  >
    ${readout}
    <div class="cv-across__ruler">${rulerLabels(ends)} ${ruler}</div>
  </div>`;
