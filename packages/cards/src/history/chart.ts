/**
 * A chart of the History page: everything measured in one unit, on one scale, with the page's cursor across it.
 * One series draws the cards' curve (a gradient under it); several draw their lines, each in its own graph colour.
 */
import { formatNumber, plural, scaleUnit } from '@fluvy/core';
import { sampleTrack, valueAt, type Track } from '@fluvy/core/history';
import { axis, head, readout } from '@fluvy/ui';
import { html, nothing, svg, type TemplateResult } from 'lit';
import {
  airScale,
  areaPath,
  bandPath,
  chartBubble,
  drawRead,
  linePath,
  resolveStyle,
  roundTicks,
  scrub,
  yAt,
  yOf,
  type PlotBox,
  type Pt,
} from '../chart/engine/index.js';

import type { ChartCaps } from '../shared/chart-config.js';
import type { Chart } from './model.js';
import type { FluvyHistory } from './view.js';

/** The plot's height, and the room the bubble keeps over the highest reading. */
const HEIGHT = 168;
const COMPACT_HEIGHT = 140;
const HEADROOM = 44;
const PAD = 12;
/** What a card spends on its sides, at every width (`fluvy/surfaces.css`): the one place that number is written. */
export const CARD_PADDING = 40;
/** The content column of a card in the page's column — what a chart is drawn into, and its lines with it. */
export const cardWidth = (mainWidth: number): number => Math.max(240, mainWidth - CARD_PADDING);
/** A point per 6 px of width: smooth enough to read, cheap enough for a phone. */
const DENSITY = 6;

interface Reading {
  readonly text: string;
  readonly unit: string;
}

/**
 * One unit and one precision for a whole card, so three readings of one measure can be compared by eye: the unit is
 * the one a typical reading takes (a house that averages 592 W reads watts everywhere, one that averages 4 kW reads
 * kilowatts), and the decimals follow what the card's readings reach in it. Home Assistant's own precision wins
 * while the unit is untouched. A reading that is not there is a dash, never a zero.
 */
export interface Scale {
  readonly unit: string;
  /** What a reading is multiplied by to be written in that unit (1, or a thousandth). */
  readonly factor: number;
  readonly digits: number;
}

export function scaleOf(chart: Chart, hass: FluvyHistory['hass']): Scale {
  const typical =
    chart.tracks.reduce((sum, track) => sum + Math.abs(track.average), 0) /
    Math.max(1, chart.tracks.length);
  const shown = scaleUnit(typical, chart.unit);
  const factor = typical === 0 ? 1 : shown.value / typical;
  const peak =
    chart.tracks.reduce(
      (most, track) => Math.max(most, Math.abs(track.min), Math.abs(track.max)),
      0,
    ) * factor;
  const said =
    factor === 1
      ? chart.tracks
          .map((track) => hass?.entities?.[track.entityId]?.display_precision)
          .find((p): p is number => typeof p === 'number')
      : undefined;
  // a measure that only ever reads whole numbers (a count of lamps, a step) is written whole
  const whole = chart.tracks.every((track) =>
    track.points.every((point) => Number.isInteger(point.v)),
  );
  const digits =
    said ?? (whole && factor === 1 ? 0 : peak >= 100 ? 0 : peak >= 10 ? 1 : peak >= 1 ? 2 : 3);
  return { unit: shown.unit, factor, digits };
}

function reading(page: FluvyHistory, number: number | null, scale: Scale): Reading {
  if (number === null) return { text: '—', unit: scale.unit };
  return {
    text: formatNumber(page.hass, number * scale.factor, {
      digits: scale.digits,
      minDigits: scale.digits,
    }),
    unit: scale.unit,
  };
}

const value = (page: FluvyHistory, track: Track, at: number, scale: Scale): Reading =>
  reading(page, valueAt(track.points, at), scale);

/**
 * What the axis says: the window's own ends first and the round marks between them where there is room for one —
 * the chart engine's labeller of a window with two fixed ends (`roundTicks`), in the page's words.
 */
export function axisLabels(page: FluvyHistory, width: number): (readonly [number, string])[] {
  return roundTicks({
    start: page.range.start,
    end: page.range.end,
    width,
    labelWidth: (text) => page.labelWidth(text),
    time: (t) => page.time(t),
    weekday: (t) => page.weekday(t),
    day: (t) => page.day(t),
    date: (t) => page.date(t),
    dateYear: (t) => page.dateYear(t),
  });
}

/**
 * What a chart says, for a reader who cannot see it: its measure and what it reads at the cursor. The page speaks
 * the one whose chart is under the hand, at every move of it, and each chart describes itself for whoever lands on
 * it — so it is worked out here, once, from the same numbers the card prints.
 */
export function spokenOf(page: FluvyHistory, chart: Chart): string {
  const scale = scaleOf(chart, page.hass);
  const lead = chart.tracks[0];
  const read = lead ? value(page, lead, page.at, scale) : { text: '—', unit: scale.unit };
  const figure = `${read.text} ${read.unit}`.trim();
  return `${chart.title}: ${
    page.scrubbed
      ? page.t('chart_at', { time: page.moment(page.at), value: figure })
      : page.t('chart_last', { value: figure })
  }`;
}

