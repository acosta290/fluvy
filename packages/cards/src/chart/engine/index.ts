/**
 * The chart engine (1.11): every chart and gauge of the house drawn by one set of rules, in its own chunk (`chart`),
 * reached by a core card through `ChartLoader` (`shared/chart-load.ts`: fetched once at start, its sheet adopted as it
 * lands) and by a card in a lazy chunk by a static import (energy, history bars, the History page …), which adds
 * `chartStyles` to its own.
 *
 * The API (what the adopting cards, the Chart card and the settings panel build on):
 *
 *   resolveStyle(preset, fine, caps, house?)  a card's style: its own key (`chart`, the fine keys of
 *                                             `shared/chart-config.ts`) › the house's chart settings
 *                                             (`chartDefaults()`, fluvy's settings → Charts) › the style's own
 *                                             defaults (`CHART_PRESETS`); `resolveGauge` likewise for `gauge`
 *   drawChart(spec)                           the drawing (`draw.ts`): a frame (width, height, headroom, pad, the
 *                                             scale's column), the series (evenly spaced values, `null` a gap, a
 *                                             tone, a series colour or a colour of their own, a band), the style,
 *                                             the scale, the extent, `now`, the cursor; `data-measure="drawn"` on
 *                                             the svg, Fluvy's knobs beside it (the wrapper is the card's,
 *                                             positioned, as for the bubble)
 *   plotOf(spec) · readAt(spec, fraction)     where the plot is (the axis row starts at its `left`); where each line
 *                                             is at a fraction of the plot, and the reading there: the bubble's place
 *   chartBubble(o)                            the value bubble (`decor.ts`): `look` the style's, `lean` 16 for classic
 *   drawGauge(o)                              a gauge in its style (`gauge.ts`): Fluvy's controls read-only — ticks,
 *                                             dial, ring, ruler
 *   ScrubController · scrub(controller)       reading a chart by pointing at it (`scrub.ts`): one owner for every
 *                                             chart that scrubs, the keys that read it without a pointer
 *   chartSection(caps, capsOf?) · chartDefaultsFor(config, caps) · chartKeysFor(caps) · gaugeField(options)
 *                                             the editor's Chart section (`fields.ts`): an editor opens once the
 *                                             engine has landed (`Card.getConfigElement`)
 *   chartStyles · adopt(root)                 the engine's sheet (`styles.ts`)
 *   previewChart(settings, mode)              the settings panel's preview: a small chart and a gauge as the
 *                                             settings draw them
 *   the maths, pure and tested: `scale.ts` (tightScale, airScale, niceTicks, niceStep, yOf), `path.ts`
 *   (linePath, areaPath, bandPath, yAt, splitAt), `bars.ts` (barGeometry, barPath, columns, thinStep, labelled,
 *   labelsApart), `axis.ts` (tickText, gridLines, tickLabels, unitLabel, quarterTicks, roundTicks), `ring.ts` (polar,
 *   arcPath, arcDash, radialTicks, knobAt), `model.ts` (evenly, sampleAt, bucket, readingsOf), `palette.ts` (seriesInk,
 *   seriesPaint,
 *   seriesCheck)
 *
 * The 1.10 geometry is kept byte for byte (`classic.test.ts` against `__fixtures__/classic-1.10.json`): a card that
 * says `chart: classic`, and every card until the house chooses another style, draws exactly what it drew.
 */
import { CHART_DEFAULTS, type ChartSettings } from '@fluvy/core';
import type { PaletteMode } from '@fluvy/tokens/runtime';
import { html, type TemplateResult } from 'lit';
import { drawChart } from './draw.js';
import { drawGauge } from './gauge.js';
import { resolveGauge, resolveStyle } from './presets.js';

export type { ChartPoint, ChartSeries, Curve, SeriesColour, Window } from './model.js';
export { bucket, evenly, readingsOf, sampleAt, type BucketRule, type Readings } from './model.js';
export {
  airScale,
  niceStep,
  niceTicks,
  tightScale,
  yOf,
  type NiceStep,
  type PlotBox,
  type Scale,
  type Ticks,
  type TightScale,
} from './scale.js';
export { areaPath, bandPath, linePath, runsOf, splitAt, yAt, type Pt } from './path.js';
export {
  barGeometry,
  barPath,
  columns,
  labelled,
  labelsApart,
  thinStep,
  type BarGeometry,
  type Column,
  type ColumnsOptions,
  type Placed,
  type Rounded,
} from './bars.js';
export {
  AXIS_GAP,
  gridLines,
  quarterTicks,
  roundTicks,
  tickLabels,
  tickText,
  UNIT_COLUMN,
  unitLabel,
  type MarksOptions,
  type QuartersOptions,
  type TimeTick,
} from './axis.js';
export {
  arcDash,
  arcPath,
  knobAt,
  polar,
  radialTicks,
  type RadialTicksOptions,
  type Tick,
} from './ring.js';
export {
  chartBubble,
  cursorLine,
  dot,
  highlightPill,
  KNOB,
  knob,
  legend,
  nowLine,
  point,
  shadowCopy,
  type BubbleOptions,
  type LegendItem,
} from './decor.js';
export { dialRadius, drawGauge, type GaugeOptions } from './gauge.js';
export { chartDefaultsFor, chartKeysFor, chartSection, gaugeField, type CapsOf } from './fields.js';
export {
  ACTS,
  acts,
  CHART_PRESETS,
  GAUGE_PRESETS,
  isBars,
  presetsFor,
  resolveGauge,
  resolveStyle,
  type GaugeSpec,
  type PresetSpec,
  type ResolvedGauge,
  type ResolvedStyle,
} from './presets.js';
export {
  seriesCheck,
  seriesInk,
  seriesPaint,
  type SeriesPaint,
  type SeriesWarning,
} from './palette.js';
export { adopt, chartStyles } from './styles.js';
export { scrub, ScrubController, scrubFraction } from './scrub.js';
export { drawChart, plotOf, readAt, type ChartFrame, type ChartSpec } from './draw.js';

/** A day of temperature, the one series every style is previewed on: the past two thirds, the rest forecast. */
const PREVIEW = Array.from({ length: 24 }, (_unused, i) => {
  const t = i / 23;
  return Math.round((17.8 + 6.9 * Math.exp(-((t - 0.62) ** 2) / 0.07) - 1.4 * t) * 10) / 10;
});

/**
 * The settings panel's preview: one small chart and one gauge drawn with a set of chart settings, as the appearance
 * preview draws the look — what the Charts tab shows while its settings move, in either mode (`data-mode`: the
 * fills' dark points). The chart's wrapper is positioned, so its knobs sit on it.
 */
export function previewChart(
  settings: Partial<ChartSettings>,
  mode: PaletteMode,
  width = 240,
): TemplateResult {
  const house: ChartSettings = { ...CHART_DEFAULTS, ...settings };
  const style = resolveStyle(undefined, {}, { now: true, axis: false }, house);
  const gauge = resolveGauge(undefined, {}, house);
  return html`<div class="fc-preview" data-mode=${mode}>
    <div class="fc-preview__chart" style="position:relative;width:${width}px;height:96px">
      ${drawChart({
        frame: { width, height: 96, headroom: 24, pad: 8 },
        series: [{ values: PREVIEW }],
        style,
        now: 2 / 3,
        id: 'fc-preview',
      })}
    </div>
    ${drawGauge({
      style: gauge,
      size: gauge.preset === 'ruler' ? width : 112,
      min: 0,
      max: 100,
      value: 62,
      format: (value) => String(Math.round(value)),
      unit: '%',
      tone: 'accent',
      small: true,
    })}
  </div>`;
}
