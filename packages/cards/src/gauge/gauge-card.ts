import {
  fetchHistory,
  formatNumber,
  isUsable,
  stateText,
  strings as words,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  type MessageKey,
  type Series,
} from '@fluvy/core';

import { head, readout, rulerLabels, sheetStyles, type Tone } from '@fluvy/ui';

import { css, html, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';

import { HeadFit } from '../energy/head.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';
import {
  actionFields,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  numberField,
  selectField,
  textField,
} from '../shared/form.js';
import { statsSize } from '../shared/readouts.js';
import { Refresher } from '../shared/refresh.js';

import { baseOf, ceilingFor, figure, scaleFor, toBase } from './units.js';
import { configKeys } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';

const strings = words('gauge');

export interface GaugeCardConfig extends FluvyCardConfig {
  subtitle?: string;
  /** `ring` (default): the dial. `bar`: the reading over a level bar, for a half column. */
  variant?: 'ring' | 'bar';
  /** Bottom of the ring, in the sensor's unit. */
  min?: number;
  /** Top of the ring, in the sensor's unit. Without it: the entity's `max` attribute, `max_entity`, or the window's peak rounded up. */
  max?: number;
  /** An entity that carries the ceiling (an inverter's rated power, a tank's capacity), in any unit of the same family. */
  max_entity?: string;
  /** The word in the open centre of the ring. Defaults to the device class ("Power"). */
  label?: string;
  /** Window the Min / Max / Average row summarises. */
  hours?: number;
  /** Head badge. Defaults to "Producing" / "Idle", read from the value. */
  badge?: string;
}

/** The sheet's ring: R 96 with 12 px ticks needs a 240 box, which a 300 px card still holds. */
const RADIUS = 96;
const TICK = 12;
/** The history cache in core lives five minutes; asking again sooner would only return the same window. */
/** Below this share of the range the source is resting: the badge says so and the head goes neutral. */
const IDLE = 0.02;

type LabelKey =
  'energy' | 'temperature' | 'pressure' | 'speed' | 'illuminance' | 'current' | 'voltage';

const CLASS_LABEL: Record<string, LabelKey> = {
  energy: 'energy',
  temperature: 'temperature',
  pressure: 'pressure',
  atmospheric_pressure: 'pressure',
  speed: 'speed',
  wind_speed: 'speed',
  illuminance: 'illuminance',
  current: 'current',
  voltage: 'voltage',
};

const SHARED_LABEL: Record<string, MessageKey> = {
  power: 'energy.power',
  humidity: 'climate.humidity',
  battery: 'energy.battery',
};

const PRODUCES = new Set(['power', 'energy', 'current']);

/**
 * A numeric sensor as the read-only ring gauge: the tick ring lit to its fraction, the figure in the
 * open centre under an uppercase label, the range under the ring, and Min / Max / Average of the
 * window below — centred in their columns, so the row mirrors the ring above it.
 */
export class FluvyGaugeCard extends Card<GaugeCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: GaugeCardConfig): number {
    return config.variant === 'bar' ? 256 : 384;
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
    css`
      /* the ring is placed on a whole pixel (its ticks stay crisp in an odd column) instead of centred on a half */
      .so-gauge {
        justify-content: flex-start;
      }
      fluvy-dial {
        flex: 0 0 auto;
      }
      .so-cols .fv-readout__label {
        white-space: nowrap;
      } /* a label never drops onto its value */
    `,
  ];

  static override properties = { ...Card.properties, series_: { state: true } };

  /** The window in the sensor's own unit: undefined while it loads, null when the recorder has nothing. */
  declare series_: Series | null | undefined;

  private readonly history = new Refresher<Series | null>();
  private readonly head = new HeadFit(this);

  constructor() {
    super();
    this.series_ = undefined;
  }

  static override keys = configKeys<GaugeCardConfig>()([
    'subtitle',
    'variant',
    'min',
    'max',
    'max_entity',
    'label',
    'hours',
    'badge',
  ]);
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['sensor', 'number', 'input_number', 'counter']),
        fieldRow(textField('name'), textField('subtitle')),
        fieldRow(iconField(), selectField('variant', ['ring', 'bar'])),
        colourFields(),
        fieldRow(
          numberField('min', -1_000_000, 1_000_000, 0.1),
          numberField('max', -1_000_000, 1_000_000, 0.1),
        ),
        {
          name: 'max_entity',
          selector: { entity: { domain: ['sensor', 'number', 'input_number'] } },
        },
        fieldRow(textField('label'), textField('badge')),
        numberField('hours', 1, 168),
        actionFields(),
      ],
      ...editorLabels(strings, { max_entity: 'max_entity', label: 'label', badge: 'badge' }, {}),
    };
  }

  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): GaugeCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const entity =
      sensors.find((id) => hass?.states?.[id]?.attributes.device_class === 'power') ??
      sensors[0] ??
      entities[0] ??
      '';
    return { type: 'custom:fluvy-gauge-card', entity };
  }

  protected override prepare(config: GaugeCardConfig): GaugeCardConfig {
    if (!config.entity) throw new Error('fluvy-gauge-card: "entity" is required');
    if (typeof config.max === 'number' && config.max <= (config.min ?? 0))
      throw new Error('fluvy-gauge-card: "max" must be greater than "min"');
    return config;
  }

  private get bar(): boolean {
    return this.config?.variant === 'bar';
  }

  override getCardSize(): number {
    return this.bar ? 5 : 8;
  }
  /** The ring takes a section; the bar half of one, and reads in a third. */
  override getGridOptions(): LovelaceGridOptions {
    return this.bar
      ? { columns: 6, rows: 'auto', min_columns: 4 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', this.config?.max_entity ?? ''].filter(Boolean);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.loadSeries();
  }

  private get hours(): number {
    const hours = this.config?.hours;
    return typeof hours === 'number' && hours > 0 ? Math.min(168, hours) : 24;
  }

  /** One history read per entity and window (core shares it between cards), asked again once it has gone stale. */
  private loadSeries(): void {
    const hass = this.hass;
    const id = this.config?.entity;
    if (!hass || !id) return;
    const key = `${id}|${this.hours}`;
    const hours = this.hours;
    const previous = this.history.request(
      key,
      () => fetchHistory(hass, id, hours),
      (series) => (this.series_ = series),
    );
    // a refresh keeps the figures on screen until the new ones arrive
    if (previous !== null && previous !== key) this.series_ = undefined;
  }

  /**
   * Top of the ring in the base unit: the config, the entity's own `max`, a companion entity, or the
   * window's peak rounded up. Null while that window is still loading — the ring waits unlit rather
   * than fill against a ceiling that is about to move.
   */
  private ceiling(view: EntityView, min: number, factor: number): number | null {
    const configured = this.config?.max;
    if (typeof configured === 'number' && Number.isFinite(configured)) return configured * factor;
    const own = view.attr<number | null>('max');
    if (typeof own === 'number' && Number.isFinite(own) && own * factor > min) return own * factor;
    const rated = this.config?.max_entity ? baseOf(this.entity(this.config.max_entity)) : null;
    if (rated && rated.value > min) return rated.value;
    if (this.series_ === undefined) return null;
    const peak = Math.max(this.series_?.max ?? -Infinity, view.number ?? -Infinity) * factor;
    return peak > min ? min + ceilingFor(peak - min) : null;
  }

  private innerLabel(view: EntityView): string {
    const configured = this.config?.label;
    if (configured !== undefined) return configured;
    const deviceClass = view.deviceClass;
    if (!deviceClass) return strings(this.hass, 'value');
    const key = `component.sensor.entity_component.${deviceClass}.name`;
    const native = this.hass?.localize(key);
    if (native && native !== key) return native;
    const shared = SHARED_LABEL[deviceClass];
    if (shared) return this.t(shared);
    const local = CLASS_LABEL[deviceClass];
    if (local) return strings(this.hass, local);
    const words = deviceClass.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const unusable = !isUsable(view);
    const base = toBase(1, view.unit);
    const value = view.number === null ? null : view.number * base.value;
    const min = (this.config?.min ?? 0) * base.value;
    const max = this.ceiling(view, min, base.value);
    const series = unusable ? null : this.series_;

    const scale = scaleFor(
      Math.max(
        Math.abs(min),
        Math.abs(max ?? 0),
        Math.abs(value ?? 0),
        Math.abs((series?.max ?? 0) * base.value),
      ),
      base.unit,
    );
    const precision =
      scale.divisor === 1 ? this.hass?.entities?.[view.id]?.display_precision : undefined;
    const shown = (raw: number): string => figure(this.hass, raw, scale, precision);
    const edgeDigits =
      Number.isInteger(min / scale.divisor) &&
      (max === null || Number.isInteger(max / scale.divisor))
        ? 0
        : 1; // "0.0 · 5.4", but "0 · 120"
    const edge = (raw: number): string =>
      formatNumber(this.hass, raw / scale.divisor, { digits: edgeDigits, minDigits: edgeDigits });

    const active = value !== null && value > min + (max === null ? 0 : (max - min) * IDLE);
    const tone: Tone = toneOf(this.config, 'solar');
    const headTone: Tone = unusable ? 'off' : active ? tone : 'neutral';
    const badgeText =
      unusable || value === null
        ? stateText(this.hass, view)
        : (this.config?.badge ??
          (!active
            ? this.t('energy.idle')
            : PRODUCES.has(view.deviceClass)
              ? this.t('energy.producing')
              : strings(this.hass, 'active')));

    const width = this.contentWidth;
    const radius = Math.min(RADIUS, Math.max(48, Math.floor((width / 2 - TICK - 12) / 4) * 4));
    const box = Math.ceil((radius + TICK + 12) / 4) * 8; // the dial's own box: twice its half, which sits on the 4 grid
    const inset = Math.max(0, Math.floor((width - box) / 2));

    const stats = (
      [
        ['common.min', series?.min],
        ['common.max', series?.max],
        ['common.average', series?.average],
      ] as const
    ).map(([label, raw]) => ({
      label: this.t(label),
      value: raw === undefined ? '—' : shown(raw * base.value),
      unit: raw === undefined ? '' : scale.unit,
    }));
    const size = statsSize(this.head.ruler, width, stats);
    const fitted = this.head.fit({
      width,
      title: name,
      sub: this.config?.subtitle ?? view.areaName,
      badge: { text: badgeText, tone: headTone },
    });

    return html`<article
      class="fv-card so-card ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
    >
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? glyphFor(view)) : null,
        tone: headTone,
        title: name,
        sub: fitted.sub,
        trailing: fitted.badge,
        onIconTap: () => this.tap(view.id),
        onHold: () => this.hold(view.id),
        iconLabel: name,
        name: true,
      })}
      ${
        this.bar
          ? html`<div class="so-top fv-value-row">
                ${readout({ label: this.innerLabel(view), value: value === null ? '—' : shown(value), unit: value === null ? '' : scale.unit, size: 'l' })}
              </div>
              <div class="so-level">
                <span class="fv-bar"
                  ><span
                    class="fv-bar__fill fv-bar--${unusable || !active ? 'neutral' : tone}"
                    data-measure="value"
                    style="width:${value === null || max === null ? 0 : Math.round(Math.min(1, Math.max(0, (value - min) / (max - min))) * 100)}%"
                  ></span
                ></span>
              </div>
              ${rulerLabels([
                [0, edge(min)],
                [1, max === null ? '—' : edge(max)],
              ])}`
          : html`<div class="so-gauge">
              <fluvy-dial
                gauge
                style="margin-left:${inset}px"
                .radius=${radius}
                .tick=${TICK}
                .large=${true}
                .stepper=${false}
                .tone=${unusable ? 'neutral' : tone}
                .min=${min}
                .max=${max ?? min + 1}
                .fill=${value === null || max === null ? 0 : (value - min) / (max - min)}
                .value=${value ?? undefined}
                .unit=${value === null ? '' : scale.unit}
                .label=${this.innerLabel(view)}
                .text=${value === null ? '—' : undefined}
                .minLabel=${edge(min)}
                .maxLabel=${max === null ? '—' : edge(max)}
                ?disabled=${value === null}
                .format=${shown}
              ></fluvy-dial>
            </div>`
      }
      <div class="so-cols fv-cols so-cols--center" data-align="center">
        ${stats.map((stat) => readout({ ...stat, size }))}
      </div>
    </article>`;
  }
}
