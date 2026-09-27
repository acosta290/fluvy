import {
  stateText,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { head, sheetStyles, type Tone } from '@fluvy/ui';

import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';

import { repeat } from 'lit/directives/repeat.js';

import { HeadFit } from '../energy/head.js';

import { rowsEditor } from '../shared/rows-editor.js';

import { baseOf, figureText, scaleFor } from '../gauge/units.js';

import { Card } from '../shared/base.js';

import {
  editorLabels,
  entityField,
  fieldRow,
  iconToneFields,
  idsOnly,
  numberField,
  textField,
  titleFields,
  toneField,
} from '../shared/form.js';

import { strings } from './strings.js';

export interface DistributionEntityConfig {
  entity: string;
  name?: string;
  tone?: Tone;
}

/** `entities` holds the power sensors: ids, or `{ entity, name, tone }` objects where YAML wants a name or a tone per segment. */
export interface DistributionCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  /** Rows the legend shows; when there are more, the smallest are summed into one neutral "Other". */
  max_rows?: number;
}

interface Part {
  readonly key: string;
  readonly label: string;
  /** Base-unit value; null when the entity has no usable number. */
  readonly value: number | null;
  readonly tone: Tone;
}

const isSource = (row: unknown): row is DistributionEntityConfig =>
  typeof row === 'object' &&
  row !== null &&
  typeof (row as { entity?: unknown }).entity === 'string';

/** The order segments take their tone in when the config does not name one. */
const CYCLE: readonly Tone[] = ['heat', 'accent', 'media', 'water', 'grid'];
/** A segment thinner than this share of the bar would be a sliver between two gaps: the legend still lists it. */
const SLIVER = 0.005;

/**
 * What is drawing right now as one stacked bar and its legend: a segment per entity in the order
 * they are configured, the smallest gathered into "Other" when there are too many. Every figure is
 * set in the same unit, so the legend reads as one column.
 */
