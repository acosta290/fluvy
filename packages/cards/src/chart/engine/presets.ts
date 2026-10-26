import { chartDefaults, type ChartPreset, type ChartSettings, type GaugePreset } from '@fluvy/core';
import {
  acts,
  presetsFor,
  type ChartCaps,
  type ChartKeys,
  type Curve,
  type Highlight,
} from '../../shared/chart-config.js';

/**
 * The named styles (the approved design, 2026-10-26): what each draws, and one rule that resolves a card's style —
 * the card's own key › the house's chart settings › the style's own default. A card with no `chart` key draws the
 * house's style; one that says `chart: classic` keeps classic whatever the house says. `classic` is 1.10's chart and
 * takes nothing from the house but its colours: a house that never chose a style changes nothing on any dashboard.
 */

export interface PresetSpec {
  readonly curve: Curve;
  readonly fill: 'gradient' | 'flat' | 'band' | 'none';
  /** The line's width: the house's (`regular`, 2.5), or one step thinner. */
  readonly line: 'regular' | 'thin';
  readonly glow: 'none' | 'soft' | 'blur';
  /** The end of the line: the classic dot, the house's end (Fluvy's knob, or the dot), or nothing. */
  readonly end: 'dot' | 'house' | 'none';
  /** The gridlines it draws; a horizontal one puts the chart on a nice scale (zero a tick). */
  readonly grid: 'none' | 'x' | 'y' | 'both';
  /** Whether it marks now where the window runs past it. */
  readonly now: boolean;
  /** How the forecast is drawn beyond now. */
  readonly future: 'dashed' | 'faint' | 'hollow';
  /** The cursor while the chart is read: the classic dashes (drawn at rest too), a hairline, none, a bar's slot. */
  readonly cursor: 'dashed' | 'hairline' | 'none' | 'snap';
  /** Whether the value's bubble stands over the line at rest (every style shows it while the chart is read). */
  readonly label: boolean;
  readonly highlight: Highlight;
  /** How bars are filled: the classic gradient, the ink with the highest in ink and the rest quiet, or the ink alone. */
  readonly bars: 'gradient' | 'max' | 'ink';
}

