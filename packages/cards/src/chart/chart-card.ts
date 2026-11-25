import {
  formatDate,
  formatNumber,
  formatTime,
  isPaletteRef,
  isUsable,
  plural,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import type { Span as StateSpan } from '@fluvy/core/history';
import { spanAt } from '@fluvy/core/spans';
import {
  activateKey,
  axis,
  clickPress,
  glyph,
  head,
  ico,
  preventMenu,
  readout,
  round,
  startPress,
  type Tone,
} from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { chartHeight, readable, readsEach } from '../chart-family.js';
import { CollectionFollower, collectionKeyOf } from '../energy-model/collection.js';
import { fullDays, stepFor } from '../energy-model/period.js';
import { rangeWords } from '../energy-model/range-words.js';
import {
  COLLECTION_LABEL,
  collectionChoices,
  collectionField,
  collectionHelper,
  following,
} from '../energy/collection-field.js';
import { HeadFit } from '../energy/head.js';
import { axisHolds } from '../shared/axis.js';
import {
  ACTIONS_BASE,
  Card,
  ICON_ACTIONS_BASE,
  type BaseKey,
  type HeadConfig,
} from '../shared/base.js';
import type { ChartKeys, Curve } from '../shared/chart-config.js';
import { toneOf } from '../shared/colour.js';
import { byState, configKeys } from '../shared/config.js';
import { iconOf, stateWord } from '../shared/domain.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  fieldRow,
  iconField,
  numberField,
  onlyWhen,
  pickFields,
  selectField,
  headFields,
  thresholdsList,
  titleFields,
} from '../shared/form.js';
import type {
  EditorChoices,
  EditorDefaults,
  FormHelper,
  RowsListSpec,
} from '../shared/rows-editor.js';
import { pairFit, pairStyles, type PairFit, type PairText } from '../shared/readout-pair.js';
import { stateLook } from '../shared/state-tint.js';
import type { Thresholds, ThresholdsConfig } from '../shared/thresholds.js';
import { decimalsOf, figure, precisionOf, scaleNamed, type Scale } from '../shared/units.js';
import { attributeSeries, timedAttributes, type Day, type Reading } from './data/attribute.js';
import {
  ForecastFeed,
  forecastReadings,
  forecastUnit,
  historyReadings,
  periodOf,
  PERIOD_MS,
  recordedStates,
  sourceOf,
  stateReadings,
  statisticsReadings,
  statOf,
  type ForecastType,
  type Source,
  type Statistic,
  type StateRow,
} from './data/sources.js';
import type { StatPeriod } from './data/statistics.js';
import { bucketGrid, roundGrid, roundStep, type Grid } from './data/slots.js';
import {
  dayStart,
  DAY,
  evenEdges,
  gains,
  HOUR,
  MOST_SLOTS,
  nowFraction,
  previousOf,
  readSlots,
  slotted,
  spanOf,
  stepOf,
  windowOf,
  type Holding,
  type SlotRule,
  type Span,
} from './data/span.js';
import {
  capsFor,
  capsIn,
  CHART_CAPS,
  defaultWindows,
  extremesAsked,
  houseSpanValue,
  isPrice,
  isStates,
  SERIES_LIST,
  seriesOf,
  spanField,
  windowAt,
  type ChartSeriesConfig,
  type SeriesKind,
  type Windows,
} from './config.js';
import {
  acts,
  airScale,
  barGeometry,
  barPath,
  chartKeysOf,
  chartBubble,
  chartDefaultsFor,
  chartSection,
  chartStyles,
  drawChart,
  drawRead,
  extremesOf,
  isBars,
  leastGap,
  legend,
  linePath,
  niceTicks,
  plotOf,
  quarterTicks,
  readAt,
  readingsOf,
  refInk,
  resolveStyle,
  roundTicks,
  scrub,
  ScrubController,
  seriesPaint,
  slotTicks,
  stretchTone,
  tickText,
  timeLine,
  yOf,
  type ChartFrame,
  type ChartSeries,
  type ChartSpec,
  type Extreme,
  type ThresholdBand,
  type TimeLine,
  type Reading as Said,
  type ResolvedStyle,
  type SeriesColour,
  type SeriesPaint,
  type Stretch,
  type Window,
} from './engine/index.js';

const s = strings('chart-card');

/** A colour a series writes on itself as its ink — a series colour, or one of the palette's by its token — not a tone. */
const ownInk = (colour: SeriesColour): boolean =>
  colour.startsWith('series-') || colour.startsWith('var(');

/**
 * How a box in a series' colour wears it (a strip, a readout's key): its ink, or its tone's class — the accent's
 * where the colour is the person's own, which its `data-accent` carries.
 */
const paintOf = (colour: SeriesColour, accent: string | undefined): SeriesPaint =>
  ownInk(colour) ? seriesPaint(colour) : { className: `fv-tone--${accent ? 'accent' : colour}` };

/** A figure as it is written: its value and its unit after a space; the value alone where it has none. */
const figureText = ({ value, unit }: { readonly value: string; readonly unit: string }): string =>
  unit ? `${value} ${unit}` : value;

export type ChartVariant = 'full' | 'compact' | 'tile';
export type { ChartSeriesConfig, SeriesKind, Windows } from './config.js';

export interface ChartCardConfig
  extends FluvyCardConfig, HeadConfig, ThresholdsConfig, Omit<ChartKeys, 'highlight'> {
  title?: string;
  subtitle?: string;
  /** The series, six at most: an entity id, or the series with what it says of itself. */
  series?: ReadonlyArray<string | ChartSeriesConfig>;
  /** `24h` (the default), `today`, `today+tomorrow`, `7d`, or any `<N>h` / `<N>d`. */
  span?: string;
  /**
   * An Energy date picker's key (`energy_…`): the chart draws the picker's range in Home Assistant's grain, its span
   * set aside, and the range it compares with as a ghost while it compares.
   */
  collection_key?: string;
  /** The windows marked, of what is to come: the cheapest (lowest), the dearest (highest), or both. */
  highlight?: Windows;
  /** How long a marked window is: one hour by default. */
  highlight_hours?: number;
  show_legend?: boolean;
  /** The value now, big, over the chart, with its change on the period before. */
  show_head?: boolean;
  variant?: ChartVariant;
  /**
   * A readout a series in the value row (#264), the several sensors' card's, in place of the legend's lines: the full
   * card with its head over two series of numbers or more (`readsEach`).
   */
  readouts?: boolean;
  /** Test hook: an ISO date that freezes "now". Undocumented. */
  _now?: string;
}

/** The chart's room (the energy card's): its 120 with the bubble's 44 above the plot; the value row's 16 and 64. */
const CHART = 120;
const HEADROOM = 44;
const ROW = 80;
/**
 * Under a value row that says the reading, the plot rises to 12 under the chart's top — the knob's room, whole: the
 * row reads the chart with it, so no bubble is drawn over the plot and none needs its room.
 */
const TIGHT = 12;
/** A stepped line's least slot: under it the steps of a line 2.5 wide read as beads (a phone's card reads a day by the hour). */
const STEP_MIN = 5;
/** A bar's least slot: its 2 at the narrowest and the air beside it. */
const BAR_MIN = 4;
/** The most a scale's column takes of a plot's width ("−0.10" and its gap): a step is counted on what is left. */
const SCALE_MOST = 48;
/** The tile's spark: 24 tall, 4 around it. */
const SPARK = 24;
/** The most bars a window is read in: an hour each over two days. */
const MOST_BARS = 48;
/** A legend line (12/500 on 16), and the 4 between two. */
const LEGEND_LINE = 16;
const LEGEND_GAP = 4;
/**
 * A legend item's least room in a column beside others: its swatch and a name's first letters (12, 8 and 48), and the
 * reading after them where it says one (8 and 56, "21.4 °C" and room to spare).
 */
const LEGEND_NAME = 68;
const LEGEND_READING = 64;
/** The value row's height: the reading now, or a legend's lines (`TOP`); and the 8 over a legend under the axis. */
const TOP = 64;
const UNDER = 8;
/**
 * A marked window's pill's sides (`.fc-pill`: 10 each, its dot 6 and the 6 after it); one led by its glyph (`.ch-delta`,
 * `.ch-peak`: 4, the glyph 16, the 2 after it and 8): the change's, a lowest or highest point's.
 */
const PILL_SIDES = 32;
const GLYPH_SIDES = 30;
const GAP = 12;
/** Two pills side by side, two rows of them. */
const PILL_GAP = 8;
/** The least a plot keeps beside its scale's column: under it the column folds. */
const PLOT_MIN = 120;
/** The readout sizes the value row may take, largest first. */
const SIZES = ['l', 'm', 's', 'xs'] as const;
/** A series of states' strip under the plot (#228): 12 tall, 4 over it (`chartHeight` counts the 16). */
const STRIP = 12;
const STRIP_GAP = 4;
/**
 * A series' readout (#264): its label 16 and its value at m (4 + 28), and 16 more where the row says lowest and highest
 * points under them; 12 between two lines of them (four series or more).
 */
const READOUT = 48;
const POINTS_LINE = 16;
const READOUTS_GAP = 12;
/** The line of a readout's points (`.ch-ext`): a glyph 16 and the 2 after it, 4 before a time, 12 between the two. */
const POINT_GLYPH = 18;
const POINT_TIME = 4;
const POINTS_GAP = 12;
/** Its forms: each figure with its time, the figures alone, the highest alone; this one none. */
const POINT_FORMS = 3;

const down4 = (n: number): number => Math.max(4, Math.floor(n / 4) * 4);
/** How tall `lines` legend lines stand. */
const linesTall = (lines: number): number => lines * (LEGEND_LINE + LEGEND_GAP) - LEGEND_GAP;

/**
 * How many a row a legend of four series or more lays under the axis, by their count and the card's width alone: three
 * (five or six) or two where each column holds an item; none (0) where two would not, and the legend's lines go in the
 * value row, one a row, as two or three series' do. Never by the names themselves: the card's height never waits on
 * its words.
 */
export function legendColumns(count: number, width: number, reading: boolean): number {
  const item = LEGEND_NAME + (reading ? LEGEND_READING : 0);
  return [count > 4 ? 3 : 2, 2].find((cols) => (width - (cols - 1) * 16) / cols >= item) ?? 0;
}
const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** One series of numbers as this render draws it. */
interface Drawn {
  readonly item: ChartSeriesConfig;
  /** Its place among the card's series: its colour, its line in the legend. */
  readonly index: number;
  readonly view: EntityView;
  readonly source: Source;
  readonly name: string;
  /** The unit its figures are written in (its readings already divided for it), and their decimals. */
  readonly scale: Scale;
  readonly digits: number | undefined;
  readonly colour: SeriesColour;
  readonly accent: string | undefined;
  readonly kind: SeriesKind;
  readonly curve: Curve;
  /** Its readings; undefined while they are asked for. */
  readonly readings: readonly Reading[] | undefined;
  readonly holding: Holding;
  /** Its readings on the window's slots, in its unit: the slots' (steps, bars) and the points between them (lines). */
  readonly slots: ReadonlyArray<number | null>;
  /** Readings laid on the slots as its own are (the range a picker compares with, `whole`: none of it to come). */
  readonly layOn: (readings: readonly Reading[], whole?: boolean) => Array<number | null>;
  readonly points: ReadonlyArray<number | null>;
  /**
   * A line of the recorder's through time (`timeLine`, the points in its place): drawn on the house's round times and
   * read at them; `cover` the part of the window it runs (to now on a calendar day).
   */
  readonly line: TimeLine | null;
  readonly cover: number;
  /** Where its points stand, where not evenly across the window: a line through time's, a band's on its slots' middles. */
  readonly at: readonly number[] | undefined;
  readonly band: ChartSeries['band'];
  /** Its reading now, in its unit; null where it has none. */
  readonly now: number | null;
  /** A price: its windows are the cheapest and the dearest. */
  readonly price: boolean;
  /** Its own thresholds (#264), read in its unit: they colour it in the card's place; none where it names none. */
  readonly thresholds: Thresholds | undefined;
}

/** A series drawn as its states (`kind: states`, #228): a strip of the stretches it spent in each, under the plot. */
interface Strip {
  readonly item: ChartSeriesConfig;
  /** Its place among the card's series: its colour, its line in the legend. */
  readonly index: number;
  readonly view: EntityView;
  readonly name: string;
  readonly colour: SeriesColour;
  readonly accent: string | undefined;
  /** Its stretches across the window, up to now and the state now; undefined while they are asked for. */
  readonly spans: readonly StateSpan[] | undefined;
}

/** A series as the legend, the value row and the spoken label say it: its place, name and colour, what it reads. */
interface Named {
  readonly index: number;
  readonly name: string;
  readonly colour: SeriesColour;
  readonly accent: string | undefined;
  /** What it reads where the chart is read, else now: a figure and its unit, or a state in its words. */
  readonly value: string;
  readonly unit: string;
  /** Its figure's ink past a threshold that claims it (`AccentSheet.ink`, #264). */
  readonly ink?: string | undefined;
}

/** Where a strip is read: the moment, and its two pixels in time (the least a stretch with a look is drawn). */
interface Moment {
  readonly t: number;
  readonly least: number;
}

/** How a stretch of a series of states is painted: its class (`stretchTone`'s, or `is-own`), and a tone of its own. */
interface StretchLook {
  readonly cls: string;
  readonly tone?: Tone;
  readonly accent?: string;
}

/** A pill of the value row: its tone, its words in their forms (longest first), the glyph it is led by (else its dot). */
interface Pill {
  readonly tone: Tone;
  readonly forms: readonly string[];
  readonly glyph?: 'up' | 'down';
}

/** A window marked: its ends (fractions of the window), the lowest or the highest, and its pill. */
interface Marked extends Pill {
  readonly from: number;
  readonly to: number;
  readonly pick: 'min' | 'max';
}

/** A series' lowest or highest point as the card says it (#264): its figure and unit, when it was, its band's ink. */
interface Point {
  readonly value: string;
  readonly unit: string;
  readonly time: string;
  readonly ink?: string | undefined;
}

/** A series' lowest and highest points, those it asks for. */
interface Points {
  readonly min?: Point;
  readonly max?: Point;
}

