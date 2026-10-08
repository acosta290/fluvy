import type { EntityView, HomeAssistant } from '@fluvy/core';
import { css, html, nothing, type TemplateResult } from 'lit';
import { DEFAULT_THRESHOLD } from '../energy-model/sources.js';
import { ceilingFor } from '../gauge/units.js';
import type { TextRuler } from '../shared/fit.js';
import { scaled, watts, type Scale } from './power.js';

/**
 * A grid read per phase, as the balance and the grid cards draw it: a row per phase in the order of the list, its
 * bar centred on zero in the grid's colour both ways (a meter cannot know where its energy came from), and its figure
 * with the direction in the unit slot ("0.4 kW out", "1.0 kW in").
 */

/** Each phase's power, signed (+ toward the house), or null when it cannot be read. */
export const phaseWatts = (
  ids: readonly string[],
  invert: boolean,
  entity: (id: string) => EntityView,
): (number | null)[] =>
  ids.map((id) => {
    const w = watts(entity(id));
    return w === null ? null : invert ? -w : w;
  });

/**
 * How far a bar reaches each side of zero: twice the busiest phase, on a round step, 1 kW at least — a quiet night
 * keeps a scale a busy hour can grow into, and a phase never fills its side.
 */
export function phaseSpan(values: readonly (number | null)[]): number {
  const peak = values.reduce<number>(
    (max, v) => (v === null ? max : Math.max(max, Math.abs(v))),
    0,
  );
  return Math.max(1000, ceilingFor(2 * peak));
}

export type Way = 'in' | 'out' | '';

/** A phase's bar: its side of zero and its reach (0…1 of that side). Below the threshold a phase rests on zero. */
export function phaseBar(
  value: number | null,
  span: number,
  threshold = DEFAULT_THRESHOLD,
): { readonly way: Way; readonly reach: number } {
  if (value === null || Math.abs(value) < threshold || !(span > 0)) return { way: '', reach: 0 };
  return { way: value > 0 ? 'in' : 'out', reach: Math.min(1, Math.abs(value) / span) };
}

export interface PhaseRow {
  /** "L1": from the order of the list, never from a sensor's name. */
  readonly label: string;
  /** Under the name: the phase's voltage ("229 V"). */
  readonly sub?: string | undefined;
  readonly value: number | null;
}

export interface PhaseOptions {
  readonly hass: HomeAssistant | undefined;
  readonly rows: readonly PhaseRow[];
  /** The card's unit for power (every figure of a card in one). */
  readonly scale: Scale;
  /** The flow's words for the two directions ("in", "out"). */
  readonly ways: { readonly in: string; readonly out: string };
  readonly width: number;
  readonly ruler: TextRuler;
  readonly threshold?: number | undefined;
}

/* the row (energy.css): the name's column, a 12 gap, the bar, a 12 gap, the value's column */
const NAME = 40;
const GAP = 12;
const VALUE = 96;
/** A bar shorter than this, or than its axis's words, goes under its row's name and figure. */
const BAR_MIN = 64;

const up4 = (v: number): number => Math.ceil(v / 4) * 4;

interface Figure {
  readonly value: string;
  readonly unit: string;
  readonly way: Way;
  readonly reach: number;
}

/** The phases' rows and their axis ("← out · in →"), laid out to the column by measure. */
export function phaseBlock(o: PhaseOptions): TemplateResult {
  const span = phaseSpan(o.rows.map((r) => r.value));
  const figuresOf = (worded: boolean): Figure[] =>
    o.rows.map((r): Figure => {
      const bar = phaseBar(r.value, span, o.threshold);
      return r.value === null
        ? { value: '—', unit: '', way: '', reach: 0 }
        : {
            value: scaled(o.hass, Math.abs(r.value), o.scale),
            unit: bar.way && worded ? `${o.scale.unit} ${o.ways[bar.way]}` : o.scale.unit,
            way: bar.way,
            reach: bar.reach,
          };
    });
  const widest = (list: readonly Figure[]): number =>
    Math.max(0, ...list.map((f) => o.ruler.width('en-phase__value', f.value, 'en-unit', f.unit)));
  // a column too narrow for a figure with its way ("0.4 kW exported" in half a phone's) writes the figure alone: its
  // bar, and the axis under the rows, say which way it goes
  let figures = figuresOf(true);
  if (widest(figures) > o.width) figures = figuresOf(false);
  const valueW = Math.max(VALUE, up4(widest(figures)));
  const left = `← ${o.ways.out}`;
  const right = `${o.ways.in} →`;
  const axisW = o.ruler.width('en-phase-axis', left) + o.ruler.width('en-phase-axis', right) + 8;
  const bar = o.width - NAME - valueW - 2 * GAP;
  const stacked = bar < Math.max(BAR_MIN, axisW);
  // narrower still: the figure under the name, the bar under both
  const tall = stacked && NAME + GAP + valueW > o.width;
  return html`<div class="en-phases">
      ${o.rows.map((r, i) => {
        const f = figures[i] as Figure;
        return html`<div
          class="en-phase ${stacked ? 'en-phase--stack' : ''} ${tall ? 'en-phase--tall' : ''}"
          style=${stacked ? '' : `grid-template-columns:${NAME}px minmax(0, 1fr) ${valueW}px`}
        >
          <span class="en-phase__name"
            >${r.label}${r.sub ? html`<small>${r.sub}</small>` : nothing}</span
          >
          <span class="en-phase__bar" data-measure="drawn"
            ><i class="en-phase__zero"></i>${
              f.way
                ? html`<span
                    class="en-phase__fill en-phase__fill--${f.way}"
                    style="width:${(f.reach * 50).toFixed(1)}%"
                  ></span>`
                : nothing
            }</span
          >
          <span class="en-phase__value"
            >${f.value}${f.unit ? html`<span class="en-unit">${f.unit}</span>` : nothing}</span
          >
        </div>`;
      })}
    </div>
    <div
      class="en-phase-axis"
      style=${stacked ? 'margin:4px 0 0' : `margin:4px ${valueW + GAP}px 0 ${NAME + GAP}px`}
    >
      <span>${left}</span><span>${right}</span>
    </div>`;
}

/** A phase's row in a narrow column: its name and figure on one line, its bar under them across the column. */
export const phaseStyles = css`
  /* an axis too wide for its column folds: the out side on its line, the in side on the next at the end */
  .en-phase-axis {
    flex-wrap: wrap;
  }
  .en-phase-axis > span:last-child {
    margin-left: auto;
  }
  .en-phase--stack {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }
  .en-phase--stack .en-phase__bar {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .en-phase--tall {
    grid-template-columns: minmax(0, 1fr);
  }
  .en-phase--tall .en-phase__value {
    text-align: left;
  }
  .en-phase--tall .en-phase__bar {
    grid-row: 3;
  }
  /* each word of the axis whole: the second takes a line of its own, at the end, when both do not fit one */
  .en-phase-axis {
    flex-wrap: wrap;
    column-gap: 8px;
  }
  .en-phase-axis > span {
    white-space: nowrap;
  }
  .en-phase-axis > span:last-child {
    margin-left: auto;
  }
`;
