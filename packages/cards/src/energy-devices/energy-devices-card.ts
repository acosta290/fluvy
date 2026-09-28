import {
  stateText,
  strings,
  valueParts,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { barRow, head, listRow, sheetStyles, type Tone } from '@fluvy/ui';

import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';

import { repeat } from 'lit/directives/repeat.js';

import { Card, type BaseKey } from '../shared/base.js';

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
  formLabels,
  iconField,
  nameIconFields,
  numberField,
  titleFields,
} from '../shared/form.js';

import { HeadFit } from '../energy/head.js';

import {
  baseValue,
  costParts,
  family,
  scaled,
  scaleOf,
  share,
  type Family,
} from '../energy/power.js';
import type { RowsListSpec } from '../shared/rows-editor.js';
import { configKeys, ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';
import { HEAD, listLength, ROW_BAR } from '../shared/heights.js';

const s = strings('energy-devices');

export interface DeviceRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** A monetary sensor for this device, quoted after its share on the row's second line. */
  cost_entity?: string;
  tone?: Tone;
  color?: string;
  tap_action?: ActionConfig;
}

export interface EnergyDevicesCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  rows?: ReadonlyArray<string | DeviceRowConfig>;
  /** `false` keeps the configured order; by default the biggest consumer leads. */
  sort?: boolean;
  /** Rows shown at most (the biggest, when sorted). */
  max_rows?: number;
}

interface DeviceRow {
  readonly key: string;
  readonly config: DeviceRowConfig;
  readonly view: EntityView;
  /** Base-unit value (W or Wh) when the row belongs to the card's family and is usable; `null` otherwise. */
  readonly value: number | null;
}

/** The bar colours the language defines; any other tone draws its bar in the accent. */
const BAR_TONES: ReadonlySet<Tone> = new Set<Tone>([
  'accent',
  'solar',
  'water',
  'grid',
  'heat',
  'media',
  'warning',
  'neutral',
  'cool',
]);

/**
 * Where the energy went: one 76 px bar row per appliance — icon circle, name, its share of the total
 * (and its cost, when there is a sensor for it), a 4 px bar normalised to the biggest consumer, and
 * the figure on the right. The head badge carries the total, so the card answers "how much" before
 * "what". Rows may mix units (Wh, kWh, MWh — or W and kW): they are compared in one base unit and
 * written in one display unit. A sensor of another kind (a water meter among energy meters) is a
 * plain 60 px row with its own figure: it has no share of the total and draws no bar.
 */
