import {
  isUsable,
  stateText,
  strings as words,
  valueParts,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  head,
  listRow,
  options,
  readout,
  sheetStyles,
  type OptionItem,
  type Tone,
} from '@fluvy/ui';

import { html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { HeadFit } from '../energy/head.js';

import { baseOf, figure, figureText, scaleFor, type Scale } from '../gauge/units.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import {
  actionField,
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  iconField,
  idsOnly,
  nameIconFields,
  textField,
  titleFields,
  toneField,
} from '../shared/form.js';
import type { RowsListSpec } from '../shared/rows-editor.js';
import { configKeys, ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';

const strings = words('stat-tiles');

export interface StatTileConfig {
  entity: string;
  name?: string;
  icon?: string;
  tone?: Tone;
  /** Fills the tile with its tone — the one figure of the set that matters more than the rest. */
  highlight?: boolean;
}

export interface StatRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** The line under the name ("This month"). Defaults to the entity's area. */
  secondary?: string;
  tone?: Tone;
  color?: string;
  tap_action?: ActionConfig;
}

export interface StatTilesCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  /** Head badge: the entity's value, with `badge_label` in front of it ("Health 92 %"). */
  badge_entity?: string;
  badge_label?: string;
  /** Two to six figures, two per row. */
  tiles?: ReadonlyArray<string | StatTileConfig>;
  /** Plain 60 px rows under the tiles, value at the right ("CO₂ avoided · 142 kg"). */
  rows?: ReadonlyArray<string | StatRowConfig>;
}

const MAX_TILES = 6;
const PER_ROW = 2;
const TILE_HEIGHT = 84;

