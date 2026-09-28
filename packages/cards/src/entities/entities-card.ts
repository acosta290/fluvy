import {
  isActive,
  relativeTime,
  stateText,
  TOGGLE_DOMAINS,
  toggleEntity,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { badge, head, listRow, type Tone } from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card } from '../shared/base.js';

import { currentTone, glyphFor, toneFor } from '../shared/domain.js';

import {
  entitiesField,
  entityField,
  formLabels,
  iconToneFields,
  nameIconFields,
  selectField,
  titleFields,
} from '../shared/form.js';
import type { RowsListSpec } from '../shared/rows-editor.js';

export interface EntityRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  secondary?: 'area' | 'last-changed' | 'state' | 'none';
}

export interface EntitiesCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  rows?: ReadonlyArray<string | EntityRowConfig>;
  /** Show "3 on" / "All off" in the head. */
  show_count?: boolean;
}

/**
 * A card of 60 px rows: icon circle, title / sub, and ONE trailing element chosen by the entity —
 * a switch for what can be toggled, the value for what is measured, a chevron for the rest.
 * State is said once: the trailing element carries it, the sub line carries context (area or time).
 */
export class FluvyEntitiesCard extends Card<EntitiesCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    css`
      .fv-rows {
        margin-top: 8px;
      }
      .fv-rows--bare {
        margin-top: -8px;
        margin-bottom: -8px;
      }
    `,
  ];

  static override lists: readonly RowsListSpec[] = [
    {
      key: 'rows',
      alias: 'entities',
      title: 'editor.rows',
      schema: [
        entityField(),
        nameIconFields(),
        selectField('secondary', ['area', 'last-changed', 'state', 'none']),
      ],
    },
  ];
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconToneFields(),
        entitiesField('entities', undefined, true),
        { name: 'show_count', selector: { boolean: {} } },
      ],
      ...formLabels({
        show_count: 'editor.show_count',
      }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): EntitiesCardConfig {
    return { type: 'custom:fluvy-entities-card', title: 'Devices', entities: entities.slice(0, 4) };
  }

  private rows(): EntityRowConfig[] {
    const source = this.config?.rows ?? this.config?.entities ?? [];
    return source.map((row) => (typeof row === 'string' ? { entity: row } : row));
  }

  protected override prepare(config: EntitiesCardConfig): EntitiesCardConfig {
    if (!config.rows?.length && !config.entities?.length)
      throw new Error('fluvy-entities-card: add at least one entity');
    return config;
  }

  protected override watched(): readonly string[] {
    return this.rows().map((r) => r.entity);
  }

  override getCardSize(): number {
    return 1 + this.rows().length;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private secondary(view: EntityView, row: EntityRowConfig, trailing: string): string {
    const mode = row.secondary ?? (view.areaName ? 'area' : 'last-changed');
    if (mode === 'none') return '';
    if (view.status !== 'ok') return stateText(this.hass, view);
    if (mode === 'state' && trailing !== 'value') return stateText(this.hass, view);
    if (mode === 'area' && view.areaName) return view.areaName;
    return view.stateObj ? relativeTime(this.hass, new Date(view.stateObj.last_changed)) : '';
  }

  protected renderCard(): TemplateResult {
    const rows = this.rows();
    const views = rows.map((row) => this.entity(row.entity));
    const active = views.filter((v) => isActive(v)).length;
    const tone = this.config?.tone ?? 'accent';
    const header = this.config?.title
      ? head({
          icon: this.config.icon ?? 'grid',
          tone,
          title: this.config.title,
          sub: this.config.subtitle ?? '',
          trailing: this.config.show_count
            ? badge(
                active > 0
                  ? `${active} ${this.t('common.on').toLowerCase()}`
                  : this.t('common.off'),
                active > 0 ? tone : 'neutral',
              )
            : nothing,
        })
      : nothing;

    return html`<article class="fv-card" data-card>
      ${header}
      <div class="fv-rows ${this.config?.title ? '' : 'fv-rows--bare'}">
        ${rows.map((row, i) => {
          const view = views[i] as EntityView;
          const usable = view.status === 'ok' || view.status === 'unknown';
          // a row switch is for what is safe to flip by accident: never a lock, and not the things that are not on/off
          const canToggle =
            usable &&
            TOGGLE_DOMAINS.has(view.domain) &&
            ![
              'scene',
              'script',
              'button',
              'input_button',
              'lock',
              'vacuum',
              'media_player',
            ].includes(view.domain);
          const measured = view.domain === 'sensor' || view.number !== null;
          const trailing = canToggle
            ? 'switch'
            : usable &&
                (measured ||
                  view.domain === 'binary_sensor' ||
                  view.domain === 'person' ||
                  view.domain === 'sun' ||
                  view.domain === 'weather' ||
                  view.domain === 'input_select' ||
                  view.domain === 'select' ||
                  view.domain === 'lock' ||
                  view.domain === 'vacuum' ||
                  view.domain === 'media_player')
              ? 'value'
              : 'chevron';
          const state = this.stateOf(view);
          const on =
            state === view.state ? isActive(view) : !['off', 'closed', 'locked'].includes(state);
          const parts = valueParts(this.hass, view);
          const warn = view.domain === 'binary_sensor' && on && toneFor(view) === 'warning';
          return listRow({
            icon: row.icon ?? glyphFor(view),
            tone: currentTone(view, on ? toneFor(view) : 'neutral'),
            title: row.name ?? view.name,
            sub: this.secondary(view, row, trailing),
            trailing,
            on,
            switchTone: toneFor(view) === 'warning' ? 'accent' : toneFor(view),
            value:
              trailing === 'value'
                ? view.number !== null
                  ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`
                  : stateText(this.hass, view)
                : '',
            valueTone: warn ? 'warning' : '',
            unavailable: !usable,
            onTap: () => this.tap(view.id, { action: 'more-info' }),
            onToggle: (next) => {
              if (!this.hass) return;
              this.expect(
                view.id,
                next
                  ? view.domain === 'cover' || view.domain === 'valve'
                    ? 'open'
                    : view.domain === 'lock'
                      ? 'unlocked'
                      : 'on'
                  : view.domain === 'cover' || view.domain === 'valve'
                    ? 'closed'
                    : view.domain === 'lock'
                      ? 'locked'
                      : 'off',
              );
              void toggleEntity(this.hass, view.id);
            },
          });
        })}
      </div>
    </article>`;
  }
}