/** A chart card: its head reads the value under the cursor, its plot draws every series on one scale. */
export function renderChart(page: FluvyHistory, chart: Chart): TemplateResult {
  const width = cardWidth(page.mainWidth);
  const height = page.compact ? COMPACT_HEIGHT : HEIGHT;
  const count = Math.max(8, Math.round(width / DENSITY));
  const { start, end } = page.range;
  // only what has happened is drawn: a window that runs into the future keeps its room but stays empty
  const drawnEnd = page.drawnEnd;
  const extent = (drawnEnd - start) / (end - start);
  const drawn = Math.max(2, Math.round(count * extent));
  const series = chart.tracks.map((track) => sampleTrack(track, start, drawnEnd, drawn));
  // what a summarised reading moved between is drawn behind a single curve; several bands would only make mud
  const bands = chart.tracks.map((track) =>
    track.band?.length && chart.tracks.length === 1
      ? {
          low: sampleTrack(
            { points: track.band.map((b) => ({ t: b.t, v: b.low })) },
            start,
            drawnEnd,
            drawn,
          ),
          high: sampleTrack(
            { points: track.band.map((b) => ({ t: b.t, v: b.high })) },
            start,
            drawnEnd,
            drawn,
          ),
        }
      : null,
  );
  // the plot: what has happened across `plotWidth`, every series on one scale between the headroom and the pad
  const plotWidth = Math.max(2, width * extent);
  const box: PlotBox = { top: HEADROOM, bottom: height - PAD };
  const ends = airScale([
    ...series,
    ...bands.flatMap((band) => (band ? [band.low, band.high] : [])),
  ]);
  const pointsOf = (values: readonly number[]): Pt[] =>
    values.map((v, i) => [(i / Math.max(1, values.length - 1)) * plotWidth, yOf(v, ends, box)]);
  const at = page.at;
  const cursorX = page.fraction(at) * width;
  const id = chart.key.replace(/\W+/g, '-');
  const lead = chart.tracks[0];
  const alone = chart.tracks.length === 1;
  const scale = scaleOf(chart, page.hass);
  const leadValue = lead ? value(page, lead, at, scale) : { text: '—', unit: scale.unit };
  const spoken = spokenOf(page, chart);
  // what the card drew, high and low — the same numbers its scale was built from, so a mark is always exactly
  // at its value. What the house reached is the readouts' business: they are words, and cannot be read as a height
  const drawnValues = [
    ...series,
    ...bands.flatMap((band) => (band ? [band.low, band.high] : [])),
  ].flat();
  const high = drawnValues.reduce(
    (most, v) => (Number.isFinite(v) ? Math.max(most, v) : most),
    -Infinity,
  );
  const low = drawnValues.reduce(
    (least, v) => (Number.isFinite(v) ? Math.min(least, v) : least),
    Infinity,
  );
  const reach: (readonly [number, boolean])[] = Number.isFinite(high)
    ? high === low
      ? [[high, false]]
      : [
          [high, false],
          [low, true],
        ]
    : [];
  // the house's style (the page has no setting of its own; classic from the factory): the lines, their band
  const caps: ChartCaps = { band: bands.some(Boolean), several: !alone, axis: false };
  const style = resolveStyle(undefined, {}, caps);
  const classic = style.preset === 'classic';

  return html`<article class="fv-card hs-card">
    ${head({
      icon: chart.glyph,
      tone: 'accent',
      title: chart.title,
      sub: chart.summarised ? page.t(page.period === 'day' ? 'summarised_day' : 'summarised') : '',
      // a lone curve's card keeps its big readout while it is read by hand, with the instant as its label; a card
      // of several leaves the figures to its legend and carries the instant alone
      trailing: alone
        ? html`<span class="hs-card__read">
            <span class="hs-card__value" data-measure="value"
              >${leadValue.text}<span class="fv-unit">${leadValue.unit}</span></span
            >
            ${page.scrubbed ? html`<span class="hs-card__when">${page.moment(at)}</span>` : nothing}
          </span>`
        : html`<span class="hs-card__when">
            ${page.scrubbed ? page.moment(at) : page.t('now')}
          </span>`,
    })}
    <div
      class="hs-plot"
      style="height:${height}px"
      data-measure="drawn"
      tabindex="0"
      aria-label=${page.t('chart_read', { measure: chart.title })}
      aria-describedby=${`hs-read-${id}`}
      @keydown=${(event: KeyboardEvent) => page.scrubber.key(event)}
      @focusin=${() => page.reads(chart.key)}
      @pointerdown=${() => page.reads(chart.key)}
      ${scrub(page.scrubber)}
    >
      <svg width=${width} height=${height} viewBox="0 0 ${width} ${height}" aria-hidden="true">
        ${
          extent < 0.999
            ? svg`<rect class="hs-future" x=${plotWidth} y="0" width=${Math.max(0, width - plotWidth)} height=${height} />
                <line class="hs-edge" x1=${plotWidth} y1="0" x2=${plotWidth} y2=${height} />`
            : nothing
        }
        ${reach.map(([v, below]) => {
          const mark = reading(page, v, scale);
          const y = yOf(v, ends, box);
          return svg`<line class="hs-rule" x1="0" y1=${y.toFixed(2)} x2=${plotWidth} y2=${y.toFixed(2)} />
            <text class="hs-rule__value" x="0" y=${(y + (below ? 12 : -5)).toFixed(2)}>${`${mark.text} ${mark.unit}`.trim()}</text>`;
        })}
        ${
          classic
            ? chart.tracks.map((track, index) => {
                const points = pointsOf(series[index] ?? []);
                const path = linePath(points, 'smooth');
                const band = bands[index];
                return svg`<g class="hs-series" style="--series:${alone ? 'var(--fluvy-accent)' : `var(--fluvy-graph-${chart.colours[index] ?? 1})`};animation-delay:${index * 60}ms">
            ${band ? svg`<path class="hs-band" d=${bandPath(pointsOf(band.low), pointsOf(band.high))} />` : nothing}
            ${
              alone
                ? svg`<linearGradient id=${`hs-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" class="hs-fill-a" />
                    <stop offset="1" class="hs-fill-b" />
                  </linearGradient>
                  <path class="hs-area" d=${areaPath(points, 'smooth', height)} fill=${`url(#hs-fill-${id})`} />`
                : nothing
            }
            <path class="hs-line ${alone ? 'hs-line--alone' : ''}" d=${path} pathLength="1" />
            ${(() => {
              // the dot marks the line, so it reads the line: the same curve, solved at the cursor's x
              const y = yAt(points, 'smooth', Math.min(cursorX, plotWidth));
              return y === null || valueAt(track.points, at) === null
                ? nothing
                : svg`<circle class="hs-dot" cx=${cursorX.toFixed(2)} cy=${y.toFixed(2)} r="4" />`;
            })()}
          </g>`;
              })
            : nothing
        }
        ${
          classic
            ? svg`<line class="hs-cursor" x1=${cursorX.toFixed(2)} y1=${HEADROOM - 8} x2=${cursorX.toFixed(2)} y2=${height - PAD} />`
            : nothing
        }
      </svg>
      ${
        // a bubble names one reading: with several series it would claim to be all of them, and the
        // legend already reads every one of them at the cursor's time
        classic
          ? page.scrubbed && alone
            ? chartBubble({
                x: cursorX,
                width,
                value: leadValue.text,
                unit: leadValue.unit,
                time: page.moment(at),
                ...(page.family ? { family: page.family } : {}),
              })
            : nothing
          : // a style's lines over the page's room and rules, on the same scale: a lone one in the accent, several
            // each in its graph colour
            drawRead(
              {
                frame: { width, height, headroom: HEADROOM, pad: PAD },
                series: chart.tracks.map((_track, index) => ({
                  values: series[index] ?? [],
                  colour: alone
                    ? 'accent'
                    : (`var(--fluvy-graph-${chart.colours[index] ?? 1})` as const),
                  ...(bands[index] ? { band: bands[index] } : {}),
                })),
                style,
                scale: ends,
                extent,
                cursor: page.scrubbed ? page.fraction(at) : null,
                id: `hs-${id}`,
              },
              page.scrubbed && alone
                ? { value: leadValue.text, unit: leadValue.unit, time: page.moment(at) }
                : null,
              null,
              page.family,
            )
      }
    </div>
    ${axis(axisLabels(page, width))}
    <p id=${`hs-read-${id}`} class="fv-sr">${spoken}</p>
    ${
      alone && lead
        ? html`<div class="fv-cols hs-readouts">
            ${(
              [
                ['min', lead.min],
                ['max', lead.max],
                ['average', lead.average],
              ] as const
            ).map(([label, number]) => {
              const read = reading(page, number, scale);
              return readout({
                label: page.t(label),
                value: read.text,
                unit: read.unit,
                size: 's',
              });
            })}
          </div>`
        : html`<ul class="hs-legend">
            ${chart.tracks.map((track, index) => {
              const read = value(page, track, at, scale);
              return html`<li class="hs-legend__row">
                <i
                  class="hs-legend__dot"
                  style="--series:var(--fluvy-graph-${chart.colours[index] ?? 1})"
                ></i>
                <span class="hs-legend__name" data-name>${track.name}</span>
                <span class="hs-legend__value" data-measure="value"
                  >${read.text}<span class="fv-unit">${read.unit}</span></span
                >
              </li>`;
            })}
            ${
              chart.hidden
                ? html`<li>
                    <button
                      class="fv-link hs-legend__more"
                      @click=${() => page.expandChart(chart.key)}
                    >
                      ${plural(page.hass, 'history.more', chart.hidden)}
                    </button>
                  </li>`
                : nothing
            }
          </ul>`
    }
  </article>`;
}