/** The chart's drawings: the lines (or the columns), and the lines over columns where both are drawn; each one's series. */
interface Specs {
  readonly main: ChartSpec;
  readonly over: ChartSpec | null;
  readonly of: readonly [main: readonly Drawn[], over: readonly Drawn[]];
}

/** How the value row lays a readout a series (#264): their fit (`pairFit`), how many to a line, and their points. */
interface Readouts {
  readonly fit: PairFit;
  readonly columns: number;
  readonly points: ReadonlyMap<number, Points>;
  /** A series asks for its points: each readout keeps their line under it. */
  readonly tall: boolean;
}

/**
 * Where the chart is read: the cursor (a line through time's snaps to its round time), its x, the moment and its words,
 * each value.
 */
interface Read {
  readonly cursor: number;
  readonly x: number;
  readonly t: number;
  readonly time: string;
  readonly values: ReadonlyArray<number | null>;
}

/** What a series' history or statistics answered: what it asked for (its entity, source, keys and span), its readings. */
interface Answer<T = readonly Reading[]> {
  readonly id: string;
  readonly readings: T;
}

/** What a series' history or statistics answer is for: its entity, its source and keys, and its window's (`spanKey`). */
const answerId = (item: ChartSeriesConfig, source: Source, span: string): string =>
  [
    item.entity,
    source,
    item.stat ?? '',
    item.period ?? '',
    item.kind === 'band' || item.kind === 'states' ? item.kind : '',
    span,
  ].join('|');

/** A followed picker's range in the chart's time: its end a midnight (Home Assistant ends a day on its last moment). */
interface Picked {
  readonly start: number;
  readonly end: number;
  /** The range it compares with, while it compares. */
  readonly before?: { readonly start: number; readonly end: number };
}

/** A picker's moment as the chart reads it: its last moment of a day as the midnight after it. */
const closing = (date: Date): number => {
  const t = date.getTime();
  return t % 1000 === 999 ? t + 1 : t;
};

/** The ghost of the range compared with: this much wider than its column, as the Energy usage card's. */
const GHOST = 1.8;

/** The decimals a series' readings carry (a price's three, a temperature's one), up to three; none where they say none. */
function carried(readings: readonly Reading[] | undefined, state: string): number | undefined {
  const digits = (n: number | string): number => String(n).split('.')[1]?.length ?? 0;
  if (/^-?\d+(\.\d+)?$/.test(state)) return Math.min(3, digits(state));
  if (!readings?.length) return undefined;
  return Math.min(3, Math.max(...readings.slice(0, 48).map((r) => digits(r.v))));
}