export class FluvyDistributionCard extends Card<DistributionCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
    css`
      /* nothing is drawing: the bar stays as a quiet empty track instead of vanishing */
      .so-empty {
        background: var(--fluvy-page-alt);
      }
      /* a long name gives way, the value never does */
      .fv-legend__name {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fv-legend__value {
        flex: 0 0 auto;
        white-space: nowrap;
      }
    `,
  ];

  private readonly head = new HeadFit(this);

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconToneFields(),
        {
          name: 'entities',
          required: true,
          selector: { entity: { multiple: true, domain: ['sensor'] } },
        },
        numberField('max_rows', 2, 10),
      ],
      ...idsOnly('entities'),
      ...editorLabels(strings, { max_rows: 'max_rows' }, {}),
    };
  }

  /** The visual editor: the card's fields, then one form per segment (entity, name, tone). */
  static getConfigElement(): HTMLElement {
    const labels = editorLabels(strings, { max_rows: 'max_rows' }, {});
    return rowsEditor({
      schema: [titleFields(), iconToneFields(), numberField('max_rows', 2, 10)],
      lists: [
        {
          key: 'entities',
          title: 'editor.entities',
          domains: ['sensor'],
          schema: [entityField(['sensor']), fieldRow(textField('name'), toneField())],
        },
      ],
      computeLabel: labels.computeLabel,
    });
  }

  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): DistributionCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const power = sensors.filter((id) => hass?.states?.[id]?.attributes.device_class === 'power');
    return {
      type: 'custom:fluvy-distribution-card',
      entities: (power.length ? power : sensors).slice(0, 4),
    };
  }

  private sources(): DistributionEntityConfig[] {
    const raw: readonly unknown[] = this.config?.entities ?? [];
    return raw.flatMap((row): DistributionEntityConfig[] =>
      typeof row === 'string' ? [{ entity: row }] : isSource(row) ? [row] : [],
    );
  }

  private get limit(): number {
    const rows = this.config?.max_rows;
    return typeof rows === 'number' && rows >= 2 ? Math.floor(rows) : 5;
  }

  protected override prepare(config: DistributionCardConfig): DistributionCardConfig {
    if (!Array.isArray(config.entities) || config.entities.length === 0)
      throw new Error('fluvy-distribution-card: add at least one entity to "entities"');
    return config;
  }

  override getCardSize(): number {
    return 2 + Math.min(this.sources().length, this.limit);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    return this.sources().map((row) => row.entity);
  }

  /** The legend's rows: everything when it fits, otherwise the largest in their configured order and one "Other". */
  private parts(
    sources: readonly DistributionEntityConfig[],
    views: readonly EntityView[],
    unit: string,
  ): Part[] {
    const values = views.map((view) => {
      const quantity = view.status === 'ok' ? baseOf(view) : null;
      return quantity && quantity.unit === unit ? Math.max(0, quantity.value) : null;
    });
    const limit = this.limit;
    const kept = new Set(
      sources.length > limit
        ? values
            .map((value, index) => ({ value: value ?? -1, index }))
            .sort((a, b) => b.value - a.value || a.index - b.index)
            .slice(0, limit - 1)
            .map((entry) => entry.index)
        : values.keys(),
    );

    const parts: Part[] = [];
    let cursor = 0;
    sources.forEach((source, index) => {
      if (!kept.has(index)) return;
      const next = sources
        .slice(index + 1)
        .find((_later, offset) => kept.has(index + 1 + offset))?.tone;
      let tone = source.tone;
      while (!tone) {
        // never two equal neighbours, whatever the config pinned on either side
        const candidate = CYCLE[cursor++ % CYCLE.length] as Tone;
        if (candidate !== parts[parts.length - 1]?.tone && candidate !== next) tone = candidate;
      }
      parts.push({
        key: source.entity,
        label: source.name ?? (views[index] as EntityView).name,
        value: values[index] ?? null,
        tone,
      });
    });
    if (kept.size < sources.length) {
      const rest = values.filter((_value, index) => !kept.has(index));
      parts.push({
        key: '__other',
        label: strings(this.hass, 'other'),
        value: rest.some((value) => value !== null)
          ? rest.reduce<number>((total, value) => total + (value ?? 0), 0)
          : null,
        tone: 'neutral',
      });
    }
    return parts;
  }

  protected renderCard(): TemplateResult {
    const sources = this.sources();
    const views = sources.map((row) => this.entity(row.entity));
    const unit = views
      .map((view) => (view.status === 'ok' ? baseOf(view)?.unit : undefined))
      .find((found) => found !== undefined);
    const dead = unit === undefined;
    const tone: Tone = dead ? 'off' : (this.config?.tone ?? 'accent');

    const parts = this.parts(sources, views, unit ?? '');
    const total = parts.reduce((count, part) => count + (part.value ?? 0), 0);
    const scale = scaleFor(total, unit ?? '');
    const text = (value: number | null): string =>
      value === null ? '—' : figureText(this.hass, value, scale);
    const segments = parts.filter(
      (part) => part.value !== null && total > 0 && part.value / total >= SLIVER,
    );
    const title = this.config?.title ?? strings(this.hass, 'distribution');
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      sub: this.config?.subtitle ?? this.t('energy.drawing_now'),
      badge: { text: dead ? stateText(this.hass, views[0] as EntityView) : text(total), tone },
    });

    return html`<article class="fv-card so-card ${dead ? 'is-unavailable is-off' : ''}" data-card>
      ${head({ icon: this.config?.icon ?? 'plug', tone, title, sub: fitted.sub, trailing: fitted.badge })}
      <div class="fv-stack ${segments.length ? '' : 'so-empty'}">
        ${repeat(
          segments,
          (part) => part.key,
          (part) =>
            html`<span
              class="fv-stack__seg fv-bar--${part.tone}"
              data-measure="value"
              style="width:${(((part.value ?? 0) / total) * 100).toFixed(2)}%"
            ></span>`,
        )}
      </div>
      <div class="fv-legend">
        ${repeat(
          parts,
          (part) => part.key,
          (part) =>
            html`<div class="fv-legend__row">
              <i class="fv-swatch fv-bar--${part.tone}"></i
              ><span class="fv-legend__name">${part.label}</span
              ><span class="fv-legend__value">${text(part.value)}</span>
            </div>`,
        )}
      </div>
    </article>`;
  }
}
