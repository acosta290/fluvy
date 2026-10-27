import {
  CHART_DEFAULTS,
  type ChartPreset,
  type ChartSettings,
  type GaugePreset,
} from '@fluvy/core';
import type { Hex, PaletteMode } from '@fluvy/tokens/runtime';
import { html, type TemplateResult } from 'lit';
import { drawChart, drawRead, readAt, type ChartSpec } from './draw.js';
import { drawGauge } from './gauge.js';
import type { ChartSeries, SeriesColour } from './model.js';
import { isBars, resolveGauge, resolveStyle } from './presets.js';

/*
 * What the settings panel's Charts tab draws while its settings move, every drawing the engine's own on made-up
 * readings: a style's tile, a gauge's tile, the preview of a sensor's chart, a chart of bars and a gauge in either mode,
 * and the six lines of a set of series colours. Each takes the house's chart settings being chosen, never the saved
 * ones; a drawing's wrapper is positioned and sized, so Fluvy's knobs and the bubble sit on it.
 */

/** A day of temperature, the one curve every style is previewed on: the past two thirds, the rest forecast. */
const DAY = Array.from({ length: 24 }, (_unused, i) => {
  const t = i / 23;
  return Math.round((17.8 + 6.9 * Math.exp(-((t - 0.62) ** 2) / 0.07) - 1.4 * t) * 10) / 10;
});
/** Its readings' lows and highs, as a summary keeps them: the band style draws them behind the line. */
const BAND = {
  low: DAY.map((v, i) => Math.round((v - 1.4 - 0.4 * Math.sin(i / 3)) * 10) / 10),
  high: DAY.map((v, i) => Math.round((v + 1.1 + 0.4 * Math.cos(i / 4)) * 10) / 10),
};
/**
 * The house's day of energy in twelve slots of two hours (kWh): a quiet night, the midday's peak before now (the bar a
 * style lights as the highest is one that has happened), a lesser evening in the forecast.
 */
const ENERGY = Array.from(
  { length: 12 },
  (_unused, slot) =>
    Math.round(
      (0.6 + 3.2 * Math.exp(-((slot - 6) ** 2) / 2) + 1.8 * Math.exp(-((slot - 10) ** 2) / 2)) *
        100,
    ) / 100,
);
/** Now, two thirds into the day: what lies beyond it is drawn as each style draws a forecast. */
const NOW = 2 / 3;
/** Everything a preview can draw: a window past now, slots for bars, a band. */
const EVERYTHING = { now: true, bars: true, band: true } as const;

const houseOf = (settings: Partial<ChartSettings>): ChartSettings => ({
  ...CHART_DEFAULTS,
  ...settings,
});

/** The made-up readings a style is drawn on: the day of energy for the bars, the day of temperature for a line. */
const sampleOf = (preset: ChartPreset): ChartSeries =>
  isBars(preset) ? { values: ENERGY } : { values: DAY, band: BAND };

/** A drawing in a wrapper of its size, positioned: its knobs (and a bubble) are placed on it. */
const plot = (width: number, height: number, content: unknown): TemplateResult =>
  html`<div class="fc-plot" style="position:relative;width:${width}px;height:${height}px">
    ${content}
  </div>`;

/** A style's tile: the style on its made-up readings, `width` × `height`, as the house's settings draw it. */
export function previewStyle(
  preset: ChartPreset,
  settings: Partial<ChartSettings>,
  width: number,
  height: number,
): TemplateResult {
  return plot(
    width,
    height,
    drawChart({
      frame: { width, height, headroom: 12, pad: 4 },
      series: [sampleOf(preset)],
      style: resolveStyle(preset, {}, EVERYTHING, houseOf(settings)),
      now: NOW,
      id: `fc-tile-${preset}`,
    }),
  );
}