/** A number an entity holds in an attribute (a weather's temperature now). */
function numberAttr(view: EntityView, key: string): number | null {
  const raw = view.attr(key);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** What lies under a series: its own fill, an area's where the style has none, its band where it has lows and highs. */
function fillFor(d: Drawn, style: ResolvedStyle): Pick<ChartSeries, 'fill'> {
  if (d.item.fill) return { fill: d.item.fill };
  if (d.kind === 'area')
    return { fill: style.fill === 'none' || style.fill === 'band' ? 'gradient' : style.fill };
  if (d.kind === 'band') return { fill: d.band ? 'band' : 'none' };
  return {};
}

/** The chart's cursor down its strips at `x`, in its look: a style's hairline, classic's dashes. */
const stripsCursor = (x: number, dashed: boolean): TemplateResult =>
  html`<i
    class="ch-strips__cursor ${dashed ? 'is-dashed' : ''}"
    style="left:${x.toFixed(2)}px"
  ></i>`;

/** The value at a fraction of a line's points, between the two nearest; a gap's neighbour where one side is a gap. */
function between(points: ReadonlyArray<number | null>, fraction: number): number | null {
  const at = Math.min(1, Math.max(0, fraction)) * (points.length - 1);
  const a = points[Math.floor(at)] ?? null;
  const b = points[Math.ceil(at)] ?? null;
  return a === null || b === null ? (a ?? b) : a + (b - a) * (at - Math.floor(at));
}

/**
 * The Chart card (#68): any time series on one chart — a sensor's history or its long-term statistics, a list in its
 * attributes (Nordpool's prices today and tomorrow, Tibber's, ENTSO-E's, Frank Energie's, a solar forecast), a
 * weather's forecast — across a window (`span`) from what has happened to what is to come, now marked and the future
 * dashed; each series a line, an area, columns or its band, in its own colour, unit and decimals; thresholds that
 * colour the line where it crosses them; the cheapest and the dearest windows marked and named; the value now big
 * with its change on the period before; a legend; read by pointing at it or from the keyboard. Its style is the
 * house's or its own (`chart`, and every fine key of the engine). Full (320; 364 with a legend of four series or
 * more), compact (240) or a tile (168): its height is its variant's and its series count's alone — loading, empty or
 * out of reach, it keeps it.
 */
export class FluvyChartCard extends Card<ChartCardConfig> {
  static override layoutHeight(config: ChartCardConfig): number {
    return chartHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    chartStyles,
    pairStyles,
    css`
      .ch-chart {
        position: relative;
        margin-top: 12px;
        outline: none;
      }
      .ch-chart:focus-visible {
        border-radius: var(--fluvy-radius-control);
        box-shadow: 0 0 0 2px var(--fluvy-focus-ring, var(--fluvy-accent));
      }
      .ch-chart > svg {
        display: block;
        overflow: visible;
      }
      /* the lines over the columns: the same frame, drawn over them; the range a followed picker compares with under
         everything */
      .ch-chart > svg + svg,
      .ch-chart > .ch-ghosts {
        position: absolute;
        top: 0;
        left: 0;
      }
      /* the range compared with: one quiet column a slot, or a quiet line through the slots */
      .ch-ghost {
        fill: color-mix(in srgb, var(--fluvy-text) 9%, transparent);
      }
      :host([dark]) .ch-ghost,
      [data-mode='dark'] .ch-ghost {
        fill: color-mix(in srgb, var(--fluvy-text) 14%, transparent);
      }
      .ch-ghost.is-line {
        fill: none;
        stroke: color-mix(in srgb, var(--fluvy-text) 24%, transparent);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ch-chart > .fv-skeleton {
        height: 100%;
        border-radius: var(--fluvy-radius-control);
      }
      /* the bubble arrives with the mark it belongs to, once the line has drawn itself */
      .ch-chart > .fv-bubble {
        animation: fv-fade 500ms var(--fv-ease) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
      }
      /* several series: each one's forecast keeps its colour, dashed, so the legend still says whose it is */
      .ch-several .fc-future {
        stroke: var(--tone-ink, var(--fluvy-accent));
        stroke-opacity: 0.6;
      }
      /* a series of states (#228): a strip of its stretches under the plot, on the plot's time from its start to its
         end — 12 tall, 4 under what is over it, its corners a third of it — drawn in as the line is */
      .ch-strips {
        position: relative;
      }
      .ch-strip {
        position: relative;
        height: ${STRIP}px;
        margin-top: ${STRIP_GAP}px;
        overflow: hidden;
        border-radius: 4px;
        background: var(--fluvy-inset, var(--fluvy-page));
        animation: ch-reveal 900ms var(--fv-ease-out) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms);
      }
      .ch-strips.is-still > .ch-strip {
        animation: none;
      }
      /* out of reach the card is the page's fill, as the strip is: its edge says where it runs */
      .is-off .ch-strip {
        box-shadow: inset 0 0 0 1px var(--fluvy-unavailable-border);
      }
      @keyframes ch-reveal {
        from {
          clip-path: inset(0 100% 0 0);
        }
      }
      /* a chart of states alone: its strips take the plot's room, each as tall as it leaves them, 4 apart */
      .ch-strips.is-tall {
        position: absolute;
        right: 0;
        bottom: 8px;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: ${STRIP_GAP}px;
      }
      .ch-strips.is-tall > .ch-strip {
        flex: 1;
        height: auto;
        margin: 0;
        border-radius: var(--fluvy-radius-control);
      }
      .ch-strip > .fv-stretch {
        position: absolute;
        top: 0;
        bottom: 0;
      }
      /* a minute on in a day is a mark, never nothing: a stretch with a look keeps two pixels */
      .ch-strip > .fv-stretch:is(.is-on, .is-quiet, .is-away, .is-own) {
        min-width: 2px;
      }
      /* on: the series' colour, the strip's ink; a state's own colour: its tone's */
      .ch-strip > .fv-stretch:is(.is-on, .is-own) {
        background: var(--tone-ink, var(--fluvy-accent));
      }
      /* two stretches of one look side by side (two words both quiet) are told apart by a hairline of the card's fill */
      .ch-strip > .fv-stretch.is-after {
        box-shadow: inset 1px 0 var(--fluvy-card);
      }
      /* the chart's cursor down the strips, in its look: a style's hairline, classic's dashes */
      .ch-strips__cursor {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 0;
        border-left: 1px solid var(--fluvy-border-strong);
        pointer-events: none;
      }
      .ch-strips__cursor.is-dashed {
        transform: translateX(-0.75px);
        border-left: 1.5px dashed var(--fluvy-border-strong);
      }
      /* the axis under the plot starts where the plot does (after a scale's column) */
      .ch-axis {
        position: relative;
        margin-top: 8px;
      }
      .ch-axis > .fv-axis {
        margin-top: 0;
        transition: opacity var(--fluvy-duration-fast, 120ms) ease;
      }
      /* while the legend's lines in the row read the chart, the axis says when: a pill in the bubble's colours under
         the cursor, over the hours, which give way to it (the several sensors' card's) */
      .ch-axis.is-reading > .fv-axis {
        opacity: 0;
      }
      .ch-when {
        position: absolute;
        top: -2px;
        z-index: 1;
        height: 20px;
        border-radius: 10px;
        background: var(--fluvy-text);
        color: var(--fluvy-page);
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        pointer-events: none;
      }
      /* the value row: the reading now (and its change) at the start, the marked windows at the end */
      .ch-top {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: ${GAP}px;
        height: ${TOP}px;
        margin-top: 16px;
      }
      .ch-now {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .ch-now .fv-readout__value {
        white-space: nowrap;
      }
      /* a pill led by its glyph: the change on the period before, on the value's foot; a lowest or highest point
         (#264), its glyph in its tone's ink as a window's dot is */
      .ch-delta,
      .ch-peak {
        flex: none;
        gap: 2px;
        padding: 0 8px 0 4px;
      }
      .ch-delta {
        margin-bottom: 10px;
      }
      :is(.ch-delta, .ch-peak) svg {
        width: 16px;
        height: 16px;
      }
      .ch-peak svg {
        color: var(--tone-ink, var(--fluvy-accent));
      }
      /* a row of pills: a marked window's beside the point of its kind */
      .ch-pills {
        display: flex;
        gap: ${PILL_GAP}px;
      }
      .ch-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .ch-top.is-side-only .ch-side {
        align-items: flex-start;
      }
      /* a legend of two or three series as lines in the row, each reading at its line's end */
      .ch-lines {
        flex: 1;
        min-width: 0;
      }
      .ch-lines > .fc-legend {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 4px;
        margin: 0;
      }
      .ch-lines .fc-legend__item {
        display: flex;
        height: ${LEGEND_LINE}px;
      }
      .ch-lines .fc-legend__name {
        flex: 1;
      }
      /* a readout a series (#264): the several sensors' row (\`pairStyles\`) in the value row, three to a line at most,
         each line's first with no hairline before it; each readout 48 tall, 64 where its points are said under it */
      .ch-reads {
        flex: 1;
        row-gap: ${READOUTS_GAP}px;
        margin-top: 0;
      }
      .ch-reads > .am-pair__item {
        height: ${READOUT}px;
      }
      .ch-reads.is-tall > .am-pair__item {
        height: ${READOUT + POINTS_LINE}px;
      }
      .ch-reads > .is-first::before {
        content: none;
      }
      .ch-read {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      /* its lowest and highest points under it, led by their glyphs: the figure 12/600 in the text's ink (its band's
         past a threshold), the time after it in the secondary's */
      .ch-ext {
        display: flex;
        gap: ${POINTS_GAP}px;
        height: ${POINTS_LINE}px;
        font-size: 12px;
        font-weight: 500;
        line-height: ${POINTS_LINE}px;
        color: var(--fluvy-text-secondary);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .ch-ext__part {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .ch-ext svg {
        flex: none;
        width: 16px;
        height: 16px;
      }
      .ch-ext__figure {
        font-weight: 600;
        color: var(--fluvy-text);
      }
      .ch-ext__figure[data-ink] {
        color: var(--fv-ink);
      }
      .ch-ext__time {
        margin-inline-start: 2px;
      }
      /* a legend of four series or more under the axis: two or three equal columns where each holds its item (in the
         value row's lines where they would not: \`legendColumns\`) */
      .ch-legend > .fc-legend {
        display: grid;
        grid-template-columns: repeat(var(--ch-cols, 3), minmax(0, 1fr));
        gap: ${LEGEND_GAP}px 16px;
        margin: ${UNDER}px 0 0;
      }
      .ch-legend .fc-legend__item {
        height: ${LEGEND_LINE}px;
      }
      /* nothing to chart: a 44 ring on the card fill and one line, centred in the plot's room on the page's fill */
      .ch-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 100%;
        padding: 0 16px;
        border-radius: var(--fluvy-radius-control);
        background: var(--fluvy-inset, var(--fluvy-page));
        text-align: center;
      }
      .ch-empty .fv-ico {
        background: var(--fluvy-card);
      }
      .ch-empty .fv-empty {
        color: var(--fluvy-text-secondary);
      }
      /* the tile: the reading over its spark, as the sensor's tile */
      .fv-tile .fv-readout {
        margin-top: 12px;
      }
      .fv-tile .fv-readout__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .ch-spark {
        position: relative;
        height: ${SPARK}px;
        padding: 0 4px;
      }
      .ch-spark > svg {
        overflow: visible;
      }
      .ch-spark > .fv-skeleton {
        height: ${SPARK}px;
      }
      /* a tile of states alone: its strip 4 over the spark's floor, where a spark's line is drawn to */
      .ch-spark > .ch-strip {
        margin-top: ${SPARK - STRIP - 4}px;
      }
      .fv-tile.is-off {
        background: var(--fluvy-page);
        box-shadow: none;
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
      }
      .fv-tile.is-off .fv-readout__label,
      .fv-tile.is-off .fv-readout__value {
        color: var(--fluvy-unavailable);
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    answers_: { state: true },
    states_: { state: true },
    ghost_: { state: true },
  };

  /** What each series' history or statistics answered, by its index: kept while a newer read is asked. */
  declare answers_: ReadonlyArray<Answer | undefined>;
  /** What the recorder kept of each series of states, by its index (#228): kept while a newer read is asked. */
  declare states_: ReadonlyArray<Answer<readonly StateRow[]> | undefined>;
  /** What the first series' answered over the range a followed picker compares with. */
  declare ghost_: Answer | undefined;
  /** What each series asked last, and when: asked again once the key moves or five minutes pass (the ghost's last). */
  private readonly reads: Array<{ key: string; at: number } | undefined> = [];
  /** Where the chart is read (a fraction of its width); null: at rest. */
  private readonly scrubber = new ScrubController(this);
  private readonly forecasts = new ForecastFeed(this);
  private readonly headFit = new HeadFit(this);
  private readonly follower = new CollectionFollower(this);

  constructor() {
    super();
    this.answers_ = [];
    this.states_ = [];
    this.ghost_ = undefined;
  }

  /* ---------- the editor (on the class: the card's chunk is fetched as the bundle starts) ---------- */

  /** The head's icon, colours and actions are the base fields it honours; its entities are its series'. */
  static override base: readonly BaseKey[] = [
    'icon',
    'tone',
    'color',
    'card_color',
    'card_opacity',
    'card_border',
    'card_blur',
    'exact_colors',
    'unavailable',
    ...ACTIONS_BASE,
    'show_icon',
    'name_lines',
    ...ICON_ACTIONS_BASE,
  ];
  static override keys = configKeys<ChartCardConfig>()([
    'title',
    'subtitle',
    'series',
    'span',
    'collection_key',
    'variant',
    'show_head',
    'show_legend',
    'readouts',
    'highlight',
    'highlight_hours',
    'thresholds',
    'chart',
    'curve',
    'fill',
    'line_width',
    'glow',
    'show_points',
    'show_grid',
    'show_axis',
    'show_now',
    'animate',
    'points',
  ]);
  static override lists: readonly RowsListSpec[] = [SERIES_LIST, thresholdsList()];
  /** What the editor shows where the config says nothing: what the card does then. */
  static override defaults: EditorDefaults = (config, hass) => {
    // the Chart section's, the engine's — but the highlight, which marks this card's windows
    const { highlight: _style, ...chart } = chartDefaultsFor(config, {
      ...capsIn(config, hass),
      now: true,
      time: true,
    });
    void _style;
    return {
      span: houseSpanValue(),
      collection_key: '',
      variant: 'full',
      show_head: true,
      show_legend: true,
      readouts: false,
      highlight: defaultWindows(config['chart']),
      highlight_hours: 1,
      ...chart,
    };
  };
  static override getConfigForm(): LovelaceConfigForm {
    const lone = (data: Readonly<Record<string, unknown>>): boolean => seriesOf(data).length < 2;
    const marked = (data: Readonly<Record<string, unknown>>): boolean =>
      lone(data) && (data['highlight'] ?? defaultWindows(data['chart'])) !== 'none';
    const full = (data: Readonly<Record<string, unknown>>): boolean =>
      (data['variant'] ?? 'full') === 'full';
    // a readout a series (#264): on the full card with its head, over two series of numbers or more
    const reads = (data: Readonly<Record<string, unknown>>): boolean =>
      full(data) && readable({ type: '', ...data });
    // a legend names several series, on the full card alone (the compact one and the tile draw none), where no
    // readouts name them
    const legended = (data: Readonly<Record<string, unknown>>): boolean =>
      !lone(data) && full(data) && !(reads(data) && data['readouts'] === true);
    const own = (data: Readonly<Record<string, unknown>>): boolean => !following(data);
    const helper: FormHelper = (schema, localize, data) =>
      schema.name === 'span'
        ? s(editorLanguage(), 'editor.span_helper')
        : collectionHelper(schema, localize, data);
    // the Chart section is the engine's, but for the highlight: this card marks its windows with it, in every style
    const section = chartSection(CHART_CAPS, capsIn);
    const chart = {
      ...section,
      schema: pickFields(section.schema ?? [], (item) => item.name !== 'highlight'),
    };
    return {
      schema: [
        titleFields(),
        iconField(),
        headFields(),
        ...colourFields(),
        // the lists are edited item by item (the rows editor takes these fields out of the form)
        { name: 'series', selector: { object: {} } },
        // its own window, or a date picker's range: Home Assistant's, or the Energy period card's
        fieldRow(collectionField(), onlyWhen(own, spanField())),
        selectField('variant', ['full', 'compact', 'tile']),
        fieldRow(boolField('show_head'), onlyWhen(legended, boolField('show_legend'))),
        onlyWhen(reads, boolField('readouts')),
        fieldRow(
          onlyWhen(
            lone,
            choiceField('highlight', [
              ['none', 'option.none'],
              ['min', 'option.min'],
              ['max', 'option.max'],
              ['both', 'option.min_max'],
            ]),
          ),
          onlyWhen(marked, numberField('highlight_hours', 1, 12)),
        ),
        { name: 'thresholds', selector: { object: {} } },
        chart,
        actionFields({ icon: true }),
      ],
      ...editorLabels(
        s,
        {
          series: 'editor.series',
          span: 'editor.span',
          highlight_hours: 'editor.highlight_hours',
          show_legend: 'editor.show_legend',
          show_head: 'editor.show_head',
          readouts: 'editor.readouts',
        },
        COLLECTION_LABEL,
      ),
      computeHelper: helper,
    };
  }

  /** A sensor that holds a list of moments and values (a price's), else the first sensor; a list's day and tomorrow. */
  /** The date pickers on the dashboard, for the key. */
  static override choices: EditorChoices = (_config, hass) => ({
    collection_key: collectionChoices(hass),
  });

  protected override prepare(config: ChartCardConfig): ChartCardConfig {
    collectionKeyOf(config, 'fluvy-chart-card');
    return config;
  }

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): ChartCardConfig {
    const day: Day = { start: 0, length: DAY };
    const listed = entities.find(
      (id) =>
        id.startsWith('sensor.') &&
        timedAttributes(hass?.states[id]?.attributes ?? {}, day).length > 0,
    );
    const entity = listed ?? entities.find((id) => id.startsWith('sensor.'));
    return {
      type: 'custom:fluvy-chart-card',
      series: entity ? [entity] : [],
      ...(listed ? { span: 'today+tomorrow' } : {}),
    };
  }

  /* ---------- size ---------- */

  override getCardSize(): number {
    return Math.round(chartHeight(this.config ?? { type: '' }) / 50);
  }

  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'tile'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get variant(): ChartVariant {
    const variant = this.config?.variant;
    return variant === 'compact' || variant === 'tile' ? variant : 'full';
  }

  /** Watched: every series' entity. */
  protected override watched(): readonly string[] {
    return seriesOf(this.config).map((item) => item.entity);
  }

  /* ---------- time ---------- */

  /** "Now": the frozen moment of a test, else the clock. */
  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private get span(): Span {
    return spanOf(this.config?.span);
  }

  /**
   * A followed date picker's range once its collection is found, and the range it compares with while it compares:
   * the window the chart draws in its span's place.
   */
  private picked(): Picked | undefined {
    const range = this.follower.range();
    if (!range) return undefined;
    const start = range.start.getTime();
    const end = range.end ? closing(range.end) : this.now().getTime();
    const { startCompare, endCompare } = range;
    return {
      start,
      end,
      ...(range.compare && startCompare
        ? {
            before: {
              start: startCompare.getTime(),
              end: endCompare ? closing(endCompare) : startCompare.getTime() + end - start,
            },
          }
        : {}),
    };
  }

  /** The window at `now`: a followed picker's range, else the span's (`windowOf`). */
  private windowAt(now: Date, latest?: number): Window {
    const picked = this.picked();
    return picked
      ? { start: picked.start, end: picked.end, now: now.getTime() }
      : windowOf(this.span, now, this.hass, latest);
  }

  /** What the window is, for the recorder's answers: a followed range's ends, else the span's kind and length. */
  private spanKey(): string {
    const picked = this.picked();
    return picked ? `${picked.start}|${picked.end}` : `${this.span.kind}|${this.span.hours}`;
  }

  /** How far back the period the head compares with lies: as long as a followed range, else the span's (`previousOf`). */
  private back(): number {
    const picked = this.picked();
    return picked ? picked.end - picked.start : previousOf(this.span);
  }

  /** What a series' statistics read by: its own stat, else a meter's change and any other sensor's mean. */
  private statFor(item: ChartSeriesConfig): Statistic {
    return statOf(this.entity(item.entity).attr('state_class'), item.stat);
  }

  /**
   * The bucket a series' statistics are read in: its own, else a followed range's as Home Assistant's Energy dashboard
   * reads it (`getSuggestedPeriod`: a meter's change by the hour, the day or the month; a measurement finer, by five
   * minutes up to eight days, the hour up to 64), else its span's.
   */
  private periodFor(item: ChartSeriesConfig): StatPeriod {
    const picked = this.picked();
    if (item.period || !picked) return item.period ?? periodOf(this.span.hours);
    const range = { start: new Date(picked.start), end: new Date(picked.end - 1) };
    const stat = this.statFor(item);
    if (stat === 'change' || stat === 'sum') return stepFor(range);
    const days = fullDays(range.start, range.end);
    return days > 64 ? 'day' : days > 8 ? 'hour' : '5minute';
  }

  /** Today and tomorrow as the house's calendar has them: what a plain list of a day's values counts from. */
  private days(now: Date): readonly [Day, Day] {
    const start = dayStart(this.hass, now);
    const next = dayStart(this.hass, now, 1);
    return [
      { start, length: next - start },
      { start: next, length: dayStart(this.hass, now, 2) - next },
    ];
  }

  /** What a forecast is subscribed as: by the hour through two days, by the day beyond. */
  private get forecastType(): ForecastType {
    const window = this.windowAt(this.now(), Infinity);
    return window.end - window.start > 48 * HOUR ? 'daily' : 'hourly';
  }

  /* ---------- the readings ---------- */

  /** Where a series is read from, as its entity has it (a sensor that holds a usual list reads it). */
  private sourceFor(item: ChartSeriesConfig): Source {
    return sourceOf(item, this.entity(item.entity).stateObj?.attributes);
  }

  /** The recorder's readings of a series over a stretch: its statistics, by its stat and bucket, or its history. */
  private recorded(
    hass: HomeAssistant,
    item: ChartSeriesConfig,
    source: Source,
    start: number,
    end: number,
  ): Promise<Reading[]> {
    return (
      source === 'statistics'
        ? statisticsReadings(
            hass,
            item.entity,
            { start, end },
            this.periodFor(item),
            this.statFor(item),
            item.kind === 'band',
          )
        : historyReadings(hass, item.entity, start, end)
    ).catch((): Reading[] => []);
  }

  /**
   * Each series that reads the recorder asks it once a key (its entity, source, keys and window, and its window's
   * start to the five minutes) and again once five minutes have passed — the first series of numbers from as far
   * before its window as the period it is compared with, for its change, and over the range a followed picker compares
   * with; a series of states its states across the window; the forecasts subscribed, as the weathers push them.
   */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const hass = this.hass;
    if (!hass) return;
    this.follower.attach(hass, this.config?.collection_key || undefined);
    const now = this.now().getTime();
    const window = this.windowAt(new Date(now), Infinity);
    const span = this.spanKey();
    const forecasts: Array<readonly [string, ForecastType]> = [];
    const ask = <T>(
      at: number,
      key: string,
      read: () => Promise<T>,
      land: (answer: T) => void,
    ): void => {
      const last = this.reads[at];
      if (last?.key === key && Date.now() - last.at < 300_000) return;
      this.reads[at] = { key, at: Date.now() };
      void read().then((answer) => {
        if (this.reads[at]?.key === key) land(answer);
      });
    };
    const items = seriesOf(this.config);
    const lead = items.findIndex((item) => !isStates(item));
    items.forEach((item, index) => {
      const source = this.sourceFor(item);
      if (source === 'forecast') forecasts.push([item.entity, this.forecastType]);
      if (source !== 'history' && source !== 'statistics') return;
      const id = answerId(item, source, span);
      if (isStates(item)) {
        ask(
          index,
          `${id}|${Math.floor(window.start / 300_000)}`,
          () =>
            recordedStates(hass, item.entity, window.start, Math.min(window.end, now)).catch(
              (): readonly StateRow[] => [],
            ),
          (rows) => {
            const next = [...this.states_];
            next[index] = { id, readings: rows };
            this.states_ = next;
          },
        );
        return;
      }
      const from = window.start - (index === lead ? this.back() : 0);
      ask(
        index,
        `${id}|${Math.floor(from / 300_000)}`,
        () => this.recorded(hass, item, source, from, Math.min(window.end, now)),
        (readings) => {
          const next = [...this.answers_];
          next[index] = { id, readings };
          this.answers_ = next;
        },
      );
      // the range a followed picker compares with, of the first series of numbers: its ghost
      const before = index === lead ? this.picked()?.before : undefined;
      if (before) {
        const ghost = `${id}|${before.start}`;
        ask(
          items.length,
          ghost,
          () => this.recorded(hass, item, source, before.start, before.end),
          (readings) => (this.ghost_ = { id: ghost, readings }),
        );
      }
    });
    this.forecasts.sync(hass, forecasts);
  }

  /** A series' readings as this render has them: the recorder's answer, its attribute's list, its weather's forecast. */
  private readingsOf(
    item: ChartSeriesConfig,
    index: number,
    source: Source,
    view: EntityView,
    days: readonly [Day, Day],
  ): readonly Reading[] | undefined {
    if (source === 'attribute')
      return view.stateObj
        ? attributeSeries(view.stateObj.attributes, item.attribute, item, days[0], days[1]).readings
        : [];
    if (source === 'forecast') {
      const entries = this.forecasts.get(item.entity, this.forecastType);
      // a weather out of reach forecasts nothing: there is nothing to wait for
      if (entries === undefined) return view.stateObj ? undefined : [];
      return forecastReadings(entries ?? [], item);
    }
    const answer = this.answers_[index];
    return answer?.id === answerId(item, source, this.spanKey()) ? answer.readings : undefined;
  }

  /** The last moment a list or a forecast reads (what tomorrow's prices reach): the window runs to the day it falls in. */
  private latest(
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
  ): number | undefined {
    let latest: number | undefined;
    items.forEach((item, index) => {
      const source = this.sourceFor(item);
      if (source !== 'attribute' && source !== 'forecast') return;
      const readings = this.readingsOf(item, index, source, this.entity(item.entity), days);
      const last = readings?.[readings.length - 1];
      if (last) latest = Math.max(latest ?? -Infinity, last.t);
    });
    return latest;
  }

  /**
   * The slots a window is read in. Bars, columns, a band and a stepped line read whole round periods of the house's
   * clock (`roundGrid`): the finest round step its series come in, its width draws calmly and the style asks (`points`)
   * — a statistic's weeks and months, the buckets themselves. A line reads the window cut evenly, as fine as its finest
   * series (a list's quarter, a statistic's hour, the recorder's window in 48), never finer than 192. A series of
   * states is no line: it reads none, and a chart of states alone is read as the recorder's window is, in 48.
   */
  private gridOf(
    window: Window,
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
    style: ResolvedStyle,
  ): Grid {
    const length = window.end - window.start;
    const columns = isBars(style.preset) || items.some((item) => item.kind === 'columns');
    const stepped = style.curve === 'step' || items.some((item) => item.curve === 'step');
    const band = items.some((item) => item.kind === 'band');
    const round = columns || stepped || band;
    const statistics = items.map((item) => this.sourceFor(item) === 'statistics');
    const history = round ? 5 * 60_000 : Math.max(5 * 60_000, length / 48);
    const grains = items.flatMap((item, index) => {
      if (isStates(item)) return [];
      const source = this.sourceFor(item);
      if (source === 'statistics') return [PERIOD_MS[this.periodFor(item)]];
      if (source === 'history') return [history];
      const readings = this.readingsOf(item, index, source, this.entity(item.entity), days);
      return [readings?.length ? stepOf(readings) : HOUR];
    });
    if (!grains.length) grains.push(history);
    if (!round) {
      const step = Math.max(length / MOST_SLOTS, Math.min(...grains, length / 2));
      return {
        edges: evenEdges(window, Math.min(MOST_SLOTS, Math.max(2, Math.round(length / step)))),
        running: false,
        round: false,
      };
    }
    const finest = Math.min(...grains, length / 2);
    // a week or a month of Home Assistant's is its own calendar's: its buckets are the slots
    const statistic = statistics.indexOf(true);
    if (finest >= 7 * DAY && statistic >= 0) {
      const item = items[statistic] as ChartSeriesConfig;
      const readings = this.readingsOf(
        item,
        statistic,
        'statistics',
        this.entity(item.entity),
        days,
      );
      const buckets = readings ? bucketGrid(readings, window) : null;
      if (buckets) return buckets;
    }
    const every = acts('points', style.preset, CHART_CAPS) ? style.every : 'auto';
    const step = roundStep({
      length,
      width: Math.max(1, this.contentWidth - SCALE_MOST),
      // bars read an hour at the finest, automatically
      finest: columns && every === 'auto' ? Math.max(finest, HOUR) : finest,
      every,
      most: columns ? MOST_BARS : MOST_SLOTS,
      gap: columns
        ? BAR_MIN
        : stepped
          ? STEP_MIN
          : leastGap(style.line, style.glow.kind === 'blur'),
    });
    const hourly = statistics.includes(true) && finest === HOUR;
    return roundGrid({
      window,
      step,
      hass: this.hass,
      hours: hourly,
      // a statistic's running hour is not compiled until it ends: the chart ends on the last whole one (its strips
      // with it)
      whole:
        hourly &&
        step === HOUR &&
        items.every((item, index) => statistics[index] || isStates(item)),
    });
  }

  /**
   * A series' colour: a lone series its card's colour, several each a series colour of the palette, a colour of its
   * own over either — a name or a hex as the card's accent sheet derives it, or one of the palette's by its token (it
   * follows the palette and the mode); one out of reach in the off skin.
   */
  private paintOf(
    item: ChartSeriesConfig,
    index: number,
    view: EntityView,
    several: boolean,
  ): { readonly colour: SeriesColour; readonly accent: string | undefined } {
    const usable = isUsable(view) || (view.status === 'missing' && !several);
    const accent = usable ? this.accents.item(item.color) : undefined;
    const colour: SeriesColour = !isUsable(view)
      ? 'off'
      : accent
        ? 'accent'
        : item.color && isPaletteRef(item.color)
          ? (refInk(item.color) as SeriesColour)
          : (item.tone ??
            (several ? (`series-${index + 1}` as SeriesColour) : toneOf(this.config, 'accent')));
    return { colour, accent };
  }

  /**
   * The series of numbers as this render draws them, laid on the window: each slot what was in force across it (an
   * hour's mean of four quarter prices, or what its `stat` reads), a line's points between the slots, its band, its
   * reading now, its unit, its decimals and its colour (`paintOf`). A series of states is a strip (`strips`).
   */
  private drawn(
    window: Window,
    grid: Grid,
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
    style: ResolvedStyle,
  ): Drawn[] {
    const several = items.length > 1;
    const bars = isBars(style.preset);
    const count = grid.edges.length - 1;
    const half = (window.end - window.start) / count / 2;
    // a line's points sit between the slots: the first on the window's start, the last on its end
    const edges = { start: window.start - half, end: window.end + half };
    // a band's points sit in the middle of its slots, the values of those periods
    const middles = Array.from({ length: count }, (_unused, k) => (k + 0.5) / count);
    return items.flatMap((item, index): Drawn[] => {
      if (isStates(item)) return [];
      const view = this.entity(item.entity);
      const source = this.sourceFor(item);
      const readings = this.readingsOf(item, index, source, view, days);
      const base = source === 'forecast' ? forecastUnit(view, item.value_key) : view.unit;
      const asked = typeof item.unit === 'string' && item.unit !== 'auto' ? item.unit.trim() : '';
      // a unit its sensor's converts to scales its figures; any other names the unit its list is written in
      const scale: Scale = asked
        ? (scaleNamed(asked, base) ?? { unit: asked, divisor: 1 })
        : { unit: base, divisor: 1 };
      const recorded = source === 'history' || source === 'statistics';
      // the decimals its reading now is written with: the sensor's state, the weather's own figure, else its list's
      const written = recorded
        ? view.state
        : source === 'forecast'
          ? String(view.attr(item.value_key ?? 'temperature') ?? '')
          : '';
      const digits =
        decimalsOf(item.decimals) ??
        (scale.unit === view.unit ? precisionOf(this.hass, view) : undefined) ??
        (scale.divisor === 1 ? carried(readings, written) : undefined);
      const { colour, accent } = this.paintOf(item, index, view, several);
      const holding: Holding =
        recorded && source === 'history'
          ? { hold: Infinity, until: window.now }
          : { hold: readings?.length ? stepOf(readings) : HOUR };
      const shown = (values: Array<number | null>): Array<number | null> =>
        scale.divisor === 1 ? values : values.map((v) => (v === null ? null : v / scale.divisor));
      const lay = (
        span: Pick<Window, 'start' | 'end'>,
        n: number,
        pick?: (reading: Reading) => number | undefined,
      ): Array<number | null> => (readings ? shown(slotted(readings, span, n, holding, pick)) : []);
      const perSlot = (
        rule: SlotRule,
        pick?: (reading: Reading) => number | undefined,
      ): Array<number | null> =>
        readings ? shown(readSlots(readings, grid.edges, holding, rule, pick)) : [];
      const kind = item.kind ?? 'line';
      // a statistic reads by its own: its changes added up, a running total's last, its lowest or highest, else its
      // mean; a history by the one it names (#228: its lowest, its highest, the last), else its mean
      const stat =
        source === 'statistics'
          ? this.statFor(item)
          : source === 'history'
            ? (this.historyStat(item) ?? null)
            : null;
      const slotRule: SlotRule = !grid.round
        ? 'mean'
        : stat === 'change'
          ? 'sum'
          : stat === 'sum' || stat === 'last'
            ? 'last'
            : stat === 'min' || stat === 'max'
              ? stat
              : 'mean';
      // a meter's history drawn as bars reads what it gained in each slot, not what it showed, unless its stat names
      // another reading; readings of a range that is over (`whole`, the one a picker compares with) are read to its end
      const meter = readingsOf(view.deviceClass, view.attr('state_class'), view.unit).rule;
      const layOn = (laid: readonly Reading[], whole = false): Array<number | null> =>
        source === 'history' && meter !== 'mean' && !stat && (bars || kind === 'columns')
          ? shown(
              gains(
                laid,
                grid.edges,
                whole ? { hold: Infinity } : holding,
                meter === 'increase',
                window.running && !whole ? window.now : window.end,
              ),
            )
          : shown(readSlots(laid, grid.edges, whole ? { hold: holding.hold } : holding, slotRule));
      // a line of the recorder's runs through time: on the house's round times, as calmly as the card draws it (or
      // every `points`), read where Home Assistant reads it
      const timed =
        recorded &&
        !bars &&
        kind !== 'columns' &&
        kind !== 'band' &&
        (item.curve ?? style.curve) !== 'step';
      const line =
        timed && readings
          ? this.lineOf(
              readings,
              window,
              style,
              source === 'statistics' ? PERIOD_MS[this.periodFor(item)] : undefined,
              source === 'history' ? this.historyStat(item) : undefined,
            )
          : null;
      // a slot's band: the lowest and the highest of what it holds, around its mean; a slot still running with nothing
      // yet compiled has none, and the band ends on the slot before it
      const wide = (values: Array<number | null>): Array<number | null> =>
        window.running && values[values.length - 1] === null ? values.slice(0, -1) : values;
      const lows = kind === 'band' ? wide(perSlot('min', (r) => r.low)) : [];
      const highs = kind === 'band' ? wide(perSlot('max', (r) => r.high)) : [];
      const banded = lows.length > 1 && lows.every((v, i) => v !== null && highs[i] !== null);
      const live = recorded
        ? view.number
        : source === 'forecast'
          ? (numberAttr(view, item.value_key ?? 'temperature') ?? readings?.[0]?.v ?? null)
          : ((readings
              ? slotted(readings, { start: window.now, end: window.now + 1 }, 1, holding)[0]
              : null) ?? view.number);
      const curve = item.curve ?? style.curve;
      const slots = readings ? layOn(readings) : [];
      const cover = (Math.min(window.end, window.now) - window.start) / (window.end - window.start);
      return [
        {
          item,
          index,
          view,
          source,
          name: this.nameFor(view, item.name),
          scale,
          digits,
          colour,
          accent,
          kind,
          curve,
          readings,
          holding,
          slots,
          layOn,
          // bars are read and drawn by the slot: they have no line's points to read between
          points:
            kind === 'columns' || bars
              ? []
              : line
                ? shown(line.values)
                : grid.round && (kind === 'band' || curve === 'step')
                  ? slots
                  : lay(edges, count + 1),
          line,
          cover,
          at: line
            ? line.at.map((f) => f * cover)
            : grid.round && kind === 'band' && curve !== 'step'
              ? middles
              : undefined,
          band: banded ? { low: lows as number[], high: highs as number[] } : undefined,
          now: live === null || live === undefined ? null : live / scale.divisor,
          price: isPrice(scale.unit, view.deviceClass),
          thresholds: this.thresholds(item, scale.unit, view.id),
        },
      ];
    });
  }

  /**
   * What a sensor's history reads of its readings where its series says (#228): their lowest, their highest or the
   * last, in each slot and around each point; none (their mean) where it says none or the mean.
   */
  private historyStat(item: ChartSeriesConfig): 'min' | 'max' | 'last' | undefined {
    const stat = item.stat;
    return stat === 'min' || stat === 'max' || stat === 'last' ? stat : undefined;
  }

  /**
   * The series of states as this render draws them (#228): each its stretches across the window as the recorder kept
   * them, brought up to now and the state now, and its colour (`paintOf`).
   */
  private strips(items: readonly ChartSeriesConfig[], window: Window): Strip[] {
    const several = items.length > 1;
    const span = this.spanKey();
    const end = Math.min(window.end, window.now);
    return items.flatMap((item, index): Strip[] => {
      if (!isStates(item)) return [];
      const view = this.entity(item.entity);
      const answer = this.states_[index];
      const rows = answer?.id === answerId(item, 'history', span) ? answer.readings : undefined;
      return [
        {
          item,
          index,
          view,
          name: this.nameFor(view, item.name),
          ...this.paintOf(item, index, view, several),
          spans: rows && stateReadings(rows, window.start, end, view),
        },
      ];
    });
  }

  /**
   * A series' line through the window as far as it has happened (`timeLine`, as calmly as the card's width draws it in
   * its style, or every `points`; never finer than its statistics' bucket, `finest`); none where nothing has.
   */
  private lineOf(
    readings: readonly Reading[],
    window: Window,
    style: ResolvedStyle,
    finest: number | undefined,
    rule: 'min' | 'max' | 'last' | undefined,
  ): TimeLine | null {
    const end = Math.min(window.end, window.now);
    if (!(end > window.start) || !readings.length) return null;
    return timeLine({
      readings,
      start: window.start,
      end,
      width: (this.contentWidth * (end - window.start)) / (window.end - window.start),
      style,
      hass: this.hass,
      ...(finest ? { finest } : {}),
      ...(rule ? { rule } : {}),
    });
  }

  /** A figure of a series, in its unit and decimals; "—" where there is none. */
  private figureOf(drawn: Drawn, value: number | null): { value: string; unit: string } {
    if (value === null || !Number.isFinite(value)) return { value: '—', unit: '' };
    return {
      value: figure(this.hass, value, { unit: drawn.scale.unit, divisor: 1 }, drawn.digits),
      unit: drawn.scale.unit,
    };
  }

  /* ---------- the window's words ---------- */

  /**
   * What the window is, under the title: the last hours or days, today, today and tomorrow — a followed picker's range
   * as the energy cards following it say it.
   */
  private spanWords(window: Window): string {
    const span = this.span;
    if (this.picked())
      return rangeWords(
        this.hass,
        { start: new Date(window.start), end: new Date(window.end) },
        this.now(),
      );
    if (span.kind !== 'rolling')
      return window.end - window.start > DAY * 1.5
        ? s(this.hass, 'today_tomorrow')
        : this.t('common.today');
    const days = span.hours >= 48 && span.hours % 24 === 0;
    const count = days ? span.hours / 24 : span.hours;
    return capitalise(
      plural(this.hass, days ? 'sensor.window_days' : 'sensor.window_hours', count, { count }),
    );
  }

  /** When a moment was: its time, with its weekday where it is not today. */
  private when(t: number, window: Window): string {
    const time = formatTime(this.hass, new Date(t));
    return dayStart(this.hass, new Date(t)) === dayStart(this.hass, new Date(window.now))
      ? time
      : `${formatDate(this.hass, new Date(t), 'weekday')} ${time}`;
  }

  /**
   * The window's clock under the plot, by the engine's labellers: a rolling window's quarters ending in "Now", a
   * calendar window's ends and its round marks between — where its ends do not stand 12 apart (half a section), the
   * days they are (Thu · Fri), else their times, else its start alone.
   */
  private axisItems(
    window: Window,
    grid: Grid,
    width: number,
  ): ReadonlyArray<readonly [number, string]> {
    const span = this.span;
    const ruler = this.headFit.ruler;
    const time = (t: number): string => formatTime(this.hass, new Date(t));
    const weekday = (t: number): string => formatDate(this.hass, new Date(t), 'weekday');
    if (span.kind === 'rolling' && !this.picked()) {
      const clock = {
        hours: span.hours,
        time,
        daysAgo: (days: number) =>
          this.t('sensor.days_ago', { count: formatNumber(this.hass, days, { digits: 1 }) }),
        nowWord: this.t('common.now'),
        holds: (items: ReadonlyArray<readonly [number, string]>) => axisHolds(ruler, width, items),
      };
      return grid.round
        ? slotTicks({ ...clock, edges: grid.edges, running: grid.running })
        : quarterTicks({ ...clock, now: window.now });
    }
    type Items = ReadonlyArray<readonly [number, string]>;
    // every label 12 apart, the two ends too (the axis's rule holds three or more)
    const holds = (items: Items): boolean =>
      axisHolds(ruler, width, items) &&
      ruler.width('fv-axis', items[0]?.[1] ?? '') +
        ruler.width('fv-axis', items[items.length - 1]?.[1] ?? '') +
        12 <=
        width;
    const length = window.end - window.start;
    const at = (fraction: number): number => window.start + fraction * length;
    const midnight = (t: number): boolean => dayStart(this.hass, new Date(t)) === t;
    // a midnight between the ends of a day or two says its day ("Fri 00:00"): a bare 00:00 could be either (a longer
    // range, a followed picker's, says its days by their dates)
    const marks: Items = roundTicks({
      start: window.start,
      end: window.end,
      width,
      labelWidth: (text) => ruler.width('fv-axis', text),
      time,
      weekday,
      day: (t) => formatDate(this.hass, new Date(t), 'day'),
      date: (t) => formatDate(this.hass, new Date(t), 'short'),
      dateYear: (t) => formatDate(this.hass, new Date(t), 'short'),
    }).map(([fraction, text], index, all) =>
      length <= 2 * DAY && index > 0 && index < all.length - 1 && midnight(at(fraction))
        ? [fraction, `${weekday(at(fraction))} ${time(at(fraction))}`]
        : [fraction, text],
    );
    // where the times do not hold, the days its midnights begin (Thu · Fri · Sat), else its ends' alone
    const days: Items = Array.from({ length: Math.round(length / DAY) + 1 }, (_unused, n) =>
      dayStart(this.hass, new Date(window.start + DAY / 2), n),
    )
      .filter((t) => t <= window.end)
      .map((t) => [(t - window.start) / length, weekday(t)]);
    const ends: Items = [days[0], days[days.length - 1]].filter(
      (item): item is readonly [number, string] => item !== undefined,
    );
    return [marks, days, ends].find(holds) ?? ends.slice(0, 1);
  }

  /* ---------- the marked windows ---------- */

  /**
   * The windows a lone series marks (`highlight`): of `highlight_hours` (one by default), the lowest mean and the
   * highest of what is to come — from now's slot on, where the window runs past now and the series reads three
   * windows' worth there (two marks on what is left of an evening would be one), else across all of it. Each is a
   * stretch of the plot in its tone (a price's cheapest the `ok` tone, its dearest the danger's; any other series' its
   * own) and words in four forms, longest first: "Cheapest 13:00–15:00 · 0.078 €/kWh", without the unit, without the
   * figure, the hours alone.
   */
  private marked(drawn: Drawn, window: Window, grid: Grid): Marked[] {
    const wanted = this.config?.highlight ?? defaultWindows(this.config?.chart);
    if (wanted === 'none' || drawn.readings === undefined) return [];
    const count = grid.edges.length - 1;
    const length = window.end - window.start;
    const hours = Math.min(12, Math.max(1, Math.round(this.config?.highlight_hours ?? 1)));
    const k = Math.max(1, Math.round((hours * HOUR * count) / length));
    const nowSlot = Math.min(count - 1, Math.floor(((window.now - window.start) / length) * count));
    const ahead =
      window.now < window.end &&
      drawn.slots.slice(nowSlot).filter((v) => v !== null).length >= 3 * k;
    const picks = wanted === 'both' ? (['min', 'max'] as const) : [wanted];
    return picks.flatMap((pick): Marked[] => {
      const found = windowAt(drawn.slots, k, pick, ahead ? nowSlot : 0);
      if (!found) return [];
      const from = grid.edges[found.start] as number;
      const to = grid.edges[found.start + k] as number;
      const range = `${this.when(from, window)}–${formatTime(this.hass, new Date(to))}`;
      const key = drawn.price
        ? pick === 'min'
          ? 'cheapest'
          : 'priciest'
        : pick === 'min'
          ? 'lowest'
          : 'highest';
      const word = s(this.hass, key, { window: range });
      const { value, unit } = this.figureOf(drawn, found.mean);
      const tone: Tone = drawn.price ? (pick === 'min' ? 'ok' : 'danger') : 'accent';
      return [
        {
          from: found.start / count,
          to: (found.start + k) / count,
          pick,
          tone,
          forms: [
            unit ? `${word} · ${value} ${unit}` : `${word} · ${value}`,
            `${word} · ${value}`,
            word,
            range,
          ],
        },
      ];
    });
  }

  /* ---------- the lowest and highest points (#264) ---------- */

  /**
   * Each series' lowest and highest points where it asks for them, as its drawing marks them (`extremesOf`): its
   * figure in its unit, when it was — a slot's start, a point's moment — and the ink of the band it is in (`wear`).
   */
  private points(
    specs: Specs,
    window: Window,
    grid: Grid,
    wear: (d: Drawn) => Thresholds | undefined,
  ): Map<number, Points> {
    const points = new Map<number, Points>();
    const { edges } = grid;
    const count = edges.length - 1;
    const length = window.end - window.start;
    const drawings = [
      [specs.main, specs.of[0]],
      [specs.over, specs.of[1]],
    ] as const;
    for (const [spec, of] of drawings) {
      if (!spec) continue;
      of.forEach((d, k) => {
        const found = extremesOf(spec, k);
        // a slot reads its round period, from its start; a point its moment
        const slotwise = spec.kind === 'bars' || d.curve === 'step' || d.kind === 'band';
        const point = (extreme: Extreme | undefined): Point | undefined => {
          if (!extreme) return undefined;
          const i = extreme.index;
          const t = slotwise
            ? (edges[i] as number)
            : window.start + (d.at ? (d.at[i] ?? 1) : i / count) * length;
          return {
            ...this.figureOf(d, extreme.value),
            time: this.pointTime(t, length, slotwise ? (edges[i + 1] ?? window.end) - t : 0),
            ink: wear(d)?.band(extreme.value)?.ink,
          };
        };
        const min = point(found.min);
        const max = point(found.max);
        if (min || max) points.set(d.index, { ...(min ? { min } : {}), ...(max ? { max } : {}) });
      });
    }
    return points;
  }

  /**
   * When a lowest or highest point was, in the house's time format: its weekday too on a window longer than a day, its
   * date where a week holds a weekday twice; a slot of a day or more its date alone.
   */
  private pointTime(t: number, length: number, slot: number): string {
    const date = new Date(t);
    if (slot >= DAY) return formatDate(this.hass, date, 'short');
    const time = formatTime(this.hass, date);
    return length > DAY
      ? `${formatDate(this.hass, date, length < 7 * DAY ? 'weekday' : 'short')} ${time}`
      : time;
  }

  /** A lowest or highest point's words, whole: "High 5.4 kW · 13:00" (its pill's longest form, what is spoken). */
  private pointWords(point: Point, pick: 'min' | 'max'): string {
    return `${s(this.hass, pick === 'max' ? 'high' : 'low', { value: figureText(point) })} · ${point.time}`;
  }

  /**
   * A lone series' lowest or highest point as a pill of the row, led by its glyph in the ok or the danger tone, as its
   * dot is: its words in four forms, longest first — "High 5.4 kW · 13:00", without the word, the figure, the number.
   */
  private pointPill(point: Point, pick: 'min' | 'max'): Pill {
    const figure = figureText(point);
    return {
      tone: pick === 'max' ? 'danger' : 'ok',
      glyph: pick === 'max' ? 'up' : 'down',
      forms: [this.pointWords(point, pick), `${figure} · ${point.time}`, figure, point.value],
    };
  }

  /**
   * What each series' readout may say, for the row's fit (#264): its name over its reading now, its lowest and its
   * highest in the window — anything a read can say of it — or every state it was in, in their words.
   */
  private widest(drawn: readonly Drawn[], strips: readonly Strip[]): PairText[] {
    return [
      ...drawn.flatMap((d) => {
        const shown = [...d.slots, ...d.points].filter(
          (v): v is number => v !== null && Number.isFinite(v),
        );
        const reach = shown.length ? [Math.min(...shown), Math.max(...shown)] : [];
        return [d.now, ...reach].map((v) => ({ label: d.name, ...this.figureOf(d, v) }));
      }),
      ...strips.flatMap((d) =>
        [
          this.stateThen(d, null),
          ...[...new Set((d.spans ?? []).map((span) => span.state))].map((state) =>
            this.stateWords(d, state),
          ),
        ].map((value) => ({ label: d.name, value, unit: '' })),
      ),
    ];
  }

  /* ---------- the change on the period before ---------- */

  /**
   * The first series' change on the period before (its head's pill, "+5 %"): what has happened of the window against
   * as long a stretch one period earlier (a rolling window's length back, the day before for a calendar one) — a
   * measurement's mean, what a meter gained — where the recorder holds both; none from a list or a forecast.
   */
  private change(drawn: Drawn, window: Window): number | null {
    const readings = drawn.readings;
    if (!readings?.length || (drawn.source !== 'history' && drawn.source !== 'statistics'))
      return null;
    const back = this.back();
    const to = Math.min(window.now, window.end);
    const statistics = drawn.source === 'statistics';
    const stat = statistics ? this.statFor(drawn.item) : null;
    const counter = statistics
      ? stat === 'change' || stat === 'sum'
      : readingsOf(drawn.view.deviceClass, drawn.view.attr('state_class'), drawn.view.unit).rule !==
        'mean';
    const at = (t: number): number | null =>
      slotted(readings, { start: t, end: t + 1 }, 1, drawn.holding)[0] ?? null;
    const of = (start: number, end: number): number | null => {
      if (stat === 'change')
        return readings
          .filter((r) => r.t >= start && r.t < end)
          .reduce<number | null>((sum, r) => (sum ?? 0) + r.v, null);
      if (counter) {
        const [a, b] = [at(start), at(end - 1)];
        return a === null || b === null ? null : b - a;
      }
      return slotted(readings, { start, end }, 1, drawn.holding)[0] ?? null;
    };
    const now = of(window.start, to);
    const before = of(window.start - back, to - back);
    if (now === null || before === null || before === 0) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const items = seriesOf(this.config);
    if (!items.length) return this.renderEmpty();
    const now = this.now();
    const days = this.days(now);
    // the window as far as the readings reach (today and tomorrow is today until tomorrow is published)
    const asked = this.windowAt(now, this.latest(items, days));
    // the windows it marks are its own: the style's lowest and highest marks stay off
    const style = resolveStyle(
      this.config?.chart,
      { ...chartKeysOf(this.config), highlight: 'none' },
      capsFor(items.length, asked.now < asked.end),
    );
    const grid = this.gridOf(asked, items, days, style);
    // the slots' round times may run on past the rolling window's own end: their last holds now, still running
    const window: Window = {
      ...asked,
      start: grid.edges[0] as number,
      end: grid.edges[grid.edges.length - 1] as number,
      running: grid.running,
    };
    const drawn = this.drawn(window, grid, items, days, style);
    const strips = this.strips(items, window);
    return this.variant === 'tile'
      ? this.renderTile(drawn, strips, window)
      : this.renderChartCard(drawn, strips, window, grid, style);
  }

  private renderChartCard(
    drawn: readonly Drawn[],
    strips: readonly Strip[],
    window: Window,
    grid: Grid,
    style: ResolvedStyle,
  ): TemplateResult {
    const config = this.config;
    const count = grid.edges.length - 1;
    // the lead is the first series of numbers: its reading heads the row, its unit the scale's; a chart of states
    // alone is headed by its first
    const lead = drawn[0];
    const first = strips[0] as Strip;
    const view = lead?.view ?? first.view;
    const total = drawn.length + strips.length;
    const several = total > 1;
    const off = !several && !isUsable(view);
    const full = this.variant === 'full';
    const width = down4(this.contentWidth);
    const title = config?.title ?? (several ? s(this.hass, 'title') : (lead ?? first).name);
    // "Unavailable" is said once, under the title; several series each say theirs in the off skin
    const stated = !several && view.status !== 'ok';
    const sub = stated ? stateText(this.hass, view) : (config?.subtitle ?? this.spanWords(window));
    // a window's words give way before they are cut; a state never is ("Entity not found" is "Not found" where narrow)
    const fitted = this.headFit.fit({
      width: this.contentWidth,
      title,
      sub,
      trailing: 44,
      shorter: !stated ? [''] : view.status === 'missing' ? [stateWord(this.hass, view)] : [],
    });
    const tone: Tone = off ? 'off' : toneOf(config, 'accent');
    const loading =
      drawn.some((d) => d.readings === undefined) || strips.some((d) => d.spans === undefined);
    // the plot draws the series of numbers where one has a reading in the window; where none has, the strips of the
    // series of states take its room; where they have nothing either, there is nothing to chart
    const plotted = !loading && drawn.some((d) => d.slots.some((v) => v !== null));
    const tracks = !loading && !plotted && strips.some((d) => Boolean(d.spans?.length));
    const marks = !several && plotted && lead ? this.marked(lead, window, grid) : [];
    const ghost = lead ? this.ghostOf(lead) : null;
    const showHead = config?.show_head !== false;
    const legendShown = several && config?.show_legend !== false;
    // a lone series' lowest and highest points (#264) are pills in the row, as its marked windows are
    const peaked =
      !several && plotted && lead !== undefined && extremesAsked(lead.item) !== undefined;
    // a readout a series where the card asks for them (#264), the legend they are: in equal columns, three to a line
    // at most, fitted on all each may say (`widest`) so a read never moves them; where a name would be cut, the
    // legend's lines, one a row
    const reads = full && readsEach(config ?? { type: '' });
    const columns = total > 3 ? Math.ceil(total / 2) : total;
    const fit = reads
      ? pairFit(this.headFit.ruler, width, this.widest(drawn, strips), { circles: false, columns })
      : null;
    const readouts = fit !== null && fit.gap !== 0;
    const tall = readouts && drawn.some((d) => extremesAsked(d.item) !== undefined);
    // a legend of four or more under the axis in the columns that hold its items; two or three series', and one whose
    // columns would cut its names (a narrow card), the value row's lines, one a row, each reading at its end
    const cols = legendColumns(total, width, showHead);
    const inRow = (legendShown && !reads && (total <= 3 || cols === 0)) || (reads && !readouts);
    const row = full && (showHead || marks.length > 0 || peaked || inRow);
    const under = full && legendShown && !reads && !inRow;
    // the card's height is its config's alone (`chartHeight`): its room for four series or more (two lines of a
    // legend under the axis, or of readouts) is the plot's where they take less, and what they take more of — a third
    // line under the axis, lines past the value row's — the plot gives; the value row's room is the chart's where the
    // row has nothing to say
    const room = full && total > 3 && (legendShown || reads) ? UNDER + linesTall(2) : 0;
    const lines = total > 3 ? 2 : 1;
    const rowTall = readouts
      ? Math.max(TOP, lines * (READOUT + (tall ? POINTS_LINE : 0)) + (lines - 1) * READOUTS_GAP)
      : inRow
        ? Math.max(TOP, linesTall(total))
        : TOP;
    const legendMore = under ? UNDER + linesTall(Math.ceil(total / cols)) : row ? rowTall - TOP : 0;
    const height = CHART + (full && !row ? ROW : 0) + room - legendMore;
    // and 16 a series of states: its strip under the plot, or the plot's own room where the strips take it (and where
    // the chart waits, or has nothing to say)
    const stripRoom = strips.length * (STRIP + STRIP_GAP);
    // a row that says the reading reads the chart with it — the value, the time its label, or the legend's lines, the
    // time on the axis — and no bubble is drawn: the plot takes the bubble's room. A row of the marked windows' pills
    // alone leaves the bubble its room, over the plot and under the pills.
    const rowReads = full && (showHead || inRow);
    const headroom = rowReads ? TIGHT : HEADROOM;
    // the card's thresholds, in its lead's unit: they colour the series written in it that have none of their own
    const shared = lead ? this.thresholds(config, lead.scale.unit) : undefined;
    const bands = shared?.bands() ?? [];
    // the scale's column folds first where it would leave the plot under its least (half a section)
    const scaled = plotted
      ? this.specs(drawn, window, style, marks, { width, height, headroom }, ghost, bands)
      : null;
    const specs =
      scaled && width - plotOf(scaled.main).left < PLOT_MIN
        ? this.specs(
            drawn,
            window,
            { ...style, axis: false },
            marks,
            { width, height, headroom },
            ghost,
            bands,
          )
        : scaled;
    const fraction = this.scrubber.value;
    const read =
      fraction === null
        ? null
        : specs
          ? this.readAt(specs, drawn, window, grid, fraction)
          : tracks
            ? this.readTracks(window, width, fraction)
            : null;
    const values = drawn.map((d, i) => (read ? (read.values[i] ?? null) : d.now));
    const plot = specs ? plotOf(specs.main) : null;
    const left = plot?.left ?? 0;
    // a strip's two pixels, in time: the least a stretch with a look is drawn, and read
    const least = (2 * (window.end - window.start)) / Math.max(1, plot?.width ?? width);
    // a figure wears the band of a threshold that claims it (#264): its series' own; the card's too in the readouts,
    // as they colour its line
    const wear = (d: Drawn): Thresholds | undefined =>
      d.thresholds ?? (reads && d.scale.unit === lead?.scale.unit ? shared : undefined);
    const named = this.named(drawn, strips, values, read ? { t: read.t, least } : null, wear);
    const headline = (lead ? named.find((n) => n.index === lead.index) : named[0]) as Named;
    const points = specs ? this.points(specs, window, grid, wear) : new Map<number, Points>();
    // the row's pills, a row each way: a marked window's beside the lone series' point of its kind
    const peaks = !several && lead ? points.get(lead.index) : undefined;
    const pills = (['min', 'max'] as const)
      .map((pick): Pill[] => {
        const point = peaks?.[pick];
        return [
          ...marks.filter((m) => m.pick === pick),
          ...(point ? [this.pointPill(point, pick)] : []),
        ];
      })
      .filter((pair) => pair.length > 0);
    // the keys read from where the chart rests: the end of what has happened where the window runs past now, else
    // the window's end
    const rest =
      specs && plot && nowFraction(window) !== null
        ? (readAt(specs.main, null).x - plot.left) / plot.width
        : 1;
    // the legend's lines in the row, or the readouts, read each series: when that is goes on the axis, under the cursor
    const when = rowReads && (inRow || readouts) ? read : null;
    return html`<article class="fv-card ch-card ${off ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: fitted.icon ? (config?.icon ?? (several ? 'chart' : iconOf(view))) : null,
        small: fitted.small,
        tone,
        title,
        name: true,
        sub: fitted.sub,
        cut: fitted.cut,
        ...this.headActions(view.id),
        trailing: round('dots', 'quiet', this.t('common.more'), () =>
          this.tap(view.id, { action: 'more-info' }),
        ),
      })}
      ${
        row
          ? this.valueRow(named, headline, read?.time ?? null, pills, window, lead, {
              showHead,
              inRow,
              height: rowTall,
              readouts: fit && readouts ? { fit, columns, points, tall } : null,
            })
          : nothing
      }
      <div
        class="ch-chart fv-tone--${off ? 'off' : toneOf(config, 'accent')}"
        style="height:${specs ? height : height + stripRoom}px;width:${width}px"
        role="img"
        tabindex="0"
        aria-label=${this.spoken(named, read?.time ?? null, points)}
        @keydown=${(event: KeyboardEvent) => this.scrubber.key(event, 1 / count, rest)}
        ${scrub(this.scrubber)}
      >
        ${
          loading
            ? html`<div class="fv-skeleton"></div>`
            : specs && lead
              ? html`${ghost ? this.ghosts(specs.main, ghost, isBars(style.preset) || lead.kind === 'columns') : nothing}${this.drawCharts(specs, lead, values[0] ?? null, read, rowReads, several)}`
              : tracks
                ? this.tracks(strips, window, read, {
                    width,
                    headroom,
                    rowReads,
                    several,
                    style,
                    least,
                  })
                : html`<div class="ch-empty" data-align="center">
                    ${ico(config?.icon ?? iconOf(view), 'neutral')}
                    <p class="fv-empty">${s(this.hass, 'empty')}</p>
                  </div>`
        }
      </div>
      ${specs && strips.length ? this.stripsUnder(strips, window, specs, read) : nothing}
      <div
        class="ch-axis ${when ? 'is-reading' : ''}"
        style=${left > 0 ? `margin-inline-start:${left}px` : nothing}
      >
        ${axis(this.axisItems(window, grid, width - left))}
        ${when ? this.whenPill(when.time, when.x - left, width - left) : nothing}
      </div>
      ${
        under
          ? html`<div class="ch-legend" style="--ch-cols:${cols}">
              ${this.legendOf(named, showHead)}
            </div>`
          : nothing
      }
    </article>`;
  }

  /**
   * Every series as the legend, the value row and the spoken label say it, in the card's order: a series of numbers
   * its figure (`values`: where the chart is read, else now) in the ink of the band its thresholds put it in (`wear`:
   * its own), a series of states its state where the chart is read (`at`, else now) in Home Assistant's words and the
   * colour its strip shows (`inkOf`).
   */
  private named(
    drawn: readonly Drawn[],
    strips: readonly Strip[],
    values: ReadonlyArray<number | null>,
    at: Moment | null,
    wear: (d: Drawn) => Thresholds | undefined = (d) => d.thresholds,
  ): Named[] {
    return [
      ...drawn.map((d, i) => ({
        index: d.index,
        name: d.name,
        colour: d.colour,
        accent: d.accent,
        ...this.figureOf(d, values[i] ?? null),
        ink: wear(d)?.band(values[i] ?? null)?.ink,
      })),
      ...strips.map((d) => ({
        index: d.index,
        name: d.name,
        ...this.inkOf(d),
        value: this.stateThen(d, at),
        unit: '',
      })),
    ].sort((a, b) => a.index - b.index);
  }

  /**
   * The state a strip shows at a moment: the last stretch drawn over it — one with a look is drawn `least` long at the
   * least (its two pixels), so a door open for a minute of a day is read where its mark is — else the stretch it falls
   * in; none past what is known.
   */
  private shownAt(strip: Strip, { t, least }: Moment): string {
    const spans = strip.spans ?? [];
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i] as StateSpan;
      if (
        span.from <= t &&
        t <= Math.max(span.to, span.from + least) &&
        this.stretchLook(strip, span.state).cls !== ''
      )
        return span.state;
    }
    return spanAt(spans, t)?.state ?? '';
  }

  /**
   * The colour a series of states shows in its legend: its colour while on — the one its `state_colors` give `on`, else
   * the first they give a state of its words (a heat pump's heating), else its own.
   */
  private inkOf(strip: Strip): {
    readonly colour: SeriesColour;
    readonly accent: string | undefined;
  } {
    const own = strip.item.state_colors;
    const states = own && typeof own === 'object' ? Object.keys(own) : [];
    for (const state of ['on', ...states]) {
      const look = this.stretchLook(strip, state);
      if (look.tone) return { colour: look.tone, accent: look.accent };
    }
    return { colour: strip.colour, accent: strip.accent };
  }

  /**
   * A series of states' state where the chart is read — now, where it is not — in Home Assistant's words ("On", "Open",
   * "Heat"); "—" where nothing was known (`unavailable`, `unknown`, past now).
   */
  private stateThen(strip: Strip, at: Moment | null): string {
    const { view } = strip;
    return this.stateWords(
      strip,
      at === null ? (view.status === 'ok' ? view.state : '') : this.shownAt(strip, at),
    );
  }

  /** A state of a series of states in Home Assistant's words; "—" where nothing was known. */
  private stateWords({ view }: Strip, state: string): string {
    if (stretchTone(view.domain, state) === 'is-away') return '—';
    // the entity as it was then: a state it held, whatever it is now
    return stateText(this.hass, {
      ...view,
      state,
      status: 'ok',
      stateObj: view.stateObj && { ...view.stateObj, state },
    });
  }

  /**
   * How a stretch of a series of states is painted: nothing known striped (a gap, never "off"); a colour the series
   * names for the state (`state_colors`: a tone, a colour, `none` for the strip's own fill); else the house's
   * (`stretchTone`) — on in the series' colour, doing something quieter the neutral, resting the strip's own fill.
   */
  private stretchLook(strip: Strip, state: string): StretchLook {
    const cls = stretchTone(strip.view.domain, state);
    const own = cls === 'is-away' ? undefined : byState(strip.item.state_colors, state);
    if (own === undefined) return { cls };
    if (own === 'none') return { cls: '' };
    const look = stateLook(
      this.accents,
      { state_colors: { [state]: own } },
      state,
      strip.colour === 'off' ? 'off' : 'accent',
    );
    return { cls: 'is-own', tone: look.tone, ...(look.accent ? { accent: look.accent } : {}) };
  }

  /**
   * A series of states' strip: its stretches across the window in their looks (`stretchLook`), two side by side of
   * one look told apart by a hairline of the card's fill; the strip itself in the series' colour, which its stretches
   * on wear.
   */
  private strip(strip: Strip, window: Window): TemplateResult {
    const length = Math.max(1, window.end - window.start);
    const at = (t: number): number =>
      ((Math.min(window.end, Math.max(window.start, t)) - window.start) / length) * 100;
    const paint = paintOf(strip.colour, strip.accent);
    let before = '';
    // a drawing: its stretches lie where their minutes do, off the grid
    return html`<div
      class="ch-strip ${paint.className}"
      data-measure="drawn"
      data-accent=${strip.accent ?? nothing}
      style=${paint.style ?? nothing}
    >
      ${(strip.spans ?? []).map((span) => {
        const look = this.stretchLook(strip, span.state);
        const key = look.cls ? `${look.cls}|${look.tone ?? ''}|${look.accent ?? ''}` : '';
        const after = key !== '' && key === before;
        before = key;
        const from = at(span.from);
        return key
          ? html`<i
              class="fv-stretch ${look.cls} ${after ? 'is-after' : ''} ${look.tone ? `fv-tone--${look.tone}` : ''}"
              data-accent=${look.accent ?? nothing}
              style="left:${from.toFixed(3)}%;width:${(at(span.to) - from).toFixed(3)}%"
            ></i>`
          : nothing;
      })}
    </div>`;
  }

  /**
   * The strips under the plot (#228): one a series of states, 12 tall and 4 under what is over it, from the plot's start
   * to its end on its time; read as the chart is, the cursor down them at the chart's x in its look.
   */
  private stripsUnder(
    strips: readonly Strip[],
    window: Window,
    specs: Specs,
    read: Read | null,
  ): TemplateResult {
    const plot = plotOf(specs.main);
    const spec = specs.over ?? specs.main;
    const bars = spec.kind ? spec.kind === 'bars' : isBars(spec.style.preset);
    return html`<div
      class="ch-strips ${spec.style.animate ? '' : 'is-still'}"
      style="margin-inline-start:${plot.left}px;width:${plot.width}px"
      aria-hidden="true"
      ${scrub(this.scrubber)}
    >
      ${strips.map((strip) => this.strip(strip, window))}
      ${
        read && spec.style.cursor !== 'none'
          ? stripsCursor(read.x - plot.left, spec.style.cursor === 'dashed' && !bars)
          : nothing
      }
    </div>`;
  }

  /**
   * A chart of states alone (#228): its strips take the plot's room under the bubble's (or the knob's, under a row that
   * reads the chart), each as tall as it leaves them, 4 apart; read by hand, the cursor down them, and the bubble —
   * where the row does not read the chart — with the state and when, or when alone over several (their legend says
   * each).
   */
  private tracks(
    strips: readonly Strip[],
    window: Window,
    read: Read | null,
    o: {
      readonly width: number;
      readonly headroom: number;
      readonly rowReads: boolean;
      readonly several: boolean;
      readonly style: ResolvedStyle;
      readonly least: number;
    },
  ): TemplateResult {
    const lone = strips[0] as Strip;
    return html`<div
        class="ch-strips is-tall ${o.style.animate ? '' : 'is-still'}"
        style="top:${o.headroom}px"
      >
        ${strips.map((strip) => this.strip(strip, window))}
        ${
          read && o.style.cursor !== 'none'
            ? stripsCursor(read.x, o.style.cursor === 'dashed')
            : nothing
        }
      </div>
      ${
        read && !o.rowReads
          ? chartBubble({
              x: read.x,
              width: o.width,
              value: o.several ? read.time : this.stateThen(lone, { t: read.t, least: o.least }),
              ...(o.several ? {} : { time: read.time }),
              family: getComputedStyle(this).fontFamily,
              lean: 0,
              look: o.style.bubble,
            })
          : nothing
      }`;
  }

  /** Where a chart of states alone is read: the moment at a fraction of its width (the strips are the plot's). */
  private readTracks(window: Window, width: number, fraction: number): Read {
    const t = window.start + fraction * (window.end - window.start);
    return { cursor: fraction, x: fraction * width, t, time: this.when(t, window), values: [] };
  }

  /**
   * The chart's drawings: one for the lines, and — where some series are columns — the columns first, on a nice
   * scale that reaches every line's readings, the lines over them on the same scale (each on its own where the units
   * differ), with no grid or scale of their own. Thresholds colour every line and bar — a series' own (#264), else the
   * card's (`bands`) where it is written in their unit; a lone series' marked windows stand behind them; a series marks
   * its lowest and highest points where it asks for them, but in a stack of columns.
   */
  private specs(
    drawn: readonly Drawn[],
    window: Window,
    resolved: ResolvedStyle,
    marks: readonly Marked[],
    frame: ChartFrame,
    ghost: ReadonlyArray<number | null> | null,
    bands: readonly ThresholdBand[],
  ): Specs {
    const lead = drawn[0] as Drawn;
    // the range a followed picker compares with stands on the same scale as the series
    const ghostly = (ghost ?? []).filter((v): v is number => v !== null);
    // a step asked closer than the style's line reads draws every line thinner (`timeLine`)
    const style = {
      ...resolved,
      line: Math.min(resolved.line, ...drawn.map((d) => d.line?.style.line ?? resolved.line)),
    };
    const bars = isBars(style.preset);
    const stretches: Stretch[] = marks.map((m) => ({ from: m.from, to: m.to, colour: m.tone }));
    const columned = bars ? drawn : drawn.filter((d) => d.kind === 'columns');
    const lined = bars ? [] : drawn.filter((d) => d.kind !== 'columns');
    // the columns style stacks two series' columns or more: a stack's column is no series' own
    const stacked = style.preset === 'columns' && columned.length > 1;
    // each series in the unit its figures are written in, its scale from zero where its quantity starts there: series of
    // one unit share a scale, another unit's stand on one of their own (the engine's)
    const asSeries = (d: Drawn, slots: boolean): ChartSeries => {
      const extremes = slots && stacked ? undefined : extremesAsked(d.item);
      return {
        unit: d.scale.unit,
        zero:
          d.price || readingsOf(d.view.deviceClass, d.view.attr('state_class'), d.view.unit).zero,
        values: slots || d.curve === 'step' ? d.slots : d.points,
        ...(d.at && !slots && d.curve !== 'step' ? { at: d.at } : {}),
        ...(window.running && (slots || d.curve === 'step' || d.kind === 'band')
          ? { soFar: true }
          : {}),
        colour: d.colour,
        name: d.name,
        ...(d.accent ? { accent: d.accent } : {}),
        ...(d.item.curve ? { curve: d.item.curve } : {}),
        ...fillFor(d, style),
        ...(d.band ? { band: d.band } : {}),
        ...(d.thresholds ? { thresholds: d.thresholds.bands() } : {}),
        ...(extremes ? { highlight: extremes } : {}),
      };
    };
    const common = {
      frame,
      now: nowFraction(window),
      thresholds: bands,
      stretches,
      tick: (value: number, decimals: number) => tickText(this.hass, value, decimals),
      measure: (text: string) => this.headFit.ruler.width('fc-tick', text),
      id: 'ch',
      ...(drawn.length > 1 ? { className: 'ch-several' } : {}),
    };
    if (!columned.length) {
      const main: ChartSpec = {
        ...common,
        series: lined.map((d) => asSeries(d, false)),
        style,
        reach: ghostly,
      };
      // a nice scale reaches the ghost; any other is one the series of its unit share with it, a tenth of air round them
      const shared =
        ghost && !plotOf(main).ticks && drawn.every((d) => d.scale.unit === lead.scale.unit);
      return {
        main: shared
          ? { ...main, scale: airScale([...main.series.map((one) => one.values), ghost]) }
          : main,
        over: null,
        of: [lined, []],
      };
    }
    // the scale's ticks are the columns' (a column's height is its value on them): a line of their unit stands on them,
    // one of another unit on its own, its figure in the row, the legend and the bubble
    const unit = (columned[0] as Drawn).scale.unit;
    const main: ChartSpec = {
      ...common,
      series: columned.map((d) => asSeries(d, true)),
      // now is marked once: on the end of the lines drawn over the columns, where they are (the columns to come hollow)
      style: lined.length ? { ...style, now: 'none' } : style,
      kind: 'bars',
      // a column's figure over it, in its series' unit
      value: (value, series) => this.figureOf(columned[series] ?? lead, value).value,
      reach: [
        ...lined
          .filter((d) => d.scale.unit === unit)
          .flatMap((d) => [...d.points, ...(d.band ? [...d.band.low, ...d.band.high] : [])])
          .filter((v): v is number => v !== null),
        ...ghostly,
      ],
    };
    if (!lined.length) return { main, over: null, of: [columned, []] };
    const plot = plotOf(main);
    const ticks = plot.ticks ?? niceTicks(0, 1, 4, true);
    return {
      main,
      over: {
        ...common,
        frame: { ...common.frame, left: plot.left },
        stretches: [],
        series: lined.map((d) => asSeries(d, false)),
        style: { ...style, grid: { ...style.grid, axes: 'none' }, axis: false },
        kind: 'line',
        scale: { min: ticks.min, max: ticks.max },
        unit,
        id: 'ch-over',
      },
      of: [columned, lined],
    };
  }

  /**
   * The first series over the range a followed picker compares with, laid on this window's slots as its own readings
   * are, moved on by the distance between the two ranges; none while the picker does not compare, or it is asked.
   */
  private ghostOf(lead: Drawn): Array<number | null> | null {
    const picked = this.picked();
    const before = picked?.before;
    if (!picked || !before || (lead.source !== 'history' && lead.source !== 'statistics'))
      return null;
    const answer = this.ghost_;
    if (answer?.id !== `${answerId(lead.item, lead.source, this.spanKey())}|${before.start}`)
      return null;
    const shift = picked.start - before.start;
    return lead.layOn(
      answer.readings.map((r) => ({
        ...r,
        t: r.t + shift,
        ...(r.end === undefined ? {} : { end: r.end + shift }),
      })),
      true,
    );
  }

  /**
   * The range a followed picker compares with, behind the chart on its scale: one quiet column a slot where the first
   * series is drawn in columns (1.8 × its bar, never wider than its slot less 2, the bars' ends), else a quiet line
   * through its slots' middles.
   */
  private ghosts(
    spec: ChartSpec,
    values: ReadonlyArray<number | null>,
    columns: boolean,
  ): TemplateResult | typeof nothing {
    const { frame } = spec;
    const plot = plotOf(spec);
    const scale = plot.ticks ?? (typeof spec.scale === 'object' ? spec.scale : null);
    if (!scale) return nothing;
    const box = { top: frame.headroom, bottom: frame.height - (frame.pad ?? 8) };
    const count = values.length;
    const slot = plot.width / Math.max(1, count);
    const y = (v: number): number => yOf(v, scale, box);
    const zero = y(0);
    const { bar } = barGeometry(count, plot.width);
    const wide = Math.max(2, Math.min(slot - 2, Math.round(bar * GHOST)));
    const shapes = columns
      ? values.map((v, i) => {
          const tall = v === null ? 0 : Math.abs(zero - y(v));
          if (v === null || tall < 1) return nothing;
          const x = plot.left + i * slot + (slot - wide) / 2;
          return svg`<path class="ch-ghost" d=${barPath(x, Math.min(zero, y(v)), wide, tall, Math.min(4, wide / 2), v < 0 ? 'bottom' : 'top')}></path>`;
        })
      : svg`<path class="ch-ghost is-line" d=${linePath(
          values.map((v, i) =>
            v === null ? null : ([plot.left + (i + 0.5) * slot, y(v)] as const),
          ),
          spec.style.curve,
        )}></path>`;
    return html`<svg
      class="ch-ghosts"
      width=${frame.width}
      height=${frame.height}
      aria-hidden="true"
    >
      ${shapes}
    </svg>`;
  }

  /**
   * Where the chart is read at a fraction of its plot: the cursor's x, the moment there (what a strip reads) and its
   * words, and each series' value there.
   */
  private readAt(
    specs: Specs,
    drawn: readonly Drawn[],
    window: Window,
    grid: Grid,
    fraction: number,
  ): Read {
    const count = grid.edges.length - 1;
    // a stepped series and columns are read by their slot, which began then; so is a lone band, its mark on the slot's
    // middle (a band is read per slot); a line where the cursor is — a line through time at the round time nearest it,
    // as Home Assistant reads it (each line there, every reading its own)
    const banded = drawn.every((d) => d.kind === 'band' && d.at);
    const slotwise = specs.main.kind === 'bars' || banded || drawn.every((d) => d.curve === 'step');
    const timed = slotwise ? undefined : drawn.find((d) => d.line);
    // what has happened, that is: past now on a calendar day a list or a forecast is read where it is pointed at
    const hit = timed && fraction <= timed.cover ? timed.line?.read(fraction / timed.cover) : null;
    const landed = banded
      ? (Math.min(count - 1, Math.floor(fraction * count)) + 0.5) / count
      : fraction;
    const cursor = hit && timed ? hit.fraction * timed.cover : landed;
    const read = readAt(specs.main, cursor);
    const plot = plotOf(specs.main);
    const f = Math.min(1, Math.max(0, (read.x - plot.left) / plot.width));
    // a key's step lands on a slot's start: a hair of rounding must not leave it in the slot before
    const slot = Math.min(count - 1, Math.floor(f * count + 1e-6));
    const length = window.end - window.start;
    // a slot's readings are its round period's, and the one still running is so far: it says now
    const slotTime =
      window.running && slot === count - 1
        ? this.t('common.now')
        : this.when(grid.edges[slot] as number, window);
    return {
      cursor,
      x: read.x,
      t: hit ? hit.t : window.start + f * length,
      time: hit
        ? this.when(hit.t, window)
        : slotwise
          ? slotTime
          : this.when(window.start + f * length, window),
      values: drawn.map((d) => {
        if (d.kind === 'columns' || d.kind === 'band' || d.curve === 'step' || !d.points.length)
          return d.slots[slot] ?? null;
        if (!d.line) return between(d.points, f);
        const v = cursor > d.cover ? undefined : d.line.read(cursor / d.cover)?.v;
        return v === undefined ? null : v / d.scale.divisor;
      }),
    };
  }

  /**
   * The drawings and the bubble (the engine's `drawRead`, on the lines where columns lie under them): what the chart
   * reads at the cursor — the lone series' figure and when, or when alone over several (their legend says each) —
   * else, at rest, the end of what has happened where the style labels it. Where the value row reads the chart, the
   * row says it and no bubble is drawn: the cursor and the marks on the lines alone.
   */
  private drawCharts(
    specs: Specs,
    lead: Drawn,
    value: number | null,
    read: Read | null,
    rowReads: boolean,
    several: boolean,
  ): TemplateResult {
    const cursor = read?.cursor ?? null;
    const main = { ...specs.main, cursor };
    const over = specs.over ? { ...specs.over, cursor } : null;
    const figure = this.figureOf(lead, value);
    const now: Said = { value: figure.value, ...(figure.unit ? { unit: figure.unit } : {}) };
    const at: Said | null =
      !read || rowReads ? null : several ? { value: read.time } : { ...now, time: read.time };
    // at rest the bubble says the reading now where the style labels it — not where the row says it, nor a dash
    const rest = several || rowReads || figure.value === '—' ? null : now;
    return html`${over ? drawChart(main) : nothing}${drawRead(
      over ?? main,
      at,
      rest,
      getComputedStyle(this).fontFamily,
    )}`;
  }

  /**
   * The value row (`height` tall): the lead series' reading now (or where the chart is read; a series of states its
   * state) at the largest readout size that holds with what goes beside it — its change on the period before, the
   * pills at the row's end (the marked windows', a lone series' lowest and highest points: a row each way), each in
   * the longest of its forms the room holds, gone where none does — or, for two or three series, the legend's lines,
   * each reading at its end; or a readout a series (#264).
   */
  private valueRow(
    named: readonly Named[],
    parts: Named,
    time: string | null,
    pills: ReadonlyArray<readonly Pill[]>,
    window: Window,
    lead: Drawn | undefined,
    shown: {
      readonly showHead: boolean;
      readonly inRow: boolean;
      readonly height: number;
      readonly readouts: Readouts | null;
    },
  ): TemplateResult {
    const height = shown.height > TOP ? `height:${shown.height}px` : nothing;
    if (shown.readouts)
      return html`<div class="ch-top" style=${height}>
        ${this.readoutsRow(named, shown.readouts)}
      </div>`;
    if (shown.inRow)
      return html`<div class="ch-top" style=${height}>
        <div class="ch-lines">${this.legendOf(named, shown.showHead)}</div>
      </div>`;
    const width = this.contentWidth;
    const ruler = this.headFit.ruler;
    const label = time ?? this.t('common.now');
    const change = shown.showHead && time === null && lead ? this.change(lead, window) : null;
    const delta =
      change === null
        ? ''
        : `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatNumber(this.hass, Math.abs(change), { digits: 0 })} %`;
    const deltaWidth = delta ? ruler.pill('fc-pill', delta, GLYPH_SIDES) + 8 : 0;
    const readoutWidth = (size: (typeof SIZES)[number]): number =>
      Math.max(
        ruler.width('fv-readout > fv-readout__label', label),
        ruler.width(
          `fv-readout fv-readout--${size} > fv-readout__value`,
          parts.value,
          'fv-unit',
          parts.unit,
        ),
      );
    const pillWidth = (pill: Pill, form: number): number =>
      ruler.pill('fc-pill', pill.forms[form] as string, pill.glyph ? GLYPH_SIDES : PILL_SIDES);
    const beside = (size: (typeof SIZES)[number]): number =>
      readoutWidth(size) + (delta && readoutWidth(size) + deltaWidth <= width ? deltaWidth : 0);
    const roomOf = (size: (typeof SIZES)[number] | null): number =>
      size ? width - beside(size) - GAP : width;
    // the pills say as much as the room holds, every one in the same form: the longest that all of them hold, a row
    // of two side by side
    const FORMS = 4;
    const depth = (room: number): number => {
      for (let d = 0; d < FORMS; d++)
        if (
          pills.every(
            (pair) =>
              pair.reduce(
                (wide, pill) => wide + pillWidth(pill, d),
                (pair.length - 1) * PILL_GAP,
              ) <= room,
          )
        )
          return d;
      return FORMS;
    };
    // the readout at l or m, whichever lets the pills say the most (the larger on a tie); else as large as it holds
    const size = !shown.showHead
      ? null
      : ((['l', 'm'] as const)
          .filter((sz) => beside(sz) <= width)
          .reduce<(typeof SIZES)[number] | null>(
            (best, sz) => (best === null || depth(roomOf(sz)) < depth(roomOf(best)) ? sz : best),
            null,
          ) ??
        SIZES.find((sz) => readoutWidth(sz) <= width) ??
        'xs');
    const withDelta = size !== null && delta !== '' && readoutWidth(size) + deltaWidth <= width;
    const form = depth(roomOf(size));
    const said = form < FORMS ? pills : [];
    return html`<div class="ch-top ${size ? '' : 'is-side-only'}">
      ${
        size
          ? html`<div class="ch-now">
              ${readout({ ink: parts.ink, label, value: parts.value, unit: parts.unit, size })}
              ${
                withDelta
                  ? html`<span
                      class="fc-pill fv-tone--neutral ch-delta"
                      data-measure="value"
                      aria-label=${s(this.hass, 'change', { change: delta })}
                      >${glyph((change ?? 0) < 0 ? 'trendDown' : 'trendUp')}${delta}</span
                    >`
                  : nothing
              }
            </div>`
          : nothing
      }
      ${
        said.length
          ? html`<div class="ch-side">
              ${said.map(
                (pair) =>
                  html`<div class="ch-pills">
                    ${pair.map(
                      (pill) =>
                        html`<span
                          class="fc-pill fv-tone--${pill.tone} ${pill.glyph ? 'ch-peak' : ''}"
                          data-measure="value"
                          aria-label=${pill.forms[0] as string}
                          >${pill.glyph ? glyph(pill.glyph) : html`<i class="fc-pill__dot"></i>`}${
                            pill.forms[form]
                          }</span
                        >`,
                    )}
                  </div>`,
              )}
            </div>`
          : nothing
      }
    </div>`;
  }

  /**
   * A readout a series (#264), the several sensors' card's row: equal columns, `columns` to a line, a hairline between
   * two of a line; each its name with its key in the series' colour over its reading (where the chart is read, else
   * now) at the size they all hold, in its band's ink past a threshold; under it, where the card's series ask for
   * them, its lowest and highest points, in the longest form every readout's room holds (`pointsForm`).
   */
  private readoutsRow(named: readonly Named[], reads: Readouts): TemplateResult {
    const { fit, columns, points, tall } = reads;
    const room = (this.contentWidth - fit.gap * (columns - 1)) / columns;
    const form = tall ? this.pointsForm(points, room) : POINT_FORMS;
    return html`<div
      class="am-pair ch-reads ${tall ? 'is-tall' : ''}"
      style="--am-pair:${columns};--am-gap:${fit.gap}px"
    >
      ${named.map((n, k) => {
        const paint = paintOf(n.colour, n.accent);
        return html`<div
          class="am-pair__item ${k % columns ? '' : 'is-first'} ${paint.className}"
          data-accent=${n.accent ?? nothing}
          style=${paint.style ?? nothing}
        >
          <div class="ch-read">
            ${readout({
              ink: n.ink,
              label: html`<span class="am-name">${n.name}</span
                ><i class="am-key" data-measure="skip"></i>`,
              value: n.value,
              unit: n.unit,
              size: fit.size,
              name: true,
            })}
            ${tall ? this.pointsLine(points.get(n.index), form) : nothing}
          </div>
        </div>`;
      })}
    </div>`;
  }

  /** A readout's points, the highest first, as many as its `form` says: both, or the first alone (2). */
  private pointsOf(
    points: Points | undefined,
    form: number,
  ): Array<readonly ['min' | 'max', Point]> {
    const shown = (['max', 'min'] as const).flatMap((pick) => {
      const point = points?.[pick];
      return point ? [[pick, point] as const] : [];
    });
    return form === 2 ? shown.slice(0, 1) : shown;
  }

  /**
   * The longest form of the readouts' points every readout's `room` holds, one for them all: each figure with its time
   * (0), the figures alone (1), the highest alone (2); none (3) where not even that holds.
   */
  private pointsForm(points: ReadonlyMap<number, Points>, room: number): number {
    const ruler = this.headFit.ruler;
    const wide = (shown: Points, form: number): number =>
      this.pointsOf(shown, form).reduce(
        (sum, [, point], k) =>
          sum +
          (k ? POINTS_GAP : 0) +
          POINT_GLYPH +
          ruler.width('ch-ext > ch-ext__figure', figureText(point)) +
          (form === 0 ? POINT_TIME + ruler.width('ch-ext > ch-ext__time', point.time) : 0),
        0,
      );
    return (
      [0, 1, 2].find((form) => [...points.values()].every((shown) => wide(shown, form) <= room)) ??
      POINT_FORMS
    );
  }

  /**
   * The line under a readout of its points (#264), led by their glyphs — "↑ 5.4 kW 13:00  ↓ 0.2 kW 04:00" — each
   * figure in its band's ink past a threshold; their words whole for a reader. Empty, it keeps its 16.
   */
  private pointsLine(points: Points | undefined, form: number): TemplateResult {
    const shown = form < POINT_FORMS ? this.pointsOf(points, form) : [];
    return html`<p
      class="ch-ext"
      aria-label=${
        shown.length
          ? this.pointsOf(points, 0)
              .map(([pick, point]) => this.pointWords(point, pick))
              .join(' · ')
          : nothing
      }
    >
      ${shown.map(
        ([pick, point]) =>
          html`<span class="ch-ext__part"
            >${glyph(pick === 'max' ? 'up' : 'down')}<span
              class="ch-ext__figure"
              data-ink=${point.ink ?? nothing}
              >${figureText(point)}</span
            >${form === 0 ? html`<span class="ch-ext__time">${point.time}</span>` : nothing}</span
          >`,
      )}
    </p>`;
  }

  /**
   * While the legend's lines in the row read the chart, when that is: a pill on the axis (the bubble's colours) under
   * the cursor at `x`, kept inside the axis's `width`, over the hours it covers — the several sensors' card's: one
   * bubble over the plot would say a value no series but one has.
   */
  private whenPill(time: string, x: number, width: number): TemplateResult {
    const pill = this.headFit.ruler.pill('ch-when', time, 16);
    const left = Math.min(Math.max(x - pill / 2, 0), width - pill);
    return html`<span
      class="ch-when"
      data-measure="value"
      style="left:${left.toFixed(2)}px;width:${pill}px"
      >${time}</span
    >`;
  }

  /** The legend: each series' swatch in its colour, its name, its reading where it says it (`values`). */
  private legendOf(named: readonly Named[], values: boolean): TemplateResult {
    return legend(
      named.map((d) => ({
        name: d.name,
        ...(d.accent ? { accent: d.accent } : {}),
        ...(ownInk(d.colour)
          ? { paint: seriesPaint(d.colour) }
          : d.accent
            ? {}
            : { tone: d.colour as Tone }),
        ...(values ? { value: figureText(d), ink: d.ink } : {}),
      })),
    );
  }

  /**
   * What the chart says to a reader who cannot see it: when, and each series' name and its reading then, and its
   * highest and lowest points where it marks them.
   */
  private spoken(
    named: readonly Named[],
    time: string | null,
    points: ReadonlyMap<number, Points>,
  ): string {
    return [
      time ?? this.t('common.now'),
      ...named.flatMap((d) => [
        `${d.name}: ${figureText(d)}`,
        ...this.pointsOf(points.get(d.index), 0).map(([pick, point]) =>
          this.pointWords(point, pick),
        ),
      ]),
    ].join(' · ');
  }

  /**
   * The tile: the lead series' reading (with its change's arrow) over a spark of every series of numbers across the
   * window — classic, or minimal where the card's style is — the sensor tile's anatomy; out of reach in the off skin.
   * A tile of states alone says its first one's state now over its strip (#228).
   */
  private renderTile(
    drawn: readonly Drawn[],
    strips: readonly Strip[],
    window: Window,
  ): TemplateResult {
    const lead = drawn[0];
    const first = strips[0] as Strip;
    const { view, colour, accent } = lead ?? first;
    const usable = isUsable(view);
    const tone: Tone = !usable ? 'off' : accent || ownInk(colour) ? 'accent' : (colour as Tone);
    const parts = lead
      ? this.figureOf(lead, lead.now)
      : { value: this.stateThen(first, null), unit: '' };
    // the reading at m, else as large as the tile holds it whole (a price and its unit in half a section)
    const size =
      (['m', 's', 'xs'] as const).find(
        (sz) =>
          this.headFit.ruler.width(
            `fv-readout fv-readout--${sz} > fv-readout__value`,
            parts.value,
            'fv-unit',
            parts.unit,
          ) <=
          this.width - 32,
      ) ?? 'xs';
    const change = lead ? this.change(lead, window) : null;
    const loading = lead ? drawn.some((d) => d.readings === undefined) : first.spans === undefined;
    const fine = chartKeysOf(this.config);
    const minimal = resolveStyle(this.config?.chart, fine, {}).preset === 'minimal';
    const series = drawn.flatMap((d): ChartSeries[] =>
      d.slots.some((v) => v !== null)
        ? [
            {
              ...(d.curve === 'step' || !d.points.length
                ? { values: d.slots }
                : {
                    values: d.points,
                    ...(d.at ? { at: d.at } : {}),
                  }),
              // series of one unit share the spark's scale, another unit's take its height on their own
              unit: d.scale.unit,
              colour: d.colour,
              ...(d.accent ? { accent: d.accent } : {}),
              ...(d.item.curve ? { curve: d.item.curve } : {}),
              ...(d.thresholds ? { thresholds: d.thresholds.bands() } : {}),
            },
          ]
        : [],
    );
    // the tile is the card's button; its circle answers of its own where the card says so (#179)
    const { onTap, onHold, onIconTap, onIconHold, iconLabel } = this.headActions(view.id);
    return html`<article
      class="fv-tile fv-tile--tap ${usable ? '' : 'is-unavailable is-off'}"
      data-card
      role="button"
      tabindex="0"
      .fvTap=${onTap}
      .fvHold=${onHold}
      @pointerdown=${startPress}
      @contextmenu=${preventMenu}
      @click=${clickPress}
      @keydown=${activateKey(onTap, onHold)}
    >
      <div class="fv-tile__head">
        ${ico(this.config?.icon ?? iconOf(view), tone, {
          onTap: onIconTap,
          onHold: onIconHold,
          label: iconLabel?.(this.nameFor(view, this.config?.name)),
        })}
        ${
          change !== null && Math.abs(change) >= 1
            ? html`<span class="fv-trend ${change < 0 ? 'fv-trend--down' : ''}"
                >${glyph(change < 0 ? 'trendDown' : 'trendUp')}</span
              >`
            : nothing
        }
      </div>
      ${readout({
        ink: lead?.thresholds?.band(lead.now)?.ink,
        label: this.config?.title ?? (lead ?? first).name,
        value: parts.value,
        unit: parts.unit,
        size,
      })}
      <div class="ch-spark fv-tone--${tone}">
        ${
          loading
            ? html`<div class="fv-skeleton"></div>`
            : lead && series.length
              ? drawChart({
                  frame: { width: down4(this.width - 32 - 8), height: SPARK, headroom: 4, pad: 4 },
                  series,
                  style: resolveStyle(minimal ? 'minimal' : 'classic', fine, {}),
                  now: nowFraction(window),
                  ...(series.length > 1 ? { scale: 'air' as const } : {}),
                  thresholds: this.thresholds(this.config, lead.scale.unit)?.bands() ?? [],
                  id: 'ch-spark',
                })
              : !lead && first.spans?.length
                ? this.strip(first, window)
                : nothing
        }
      </div>
    </article>`;
  }
}
