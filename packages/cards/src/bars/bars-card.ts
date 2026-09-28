import {
  stateText,
  strings as words,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { barRow, head, listRow, sheetStyles, type Tone } from '@fluvy/ui';

import { html, type CSSResultGroup, type TemplateResult } from 'lit';

import type { Segment } from '../shared/fit.js';
import { HeadFit } from '../energy/head.js';

import { baseOf, figureText, scaleFor, toBase } from '../gauge/units.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import {
  boolField,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  iconToneFields,
  idsOnly,
  nameIconFields,
  textField,
  titleFields,
  toneField,
} from '../shared/form.js';
import type { RowsListSpec } from '../shared/rows-editor.js';

const strings = words('bars');

const anyNumber = (name: string): HaFormSchemaItem => ({
  name,
  selector: { number: { mode: 'box', step: 'any' } },
});

export interface BarRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Static context in front of the live secondary text ("6 panels"). */
  sub?: string;
  /** One or more entities read into the row's secondary line (a string's temperature, a plant's note). */
  sub_entity?: string | readonly string[];
  /** The bar's range, in the entity's unit. Defaults: 0–100 for a percentage, 0–largest row otherwise. */
  min?: number;
  max?: number;
  /** Below this the row turns warning and counts towards the head badge. */
  low?: number;
  /** Above this the row turns warning and counts towards the head badge. */
  high?: number;
  /** Fills the icon circle and colours the bar. Without it the circle stays neutral and the bar takes the measure's tone. */
  tone?: Tone;
  /** No bar: a plain 60 px row with its value at the right (the inverter under its strings). */
  plain?: boolean;
}

export interface BarsCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  rows?: ReadonlyArray<string | BarRowConfig>;
  /** "All good" by default. */
  badge_ok?: string;
  /** "{count} low" by default ("{count} thirsty", "{count} shaded"). */
  badge_warn?: string;
}

/** Device classes that are a share of themselves: 0 … 100, low at 20. */
const PERCENT = new Set(['battery', 'moisture', 'humidity']);

/** The tone a bar takes from what it measures, when the row does not say. */
function barToneFor(view: EntityView): Tone {
  const deviceClass = view.deviceClass;
  if (
    deviceClass === 'moisture' ||
    deviceClass === 'humidity' ||
    deviceClass === 'battery' ||
    deviceClass === 'water'
  )
    return 'water';
  if (deviceClass === 'power' || deviceClass === 'energy' || deviceClass === 'current')
    return 'solar';
  if (deviceClass === 'temperature') return 'heat';
  return 'accent';
}

const subEntities = (row: BarRowConfig): string[] =>
  row.sub_entity === undefined
    ? []
    : typeof row.sub_entity === 'string'
      ? [row.sub_entity]
      : [...row.sub_entity];

/**
 * The bar-row list: one 76 px row per entity — icon circle, name and context, the value at the right
 * and a 4 px bar under the text. Rows outside their band turn warning and are counted in the head
 * badge ("1 shaded", "2 thirsty", "All good"). Strings, plants, batteries and meters are all this card.
 */