export class FluvyEnergyDevicesCard extends Card<EnergyDevicesCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: EnergyDevicesCardConfig): number {
    return HEAD + ROW_BAR * listLength(config, ['rows', 'entities']);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.energy,
    css`
      .ef-card {
        width: 100%;
      } /* the sheet fixes 360; a card takes the column it is given */
    `,
  ];

  private readonly head = new HeadFit(this);

  /** A list of many sensors has no entity of its own: its head's icon, tone and colour, and its actions on the head. */
  static override base: readonly BaseKey[] = [
    'entities',
    'icon',
    'tone',
    'color',
    'tap_action',
    'hold_action',
  ];
  static override keys = configKeys<EnergyDevicesCardConfig>()([
    'title',
    'subtitle',
    'rows',
    'sort',
    'max_rows',
  ]);
  static override lists: readonly RowsListSpec[] = [
    {
      key: 'rows',
      alias: 'entities',
      title: 'editor.rows',
      domains: ['sensor'],
      keys: ['entity', 'name', 'icon', 'cost_entity', 'tone', 'color', 'tap_action'],
      schema: [
        entityField(['sensor']),
        nameIconFields(),
        colourFields(),
        fieldRow(entityField(['sensor'], 'cost_entity', false), actionField()),
      ],
      computeLabel: formLabels({ cost_entity: 'energy.cost' }).computeLabel,
    },
  ];
  static override aliases: AliasSpec = { items: { rows: ITEM_ALIASES } };
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconField(),
        colourFields(),
        entitiesField('entities', ['sensor'], true),
        fieldRow(boolField('sort'), numberField('max_rows', 1, 20)),
        actionFields(),
      ],
      ...editorLabels(s, { sort: 'editor_sort' }, { max_rows: 'editor.max_rows' }),
    };
  }

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): EnergyDevicesCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const energy = sensors.filter((id) => hass?.states[id]?.attributes.device_class === 'energy');
    return {
      type: 'custom:fluvy-energy-devices-card',
      entities: (energy.length ? energy : sensors).slice(0, 4),
    };
  }

  protected override prepare(config: EnergyDevicesCardConfig): EnergyDevicesCardConfig {
    if (!config.rows?.length && !config.entities?.length)
      throw new Error('fluvy-energy-devices-card: add at least one sensor');
    return config;
  }

  override getCardSize(): number {
    return 1 + Math.ceil((this.configured().length * 76) / 50);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private configured(): DeviceRowConfig[] {
    const source = this.config?.rows ?? this.config?.entities ?? [];
    return source.map((row) => (typeof row === 'string' ? { entity: row } : row));
  }

  protected override watched(): readonly string[] {
    return this.configured().flatMap((row) =>
      row.cost_entity ? [row.entity, row.cost_entity] : [row.entity],
    );
  }

  /** The card is either "energy today" or "power now": the first sensor that says which decides for all. */
  private kind(views: readonly EntityView[]): Family {
    return views.map(family).find((kind) => kind !== null) ?? 'energy';
  }

  private rows(kind: Family): DeviceRow[] {
    const rows: DeviceRow[] = this.configured().map((config, index) => {
      const view = this.entity(config.entity);
      return {
        key: `${config.entity}#${index}`,
        config,
        view,
        value: family(view) === kind ? baseValue(view) : null,
      };
    });
    const shown =
      this.config?.sort === false
        ? rows
        : rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)); // unusable rows sink, in their configured order
    const limit = this.config?.max_rows;
    return typeof limit === 'number' && limit >= 1 ? shown.slice(0, Math.round(limit)) : shown;
  }

  /** Second line: the state when there is no figure, otherwise the share of the total and what it cost. */
  private secondary(row: DeviceRow, total: number): string {
    if (row.view.status !== 'ok') return stateText(this.hass, row.view);
    if (row.value === null) return row.view.areaName;
    const cost = row.config.cost_entity
      ? costParts(this.hass, this.entity(row.config.cost_entity))
      : null;
    const money =
      cost && cost.value !== '—' ? [cost.value, cost.unit].filter(Boolean).join(' ') : '';
    if (total <= 0) return money;
    const percent = Math.round(share(row.value, total) * 100);
    return money ? `${percent} % · ${money}` : s(this.hass, 'share_of_total', { percent });
  }

  protected renderCard(): TemplateResult {
    const kind = this.kind(this.configured().map((row) => this.entity(row.entity)));
    const rows = this.rows(kind);
    const values = rows.flatMap((row) => (row.value === null ? [] : [Math.max(0, row.value)]));
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(0, ...values);
    const scale = scaleOf([...values, total], kind === 'power' ? 'W' : 'Wh');
    const tone: Tone = toneOf(this.config, 'accent');
    const none = values.length === 0;
    const first = rows[0]?.view;
    const width = this.contentWidth;
    const title = this.config?.title ?? s(this.hass, 'title');
    const fitted = this.head.fit({
      width,
      title,
      sub:
        none && first
          ? stateText(this.hass, first)
          : (this.config?.subtitle ??
            this.t(kind === 'power' ? 'energy.drawing_now' : 'common.today')),
      badge: none ? null : { text: `${scaled(this.hass, total, scale)} ${scale.unit}`, tone },
    });

    return html`<article class="fv-card ef-card ${none ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'plug') : null,
        tone: none ? 'off' : tone,
        title,
        sub: fitted.sub,
        trailing: fitted.badge,
        name: Boolean(this.config?.title),
        onIconTap: () => this.tap(),
        onHold: () => this.hold(),
      })}
      <div class="ef-rows">
        ${repeat(
          rows,
          (row) => row.key,
          (row) => {
            const rowTone = toneOf(row.config, tone);
            const usable = row.view.status === 'ok';
            const shared = {
              icon: row.config.icon ?? glyphFor(row.view),
              title: row.config.name ?? row.view.name,
              name: true,
              accent: this.accents.item(row.config.color),
              onTap: (): void => this.tap(row.view.id, row.config.tap_action),
            };
            if (row.value === null && usable) {
              // a sensor of another family: its own figure, no share, no bar
              const own = valueParts(this.hass, row.view);
              const value = [own.value, own.unit].filter(Boolean).join(' ');
              return listRow({
                ...shared,
                tone: 'neutral',
                sub: this.head.fitRowSub(row.view.areaName, this.head.rowRoom(width, value)),
                trailing: 'value',
                value,
              });
            }
            const value =
              row.value === null ? '—' : `${scaled(this.hass, row.value, scale)} ${scale.unit}`;
            return barRow({
              ...shared,
              tone: !usable ? 'off' : row.value !== null && row.value > 0 ? rowTone : 'neutral',
              sub: this.head.fitRowSub(this.secondary(row, total), this.head.rowRoom(width, value)),
              value,
              fraction: row.value === null ? 0 : share(row.value, peak),
              barTone: BAR_TONES.has(rowTone) ? rowTone : 'accent',
            });
          },
        )}
      </div>
    </article>`;
  }
}
