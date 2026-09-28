import {
  clock12,
  dateFormat,
  formatNumber,
  isUsable,
  stateText,
  strings as words,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { axis, head, readout, scrub, ScrubController, sheetStyles, type Tone } from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { HeadFit } from '../energy/head.js';

import { baseOf, ceilingFor, figure, scaleFor, toBase } from '../gauge/units.js';

import { Card } from '../shared/base.js';

import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  selectField,
  textField,
} from '../shared/form.js';
import { Refresher } from '../shared/refresh.js';
import { loadDay, startOfDay, type DayRecord } from './day.js';

import { hourlyForecast } from './forecast.js';
import { configKeys, type AliasSpec } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';

const strings = words('production');

export interface ProductionCardConfig extends FluvyCardConfig {
  subtitle?: string;
  /** Today's forecast: its state is the day's total, its attributes may carry the hours (Solcast, Open-Meteo, a template). */
  forecast_entity?: string;
  show_forecast?: boolean;
  /** A power sensor that holds today's peak. Without it the best hour stands in. */
  peak_entity?: string;
  /** The peak and its hour under the bars (default). */
  show_peak?: boolean;
  /** `full` (default): the total, the bars, their axis and the figures. `compact`: the head, the bars and their axis. */
  variant?: 'full' | 'compact';
  /** Test hook, as in the clock cards: an ISO instant the card takes for "now". */
  _now?: string;
}

const HOURS = 24;
const BAR_HEIGHT = 80;
/** A finished hour is compiled a few seconds after it ends; asking again picks it up, and keeps a long-lived dashboard honest. */

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * A growing meter's day, hour by hour: the recorded hours as solid bars, the hour in progress read
 * live from the sensor, the forecast standing behind them and carrying on past "now", the day's
 * figures above and its peak below.
 */
