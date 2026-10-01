import { formatNumber, type HomeAssistant } from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';

/**
 * A state of charge on a read-only ruler (the batteries' and the car's): the marker at the level, a mark at a value
 * that matters (the reserve, the target) and the labels under it — `0 · 50 · 100` and the mark's word at its place.
 */

/** The knob's ring and its halo: a mark closer to the marker's centre than this is under it. */
const UNDER_KNOB = 18 + 4;
/** The marker stops 4 px past the ruler's ends (the ruler's own rule): its centre never comes nearer the ends. */
const KNOB_INSET = 36 / 2 - 4;

export interface RulerLabel {
  readonly text: string;
  /** Left edge of the label's box, in px from the ruler's start. */
  readonly left: number;
  readonly mark: boolean;
}

/**
 * The labels under a ruler with a mark on it. Each is a box of its measured width — the ends flush with the ruler's,
 * the others centred on their value and kept inside it — and a number whose box would come within 8 px of the
 * mark's word gives way to it: the word says where the mark is.
 */
export function markedLabels(
  width: number,
  numbers: readonly (readonly [fraction: number, text: string])[],
  mark: { readonly fraction: number; readonly text: string } | null,
  measure: (text: string) => number,
): RulerLabel[] {
  const place = (fraction: number, text: string, isMark: boolean) => {
    const w = measure(text);
    const at = Math.min(1, Math.max(0, fraction)) * width;
    const left = Math.round(Math.min(Math.max(0, at - w / 2), Math.max(0, width - w)));
    return { text, left, right: left + w, mark: isMark };
  };
  const marked = mark ? place(mark.fraction, mark.text, true) : null;
  const kept = numbers
    .map(([fraction, text]) => place(fraction, text, false))
    .filter((n) => !marked || n.right + 8 <= marked.left || n.left >= marked.right + 8);
  return [...kept, ...(marked ? [marked] : [])]
    .sort((a, b) => a.left - b.left)
    .map(({ text, left, mark: isMark }) => ({ text, left, mark: isMark }));
}

/** Where a mark is drawn on a ruler of `width` (its 2 px line kept inside), and whether the marker at `value` hides it. */
export function markAt(
  width: number,
  fraction: number,
  value: number | null,
): { readonly x: number; readonly covered: boolean } {
  const x = Math.round(Math.min(width - 1, Math.max(1, fraction * width)));
  if (value === null) return { x, covered: false };
  const centre = Math.min(
    width - KNOB_INSET,
    Math.max(KNOB_INSET, (Math.min(100, Math.max(0, value)) / 100) * width),
  );
  return { x, covered: Math.abs(x - centre) < UNDER_KNOB };
}

export interface MarkedRulerOptions {
  readonly hass: HomeAssistant | undefined;
  readonly width: number;
  /** The level in %, `null` when it cannot be read (no marker, nothing lit). */
  readonly value: number | null;
  readonly tone: Tone;
  /** The mark: a level in % and its word. */
  readonly mark: { readonly percent: number; readonly text: string } | null;
  /** The ruler's name for a screen reader ("Garage · State of charge"). */
  readonly label: string;
  /** A label's laid-out width (the card's text ruler, in `fv-ruler-labels en-mark-labels > en-mark-label`). */
  readonly measure: (text: string) => number;
}

/** The class path the labels are measured in. */
export const MARK_LABEL = 'fv-ruler-labels en-mark-labels > en-mark-label';

export function markedRuler(o: MarkedRulerOptions): TemplateResult {
  const digits = (v: number): string => formatNumber(o.hass, v, { digits: 0 });
  const mark = o.mark ? { fraction: o.mark.percent / 100, text: o.mark.text } : null;
  const at = mark ? markAt(o.width, mark.fraction, o.value) : null;
  const labels = markedLabels(
    o.width,
    [
      [0, digits(0)],
      [0.5, digits(50)],
      [1, digits(100)],
    ],
    mark,
    o.measure,
  );
  return html`<div
      class="ef-gauge ${at ? 'en-mark' : ''} ${at?.covered ? 'is-covered' : ''}"
      style=${at ? `--at:${at.x}px` : nothing}
    >
      <fluvy-ruler
        marker
        ?inactive=${o.value === null}
        .value=${o.value ?? 0}
        .min=${0}
        .max=${100}
        .step=${1}
        .length=${o.width}
        .tone=${o.tone}
        unit="%"
        .label=${o.label}
        .format=${digits}
      ></fluvy-ruler>
    </div>
    <div class="fv-ruler-labels en-mark-labels">
      ${labels.map(
        (l) =>
          html`<span class="en-mark-label ${l.mark ? 'is-mark' : ''}" style="left:${l.left}px"
            >${l.text}</span
          >`,
      )}
    </div>`;
}
