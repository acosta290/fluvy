import { textWidth, type Tone } from '@fluvy/ui';
import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import type { SeriesPaint } from './palette.js';

/**
 * What a chart wears over its lines: the value bubble on the cursor, the end of a line (the classic dot, or Fluvy's
 * knob — the thermostat's ball, never a circle of the engine's own), the line at now, the cursor across the plot, the
 * soft copy of a line under it, the pill of a highlighted window and a legend. Each is placed by rule: the bubble
 * centred on its x and kept inside the plot (its tail moves, not the pill), a dot or a knob whole by its radius, a
 * legend's swatches and words on the 4 grid. The bubble and the knobs are the page's boxes, placed in the chart's
 * wrapper (a positioned box the drawing fills from its top left): the knob is the controls' own `.fv-knob`.
 */

export interface BubbleOptions {
  /** Where the dot is, in the chart's px. */
  readonly x: number;
  /** The chart's width: the bubble stays inside it. */
  readonly width: number;
  /** Where the plot starts (a scale's column before it): the bubble stays right of it. */
  readonly start?: number;
  /**
   * How far the bubble may lean past the plot's ends into the card's padding: 16 for the classic bubble (1.0's, which
   * keeps its tail on a dot at the very edge), none for the styles, whose bubble stays inside the plot.
   */
  readonly lean?: number;
  readonly value: string;
  readonly unit?: string;
  /** While scrubbed, when that was ("10:15"). */
  readonly time?: string;
  /** The chart's face (the card's font family). */
  readonly family?: string;
  /** Dark (the text's ink, the default) or in the series' tone with white words. */
  readonly look?: 'dark' | 'tone';
}

/**
 * The value bubble over a chart's dot: the value (15/700), its unit and, while scrubbed, the time (13/500), 12 px sides,
 * never narrower than 80, on the 4 grid — sized by the shared measurer, as the page lays it out. It stays inside the
 * chart, its tail on the dot (on the pill's straight part).
 */
export function chartBubble(o: BubbleOptions): TemplateResult {
  const family = o.family;
  const face = (size: number, weight: number) => ({
    size,
    weight,
    tabular: true,
    ...(family ? { family } : {}),
  });
  const unit = o.unit ? ` ${o.unit}` : '';
  const text =
    textWidth(o.value, face(15, 700)) +
    (unit ? 2 + textWidth(unit, face(13, 500)) : 0) +
    (o.time ? 2 + 4 + textWidth(o.time, face(13, 500)) : 0);
  const width = Math.max(80, Math.ceil((Math.ceil(text) + 24) / 4) * 4);
  // at either end the classic bubble leans into the card's own padding rather than let its tail leave the dot
  const lean = o.lean ?? 16;
  const start = (o.start ?? 0) - lean;
  const left = Math.min(Math.max(o.x - width / 2, start), Math.max(start, o.width - width + lean));
  const tail = Math.min(Math.max(Math.round(o.x - left - 6), 8), width - 20);
  return html`<span
    class="fv-bubble is-visible ${o.look === 'tone' ? 'fv-bubble--tone' : ''}"
    data-measure="value"
    style="left:${left.toFixed(2)}px;width:${width}px;--tail:${tail}px"
    ><b>${o.value}</b>${unit}${
      o.time ? html`<span class="fv-bubble__time">${o.time}</span>` : nothing
    }</span
  >`;
}

const px = (n: number): string => n.toFixed(2);

/** The classic dot at the end of a line (r 5, the card's stroke), in a tone where one is given (a lowest, a highest). */
export const dot = (x: number, y: number, tone?: Tone): SVGTemplateResult =>
  svg`<circle class="curve-dot ${tone ? `fv-tone--${tone}` : ''}" cx=${px(x)} cy=${px(y)} r="5" />`;

/** A reading among every reading drawn (`show_points: all`): the classic dot, smaller. */
export const point = (x: number, y: number): SVGTemplateResult =>
  svg`<circle class="curve-dot fc-point" cx=${px(x)} cy=${px(y)} r="3" />`;