export class FluvyProductionCard extends Card<ProductionCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: ProductionCardConfig): number {
    return config.variant === 'compact' ? 236 : 344;
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
    css`
      /* the sheet paints the bars solar; another tone brings its own ink (a ruler tone class carries nothing but the tone's variables) */
      .so-bars .so-bar__fill {
        background: var(--tone-ink, var(--fluvy-state-energy-solar));
      }
      .so-bar__fill,
      .so-bar__forecast {
        transform-origin: 50% 100%;
        animation: fv-grow-y 560ms var(--fv-ease-out) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + var(--bar-delay, 0ms));
      }
      .so-skeleton {
        height: 80px;
        margin-top: 16px;
      }
      .so-cols .fv-readout__label {
        white-space: nowrap;
      } /* a label never drops onto its value */
      .fv-axis span {
        white-space: nowrap;
      } /* "12 AM" on a 12-hour clock is one label */
    `,
  ];

  static override properties = {
    ...Card.properties,
    day_: { state: true },
  };

  /** The hour under the pointer (0–23); null: the day's total. */
  private readonly scrubber = new ScrubController(this, (fraction) =>
    Math.min(HOURS - 1, Math.floor(fraction * HOURS)),
  );

  /** undefined while the day loads, null when the recorder knows nothing about the sensor. */
  declare day_: DayRecord | null | undefined;

  private readonly history = new Refresher<DayRecord | null>();
  private readonly head = new HeadFit(this);

  constructor() {
    super();
    this.day_ = undefined;
  }

  static override keys = configKeys<ProductionCardConfig>()([
    'subtitle',
    'forecast_entity',
    'show_forecast',
    'peak_entity',
    'show_peak',
    'variant',
  ]);
  /** The card's head is its meter's name (`title` was the older word for it). */
  static override aliases: AliasSpec = { keys: [{ from: 'title', to: 'name' }] };
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['sensor']),
        fieldRow(textField('name'), textField('subtitle')),
        iconField(),
        colourFields(),
        fieldRow(
          { name: 'forecast_entity', selector: { entity: { domain: ['sensor'] } } },
          { name: 'peak_entity', selector: { entity: { domain: ['sensor'] } } },
        ),
        fieldRow(boolField('show_forecast'), boolField('show_peak')),
        selectField('variant', ['full', 'compact']),
        actionFields(),
      ],
      ...editorLabels(
        strings,
        { forecast_entity: 'forecast_entity', peak_entity: 'peak_entity' },
        {},
      ),
    };
  }

  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): ProductionCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    return {
      type: 'custom:fluvy-production-card',
      entity:
        sensors.find((id) => hass?.states?.[id]?.attributes.device_class === 'energy') ??
        sensors[0] ??
        '',
    };
  }

  protected override prepare(config: ProductionCardConfig): ProductionCardConfig {
    if (!config.entity) throw new Error('fluvy-production-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return 7;
  }
  override getGridOptions(): LovelaceGridOptions {
    return this.compact
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get compact(): boolean {
    return this.config?.variant === 'compact';
  }

  protected override watched(): readonly string[] {
    return [
      this.config?.entity ?? '',
      this.config?.forecast_entity ?? '',
      this.config?.peak_entity ?? '',
    ].filter(Boolean);
  }

  private now(): Date {
    const frozen = this.config?._now;
    if (frozen) {
      const date = new Date(frozen);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.loadHours();
  }

  /** Once per entity and hour, and again when the answer has gone stale; the bars on screen stay until the new day arrives. */
  private loadHours(): void {
    const hass = this.hass;
    const view = this.entity();
    if (!hass || view.status === 'missing') return;
    const now = this.now();
    const day = `${view.id}|${now.toDateString()}`;
    const previous = this.history.request(
      `${day}|${now.getHours()}`,
      () => loadDay(hass, view.id, view.unit, now),
      (record) => (this.day_ = record),
    );
    if (previous !== null && !previous.startsWith(`${day}|`)) this.day_ = undefined;
  }

  private get hour12(): boolean {
    return clock12(this.hass);
  }

  /** "12:00" on a 24 h clock, "12 PM" on a 12 h one: a whole hour never needs its minutes twice. */
  private hourLabel(hour: number): string {
    if (!this.hour12) return `${String(hour).padStart(2, '0')}:00`;
    return dateFormat(this.hass?.language ?? 'en', { hour: 'numeric', hour12: true }).format(
      new Date(2026, 0, 1, hour % 24),
    );
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const unusable = !isUsable(view);
    const tone: Tone = unusable ? 'off' : toneOf(this.config, 'solar');
    const compact = this.compact;
    const now = this.now();
    const hourNow = now.getHours();
    const base = toBase(1, view.unit);
    const record = this.day_;
    const loading = record === undefined;

    // finished hours from the recorder, the hour in progress from the meter itself
    const produced = Array.from(
      { length: HOURS },
      (_unused, hour) => Math.max(0, record?.hours[hour] ?? 0) * base.value,
    );
    if (record && record.baseline !== null && view.number !== null) {
      const gain = view.number - record.baseline;
      produced[hourNow] =
        (produced[hourNow] ?? 0) + (gain >= 0 ? gain : Math.max(0, view.number)) * base.value; // a meter below its last reading has reset
    }
    const known = record !== null && record !== undefined;
    const hovered = known ? this.scrubber.value : null;
    const total = sum(produced);

    const forecastView =
      this.config?.forecast_entity && this.config.show_forecast !== false
        ? this.entity(this.config.forecast_entity)
        : null;
    const hourly =
      forecastView && forecastView.status === 'ok'
        ? hourlyForecast(forecastView, startOfDay(now))
        : null;
    const hourlyBase = hourly ? toBase(1, hourly.unit || view.unit) : null;
    const forecast =
      hourly && hourlyBase && hourlyBase.unit === base.unit
        ? hourly.hours.map((value) => value * hourlyBase.value)
        : null;
    const forecastState = forecastView ? baseOf(forecastView) : null;
    const forecastTotal =
      forecastState && forecastState.unit === base.unit
        ? forecastState.value
        : forecast
          ? sum(forecast)
          : null;

    // like against like: what came in against what was forecast up to this very minute
    const expected = forecast
      ? sum(forecast.slice(0, hourNow)) + (forecast[hourNow] ?? 0) * (now.getMinutes() / 60)
      : 0;
    const delta =
      known && !unusable && expected > 0
        ? Math.max(-9.99, Math.min(9.99, total / expected - 1))
        : null;

    const scale = scaleFor(Math.max(total, forecastTotal ?? 0), base.unit);
    const shown = (raw: number): string => figure(this.hass, raw, scale);

    const peakHour = produced.reduce(
      (best, value, hour) => (value > (produced[best] ?? 0) ? hour : best),
      0,
    );
    const peakValue = produced[peakHour] ?? 0;
    const peakView = this.config?.peak_entity ? this.entity(this.config.peak_entity) : null;
    const peakBase = peakView ? baseOf(peakView) : null;
    const peakScale = peakBase ? scaleFor(peakBase.value, peakBase.unit) : null;
    const peak = peakView
      ? peakBase && peakScale
        ? { value: figure(this.hass, peakBase.value, peakScale), unit: peakScale.unit }
        : { value: '—', unit: '' }
      : known
        ? { value: shown(peakValue), unit: scale.unit }
        : { value: '—', unit: '' };

    // the sheet's bars: 80 px under a round ceiling, in 4 px steps — an hour below half a step draws nothing and is no sun hour
    const ceiling = ceilingFor(Math.max(...produced, ...(forecast ?? [])));
    const step = (raw: number): number =>
      ceiling > 0 ? Math.round(((Math.max(0, raw) / ceiling) * BAR_HEIGHT) / 4) * 4 : 0;
    // finished hours that produced, plus the elapsed part of the hour in progress: "7.4 h", not a count that jumps at the hour
    const sunHours = produced.reduce(
      (total, value, hour) =>
        total + (step(value) > 0 ? (hour === hourNow ? now.getMinutes() / 60 : 1) : 0),
      0,
    );

    const fitted = this.head.fit({
      width: this.contentWidth,
      title: name,
      sub:
        this.config?.subtitle ??
        (forecastTotal !== null
          ? `${this.t('common.today')} · ${strings(this.hass, 'vs_forecast')}`
          : this.t('common.today')),
      badge: unusable
        ? { text: stateText(this.hass, view), tone: 'off' }
        : delta !== null
          ? {
              text: `${delta >= 0 ? '+' : '−'}${formatNumber(this.hass, Math.abs(delta) * 100, { digits: 0 })} %`,
              tone: delta >= 0 ? tone : 'neutral',
            }
          : null,
    });

    // 24 bars of 8 spread over the column: the boundary between hour h−1 and h is where the label for h belongs
    const pitch = (this.contentWidth - 8) / 23;
    const boundary = (hour: number): number => (hour * pitch - (pitch - 8) / 2) / this.contentWidth;
    return html`<article
      class="fv-card so-card ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
    >
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'sun') : null,
        tone,
        title: name,
        sub: fitted.sub,
        trailing: fitted.badge,
        onIconTap: () => this.tap(view.id),
        onHold: () => this.hold(view.id),
        iconLabel: name,
        name: true,
      })}
      ${
        compact
          ? nothing
          : html`<div class="so-top fv-value-row">
              ${
                hovered !== null
                  ? readout({
                      label: `${this.hourLabel(hovered)} – ${this.hourLabel(hovered + 1)}`,
                      value: shown(produced[hovered] ?? 0),
                      unit: scale.unit,
                      size: 'l',
                    })
                  : readout({
                      label: strings(this.hass, 'so_far'),
                      value: known ? shown(total) : '—',
                      unit: known ? scale.unit : '',
                      size: 'l',
                    })
              }
              ${
                forecastTotal !== null && forecastTotal > 0
                  ? html`<div class="so-top__side">
                      ${readout({ label: strings(this.hass, 'forecast'), value: shown(forecastTotal), unit: scale.unit, size: 's' })}
                    </div>`
                  : nothing
              }
            </div>`
      }
      ${
        loading
          ? html`<div class="fv-skeleton so-skeleton"></div>`
          : html`<div
              class="so-bars fv-tone--${unusable ? 'neutral' : tone} ${hovered !== null ? 'is-scrub' : ''}"
              role="img"
              aria-label=${known ? `${strings(this.hass, 'so_far')}: ${shown(total)} ${scale.unit}` : name}
              ${scrub(this.scrubber)}
            >
              ${produced.map((value, hour) => {
                const ahead = step(forecast?.[hour] ?? 0);
                const done = step(value);
                // a day with nothing in it still draws its baseline: one quiet stub per hour
                return html`<span
                  class="so-bar ${hovered === hour ? 'is-hover' : ''}"
                  style="--bar-delay:${hour * 18}ms"
                >
                  ${ahead > 0 || ceiling === 0 ? html`<span class="so-bar__forecast" data-measure="value" style="height:${ahead || 4}px"></span>` : nothing}
                  ${done > 0 ? html`<span class="so-bar__fill" data-measure="value" style="height:${done}px"></span>` : nothing}
                </span>`;
              })}
            </div>`
      }
      ${axis([
        [0, this.hourLabel(0)],
        [boundary(6), this.hourLabel(6)],
        [0.5, this.hourLabel(12)],
        [boundary(18), this.hourLabel(18)],
        [1, this.hour12 ? this.hourLabel(24) : '24:00'],
      ])}
      ${
        compact
          ? nothing
          : html`<div class="so-cols fv-cols">
              ${
                this.config?.show_peak === false
                  ? nothing
                  : html`${readout({ label: strings(this.hass, 'peak'), value: peak.value, unit: peak.unit, size: 's' })}
                    ${readout({ label: strings(this.hass, 'peak_at'), value: known && peakValue > 0 ? this.hourLabel(peakHour) : '—', size: 's' })}`
              }
              ${readout({ label: strings(this.hass, 'sun_hours'), value: known ? formatNumber(this.hass, sunHours, { digits: 1 }) : '—', unit: known ? strings(this.hass, 'hour') : '', size: 's' })}
            </div>`
      }
    </article>`;
  }
}
