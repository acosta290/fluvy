import {
  clock12,
  fetchHistory,
  formatNumber,
  formatTime,
  isUsable,
  scaleUnit,
  stateText,
  strings,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  type Series,
} from '@fluvy/core';

import {
  axis,
  chartBubble,
  clickPress,
  curve,
  firstFit,
  glyph,
  head,
  ico,
  preventMenu,
  readout,
  round,
  sampleAt,
  scrub,
  ScrubController,
  sheetStyles,
  startPress,
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

import { toneOf } from '../shared/colour.js';
import { TextRuler } from '../shared/fit.js';
import { statsSize } from '../shared/readouts.js';
import { FontsSettled } from '../shared/fonts.js';
import { glyphFor } from '../shared/domain.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  numberField,
  selectField,
  textField,
} from '../shared/form.js';
import { Refresher } from '../shared/refresh.js';
import { configKeys } from '../shared/config.js';

const s = strings('sensor');

export type SensorVariant = 'chart' | 'tile';

export interface SensorCardConfig extends FluvyCardConfig {
  /** Context in the sub line, before the window ("Temperature · last 24 h"). Defaults to the device class, as Home Assistant names it. */
  subtitle?: string;
  /** Rolling window of history in hours (default 24), ending at "now". */
  hours?: number;
  show_stats?: boolean;
  /** `chart` = the wide card; `tile` = the sheet's sensor tile (readout, trend arrow, spark). */
  variant?: SensorVariant;
  /** Test hook: an ISO date that freezes "now" (the day's axis). Undocumented. */
  _now?: string;
}

const POINTS = 48;
const CHART_HEIGHT = 120;
const HEADROOM = 44; // the bubble's room above the curve (design/language.md)
const HOUR_MS = 3_600_000;

const down4 = (n: number): number => Math.max(4, Math.floor(n / 4) * 4);
const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** What a measurement is coloured by when the config does not say (the sheet paints heat and water). */
function sensorTone(view: EntityView): Tone {
  switch (view.deviceClass) {
    case 'temperature':
      return 'heat';
    case 'humidity':
    case 'moisture':
    case 'water':
    case 'precipitation':
    case 'precipitation_intensity':
      return 'water';
    case 'power':
    case 'energy':
    case 'illuminance':
    case 'irradiance':
      return 'solar';
    case 'current':
    case 'voltage':
    case 'pressure':
    case 'atmospheric_pressure':
      return 'grid';
    default:
      return 'accent';
  }
}

/** The largest readout size a text state fits in: a word is a value too, and a value never ellipsizes. */
function sizeFor(
  text: string,
  width: number,
  sizes: ReadonlyArray<readonly ['l' | 'm' | 's' | 'xs', number]>,
): 'l' | 'm' | 's' | 'xs' {
  for (const [size, perCharacter] of sizes) if (text.length * perCharacter <= width) return size;
  return 'xs';
}

/**
 * One measurement over time. `chart` is the sheet's wide card — head, the curve with its value
 * bubble on the cursor at "now", the axis, min / max / average. `tile` is the sheet's sensor tile —
 * readout, a trend arrow (the latest value against the mean of the window's first quarter) and a spark.
 *
 * A sensor that does not report a number keeps its state, set big, and no chart. History is asked
 * of `@fluvy/core` (one cached WebSocket call per entity and window) and asked again, at most every
 * five minutes, when the sensor itself changes — no timer.
 */
