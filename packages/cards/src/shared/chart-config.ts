import type { ChartPreset, GaugePreset } from '@fluvy/core';

/**
 * What a card says of its chart: the named style (`chart`) and the fine keys that override the style's own and the
 * house's chart settings, each a key of its own at the top level of the config, never written unless chosen. Which
 * fine keys a style acts on is `ACTS`; which the card can draw at all is its `ChartCaps`. Every page carries this
 * file (the editors read it): the drawing is the chart chunk's.
 */

export type { ChartPreset, GaugePreset };

export type Curve = 'smooth' | 'straight' | 'step';
export type FillKind = 'gradient' | 'flat' | 'none';
export type LineWidth = 'thin' | 'regular' | 'bold';
export type Points = 'none' | 'end' | 'all';
/** The gridlines: the style's own (`auto`, or `true`), none (`false`), or which: vertical, horizontal, both. */
export type GridChoice = 'auto' | 'none' | 'x' | 'y' | 'both' | boolean;
export type Highlight = 'none' | 'min' | 'max' | 'both' | 'current';

export interface ChartKeys {
  /** The chart's style; none: the house's. */
  chart?: ChartPreset;
  curve?: Curve;
  fill?: FillKind;
  /** The line's width: `thin` (1.5), `regular` (2.5, the default) or `bold` (3). */
  line_width?: LineWidth;
  /** The soft shadow under the line (`soft` and `glow` draw one; a style without one cannot be given it). */
  glow?: boolean;
  /** The points on the line: none, the one at its end, or every reading. */
  show_points?: Points;
  show_grid?: GridChoice;
  /** The scale's tick labels beside the plot, where the style draws one. */
  show_axis?: boolean;
  /** The marker at "now", where the window runs past it. */
  show_now?: boolean;
  /** The readings marked out: the lowest, the highest, both, or the current one. */
  highlight?: Highlight;
  /** Whether this chart draws itself in and moves; none: the house's. */
  animate?: boolean;
}

export type FineKey = Exclude<keyof ChartKeys, 'chart'>;

/** Every chart key, in the editor's order. */
export const CHART_KEYS = [
  'chart',
  'curve',
  'fill',
  'line_width',
  'glow',
  'show_points',
  'show_grid',
  'show_axis',
  'show_now',
  'highlight',
  'animate',
] as const satisfies readonly (keyof ChartKeys)[];

const LINE: readonly FineKey[] = [
  'curve',
  'fill',
  'line_width',
  'show_points',
  'show_grid',
  'show_axis',
  'animate',
];

/** The fine keys each style acts on: a key a style cannot draw is not offered in it, and does nothing in it. */
export const ACTS: Readonly<Record<ChartPreset, readonly FineKey[]>> = {
  classic: LINE,
  soft: [...LINE, 'glow', 'show_now', 'highlight'],
  glow: [...LINE, 'glow', 'show_now', 'highlight'],
  minimal: [...LINE, 'show_now'],
  step: [
    'fill',
    'line_width',
    'show_points',
    'show_grid',
    'show_axis',
    'show_now',
    'highlight',
    'animate',
  ],
  bars: ['show_grid', 'show_axis', 'show_now', 'highlight', 'animate'],
  columns: ['show_grid', 'show_axis', 'show_now', 'animate'],
  band: ['line_width', 'show_points', 'show_grid', 'show_axis', 'show_now', 'animate'],
};

/** What a card (in a variant) can draw: the styles and keys it is offered follow from it. */
export interface ChartCaps {
  /** The window runs past now (a forecast, a day): a now marker and a dashed future can be drawn. */
  readonly now?: boolean;
  /** The card can draw bars and columns (it has slots, not a continuous line). */
  readonly bars?: boolean;
  /** The card has a low/high band to draw (summarised readings). */
  readonly band?: boolean;
  /** Several series share the plot: a highlight would claim to be every one of them. */
  readonly several?: boolean;
  /** The card has room for a scale's tick labels. */
  readonly axis?: boolean;
}

/** The styles a card can draw with what it has: the line styles always, bars and columns with slots, the band with a band. */
export function presetsFor(caps: ChartCaps): ChartPreset[] {
  const out: ChartPreset[] = ['classic', 'soft', 'glow', 'minimal', 'step'];
  if (caps.bars) out.push('bars', 'columns');
  if (caps.band) out.push('band');
  return out;
}

/** Whether a fine key acts in a style on a card that can draw it. */
export function acts(key: FineKey, preset: ChartPreset, caps: ChartCaps): boolean {
  if (!ACTS[preset].includes(key)) return false;
  if (key === 'show_now') return caps.now === true;
  if (key === 'show_axis') return caps.axis !== false;
  if (key === 'highlight') return !caps.several;
  return true;
}

/** The chart keys of a config, as given. */
export function chartKeysOf(config: Readonly<Record<string, unknown>> | undefined): ChartKeys {
  const out: Record<string, unknown> = {};
  if (config) for (const key of CHART_KEYS) if (config[key] !== undefined) out[key] = config[key];
  return out as ChartKeys;
}