export class FluvyBarsCard extends Card<BarsCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
  ];

  private readonly head = new HeadFit(this);

  static override lists: readonly RowsListSpec[] = [
    {
      key: 'rows',
      title: 'editor.rows',
      schema: [
        entityField(),
        nameIconFields(),
        fieldRow(toneField(), textField('sub')),
        fieldRow(anyNumber('min'), anyNumber('max')),
        fieldRow(anyNumber('low'), anyNumber('high')),
        boolField('plain'),
      ],
    },
  ];
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconToneFields(),
        entitiesField('rows', undefined, true),
        fieldRow(textField('badge_ok'), textField('badge_warn')),
      ],
      ...idsOnly('rows'),
      ...editorLabels(
        strings,
        { rows: 'rows', badge_ok: 'badge_ok', badge_warn: 'badge_warn' },
        {},
      ),
    };
  }

  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): BarsCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const levels = sensors.filter((id) =>
      PERCENT.has(hass?.states?.[id]?.attributes.device_class ?? ''),
    );
    return {
      type: 'custom:fluvy-bars-card',
      title: strings(undefined, 'levels'),
      rows: (levels.length ? levels : sensors).slice(0, 4),
    };
  }

  private rows(): BarRowConfig[] {
    return (this.config?.rows ?? []).map((row) =>
      typeof row === 'string' ? { entity: row } : row,
    );
  }

  protected override prepare(config: BarsCardConfig): BarsCardConfig {
    if (!config.rows?.length) throw new Error('fluvy-bars-card: add at least one entity to "rows"');
    return config;
  }

  override getCardSize(): number {
    return 1 + Math.ceil((this.rows().length * 76) / 50);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    return this.rows().flatMap((row) => [row.entity, ...subEntities(row)]);
  }

  /** `barRow` is a focusable button without a key handler of its own: Enter or Space on a focused row opens it. */
  private onRowsKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return; // a plain row has already answered
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('fv-row')) return;
    const index = [...(event.currentTarget as HTMLElement).children].indexOf(target);
    const id = this.rows()[index]?.entity;
    if (!id) return;
    event.preventDefault();
    this.tap(id, { action: 'more-info' });
  };

  /**
   * The secondary line: the row's own context, then what its companion entities say, then why there
   * is no value. A state that follows a "·" is lowercase; figures and the user's own words are left alone.
   * In a narrow column the context gives way from the end — the word that says why there is no value never does.
   */
  private context(row: BarRowConfig, view: EntityView, usable: boolean, room: number): string {
    const segments: Segment[] = row.sub ? [{ text: row.sub, optional: true }] : [];
    const lower = (state: string): string =>
      segments.length
        ? state.charAt(0).toLocaleLowerCase(this.hass?.language) + state.slice(1)
        : state;
    for (const id of subEntities(row)) {
      const other = this.entity(id);
      if (other.status !== 'ok') continue;
      const parts = valueParts(this.hass, other);
      // a companion's own text may carry its own segments ("41 °C · 97 % efficiency"): each can go on its own
      const texts =
        other.number !== null
          ? [parts.unit ? `${parts.value} ${parts.unit}` : parts.value]
          : lower(stateText(this.hass, other)).split(' · ');
      for (const text of texts) segments.push({ text, optional: true });
    }
    const state = usable ? '' : stateText(this.hass, view);
    if (state) segments.push({ text: lower(state) });
    const first = segments[0];
    if (first && usable) segments[0] = { text: first.text }; // the row's first word of context stays
    const line = this.head.fitRowSegments(segments, room);
    return state && line === lower(state) ? state : line; // left alone on the line, the state keeps its capital
  }

  protected renderCard(): TemplateResult {
    const rows = this.rows();
    const views = rows.map((row) => this.entity(row.entity));
    const tone: Tone = this.config?.tone ?? 'accent';

    // rows that measure the same thing are written in one unit; a bar nobody bounded is measured against the largest bar
    const setPeak = new Map<string, number>();
    const barPeak = new Map<string, number>();
    views.forEach((view, index) => {
      const quantity = baseOf(view);
      if (!quantity) return;
      const size = Math.abs(quantity.value);
      setPeak.set(quantity.unit, Math.max(setPeak.get(quantity.unit) ?? 0, size));
      if (!rows[index]?.plain)
        barPeak.set(quantity.unit, Math.max(barPeak.get(quantity.unit) ?? 0, size));
    });

    const width = this.contentWidth;
    let warnings = 0;
    const body = rows.map((row, index) => {
      const view = views[index] as EntityView;
      const usable = view.status === 'ok' || view.status === 'unknown';
      const quantity = usable ? baseOf(view) : null;
      const percent = PERCENT.has(view.deviceClass) || view.unit === '%';
      const factor = toBase(1, view.unit).value;
      const min = (row.min ?? 0) * factor;
      const max =
        row.max !== undefined
          ? row.max * factor
          : percent
            ? 100
            : (barPeak.get(quantity?.unit ?? '') ?? 0);
      const low = row.low ?? (percent ? 20 : undefined);
      const warn =
        quantity !== null &&
        ((low !== undefined && quantity.value < low * factor) ||
          (row.high !== undefined && quantity.value > row.high * factor));
      if (warn) warnings += 1;

      const scale = quantity ? scaleFor(setPeak.get(quantity.unit) ?? 0, quantity.unit) : null;
      const parts = valueParts(this.hass, view);
      // a figure in the set's unit; anything else (a percentage, a text state, "—") as Home Assistant formats it
      const value =
        quantity && scale && scale.unit !== view.unit
          ? figureText(this.hass, quantity.value, scale)
          : parts.unit
            ? `${parts.value} ${parts.unit}`
            : parts.value;
      const iconTone: Tone = !usable ? 'off' : warn ? 'warning' : (row.tone ?? 'neutral');
      const valueTone: 'warning' | '' = warn ? 'warning' : '';

      const shared = {
        icon: row.icon ?? glyphFor(view),
        tone: iconTone,
        title: row.name ?? view.name,
        sub: this.context(row, view, usable, this.head.rowRoom(width, value)),
        value,
        valueTone,
        onTap: (): void => this.tap(row.entity, { action: 'more-info' }),
      };
      return row.plain
        ? listRow({ ...shared, trailing: 'value' })
        : barRow({
            ...shared,
            barTone: warn ? 'warning' : (row.tone ?? barToneFor(view)),
            fraction: quantity === null || max <= min ? 0 : (quantity.value - min) / (max - min),
          });
    });

    const template =
      warnings > 0
        ? (this.config?.badge_warn ?? this.t('battery.low', { count: warnings }))
        : (this.config?.badge_ok ?? this.t('battery.all_good'));
    const title = this.config?.title ?? strings(this.hass, 'levels');
    const fitted = this.head.fit({
      width,
      title,
      sub: this.config?.subtitle ?? '',
      badge: {
        text: template.replace(/\{count\}/g, String(warnings)),
        tone: warnings > 0 ? 'warning' : tone,
      },
    });

    return html`<article class="fv-card so-card" data-card>
      ${head({ icon: fitted.icon ? (this.config?.icon ?? 'sliders') : null, tone, title, sub: fitted.sub, trailing: fitted.badge, name: Boolean(this.config?.title) })}
      <div class="so-rows" @keydown=${this.onRowsKey}>${body}</div>
    </article>`;
  }
}