/** Fluvy's knob in a chart: 16 across, its ring in the series' ink, its halo the card's (it cuts the line under it). */
export const KNOB = 16;

/** The paint a series' marks wear: its tone's class, its ink, or the person's own colour (the card's accent sheet). */
const painted = (paint: SeriesPaint | undefined): { className: string; style: string } => ({
  className: paint?.className ?? '',
  style: paint?.ink ? `;--tone-ink:${paint.ink}` : '',
});

/**
 * Fluvy's knob where a line ends or now falls (the controls' `.fv-knob`, as the thermostat's dial and the rulers draw
 * it): a box of the page, placed at (`x`, `y`) of the drawing in the chart's wrapper.
 */
export function knob(x: number, y: number, paint?: SeriesPaint, accent?: string): TemplateResult {
  const { className, style } = painted(paint);
  return html`<span
    class="fv-knob fc-knob ${className}"
    data-accent=${accent ?? nothing}
    data-measure="value"
    style="left:${px(x - KNOB / 2)}px;top:${px(y - KNOB / 2)}px;width:${KNOB}px;height:${KNOB}px${style}"
  ></span>`;
}

/** Now as a hairline across the plot, where the past meets the forecast (the knob sits on it where the style has one). */
export const nowLine = (x: number, top: number, bottom: number): SVGTemplateResult =>
  svg`<line class="fc-now" x1=${px(x)} y1=${px(top)} x2=${px(x)} y2=${px(bottom)} />`;

/** The cursor across the plot while it is read: the classic dashes (3·4, strong border, 1.5) or a hairline. */
export const cursorLine = (
  x: number,
  top: number,
  bottom: number,
  kind: 'dashed' | 'hairline',
): SVGTemplateResult =>
  kind === 'dashed'
    ? svg`<line class="curve-cursor" x1=${x} y1=${top} x2=${x} y2=${bottom} />`
    : svg`<line class="fc-cursor" x1=${px(x)} y1=${px(top)} x2=${px(x)} y2=${px(bottom)} />`;

/**
 * The soft copy of a line under it: the same path moved down by `offset`, wider, at `opacity` — no filter, which would
 * re-rasterise on every frame of the draw-in and every scrub; `blur` names a filter for the static glow style, which
 * blurs its copy once.
 */
export const shadowCopy = (
  d: string,
  o: {
    readonly offset: number;
    readonly width: number;
    readonly opacity: number;
    readonly blur?: string;
  },
): SVGTemplateResult =>
  svg`<path class="fc-glow" d=${d} stroke-width=${o.width} opacity=${o.opacity} transform="translate(0 ${o.offset})" filter=${o.blur ? `url(#${o.blur})` : nothing} />`;

/** A pill naming a highlighted window ("● Cheapest 13:00–15:00 · 0.078 €"), in its tone. */
export const highlightPill = (tone: Tone, text: string): TemplateResult =>
  html`<span class="fc-pill fv-tone--${tone}" data-measure="value"
    ><i class="fc-pill__dot"></i>${text}</span
  >`;

export interface LegendItem {
  readonly name: string;
  /** The swatch's tone, or a colour of its own as the card's accent sheet keys it. */
  readonly tone?: Tone;
  readonly accent?: string;
  /** The ink as a CSS value where neither names it (a series colour). */
  readonly ink?: string;
  readonly value?: string;
}

/** A legend under a chart of several series: a 12 px swatch (radius 3) and the name, 12/500, the value beside it. */
export const legend = (items: readonly LegendItem[]): TemplateResult =>
  html`<ul class="fc-legend">
    ${items.map(
      (item) =>
        html`<li
          class="fc-legend__item ${item.tone ? `fv-tone--${item.tone}` : ''}"
          data-accent=${item.accent ?? nothing}
          style=${item.ink ? `--tone-ink:${item.ink}` : nothing}
        >
          <i class="fc-legend__swatch"></i
          ><span class="fc-legend__name" data-name>${item.name}</span>${
            item.value
              ? html`<span class="fc-legend__value" data-measure="value">${item.value}</span>`
              : nothing
          }
        </li>`,
    )}
  </ul>`;
