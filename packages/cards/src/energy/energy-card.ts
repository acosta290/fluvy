import {
  clock12,
  dateFormat,
  type EntityView,
  fetchHistory,
  type FluvyCardConfig,
  formatNumber,
  formatTime,
  type HomeAssistant,
  houseZone,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  type Series,
  stateText,
  wallClock,
} from '@fluvy/core';

import {
  axis,
  chartBubble,
  curve,
  emptyState,
  head,
  readout,
  round,
  sampleAt,
  scrub,
  ScrubController,
  sheetStyles,
  type Tone,
} from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { Card } from '../shared/base.js';

import {
  editorLabels,
  entityField,
  fieldRow,
  iconToneFields,
  numberField,
  textField,
  titleFields,
} from '../shared/form.js';

import { listsEditor } from '../shared/rows-editor.js';

import { HeadFit } from './head.js';

import { legendReadouts } from './legend.js';

import { costParts, readoutParts } from './power.js';

import { s } from './strings.js';

export interface EnergyLegendItem {
  entity: string;
  label?: string;
}

export interface EnergyCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  /** Window of the curve. 24 (the default) draws today on a 00:00 … 24:00 axis; anything else rolls. */
  hours?: number;
  /** A price or running-cost sensor shown beside the big value (€/h, €/kWh, …). */
  cost_entity?: string;
  /** Up to three sensors under the chart (grid / solar / house energy today). */
  legend?: ReadonlyArray<string | EnergyLegendItem>;
  /** Test hook, as in the clock and calendar cards: an ISO instant the card takes for "now". */
  _now?: string;
}