export class FluvySensorCard extends Card<SensorCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
      .am-cols {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      /* the sheet scopes this under its lab frame (.am-sensors); here the tile is the card itself */
      .fv-tile .fv-readout {
        margin-top: 12px;
      }
      /* the language's unavailable surface (fluvy.css draws it for cards; tiles here keep their 168) */
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
      .fv-tile .fv-readout__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      } /* a name may ellipsize */
      .am-spark {
        padding: 0 4px;
      } /* the lab insets the spark so the end dot stays whole */
      .am-spark .fv-curve {
        overflow: visible;
      }
      .am-spark .fv-skeleton {
        height: 24px;
      }
      .am-chart .fv-skeleton {
        height: ${CHART_HEIGHT}px;
        border-radius: var(--fluvy-radius-control);
      }
      .am-chart .fv-curve {
        overflow: visible;
      } /* a rolling window ends at the edge: the dot at "now" stays whole */
      /* the bubble arrives with the dot it belongs to, once the line has drawn itself */
      .am-chart .fv-bubble {
        animation: fv-fade 500ms var(--fv-ease) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
      }
      .am-state {
        margin-top: 16px;
      }
      /* empty state: a 44 ring on the card fill and one line, centred in a 120 page panel (design language) */
      .am-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: ${CHART_HEIGHT}px;
        margin-top: 16px;
        border-radius: var(--fluvy-radius-control);
        background: var(--fluvy-page);
      }
      .am-empty .fv-ico {
        background: var(--fluvy-card);
      }
      .am-empty .fv-empty {
        color: var(--fluvy-text-secondary);
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    series_: { state: true },
  };

  /** `undefined` while the recorder has not answered; `null` when it has nothing for this window. */
  declare series_: Series | null | undefined;
  /** Where the chart is being read (a fraction of its width); null: it shows now. */
  private readonly scrubber = new ScrubController(this);

  private readonly history = new Refresher<Series | null>();
  /** The window (hours) the series on screen was asked for: the curve and its axis stay one picture while a newer one loads. */
  private drawn: number | null = null;

  static override keys = configKeys<SensorCardConfig>()([
    'subtitle',
    'hours',
    'show_stats',
    'variant',
  ]);
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['sensor', 'number', 'input_number', 'counter']),
        fieldRow(textField('name'), textField('subtitle')),
        iconField(),
        colourFields(),
        fieldRow(selectField('variant', ['chart', 'tile']), numberField('hours', 1, 168)),
        boolField('show_stats'),
        actionFields(),
      ],
      ...editorLabels(s, { show_stats: 'editor.show_stats' }, {}),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): SensorCardConfig {
    return {
      type: 'custom:fluvy-sensor-card',
      entity: entities.find((id) => id.startsWith('sensor.')) ?? '',
    };
  }

  protected override prepare(config: SensorCardConfig): SensorCardConfig {
    if (!config.entity) throw new Error('fluvy-sensor-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return this.variant === 'tile' ? 3 : (this.config?.show_stats ?? true) ? 6 : 5;
  }
  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'tile'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get variant(): SensorVariant {
    return this.config?.variant === 'tile' ? 'tile' : 'chart';
  }

  /**
   * "Last N hours" is a rolling window: the series always fills the width and ends at "now". At one
   * in the morning a calendar-day axis would show an almost empty card, which is not what a sensor
   * card is for (the energy card keeps the day axis: "today" is its subject).
   */
  private get hours(): number {
    return Math.min(168, Math.max(1, Math.round(this.config?.hours ?? 24)));
  }

  /* ---------- history ---------- */

  /** Runs before every render — state set here belongs to this render, never to a second one. */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const hass = this.hass;
    const view = this.entity();
    if (!hass || view.number === null) return; // nothing to chart (text, unavailable, missing): what was loaded stays for when it returns
    const hours = this.hours;
    const previous = this.history.request(
      `${view.id}|${hours}`,
      () => fetchHistory(hass, view.id, hours, POINTS),
      (series) => {
        this.drawn = hours;
        this.series_ = series;
      },
    );
    // another entity: back to the skeleton
    if (previous !== null && !previous.startsWith(`${view.id}|`)) {
      this.series_ = undefined;
      this.drawn = null;
    }
  }

  /* ---------- pieces ---------- */

  /** The card's tone: the one asked for, the accent where a colour of its own was given, else the measure's. */
  private readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);

  constructor() {
    super();
    // a web font landing after the first render changes what fits: measure again
    new FontsSettled(this, () => {
      this.ruler.clear();
      this.requestUpdate();
    });
  }

  private toneOf(view: EntityView): Tone {
    if (!isUsable(view)) return 'off';
    return toneOf(this.config, sensorTone(view));
  }

  /** Decimals of the statistics: the entity's display precision, else what the state itself carries. */
  private precision(view: EntityView): number {
    const configured = this.hass?.entities?.[view.id]?.display_precision;
    if (typeof configured === 'number') return configured;
    return Math.min(3, view.state.split('.')[1]?.length ?? 0);
  }

  /** A statistic as the row says it: its number in the entity's precision (a scaled unit's own), and its unit. */
  private statText(value: number | null, view: EntityView): { value: string; unit: string } {
    if (value === null) return { value: '—', unit: '' };
    const scaled = scaleUnit(value, view.unit);
    const magnitude = Math.abs(scaled.value);
    const digits =
      scaled.unit === view.unit
        ? this.precision(view)
        : magnitude >= 100
          ? 0
          : magnitude >= 10
            ? 1
            : 2;
    return {
      value: formatNumber(this.hass, scaled.value, { digits, minDigits: digits }),
      unit: scaled.unit,
    };
  }

  /** The three statistics share the content width in equal columns, at the readout size they fit (`statsSize`). */
  private statsRow(series: Series | null | undefined, view: EntityView): TemplateResult {
    const stats = [
      [this.t('common.min'), series?.min ?? null],
      [this.t('common.max'), series?.max ?? null],
      [this.t('common.average'), series?.average ?? null],
    ] as const;
    const texts = stats.map(([label, value]) => ({ label, ...this.statText(value, view) }));
    const size = statsSize(this.ruler, this.contentWidth, texts);
    return html`<div class="am-cols fv-cols">
      ${texts.map(({ label, value, unit }) => readout({ label, value, unit, size }))}
    </div>`;
  }

  /** History is up to five minutes old: the curve ends on the reading the card quotes, and the extremes count it. */
  private live(view: EntityView): Series | null | undefined {
    const series = this.series_;
    const value = view.number;
    if (!series || value === null || series.values.length < 2) return series;
    return {
      values: [...series.values.slice(0, -1), value],
      min: Math.min(series.min, value),
      max: Math.max(series.max, value),
      average: series.average,
    };
  }

  /** Latest against the mean of the first quarter of the window: the shape of the day, not its noise. */
  private trend(series: Series | null | undefined): 'up' | 'down' | null {
    if (!series || series.values.length < 4) return null;
    const quarter = Math.max(1, Math.floor(series.values.length / 4));
    let sum = 0;
    for (let i = 0; i < quarter; i++) sum += series.values[i] ?? 0;
    const start = sum / quarter;
    const latest = series.values[series.values.length - 1] ?? start;
    const threshold = Math.max((series.max - series.min) * 0.05, 1e-6);
    return latest - start > threshold ? 'up' : start - latest > threshold ? 'down' : null;
  }

  /** "Temperature · last 24 h": the context (config, else the device class in Home Assistant's words) and the window. */
  private subLine(view: EntityView, title: string): string {
    const days = this.hours > 24 && this.hours % 24 === 0;
    const window = s(this.hass, days ? 'window_days' : 'window_hours', {
      count: days ? this.hours / 24 : this.hours,
    });
    let context = this.config?.subtitle ?? '';
    if (this.config?.subtitle === undefined && view.deviceClass) {
      const key = `component.${view.domain}.entity_component.${view.deviceClass}.name`;
      const named = this.hass?.localize(key) ?? '';
      if (named && named !== key && !title.toLocaleLowerCase().includes(named.toLocaleLowerCase()))
        context = named;
    }
    if (!context) return capitalise(window);
    // the head: 44 circle + 12, the titles, 12 + the 44 round; the window is what this card is about, the context the part that may go
    return firstFit(
      [`${context} · ${window}`, capitalise(window)],
      this.contentWidth - 112 - 4,
      `500 13px ${getComputedStyle(this).fontFamily}`,
    );
  }

  /** The window is labelled with the clock times at its quarters (a 12 h clock only fits three), ending in "Now"; days once it is two or more. */
  private axisItems(hours: number): ReadonlyArray<readonly [number, string]> {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    const now = frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
    if (hours >= 48) {
      const back = (h: number): string =>
        s(this.hass, 'days_ago', { count: formatNumber(this.hass, h / 24, { digits: 1 }) });
      return [
        [0, back(hours)],
        [0.5, back(hours / 2)],
        [1, this.t('common.now')],
      ];
    }
    const at = (fraction: number): string =>
      formatTime(this.hass, new Date(now.getTime() - (1 - fraction) * hours * HOUR_MS));
    return clock12(this.hass) || this.contentWidth < 280
      ? [
          [0, at(0)],
          [0.5, at(0.5)],
          [1, this.t('common.now')],
        ]
      : [
          [0, at(0)],
          [0.25, at(0.25)],
          [0.5, at(0.5)],
          [0.75, at(0.75)],
          [1, this.t('common.now')],
        ];
  }

  /** A point of the window formatted like the stats: the entity's unit, rescaled when the figure asks for it. */
  private figure(value: number, view: EntityView): { value: string; unit: string } {
    const scaled = scaleUnit(value, view.unit);
    const magnitude = Math.abs(scaled.value);
    const digits =
      scaled.unit === view.unit
        ? this.precision(view)
        : magnitude >= 100
          ? 0
          : magnitude >= 10
            ? 1
            : 2;
    return {
      value: formatNumber(this.hass, scaled.value, { digits, minDigits: digits }),
      unit: scaled.unit,
    };
  }

  /* ---------- variants ---------- */

  private renderTile(view: EntityView): TemplateResult {
    const open = (): void => this.tap(view.id);
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    };
    const name = this.config?.name ?? view.name;
    const tone = this.toneOf(view);
    const parts = valueParts(this.hass, view);
    const numeric = view.number !== null;
    const series = this.live(view);
    const trend = numeric ? this.trend(series) : null;
    const inner = this.width - 32;
    const values = series?.values ?? [];
    // unavailable keeps the tile's own anatomy (the 76 "off" tile cannot hold a name in a half column): dashed outline, page fill, dashed ring, "—"
    return html`<article
      class="fv-tile fv-tile--tap ${isUsable(view) ? '' : 'is-unavailable is-off'}"
      data-card
      role="button"
      tabindex="0"
      .fvTap=${open}
      .fvHold=${() => this.hold(view.id)}
      @pointerdown=${startPress}
      @contextmenu=${preventMenu}
      @click=${clickPress}
      @keydown=${key}
    >
      <div class="fv-tile__head">
        ${ico(this.config?.icon ?? glyphFor(view), tone)}
        ${trend ? html`<span class="fv-trend ${trend === 'down' ? 'fv-trend--down' : ''} am-tile__trend">${glyph(trend === 'down' ? 'trendDown' : 'trendUp')}</span>` : nothing}
      </div>
      ${readout({
        label: name,
        value: parts.value,
        unit: parts.unit,
        size: numeric
          ? 'm'
          : sizeFor(parts.value, inner, [
              ['m', 14],
              ['s', 12],
            ]),
      })}
      ${
        !numeric || series === null
          ? nothing
          : html`<div class="am-spark fv-tone--${tone}">
              ${values.length > 1 ? curve(values, { w: down4(inner - 8), h: 24, pad: 4 }) : html`<div class="fv-skeleton"></div>`}
            </div>`
      }
    </article>`;
  }

  private renderChart(view: EntityView): TemplateResult {
    const tone = this.toneOf(view);
    const title = this.config?.name ?? view.name;
    const usable = isUsable(view);
    const header = head({
      icon: this.config?.icon ?? glyphFor(view),
      tone,
      title,
      name: true, // the entity's name, or one typed for it: a name may end in an ellipsis
      onIconTap: () => this.tap(view.id),
      onHold: () => this.hold(view.id),
      iconLabel: title,
      // "Unavailable" is said once, here; a sensor that is a word has no window to speak of
      sub:
        view.status !== 'ok'
          ? stateText(this.hass, view)
          : view.number === null
            ? (this.config?.subtitle ?? view.areaName)
            : this.subLine(view, title),
      trailing: round('dots', 'quiet', this.t('common.more'), () =>
        this.tap(view.id, { action: 'more-info' }),
      ),
    });

    if (view.number === null) {
      const text = view.status === 'ok' ? stateText(this.hass, view) : '—';
      return html`<article class="fv-card am-card ${usable ? '' : 'is-off'}" data-card>
        ${header}
        <div class="am-state">
          ${readout({
            label: s(this.hass, 'state'),
            value: text,
            size: sizeFor(text, this.contentWidth, [
              ['l', 24],
              ['m', 15],
              ['s', 12],
            ]),
          })}
        </div>
      </article>`;
    }

    const series = this.live(view);
    const values = series?.values ?? [];
    const hours = this.drawn ?? this.hours;
    const width = down4(this.contentWidth);
    const family = getComputedStyle(this).fontFamily;
    const parts = valueParts(this.hass, view);
    const stats = this.config?.show_stats ?? true;

    if (series !== undefined && values.length < 2) {
      return html`<article class="fv-card am-card" data-card>
        ${header}
        <div class="am-empty" data-align="center">
          ${ico(glyphFor(view), 'neutral')}
          <p class="fv-empty">${s(this.hass, 'no_history')}</p>
        </div>
      </article>`;
    }

    const fraction = this.scrubber.value;
    const point = series && fraction !== null ? sampleAt(values, fraction) : null;
    const at =
      point === null
        ? null
        : {
            cursor: fraction as number,
            ...this.figure(point, view),
            time: formatTime(
              this.hass,
              new Date(Date.now() - hours * 3_600_000 * (1 - (fraction as number))),
            ),
          };
    return html`<article class="fv-card am-card" data-card>
      ${header}
      <div class="am-chart fv-tone--${tone}" ${scrub(this.scrubber)}>
        ${
          series
            ? html`${curve(values, { w: width, h: CHART_HEIGHT, padTop: HEADROOM, cursor: at?.cursor })}${chartBubble(
                at
                  ? {
                      x: at.cursor * width,
                      width,
                      value: at.value,
                      unit: at.unit,
                      time: at.time,
                      family,
                    }
                  : { x: width, width, value: parts.value, unit: parts.unit, family },
              )}`
            : html`<div class="fv-skeleton"></div>`
        }
      </div>
      ${axis(this.axisItems(hours))} ${stats ? this.statsRow(series, view) : nothing}
    </article>`;
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    if (view.status === 'missing')
      return this.renderEmpty(
        this.config?.entity
          ? `${this.config.name ?? view.name} · ${stateText(this.hass, view)}`
          : undefined,
      );
    return this.variant === 'tile' ? this.renderTile(view) : this.renderChart(view);
  }
}
