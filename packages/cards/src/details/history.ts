import { formatNumber, formatTime, localize, type HomeAssistant } from '@fluvy/core';
import { axis, glyph, pressCover, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import {
  drawChart,
  quarterTicks,
  styleOf,
  timeLine,
  type ChartSeries,
  type Timed,
} from '../chart/engine/index.js';
import { axisHolds } from '../shared/axis.js';
import type { ChartCaps } from '../shared/chart-config.js';
import { spanText } from '../shared/duration.js';
import type { TextRuler } from '../shared/fit.js';

/*
 * The day at a details sheet's foot: the entity's last 24 hours as one line, drawn by the chart engine in the house's
 * style (fluvy's settings → Charts), with what the day amounts to beside its label. The whole strip is one button to
 * Fluvy's History page.
 */

/** What a sheet's day draws. */
export type DaySpec =
  | {
      /**
       * A state that is one thing or another (on, open, playing): the line is the share of each stretch spent in it,
       * and the words beside the label how long that was, after the state's word ("On · 5 h 12 min").
       */
      readonly kind: 'state';
      readonly active: (state: string) => boolean;
      readonly word: string;
    }
  | {
      /** A number among its attributes (a room's temperature): the line is it, the words its lowest and highest. */
      readonly kind: 'value';
      readonly attribute: string;
      readonly unit: string;
      readonly digits: number;
    };

/** A row of the recorder's history as `history/history_during_period` sends it. */
interface Row {
  readonly s: string;
  readonly lu: number;
  readonly a?: Readonly<Record<string, unknown>>;
}

const HOURS = 24;
const DAY = HOURS * 3_600_000;
/** The drawing: 48 tall, 8 over the plot for the line's stroke and its dot (and the engine's 8 under it). */
const HEIGHT = 48;
const HEADROOM = 8;
/** A line through time, with no scale beside it. */
const CAPS: ChartCaps = { time: true, axis: false };
/** The head's gap between its label and its words, and the chevron after them (4 and its 16). */
const HEAD_GAP = 12;
const CHEVRON = 20;

/** What a row is worth on the line; none where it says nothing of it (a temperature while out of reach). */
function levelOf(spec: DaySpec, row: Row): number | null {
  if (spec.kind === 'state') return spec.active(row.s) ? 1 : 0;
  const value = row.a?.[spec.attribute];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** How long the line stood at 1 between `start` and `end`, in seconds: each reading holds until the next. */
function secondsActive(readings: readonly Timed[], start: number, end: number): number {
  let total = 0;
  readings.forEach(({ t, v }, index) => {
    const from = Math.max(start, t);
    const to = Math.min(end, readings[index + 1]?.t ?? end);
    if (v > 0 && to > from) total += to - from;
  });
  return total / 1000;
}

export interface DayOptions {
  readonly hass: HomeAssistant | undefined;
  readonly entityId: string;
  readonly spec: DaySpec;
  /** The strip's width: the sheet's content column. */
  readonly width: number;
  readonly tone: Tone;
  /** The entity's own colour, as the sheet's accent sheet keys it (a lamp's). */
  readonly accent?: string | undefined;
  /** What the entity reads now, the line's last point; none where it cannot be read. */
  readonly live: number | null;
  readonly ruler: TextRuler;
  /** What a reader hears for the button: the entity's name. */
  readonly name: string;
  readonly open: () => void;
}

/**
 * A sheet's day: asks the recorder once for the entity it is shown (its states alone, or with their attributes where
 * the line is one of them), and draws what came back. One per sheet.
 */
export class DayStrip {
  private key = '';
  /** The readings: none yet while the recorder is asked, `null` where it has nothing to say. */
  private readings: readonly Timed[] | null | undefined;
  /** When the recorder was asked: the window's end. */
  private end = 0;

  constructor(private readonly host: { requestUpdate(): void }) {}

  private read({ hass, entityId, spec }: DayOptions): readonly Timed[] | null | undefined {
    const key = `${entityId}|${spec.kind}`;
    if (key === this.key || !hass) return this.readings;
    this.key = key;
    this.readings = undefined;
    this.end = Date.now();
    const plain = spec.kind === 'state';
    hass
      .callWS<Record<string, Row[]>>({
        type: 'history/history_during_period',
        start_time: new Date(this.end - DAY).toISOString(),
        end_time: new Date(this.end).toISOString(),
        entity_ids: [entityId],
        minimal_response: plain,
        no_attributes: plain,
        significant_changes_only: false,
      })
      .then(
        (result) => result?.[entityId] ?? [],
        () => [],
      )
      .then((rows) => {
        if (this.key !== key) return;
        const readings = rows.flatMap((row) => {
          const v = levelOf(spec, row);
          return v === null ? [] : [{ t: row.lu * 1000, v }];
        });
        this.readings = readings.length ? readings : null;
        this.host.requestUpdate();
      });
    return undefined;
  }

  /**
   * What the day amounts to, and its shorter form: how long it spent in its state ("On · 5 h 12 min", "5 h 12 min"),
   * or how far its number moved; "No history" with none.
   */
  private say(o: DayOptions, readings: readonly Timed[] | null | undefined): readonly string[] {
    if (readings === undefined) return [''];
    if (!readings) return [localize(o.hass, 'sheets.history_none')];
    if (o.spec.kind === 'state') {
      const span = spanText(o.hass, secondsActive(readings, this.end - DAY, this.end));
      return [`${o.spec.word} · ${span}`, span];
    }
    const { unit, digits } = o.spec;
    const figure = (value: number): string =>
      formatNumber(o.hass, value, { digits, minDigits: digits });
    const values = readings.map((reading) => reading.v);
    return [`${figure(Math.min(...values))} – ${figure(Math.max(...values))} ${unit}`.trim()];
  }

  /** The line as the engine draws it in the house's style, ending on what the entity reads now. */
  private draw(o: DayOptions, readings: readonly Timed[]): TemplateResult {
    const line = timeLine({
      readings,
      start: this.end - DAY,
      end: this.end,
      width: o.width,
      style: styleOf(undefined, CAPS),
      hass: o.hass,
    });
    const values = o.live === null ? line.values : [...line.values.slice(0, -1), o.live];
    const series: ChartSeries = {
      values,
      at: line.at,
      colour: o.tone,
      ...(o.accent ? { accent: o.accent } : {}),
    };
    return drawChart({
      frame: { width: o.width, height: HEIGHT, headroom: HEADROOM },
      series: [series],
      style: line.style,
      // a state's share runs from none of a stretch to all of it; a number keeps to its own range
      ...(o.spec.kind === 'state' ? { scale: { min: 0, max: 1 } } : {}),
      id: 'fv',
    });
  }

  render(o: DayOptions): TemplateResult {
    const readings = this.read(o);
    const label = localize(o.hass, 'sheets.history');
    // the words beside the label where both hold on a line, else under it; a state's word gives way before either is cut
    const says = this.say(o, readings);
    const labelWidth = o.ruler.width('dt-day__label', label);
    const width = (text: string): number => o.ruler.width('dt-day__say', text) + CHEVRON;
    const stacked = labelWidth + HEAD_GAP + width(says[0] ?? '') > o.width;
    const say = says.find((text) => width(text) <= o.width) ?? says[says.length - 1] ?? '';
    const ticks = quarterTicks({
      hours: HOURS,
      now: this.end,
      time: (t) => formatTime(o.hass, new Date(t)),
      daysAgo: () => '',
      nowWord: localize(o.hass, 'common.now'),
      holds: (items) => axisHolds(o.ruler, o.width, items),
    });
    return html`<div class="dt-day">
      <div class="dt-day__head ${stacked ? 'is-stacked' : ''}">
        <span class="dt-day__label">${label}</span>
        <span class="dt-day__say">${say}${glyph('chevron')}</span>
      </div>
      <div class="dt-day__plot fv-tone--${o.tone}">
        ${readings && o.width > 0 ? this.draw(o, readings) : nothing}
      </div>
      ${axis(ticks)}
      ${pressCover(
        `${o.name} · ${label}${say ? ` · ${say}` : ''} · ${localize(o.hass, 'sheets.history_open')}`,
        o.open,
        undefined,
      )}
    </div>`;
  }
}