const CHART_HEIGHT = 120;
const HEADROOM = 44; // the bubble's room: the chart rule in design/language.md
const POINTS = 48; // a full window: one point per half hour of a day
const REFRESH = 5 * 60_000; // how long the shared history cache keeps an answer
const DAY_MINUTES = 24 * 60;
const DAY_FROM = 3; // hours into the day from which "24 h" means the calendar day (40 px of curve in a 320 column)

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Minutes into the day on the clock Home Assistant shows (the server's zone when the user chose it). */
function minutesIntoDay(hass: HomeAssistant | undefined, now: Date): number {
  const wall = wallClock(now, houseZone(hass));
  return wall.hour * 60 + wall.minute + wall.second / 60;
}

interface ChartWindow {
  /** The axis is the calendar day and the series covers midnight → now. */
  readonly day: boolean;
  /** Hours of history to ask for. */
  readonly hours: number;
  readonly points: number;
  /** Fraction of the axis the series covers. */
  readonly extent: number;
}

/**
 * Power now and today's curve: the big tabular figure with its running cost, the power sensor drawn
 * up to "now" with the value bubble on the cursor, the axis, and up to three totals as a legend row.
 *
 * On a 24 h card the axis IS the day: the series covers midnight → now and the curve stops at the
 * true fraction of the day elapsed (before 03:00 there is no day to draw yet, and the last 24 h roll).
 * Any other window rolls: the series spans the full width and the axis counts back in hours.
 */
export class FluvyEnergyCard extends Card<EnergyCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.energy,
    css`
      .ef-card {
        width: 100%;
      } /* the sheet fixes 360; a card takes the column it is given */
      .ef-cols {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .ef-cols .fv-readout {
        min-width: 0;
      }
      .ef-cols .fv-readout__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      } /* names may ellipsize, values never */
      .ef-chart .fv-skeleton {
        height: ${CHART_HEIGHT}px;
      }
      .ef-chart .fv-curve {
        display: block;
        overflow: visible;
      } /* the dot at "now" stays whole when now is the edge of the axis */
      .is-unavailable .fv-curve .curve-dot,
      .is-unavailable .fv-curve .curve-cursor {
        display: none;
      } /* the history is real; a reading at "now" is not */
      .fv-axis span {
        white-space: nowrap;
      } /* "12 AM" on a 12-hour clock is one label */
      /* the bubble arrives with the dot it belongs to, after the line has drawn itself */
      .ef-chart .fv-bubble {
        animation: fv-fade 500ms var(--fv-ease) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    series_: { state: true },
    loaded_: { state: true },
  };

  declare series_: Series | null;
  declare loaded_: boolean;
  /** Where the chart is being read (a fraction of its width); null: it shows now. */
  private readonly scrubber = new ScrubController(this);

  /** The request already made, so a re-render does not repeat it. */
  private asked = '';
  private readonly head = new HeadFit(this);

  constructor() {
    super();
    this.series_ = null;
    this.loaded_ = false;
  }

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['sensor']),
        titleFields(),
        iconToneFields(),
        fieldRow(numberField('hours', 1, 168), entityField(['sensor'], 'cost_entity', false)),
        { name: 'legend', selector: { entity: { multiple: true, domain: ['sensor'] } } },
      ],
      ...editorLabels(s, { cost_entity: 'cost', legend: 'editor_legend' }, {}),
    };
  }

  /** The visual editor: the card's own fields, then one form per item — a name, an icon, a tone, whatever the item may carry. */
  static getConfigElement(): HTMLElement {
    return listsEditor(this.getConfigForm(), [
      {
        key: 'legend',
        title: 'editor.rows',
        domains: ['sensor'],
        schema: [entityField(['sensor']), textField('label')],
      },
    ]);
  }

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): EnergyCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const entity =
      sensors.find((id) => hass?.states[id]?.attributes.device_class === 'power') ??
      sensors[0] ??
      '';
    return { type: 'custom:fluvy-energy-card', entity };
  }

  protected override prepare(config: EnergyCardConfig): EnergyCardConfig {
    if (!config.entity) throw new Error('fluvy-energy-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return this.legend().length ? 7 : 6;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    const ids = this.legend().map((item) => item.entity);
    if (this.config?.entity) ids.push(this.config.entity);
    if (this.config?.cost_entity) ids.push(this.config.cost_entity);
    return ids;
  }

  private legend(): EnergyLegendItem[] {
    return (this.config?.legend ?? [])
      .slice(0, 3)
      .map((item) => (typeof item === 'string' ? { entity: item } : item));
  }

  /* ---------- history ---------- */

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : undefined;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private chartWindow(now: Date = this.now()): ChartWindow {
    const asked = clamp(Math.round(Number(this.config?.hours ?? 24)) || 24, 1, 168);
    const minutes = minutesIntoDay(this.hass, now);
    // the first hours of a day are a few pixels of curve blown up to full height: until there is a day to draw, the last 24 h roll
    if (asked !== 24 || minutes < DAY_FROM * 60)
      return { day: false, hours: asked, points: POINTS, extent: 1 };
    // asked in five-minute steps, so cards opened within the same beat share one cached answer
    const hours = Math.floor(minutes / 5) / 12;
    return {
      day: true,
      hours,
      points: clamp(Math.round(hours * 2), 2, POINTS),
      extent: clamp(minutes / DAY_MINUTES, 0, 1),
    };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const previous = changed.get('config') as EnergyCardConfig | undefined;
    if (
      previous &&
      (previous.entity !== this.config?.entity || previous.hours !== this.config?.hours)
    ) {
      this.series_ = null; // another sensor or window: its curve is loading, the old one is not shown in its place
      this.loaded_ = false;
      this.asked = '';
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    void this.load();
  }

  private async load(): Promise<void> {
    const id = this.config?.entity;
    const hass = this.hass;
    if (!id || !hass?.states[id]) return;
    const { hours, points } = this.chartWindow();
    const key = `${id}|${hours}|${points}|${Math.floor(this.now().getTime() / REFRESH)}`;
    if (key === this.asked) return;
    this.asked = key;
    const series = await fetchHistory(hass, id, hours, points);
    if (key !== this.asked) return; // a newer request owns the chart
    this.series_ = series;
    this.loaded_ = true;
  }

  /* ---------- pieces ---------- */

  private dayAxis(): ReadonlyArray<readonly [number, string]> {
    const marks = [0, 6, 12, 18, 24];
    if (!clock12(this.hass))
      return marks.map((h) => [h / 24, `${String(h).padStart(2, '0')}:00`] as const);
    // "12 AM … 6 PM": the hour and a compact day period, which is all a 40 px label holds
    const clock = dateFormat(this.hass?.language ?? 'en', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    });
    return marks.map((h) => {
      const parts = clock.formatToParts(new Date(Date.UTC(2026, 0, 1, h % 24)));
      const hour = parts.find((p) => p.type === 'hour')?.value ?? String(h % 12 || 12);
      const period = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').replace(/[.\s]/g, '');
      return [h / 24, period ? `${hour} ${period}` : hour] as const;
    });
  }

  private rollingAxis(hours: number): ReadonlyArray<readonly [number, string]> {
    const days = hours >= 48;
    const back = (h: number): string =>
      s(this.hass, days ? 'days_ago' : 'hours_ago', {
        count: formatNumber(this.hass, days ? h / 24 : h, { digits: 1 }),
      });
    return [
      [0, back(hours)],
      [0.5, back(hours / 2)],
      [1, this.t('common.now')],
    ];
  }

  /** The point under the pointer: where the cursor goes, what it reads and when that was. */
  private scrubbed(
    values: readonly number[],
    view: EntityView,
    extent: number,
    day: boolean,
    hours: number,
  ): { cursor: number; parts: { value: string; unit: string }; time: string } | null {
    const fraction = this.scrubber.value;
    if (fraction === null || values.length < 2 || !(extent > 0)) return null;
    const cursor = Math.min(fraction, extent);
    const point = sampleAt(values, cursor / extent);
    if (point === null) return null;
    const now = this.now();
    const at = day
      ? new Date(new Date(now).setHours(0, 0, 0, 0) + cursor * DAY_MINUTES * 60_000)
      : new Date(now.getTime() - hours * 3_600_000 * (1 - cursor));
    return { cursor, parts: readoutParts(this.hass, view, point), time: formatTime(this.hass, at) };
  }

  private renderChart(
    extent: number,
    live: number | null,
    value: string,
    unit: string,
    at: { cursor: number; parts: { value: string; unit: string }; time: string } | null,
  ): TemplateResult {
    if (!this.loaded_) return html`<div class="ef-chart"><div class="fv-skeleton"></div></div>`;
    const values = [...(this.series_?.values ?? [])];
    if (values.length < 2) {
      return html`<div class="ef-chart">${emptyState('bolt', s(this.hass, 'no_history'))}</div>`;
    }
    // history is up to five minutes old; the curve ends on the reading the bubble quotes
    if (live !== null) values[values.length - 1] = live;
    const w = this.contentWidth;
    const family = getComputedStyle(this).fontFamily;
    return html`<div class="ef-chart" ${scrub(this.scrubber)}>
      ${curve(values, { w, h: CHART_HEIGHT, padTop: HEADROOM, extent, cursor: at?.cursor })}
      ${
        at
          ? chartBubble({
              x: at.cursor * w,
              width: w,
              value: at.parts.value,
              unit: at.parts.unit,
              time: at.time,
              family,
            })
          : live !== null
            ? chartBubble({ x: extent * w, width: w, value, unit, family })
            : nothing
      }
    </div>`;
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const title =
      this.config?.title ?? (view.status === 'missing' ? s(this.hass, 'title') : view.name);
    if (view.status === 'missing')
      return this.renderEmpty(`${title} · ${stateText(this.hass, view)}`);

    const off = view.status === 'unavailable';
    const live = view.status === 'ok' ? view.number : null;
    const { day, hours, extent } = this.chartWindow();
    const parts = readoutParts(this.hass, view);
    const sub =
      this.config?.subtitle ??
      (day
        ? `${view.areaName || this.t('energy.home')} · ${this.t('common.today').toLowerCase()}`
        : s(this.hass, 'last_hours', { hours: formatNumber(this.hass, hours, { digits: 0 }) }));
    const cost = this.config?.cost_entity
      ? costParts(this.hass, this.entity(this.config.cost_entity))
      : null;
    const legend = this.legend();
    const fitted = this.head.fit({ width: this.contentWidth, title, sub, trailing: 44 });
    const curveValues = [...(this.series_?.values ?? [])];
    if (live !== null && curveValues.length) curveValues[curveValues.length - 1] = live;
    const at = this.loaded_ ? this.scrubbed(curveValues, view, extent, day, hours) : null;

    return html`<article class="fv-card ef-card ${off ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: this.config?.icon ?? 'bolt',
        tone: off ? 'off' : (this.config?.tone ?? 'solar'),
        title,
        sub: fitted.sub,
        trailing: round('dots', 'quiet', this.t('common.more'), () =>
          this.tap(view.id, { action: 'more-info' }),
        ),
      })}
      <div class="ef-top fv-value-row">
        ${readout({ label: at ? at.time : s(this.hass, 'right_now'), value: at ? at.parts.value : parts.value, unit: at ? at.parts.unit : parts.unit, size: live === null && view.status === 'ok' ? 'm' : 'l' })}
        ${cost ? html`<div class="ef-top__side">${readout({ label: s(this.hass, 'cost'), value: cost.value, unit: cost.unit, size: 's' })}</div>` : nothing}
      </div>
      ${this.renderChart(extent, live, parts.value, parts.unit, at)}
      ${axis(day ? this.dayAxis() : this.rollingAxis(hours))}
      ${
        legend.length
          ? html`<div class="ef-cols fv-cols">
              ${legendReadouts(this.hass, legend, (id) => this.entity(id))}
            </div>`
          : nothing
      }
    </article>`;
  }
}