export interface GaugePreviewOptions {
  /** A dial's or a ring's box, or a ruler's length. */
  readonly size: number;
  /** The reading as the panel writes it, in its language. */
  readonly format: (value: number) => string;
  /** A tile's drawing (the small dial, a thinner ring), or the preview's. */
  readonly small: boolean;
}

/** A gauge style on one reading (62 %), as the house's settings draw it. */
export function previewGauge(
  preset: GaugePreset | undefined,
  settings: Partial<ChartSettings>,
  o: GaugePreviewOptions,
): TemplateResult {
  return drawGauge({
    style: resolveGauge(preset, {}, houseOf(settings)),
    size: o.size,
    min: 0,
    max: 100,
    value: 62,
    format: o.format,
    unit: '%',
    tone: 'accent',
    small: o.small,
  });
}

export interface ChartPreviewOptions {
  readonly mode: PaletteMode;
  /** The column's width: every drawing takes it whole (a dial or a ring at most 112 of it). */
  readonly width: number;
  /** A reading as the panel writes it, in its language (the bubble's figure, the gauge's). */
  readonly format: (value: number) => string;
  /** The page's face, for the bubble's width. */
  readonly family?: string;
}

/**
 * The Charts tab's preview in one mode (`data-mode`: the fills' dark points): a sensor's day of temperature in the
 * house's style (its bubble at rest where the style shows one), the day's energy as bars in it (a card of slots draws
 * bars in any style), and a gauge in the house's gauge style. A style the line cannot take (bars, columns) draws the
 * line as the sensor would: classic.
 */
export function previewChart(
  settings: Partial<ChartSettings>,
  o: ChartPreviewOptions,
): TemplateResult {
  const house = houseOf(settings);
  const line: ChartSpec = {
    frame: { width: o.width, height: 120, headroom: 44 },
    series: [{ values: DAY, band: BAND }],
    style: resolveStyle(undefined, {}, { now: true, band: true }, house),
    now: NOW,
    id: `fc-preview-${o.mode}-line`,
  };
  // at rest, the reading now: the bubble where the style shows one
  const rest = { value: o.format(DAY[readAt(line, null).index] as number), unit: '°C' };
  const bars = resolveStyle(undefined, {}, EVERYTHING, house);
  const gauge = resolveGauge(undefined, {}, house).preset;
  return html`<div class="fc-preview" data-mode=${o.mode}>
    ${plot(o.width, 120, drawRead(line, null, rest, o.family))}
    ${plot(
      o.width,
      64,
      drawChart({
        frame: { width: o.width, height: 64, headroom: 8, pad: 0 },
        series: [{ values: ENERGY }],
        style: bars,
        kind: 'bars',
        now: NOW,
        id: `fc-preview-${o.mode}-bars`,
      }),
    )}
    <div class="fc-preview__gauge">
      ${previewGauge(undefined, settings, {
        size: gauge === 'ruler' ? o.width : Math.min(112, o.width),
        format: o.format,
        small: true,
      })}
    </div>
  </div>`;
}

/**
 * A set of six series colours as a chart of several sensors draws them, in the house's line: six days, one above the
 * other on one scale, without a fill or a mark to stand between the colours and the card.
 */
export function previewSeries(
  colours: readonly Hex[],
  settings: Partial<ChartSettings>,
  o: { readonly mode: PaletteMode; readonly width: number; readonly height: number },
): TemplateResult {
  return plot(
    o.width,
    o.height,
    drawChart({
      frame: { width: o.width, height: o.height, headroom: 4, pad: 4 },
      series: colours.map((colour, n) => ({
        values: DAY.map((v, i) => v + n * 4.5 + 1.2 * Math.sin(i / 3 + n)),
        colour: colour as SeriesColour,
      })),
      style: resolveStyle(
        'soft',
        { fill: 'none', glow: false, show_grid: false, show_points: 'none' },
        { several: true },
        houseOf(settings),
      ),
      id: `fc-series-${o.mode}`,
    }),
  );
}