export const CHART_PRESETS: Readonly<Record<ChartPreset, PresetSpec>> = {
  classic: {
    curve: 'smooth',
    fill: 'gradient',
    line: 'regular',
    glow: 'none',
    end: 'dot',
    grid: 'none',
    now: false,
    future: 'dashed',
    cursor: 'dashed',
    label: true,
    highlight: 'none',
    bars: 'gradient',
  },
  soft: {
    curve: 'smooth',
    fill: 'gradient',
    line: 'regular',
    glow: 'soft',
    end: 'house',
    grid: 'x',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'max',
  },
  glow: {
    curve: 'smooth',
    fill: 'none',
    line: 'regular',
    glow: 'blur',
    end: 'house',
    grid: 'none',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'ink',
  },
  minimal: {
    curve: 'smooth',
    fill: 'none',
    line: 'thin',
    glow: 'none',
    end: 'dot',
    grid: 'none',
    now: false,
    future: 'faint',
    cursor: 'none',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  step: {
    curve: 'step',
    fill: 'flat',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'both',
    bars: 'ink',
  },
  bars: {
    curve: 'straight',
    fill: 'none',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'hollow',
    cursor: 'snap',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  columns: {
    curve: 'straight',
    fill: 'none',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'hollow',
    cursor: 'snap',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  band: {
    curve: 'straight',
    fill: 'band',
    line: 'regular',
    glow: 'none',
    end: 'dot',
    grid: 'y',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'ink',
  },
};

/** The styles drawn as bars: a value per slot, never a line. */
export const isBars = (preset: ChartPreset): boolean => preset === 'bars' || preset === 'columns';

/**
 * A gauge style, each one of Fluvy's own controls read-only: the dial's ticks (`<fluvy-dial gauge>`, 54 over 270°
 * lit to the value), the thermostat's dial with its disc and its knob (`<fluvy-dial readonly>`), a ring lit to the
 * value with the knob at its end, the ruler with its marker (`<fluvy-ruler marker>`). `motion` says whether a gauge
 * moves: none of these does; the animated gauges, a later block, come in through the same door, each saying so here.
 */
export interface GaugeSpec {
  readonly motion: boolean;
}

export const GAUGE_PRESETS: Readonly<Record<GaugePreset, GaugeSpec>> = {
  ticks: { motion: false },
  dial: { motion: false },
  ring: { motion: false },
  ruler: { motion: false },
};

/** The line widths in px: the house's `regular` is 2.5; a thin style draws one step thinner, never under 1.5. */
const LINE_PX = { thin: 1.5, regular: 2.5, bold: 3 } as const;

export interface ResolvedStyle {
  readonly preset: ChartPreset;
  readonly curve: Curve;
  readonly fill: PresetSpec['fill'];
  /** The fill's opacity at the top of the gradient (or of a flat fill); dark mode adds six points in the sheet. */
  readonly fillOpacity: number;
  readonly line: number;
  readonly glow: {
    readonly kind: PresetSpec['glow'];
    readonly offset: number;
    readonly opacity: number;
  };
  /** The points drawn on the line: none, its end, or every reading. */
  readonly points: 'none' | 'end' | 'all';
  /** How the end of the line is drawn: the classic dot, or Fluvy's knob. */
  readonly end: 'dot' | 'knob';
  /** The gridlines drawn, and how. */
  readonly grid: { readonly axes: PresetSpec['grid']; readonly kind: 'hairline' | 'dashed' };
  /** A nice scale (zero a tick) under a horizontal grid and under bars; the series' own ends otherwise. */
  readonly scale: 'nice' | 'tight';
  /** The scale's tick labels in a column before the plot, where the style draws a scale. */
  readonly axis: boolean;
  /** Now, where the window runs past it: Fluvy's knob on the line, a hairline, or nothing. */
  readonly now: 'none' | 'knob' | 'line';
  readonly future: PresetSpec['future'];
  readonly cursor: PresetSpec['cursor'];
  /** The bubble's look, and whether it stands at rest. */
  readonly bubble: 'dark' | 'tone';
  readonly label: boolean;
  readonly highlight: Highlight;
  readonly caps: 'top' | 'both';
  readonly bars: PresetSpec['bars'];
  /** Whether the chart draws itself in (off: its resting frame at once). */
  readonly animate: boolean;
}

/**
 * A card's style, resolved: its own keys first, the house's settings next, the style's own defaults last. A fine key
 * the style does not act on (or the card cannot draw) is ignored, as the editor never offers it, and a style the card
 * cannot draw (bars over several sensors) is drawn `classic`. `classic` reads nothing of the house's but motion: it is
 * the chart every card drew before 1.11.
 */
export function resolveStyle(
  preset: ChartPreset | undefined,
  fine: ChartKeys,
  caps: ChartCaps,
  house: ChartSettings = chartDefaults().settings,
): ResolvedStyle {
  const wanted = preset ?? house.style;
  const name = presetsFor(caps).includes(wanted) ? wanted : 'classic';
  const spec = CHART_PRESETS[name];
  const own = <K extends Exclude<keyof ChartKeys, 'chart'>>(key: K): ChartKeys[K] | undefined =>
    acts(key, name, caps) ? fine[key] : undefined;
  const classic = name === 'classic';
  const lineWord = own('line_width') ?? (classic ? 'regular' : house.line);
  const line = spec.line === 'thin' ? Math.max(1.5, LINE_PX[lineWord] - 1) : LINE_PX[lineWord];
  const glowOn = own('glow') ?? spec.glow !== 'none';
  const glowKind = glowOn ? (spec.glow === 'none' ? 'soft' : spec.glow) : 'none';
  const fill = own('fill') ?? spec.fill;
  const gridChoice = own('show_grid');
  const axes =
    gridChoice === false || gridChoice === 'none' || (!classic && house.grid === 'none')
      ? 'none'
      : gridChoice === 'x' || gridChoice === 'y' || gridChoice === 'both'
        ? gridChoice
        : spec.grid;
  const nowOn = (own('show_now') ?? spec.now) && caps.now === true;
  return {
    preset: name,
    curve: own('curve') ?? spec.curve,
    fill,
    fillOpacity: classic ? 0.28 : fill === 'flat' ? house.fill / 150 : house.fill / 100,
    line,
    glow: {
      kind: glowKind,
      offset: house.glow.offset,
      // the blurred copy spreads its ink: a tenth more of it reads as strong as the offset one
      opacity:
        glowKind === 'blur'
          ? Math.min(0.6, Math.round((house.glow.opacity + 0.1) * 100) / 100)
          : house.glow.opacity,
    },
    points: own('show_points') ?? (spec.end === 'none' ? 'none' : 'end'),
    end: spec.end === 'house' ? house.endpoint : 'dot',
    grid: { axes, kind: !classic && house.grid === 'dashed' ? 'dashed' : 'hairline' },
    scale: spec.grid === 'y' || spec.grid === 'both' || isBars(name) ? 'nice' : 'tight',
    axis: (own('show_axis') ?? true) && caps.axis !== false,
    now: nowOn ? house.now : 'none',
    future: spec.future,
    cursor: spec.cursor,
    bubble: classic ? 'dark' : house.bubble,
    label: spec.label,
    highlight: own('highlight') ?? spec.highlight,
    caps: classic ? 'top' : house.caps,
    bars: spec.bars,
    animate: fine.animate ?? house.animate,
  };
}

export interface ResolvedGauge {
  readonly preset: GaugePreset;
  /** The liquid gauges' wave height in px (the animated gauges' own). */
  readonly wave: number;
  /** Whether the gauge moves: the card's (or the house's) `animate`, and a style that has motion to show. */
  readonly animate: boolean;
}

const WAVE_PX = { low: 4, mid: 7, high: 10 } as const;

/** A card's gauge style, resolved as a chart's is: its own key, the house's settings, the style's defaults. */
export function resolveGauge(
  preset: GaugePreset | undefined,
  fine: { readonly animate?: boolean },
  house: ChartSettings = chartDefaults().settings,
): ResolvedGauge {
  const name = preset ?? house.gauge;
  return {
    preset: name,
    wave: WAVE_PX[house.wave],
    animate: (fine.animate ?? house.animate) && GAUGE_PRESETS[name].motion,
  };
}