/** The gap that lets equal tiles land on the 4 px grid (2 × 156 + 8 = 320, 2 × 124 + 12 = 260); 8 when no gap does. */
function tileGap(width: number, count: number): number {
  for (let gap = 8; gap <= 16; gap += 4)
    if ((width - gap * (count - 1)) % (count * 4) === 0) return gap;
  return 8;
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

/**
 * A set of figures as read-only tiles: the option-tile anatomy (glyph top-left, label, value) without
 * the interaction, two per row, one of them optionally filled with its tone. An optional big readout
 * sits above them, optional plain rows below.
 */
export class FluvyStatTilesCard extends Card<StatTilesCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
  ];

  private readonly head = new HeadFit(this);

  static override keys = configKeys<StatTilesCardConfig>()([
    'title',
    'subtitle',
    'badge_entity',
    'badge_label',
    'tiles',
    'rows',
  ]);
  static override lists: readonly RowsListSpec[] = [
    {
      key: 'tiles',
      title: 'editor.tiles',
      keys: ['entity', 'name', 'icon', 'tone', 'highlight'],
      schema: [entityField(), nameIconFields(), fieldRow(toneField(), boolField('highlight'))],
    },
    {
      key: 'rows',
      title: 'editor.rows',
      keys: ['entity', 'name', 'icon', 'secondary', 'tone', 'color', 'tap_action'],
      schema: [
        entityField(),
        nameIconFields(),
        textField('secondary'),
        colourFields(),
        actionField(),
      ],
    },
  ];
  static override aliases: AliasSpec = { items: { rows: ITEM_ALIASES, tiles: ITEM_ALIASES } };
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconField(),
        colourFields(),
        entitiesField('tiles', undefined, true),
        fieldRow(entityField(undefined, 'entity', false), textField('name')),
        fieldRow({ name: 'badge_entity', selector: { entity: {} } }, textField('badge_label')),
        entitiesField('rows'),
        actionFields(),
      ],
      ...idsOnly('tiles', 'rows'),
      ...editorLabels(
        strings,
        { tiles: 'tiles', rows: 'rows', badge_entity: 'badge_entity', badge_label: 'badge_label' },
        {},
      ),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): StatTilesCardConfig {
    return {
      type: 'custom:fluvy-stat-tiles-card',
      title: strings(undefined, 'stats'),
      tiles: entities.filter((id) => id.startsWith('sensor.')).slice(0, 4),
    };
  }

  private tiles(): StatTileConfig[] {
    return (this.config?.tiles ?? [])
      .slice(0, MAX_TILES)
      .map((tile) => (typeof tile === 'string' ? { entity: tile } : tile));
  }

  private rows(): StatRowConfig[] {
    return (this.config?.rows ?? []).map((row) =>
      typeof row === 'string' ? { entity: row } : row,
    );
  }

  protected override prepare(config: StatTilesCardConfig): StatTilesCardConfig {
    if (!config.tiles?.length)
      throw new Error('fluvy-stat-tiles-card: add at least one entity to "tiles"');
    return config;
  }

  override getCardSize(): number {
    return (
      2 +
      (this.config?.entity ? 2 : 0) +
      Math.ceil(this.tiles().length / PER_ROW) * 2 +
      this.rows().length
    );
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    return [
      ...this.tiles().map((tile) => tile.entity),
      ...this.rows().map((row) => row.entity),
      this.config?.entity ?? '',
      this.config?.badge_entity ?? '',
    ].filter(Boolean);
  }

  /** Tiles that measure the same thing share one unit, so the set reads as one figure (3.2 kW · 0.25 kW · 1.1 kW). */
  private scales(views: readonly EntityView[]): Map<string, Scale> {
    const peaks = new Map<string, number>();
    for (const view of views) {
      const quantity = baseOf(view);
      if (quantity)
        peaks.set(quantity.unit, Math.max(peaks.get(quantity.unit) ?? 0, Math.abs(quantity.value)));
    }
    return new Map([...peaks].map(([unit, peak]) => [unit, scaleFor(peak, unit)]));
  }

  /** "3.2 kW": a scaled figure for power and energy, Home Assistant's own formatting (precision included) for the rest. */
  private text(view: EntityView, scales?: Map<string, Scale>): string {
    const quantity = view.status === 'ok' ? baseOf(view) : null;
    const scale = quantity
      ? (scales?.get(quantity.unit) ?? scaleFor(quantity.value, quantity.unit))
      : null;
    if (quantity && scale && scale.unit !== view.unit)
      return figureText(this.hass, quantity.value, scale);
    const parts = valueParts(this.hass, view);
    return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
  }

  protected renderCard(): TemplateResult {
    const tiles = this.tiles();
    const views = tiles.map((tile) => this.entity(tile.entity));
    const lead = this.config?.entity ? this.entity(this.config.entity) : null;
    const tone: Tone = toneOf(this.config, 'accent');
    const gone = (view: EntityView): boolean => !isUsable(view);
    const unusable = views.every(gone) && (!lead || gone(lead));
    const headTone: Tone = unusable ? 'off' : tone;

    const badgeView = this.config?.badge_entity ? this.entity(this.config.badge_entity) : null;
    const badgeText = badgeView
      ? [this.config?.badge_label, this.text(badgeView)].filter(Boolean).join(' ')
      : '';

    const scales = this.scales(views);
    const items = tiles.map((tile, index): OptionItem => {
      const view = views[index] as EntityView;
      return {
        key: tile.entity,
        label: tile.name ?? view.name,
        value: this.text(view, scales),
        glyph: tile.icon ?? glyphFor(view),
        tone: tile.tone ?? tone,
        active: !gone(view) && (tile.highlight ?? false),
      };
    });

    const leadBase = lead && lead.status === 'ok' ? baseOf(lead) : null;
    const leadScale = leadBase ? scaleFor(leadBase.value, leadBase.unit) : null;
    const leadParts =
      leadBase && leadScale && leadScale.unit !== lead?.unit
        ? { value: figure(this.hass, leadBase.value, leadScale), unit: leadScale.unit }
        : lead
          ? valueParts(this.hass, lead)
          : null;

    const width = this.contentWidth;
    const gap = tileGap(width, PER_ROW);
    const rows = this.rows();
    const title = this.config?.title ?? lead?.name ?? strings(this.hass, 'stats');
    const fitted = this.head.fit({
      width,
      title,
      sub: this.config?.subtitle ?? lead?.areaName ?? '',
      badge: badgeText ? { text: badgeText, tone: headTone } : null,
    });

    return html`<article
      class="fv-card so-card ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
    >
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? (lead ? glyphFor(lead) : 'grid')) : null,
        tone: headTone,
        title,
        sub: fitted.sub,
        trailing: fitted.badge,
        ...(lead
          ? {
              onIconTap: (): void => this.tap(lead.id),
              onHold: (): void => this.hold(lead.id),
              iconLabel: lead.name,
            }
          : {}),
        name: Boolean(this.config?.title),
      })}
      ${lead && leadParts ? html`<div class="so-top fv-value-row">${readout({ label: this.config?.name ?? lead.name, value: leadParts.value, unit: leadParts.unit, size: 'l' })}</div>` : nothing}
      <div class="so-tiles" style="gap:${gap}px">
        ${chunk(items, PER_ROW).map((row) => options(row, null, gap, TILE_HEIGHT, row.length))}
      </div>
      ${
        rows.length
          ? html`<div class="so-rows">
              ${rows.map((row) => {
                const view = this.entity(row.entity);
                const usable = isUsable(view);
                const value = this.text(view);
                return listRow({
                  icon: row.icon ?? glyphFor(view),
                  tone: usable ? toneOf(row, 'neutral') : 'off',
                  accent: this.accents.item(row.color),
                  title: row.name ?? view.name,
                  name: true,
                  sub: this.head.fitRowSub(
                    usable ? (row.secondary ?? view.areaName) : stateText(this.hass, view),
                    this.head.rowRoom(width, value),
                  ),
                  trailing: 'value',
                  value,
                  unavailable: !usable,
                  onTap: () => this.tap(view.id, row.tap_action),
                });
              })}
            </div>`
          : nothing
      }
    </article>`;
  }
}
