import {
  isUsable,
  stateText,
  strings as words,
  valueParts,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { barRow, head, listRow, sheetStyles, type Tone } from '@fluvy/ui';

import { html, type CSSResultGroup, type TemplateResult } from 'lit';

import type { Segment } from '../shared/fit.js';
import { HeadFit } from '../energy/head.js';
import { softIn, type ChartKeys } from '../shared/chart-config.js';

import { baseOf, figureText, scaleFor, toBase } from '../gauge/units.js';

import { Card, type CardEditor } from '../shared/base.js';
import type { Own } from '../shared/own-values.js';

import { iconOf, stateWord } from '../shared/domain.js';
import { ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';
import { EMPTY, HEAD, ROW, ROW_BAR, ROW_COMPACT, sectionsHeight } from '../shared/heights.js';
import {
  conditionIds,
  drawnOf,
  emptyPanel,
  isRow,
  itemsOf,
  listOf,
  withSections,
  type ConditionalRows,
  type EmptyList,
  type RowWhen,
  type SectionEntry,
} from '../shared/lists.js';
import { PENDING_LINE } from '../shared/templates.js';

const strings = words('bars');

export type BarsVariant = 'full' | 'compact';

export interface BarRowConfig {
  entity: string;
  name?: EntityName;
  icon?: string;
  /** The row's own context in front of what its companions say ("6 panels"), or a template rendered live. */
  secondary?: string;
  /** One or more entities read into the row's secondary line (a string's temperature, a plant's note). */
  sub_entity?: string | readonly string[];
  /**
   * The bar's range, in the entity's unit. Defaults: 0–100 for a percentage, 0–largest row otherwise. This and the
   * limits below are each a figure, an entity whose reading it is (another unit of its family converted), or a template
   * whose answer it is, the row's entity its `entity` (#253); one that says nothing is its default.
   */
  min?: Limit;
  max?: Limit;
  /**
   * Below this the row turns warning and counts towards the head badge. Default: 20 for a battery and a soil's moisture
   * (what runs low and wants a hand), none for any other reading.
   */
  low?: Limit;
  /** Above this the row turns warning and counts towards the head badge. */
  high?: Limit;
  /** Fills the icon circle and colours the bar. Without it the circle stays neutral and the bar takes the measure's tone. */
  tone?: Tone;
  /** No bar: a plain 60 px row with its value at the right (the inverter under its strings). */
  plain?: boolean;
  /** The row's own colour: its circle and its bar, in the palette's family. */
  color?: string;
  /**
   * Shown while it holds (a battery only below a number, #157; `always`: whatever the card's says); the card's
   * `show_rows_when` where it names none.
   */
  show_when?: RowWhen;
  /** What the row answers: its entity's details where none is said, never the card's; a double tap none (#179). */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/**
 * `chart`: the bars classic (1.10's) or soft (their ink deepening along them); none: the house's. `show_rows_when`:
 * one condition for every row that names none.
 */
export interface BarsCardConfig
  extends FluvyCardConfig, EmptyList, ConditionalRows, Pick<ChartKeys, 'chart'> {
  title?: string;
  subtitle?: string;
  /** The entities, with a section's label or a hairline between them where the list is in parts (`SectionEntry`). */
  rows?: ReadonlyArray<string | BarRowConfig | SectionEntry>;
  /**
   * `full` (default): 76 px rows with the context under the name (60 for a plain one). `compact`: 48 px rows, the
   * name and the value on one line and the bar under them.
   */
  variant?: BarsVariant;
  /**
   * The head's badge in place of the two below (#253): words of the person's own, an entity's state or a template, the
   * card's own words where it says nothing (an empty answer, a template that failed); `{count}` is how many rows warn.
   */
  badge?: string;
  /** "All good" by default; words, an entity's state or a template, as `badge`. */
  badge_ok?: string;
  /** "{count} low" by default ("{count} thirsty", "{count} shaded"); words, an entity's state or a template. */
  badge_warn?: string;
}

/** A bar's bound or limit as a config writes it: a figure, an entity, a template (`BarRowConfig.min`). */
type Limit = number | string;

/** A row's range and its limits as read now (`ownFigure`). */
interface Limits {
  readonly min: Own<number>;
  readonly max: Own<number>;
  readonly low: Own<number>;
  readonly high: Own<number>;
}

/** Device classes that are a share of themselves: 0 … 100. */
const PERCENT = new Set(['battery', 'moisture', 'humidity']);
/**
 * Those that run low and want a hand (a battery to charge, a plant's soil to water): low at 20 (#94). A room's humidity,
 * a processor's use or a disk's are shares that warn only under a `low` of their own.
 */
const RUNS_LOW = new Set(['battery', 'moisture']);

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

/** A row's height: a bar row 76 and a plain one 60; every compact row 48. */
const rowHeight = (row: BarRowConfig, compact: boolean): number =>
  compact ? ROW_COMPACT : row.plain ? ROW : ROW_BAR;

/**
 * The bar-row list: one 76 px row per entity — icon circle, name and context, the value at the right
 * and a 4 px bar under the text — or, compact, 48 px rows with the name and the value on one line over
 * the bar. Rows outside their band turn warning and are counted in the head badge ("1 shaded",
 * "2 thirsty", "All good"); a band's ends may come from the house, an entity's reading or a template's answer, as the
 * badge's words may (#253). Strings, plants, batteries and meters are all this card. A list in parts carries a
 * section's label or a hairline between its rows, and a row may show only while a condition holds (#157): the badge
 * counts the rows that show, and with none showing the card is its empty panel.
 */
export class FluvyBarsCard extends Card<BarsCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: BarsCardConfig): number {
    const compact = config.variant === 'compact';
    // auto-entities hands its rows over as `entities` (read as `rows` once the card has them)
    const list = config.rows ?? config.entities;
    const rows = itemsOf<BarRowConfig>(list);
    if (!rows.length) return HEAD + EMPTY;
    // every row counted, whatever its condition says now, and the sections between them
    return rows.reduce(
      (height, row) => height + rowHeight(row, compact),
      HEAD + sectionsHeight(list),
    );
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
  ];

  private readonly head = new HeadFit(this);

  static override editor(): Promise<CardEditor> {
    return import('./bars-editor.js');
  }
  static override aliases: AliasSpec = {
    keys: [{ from: 'entities', to: 'rows' }],
    items: { rows: ITEM_ALIASES },
  };

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): BarsCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const levels = sensors.filter((id) =>
      PERCENT.has(hass?.states?.[id]?.attributes.device_class ?? ''),
    );
    return {
      type: 'custom:fluvy-bars-card',
      title: strings(hass, 'levels'),
      rows: (levels.length ? levels : sensors).slice(0, 4),
    };
  }

  private rows(): BarRowConfig[] {
    return itemsOf(this.config?.rows);
  }

  private compact(): boolean {
    return this.config?.variant === 'compact';
  }

  protected override prepare(config: BarsCardConfig): BarsCardConfig {
    listOf(config, 'rows');
    return config;
  }

  override getCardSize(): number {
    return Math.ceil((this.config ? FluvyBarsCard.layoutHeight(this.config) : HEAD) / 50);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** The rows' entities, their companions', and what their conditions read. */
  protected override watched(): readonly string[] {
    const rows = this.rows();
    return [
      ...rows.flatMap((row) => [row.entity, ...subEntities(row)]),
      ...conditionIds(rows, this.config?.show_rows_when),
    ];
  }

  /**
   * The secondary line: the row's own context, then what its companion entities say, then why there
   * is no value. A state that follows a "·" is lowercase; figures and the user's own words are left alone.
   * In a narrow column the context gives way from the end — the word that says why there is no value never does.
   */
  private context(row: BarRowConfig, view: EntityView, usable: boolean, room: number): string {
    const own = row.secondary ? this.templates.resolve(row.secondary, row.entity) : '';
    const segments: Segment[] =
      own && own !== PENDING_LINE ? own.split(' · ').map((text) => ({ text, optional: true })) : [];
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
    // a state too long for the room says its one word ("Not found")
    const said = usable ? '' : stateText(this.hass, view);
    const state =
      said && this.head.ruler.width('fv-row__sub', said) > room ? stateWord(this.hass, view) : said;
    if (state) segments.push({ text: lower(state) });
    const first = segments[0];
    if (first && usable) segments[0] = { text: first.text }; // the row's first word of context stays
    const line = this.head.fitRowSegments(segments, room);
    if (!line) return own; // nothing else on the line: the row's own, a blank while its template is pending
    return state && line === lower(state) ? state : line; // left alone on the line, the state keeps its capital
  }

  /** A row's range and its limits (#253), in its entity's unit: a template asked with the row's entity as `entity`. */
  private limitsOf(row: BarRowConfig): Limits {
    const unit = this.entity(row.entity).unit;
    const read = (raw: unknown): Own<number> => this.ownFigure(raw, unit, row.entity);
    return { min: read(row.min), max: read(row.max), low: read(row.low), high: read(row.high) };
  }

  protected renderCard(): TemplateResult {
    // every row's range and limits, asked whether the row shows or not: a template stays live while its row is hidden
    const limits = new Map(this.rows().map((row) => [row, this.limitsOf(row)]));
    // the rows whose condition holds, and the sections over them: what is measured, counted and drawn
    const drawn = drawnOf<BarRowConfig>(this.hass, this.config?.rows, this.config?.show_rows_when);
    const rows = drawn.filter(isRow<BarRowConfig>);
    const views = rows.map((row) => this.entity(row.entity));
    const tone: Tone = toneOf(this.config, 'accent');

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
    const compact = this.compact();
    let warnings = 0;
    // a limit whose template is still to answer: the count is not known yet, so the badge waits for it
    let counting = false;
    // every row's figure first: whether the rows keep their circles is decided over all of them
    const items = rows.map((row, index) => {
      const view = views[index] as EntityView;
      const usable = isUsable(view);
      const quantity = usable ? baseOf(view) : null;
      const percent = PERCENT.has(view.deviceClass) || view.unit === '%';
      const factor = toBase(1, view.unit).value;
      // a row given as an id alone is a new item each time, with none of its own
      const limit = limits.get(row) ?? this.limitsOf(row);
      // a bound still to come leaves the bar empty, rather than drawn against a scale it does not have
      const scaled = !limit.min.pending && !limit.max.pending;
      const min = (limit.min.value ?? 0) * factor;
      const max =
        limit.max.value !== undefined
          ? limit.max.value * factor
          : percent
            ? 100
            : (barPeak.get(quantity?.unit ?? '') ?? 0);
      // a limit still to come warns of nothing; one that says nothing is its default
      const low = limit.low.pending
        ? undefined
        : (limit.low.value ?? (RUNS_LOW.has(view.deviceClass) ? 20 : undefined));
      const high = limit.high.value;
      const warn =
        quantity !== null &&
        ((low !== undefined && quantity.value < low * factor) ||
          (high !== undefined && quantity.value > high * factor));
      if (warn) warnings += 1;
      if (quantity !== null && (limit.low.pending || limit.high.pending)) counting = true;

      const scale = quantity ? scaleFor(setPeak.get(quantity.unit) ?? 0, quantity.unit) : null;
      const parts = valueParts(this.hass, view);
      // a figure in the set's unit; anything else (a percentage, a text state, "—") as Home Assistant formats it
      const figure =
        quantity && scale && scale.unit !== view.unit
          ? figureText(this.hass, quantity.value, scale)
          : parts.unit
            ? `${parts.value} ${parts.unit}`
            : parts.value;
      const title = this.nameFor(view, row.name);
      // a compact row has no second line to say why there is no figure: the state's word is its value, where the
      // word leaves the name its room (the full row says it under the name)
      const value =
        compact && view.status !== 'ok'
          ? this.head.rowWord(width, title, stateWord(this.hass, view), figure)
          : figure;
      return { row, view, usable, quantity, scaled, min, max, warn, title, value };
    });
    // the line under a name keeps its room as the name does: the circles give way to "6 panels" too
    const keepIcon = this.head.rowsKeepIcon(
      width,
      items.map((item) => ({
        ...item,
        sub: compact
          ? ''
          : (this.context(item.row, item.view, item.usable, Infinity).split(' · ')[0] ?? ''),
      })),
      compact,
    );
    const body = withSections(drawn, (row, index) => {
      const { view, usable, quantity, scaled, min, max, warn, title, value } = items[index]!;
      // a row's own tone, or its colour as the accent; without either the circle stays neutral and the bar takes the measure's tone
      const own: Tone | undefined = row.tone ?? (row.color ? 'accent' : undefined);
      const iconTone: Tone = !usable ? 'off' : warn ? 'warning' : (own ?? 'neutral');
      const valueTone: 'warning' | '' = warn ? 'warning' : '';

      // a compact row is the name and the value alone: its context is not laid out
      const shared = {
        icon: keepIcon ? iconOf(view, row.icon) : null,
        tone: iconTone,
        title,
        name: true,
        accent: this.accents.item(row.color),
        sub: compact
          ? ''
          : this.context(row, view, usable, this.head.rowRoom(width, value, { icon: keepIcon })),
        // the owner's own words lead the line: a name, that may end in its ellipsis
        subName: Boolean(row.secondary) && usable,
        value,
        valueTone,
        compact,
        unavailable: !usable,
        ...this.pressOf(row, row.entity),
      };
      return row.plain
        ? listRow({ ...shared, trailing: 'value' })
        : barRow({
            ...shared,
            barTone: warn ? 'warning' : (own ?? barToneFor(view)),
            fraction:
              quantity === null || !scaled || max <= min ? 0 : (quantity.value - min) / (max - min),
          });
    });

    // the person's badges, each asked every render so its template stays live: the first that says something, then
    // the card's own words; none while one before them waits for its answer, or while the count does
    const badge = this.ownWords(this.config?.badge);
    const ok = this.ownWords(this.config?.badge_ok);
    const warn = this.ownWords(this.config?.badge_warn);
    const said = [badge, warnings > 0 ? warn : ok].find(
      (own) => own.pending || own.value !== undefined,
    );
    const words = said
      ? said.value
      : warnings > 0
        ? this.t('battery.low', { count: warnings })
        : this.t('battery.all_good');
    const title = this.config?.title ?? strings(this.hass, 'levels');
    // nothing measured is nothing to call good: the badge waits for a row
    const panel = emptyPanel(this, !rows.length, 'sliders', 'common.no_readings');
    // soft: the bars' ink deepens along them
    const list = softIn(this.config) ? 'so-rows is-soft' : 'so-rows';
    const fitted = this.head.fit({
      width,
      title,
      sub: this.config?.subtitle ?? '',
      badge:
        panel || counting || !words
          ? null
          : {
              text: words.replace(/\{count\}/g, String(warnings)),
              tone: warnings > 0 ? 'warning' : tone,
            },
    });

    return html`<article class="fv-card so-card" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'sliders') : null,
        tone,
        title,
        sub: fitted.sub,
        trailing: fitted.badge,
        name: Boolean(this.config?.title),
        cut: fitted.cut,
        ...this.headActions(),
      })}
      <div class=${list}>${panel ?? body}</div>
    </article>`;
  }
}
