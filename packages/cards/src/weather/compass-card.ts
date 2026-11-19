import {
  entriesOf,
  formatNumber,
  isUsable,
  strings as words,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { head, readout, sheetStyles, type Tone } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';

import { HeadFit } from '../energy/head.js';
import { BADGE_BASE, Card, type BaseKey } from '../shared/base.js';
import { toneOf } from '../shared/colour.js';
import { configKeys } from '../shared/config.js';
import { iconOf, stateWord, classWord } from '../shared/domain.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  headFields,
  iconField,
  nameField,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  ownTextField,
  textField,
} from '../shared/form.js';
import { itemsOf, listOf } from '../shared/lists.js';
import { statsRow, statsSize } from '../shared/readouts.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { askedParts, type NumberKeys } from '../shared/units.js';
import { compassKey, type CompassKey } from '../shared/weather.js';
import { compassHeight } from '../weather-family.js';

const s = words('compass');
const weatherWords = words('weather');

/** The widest Home Assistant's own device-class word may be before it leaves rather than overlapping the ring. */
const LABEL_ROOM = 120;

export type CompassIndicator = 'pointer' | 'knob' | 'arrow_inward' | 'arrow_outward' | 'circle';

export const COMPASS_INDICATORS: readonly CompassIndicator[] = [
  'pointer',
  'knob',
  'arrow_inward',
  'arrow_outward',
  'circle',
];

/** One readout in the bottom row. */
export interface CompassStatConfig extends NumberKeys {
  entity: string;
  name?: EntityName;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface CompassCardConfig extends FluvyCardConfig, NumberKeys {
  /** The line under the title. */
  subtitle?: string;
  /** Primary directional entity (0–360° or cardinal point). Falls back to `entity` when omitted. */
  direction_entity?: string;
  /** Optional secondary directional entity (e.g. 10-minute average wind direction or sun azimuth). */
  secondary_direction_entity?: string;
  /** Primary pointer style on the ring (`pointer` by default). */
  indicator?: CompassIndicator;
  /** Primary pointer opacity (0.1–1, `1` by default). */
  indicator_opacity?: number;
  /** Secondary pointer style on the ring (`knob` by default). */
  secondary_indicator?: CompassIndicator;
  /** Secondary pointer opacity (0.1–1, `0.55` by default). */
  secondary_opacity?: number;
  /** Shift tone to `warning` when the primary numeric value reaches or exceeds this threshold. */
  warn_above?: number;
  /** Shift tone to `danger` when the primary numeric value reaches or exceeds this threshold. */
  danger_above?: number;
  /** Dial rotation offset in degrees (`0` = True North at 12 o'clock). */
  north_offset?: number;
  /** Uppercase label above the center figure. */
  label?: string;
  /** Head pill badge text (defaults to the current cardinal direction). */
  badge?: string;
  /** Show the 48 compass degree tick marks (`true` by default). */
  show_ticks?: boolean;
  /** Show the N / E / S / W cardinal letters on the ring (`true` by default). */
  show_cardinals?: boolean;
  /** Show the bottom stats row (`true` by default when `stats` has items). */
  show_stats?: boolean;
  /** Up to three readout entities shown in the bottom row (e.g. Gusts, Max daily gust, 10m average). */
  stats?: ReadonlyArray<string | CompassStatConfig>;
}

/** 16-point bearings in degrees: the English abbreviations and the German ones some integrations send (O for east, NO/SO/ONO…). */
const COMPASS_POINTS: Readonly<Record<string, number>> = {
  N: 0,
  NNE: 22.5,
  NNO: 22.5,
  NE: 45,
  NO: 45,
  ENE: 67.5,
  ONO: 67.5,
  E: 90,
  O: 90,
  ESE: 112.5,
  OSO: 112.5,
  SE: 135,
  SO: 135,
  SSE: 157.5,
  SSO: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

const DOMAINS: readonly string[] = ['sensor', 'number', 'input_number'];
const DIRECTION_DOMAINS: readonly string[] = ['sensor', 'number', 'input_number', 'sun'];
/** The bottom row never grows past three readouts, whatever `stats` lists. */
const MAX_STATS = 3;

/** Degrees wrapped into [0, 360); NaN-safe for a reading that failed to parse. */
const normDeg = (value: number): number => {
  const n = ((value % 360) + 360) % 360;
  return Number.isFinite(n) ? n : 0;
};

/** A direction reading: its exact degrees (the pointer's rotation), rounded degrees and cardinal key (its words). */
interface ParsedDirection {
  readonly degrees: number;
  readonly exact: number;
  readonly key: CompassKey;
}

/** Reads a direction view as degrees, or as one of `COMPASS_POINTS`' cardinal strings; null where neither parses. */
function parseDirection(view: EntityView | undefined): ParsedDirection | null {
  if (!view || !isUsable(view)) return null;
  if (view.number !== null) {
    const exact = normDeg(view.number);
    return { degrees: Math.round(exact), exact, key: compassKey(exact) };
  }
  const upper = view.state.trim().toUpperCase();
  const mapped = COMPASS_POINTS[upper];
  if (mapped !== undefined) {
    return { degrees: Math.round(mapped), exact: mapped, key: compassKey(mapped) };
  }
  return null;
}

const INDICATOR_CHOICES = [
  ['pointer', 'compass.indicator_pointer'],
  ['knob', 'compass.indicator_knob'],
  ['arrow_inward', 'compass.indicator_arrow_in'],
  ['arrow_outward', 'compass.indicator_arrow_out'],
  ['circle', 'compass.indicator_circle'],
] as const;

/**
 * A bearing on a 360° ring: degree ticks, localised N/E/S/W, a primary pointer (`direction_entity`) and an optional
 * secondary one to compare against, a numeric reading in the open centre with the current cardinal point and degrees
 * underneath, and up to three more readouts below. Generic by design — wind, a vehicle's heading, a dish's or the
 * sun's azimuth are all just a direction with an optional figure.
 */
export class FluvyCompassCard extends Card<CompassCardConfig> {
  static override layoutHeight(config: LovelaceCardConfig): number {
    return compassHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
    css`
      .cp-dial {
        position: relative;
        width: 248px;
        height: 248px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cp-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .cp-ring {
        fill: none;
        stroke: var(--fluvy-border);
        stroke-width: 8px;
        stroke-opacity: 0.55;
      }
      .cp-ring-inner {
        fill: var(--fluvy-card);
        stroke: var(--fluvy-border);
        stroke-width: 1px;
      }
      .cp-ticks {
        stroke: var(--fluvy-text-secondary);
        stroke-linecap: round;
      }
      .cp-tick--major {
        stroke-width: 2;
        opacity: 0.85;
      }
      .cp-tick--medium {
        stroke-width: 1.4;
        opacity: 0.65;
      }
      .cp-tick--minor {
        stroke-width: 0.9;
        opacity: 0.35;
      }
      .cp-cardinal {
        font-family: var(--fluvy-font);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
        fill: var(--fluvy-text-secondary);
        text-anchor: middle;
      }
      .cp-cardinal--north {
        fill: var(--tone-ink);
      }
      .cp-center {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        pointer-events: none;
        padding: 0 44px; /* keeps the figure and the label inside the ring's open circle, not just its box */
      }
      /* fixed width, never the label's: its figure stays centred whatever the label says, cut or none at all */
      .cp-center > .fv-readout {
        width: 100%;
      }
      /* the figure's own row is a flex row (for its baseline), so text-align alone never centres it */
      .cp-center .fv-readout__value {
        justify-content: center;
      }
      /* a size of its own, a step under the usual large readout: room for three decimals beside a long unit */
      .cp-center .fv-readout--l .fv-readout__value {
        height: 38px;
        font-size: 34px;
        line-height: 38px;
      }
      .cp-center .fv-readout--l .fv-unit {
        margin-left: 5px;
        font-size: 14px;
      }
      /* a label longer than the ring's open centre is a name: it ends in an ellipsis inside it (the gauge's rule) */
      .cp-center .fv-readout__label[data-name] {
        max-width: 120px; /* LABEL_ROOM: the bundler's css\` literal is static, so this is written by hand */
        margin: 0 auto;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .cp-dir {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .cp-dir__abbr {
        font-weight: 600;
        color: var(--tone-ink);
      }
      .so-cols .fv-readout__label {
        white-space: nowrap;
      }
    `,
  ];

  private readonly head = new HeadFit(this);

  static override base: readonly BaseKey[] = BADGE_BASE;

  static override keys = configKeys<CompassCardConfig>()([
    'subtitle',
    'direction_entity',
    'secondary_direction_entity',
    'indicator',
    'indicator_opacity',
    'secondary_indicator',
    'secondary_opacity',
    'warn_above',
    'danger_above',
    'north_offset',
    'label',
    'badge',
    'show_ticks',
    'show_cardinals',
    'show_stats',
    'stats',
    'unit',
    'decimals',
  ]);

  static override lists: readonly RowsListSpec[] = [
    {
      key: 'stats',
      title: 'editor.readouts',
      domains: DOMAINS,
      keys: ['entity', 'name', 'unit', 'decimals'],
      schema: [entityField(DOMAINS), nameField(), numberFields()],
    },
  ];

  static override defaults: EditorDefaults = () => ({
    indicator: 'pointer',
    indicator_opacity: 1,
    secondary_indicator: 'knob',
    secondary_opacity: 0.55,
    north_offset: 0,
    show_ticks: true,
    show_cardinals: true,
    show_stats: true,
    ...NUMBER_DEFAULTS,
  });

  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(DOMAINS, 'entity', false),
        fieldRow(nameField(), ownTextField('subtitle')),
        iconField(),
        headFields({ badge: true }),
        ...colourFields(),
        fieldRow(numberField('warn_above', 0, 500, 1), numberField('danger_above', 0, 500, 1)),
        entityField(DIRECTION_DOMAINS, 'direction_entity', false),
        fieldRow(
          choiceField('indicator', INDICATOR_CHOICES),
          numberField('indicator_opacity', 0.1, 1, 0.05),
        ),
        entityField(DIRECTION_DOMAINS, 'secondary_direction_entity', false),
        fieldRow(
          choiceField('secondary_indicator', INDICATOR_CHOICES),
          numberField('secondary_opacity', 0.1, 1, 0.05),
        ),
        fieldRow(numberField('north_offset', -180, 360, 1), textField('label')),
        fieldRow(ownTextField('badge'), boolField('show_stats')),
        fieldRow(boolField('show_ticks'), boolField('show_cardinals')),
        entitiesField('stats', DOMAINS),
        numberFields(),
        actionFields({ icon: true }),
      ],
      ...editorLabels(
        s,
        {
          direction_entity: 'direction_entity',
          secondary_direction_entity: 'secondary_direction_entity',
          indicator: 'indicator',
          indicator_opacity: 'indicator_opacity',
          secondary_indicator: 'secondary_indicator',
          secondary_opacity: 'secondary_opacity',
          warn_above: 'warn_above',
          danger_above: 'danger_above',
          north_offset: 'north_offset',
          label: 'label',
          badge: 'badge',
          show_ticks: 'show_ticks',
          show_cardinals: 'show_cardinals',
          show_stats: 'show_stats',
        },
        { stats: 'editor.readouts' },
      ),
    };
  }

  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): CompassCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const speed =
      sensors.find((id) => hass?.states?.[id]?.attributes.device_class === 'wind_speed') ??
      sensors[0] ??
      entities[0] ??
      '';
    const dir = sensors.find((id) => /wind.*dir|bearing/i.test(id)) ?? speed;
    return {
      type: 'custom:fluvy-compass-card',
      entity: speed,
      direction_entity: dir,
    };
  }

  protected override prepare(config: CompassCardConfig): CompassCardConfig {
    if (!config.entity && !config.direction_entity) {
      throw new Error('fluvy-compass-card: "entity" or "direction_entity" is required');
    }
    const stats = itemsOf<CompassStatConfig>(listOf(config, 'stats')).slice(0, MAX_STATS);
    return { ...config, ...(config.stats ? { stats } : {}) };
  }

  override getCardSize(): number {
    return this.statItems().length ? 8 : 7;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    return [
      this.config?.entity ?? '',
      this.config?.direction_entity ?? '',
      this.config?.secondary_direction_entity ?? '',
      ...this.statItems().map((item) => item.entity),
    ].filter(Boolean);
  }

  private statItems(): readonly CompassStatConfig[] {
    if (this.config?.show_stats === false) return [];
    return entriesOf<CompassStatConfig>(this.config?.stats)
      .slice(0, MAX_STATS)
      .map((item) => (typeof item === 'string' ? { entity: item } : item));
  }

  /** The ring's 48 ticks, longer and bolder at the cardinal points (every 90°) and the intercardinals (every 22.5°). */
  private drawTicks(radius = 62, step = 7.5): SVGTemplateResult {
    const cx = 76;
    const cy = 76;
    const lines: SVGTemplateResult[] = [];
    for (let deg = 0; deg < 360; deg += step) {
      const d = normDeg(deg);
      const isMajor = d % 90 === 0;
      const isMedium = !isMajor && Math.abs(d / 22.5 - Math.round(d / 22.5)) <= 0.05;
      const cls = isMajor ? 'cp-tick--major' : isMedium ? 'cp-tick--medium' : 'cp-tick--minor';
      const rIn = isMajor ? radius - 7 : isMedium ? radius - 5 : radius - 3;
      const rOut = radius + 4;
      const rad = (d * Math.PI) / 180;
      const x1 = (cx + rIn * Math.sin(rad)).toFixed(2);
      const y1 = (cy - rIn * Math.cos(rad)).toFixed(2);
      const x2 = (cx + rOut * Math.sin(rad)).toFixed(2);
      const y2 = (cy - rOut * Math.cos(rad)).toFixed(2);
      lines.push(svg`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} class=${cls} />`);
    }
    return svg`<g class="cp-ticks">${lines}</g>`;
  }

  /** One pointer on the ring, rotated to its reading: a chevron, a knob, an arrow in or out, or a circle. */
  private drawIndicator(
    parsed: ParsedDirection | null,
    style: CompassIndicator,
    opacity: number,
  ): SVGTemplateResult | typeof nothing {
    if (!parsed) return nothing;
    const cx = 76;
    const cy = 76;
    const R = 62;
    const yTop = cy - R;
    const r = 11;
    let shape: SVGTemplateResult;

    switch (style) {
      case 'knob':
        shape = svg`
          <circle cx=${cx} cy=${yTop} r=${r + 3.5} fill="var(--fluvy-card)" />
          <circle cx=${cx} cy=${yTop} r=${r} fill="var(--fv-solid-card, var(--fluvy-card))" stroke="var(--tone-ink)" stroke-width="1.25" />
          <circle cx=${cx} cy=${yTop} r=${(r * 0.25).toFixed(2)} fill="var(--tone-ink)" />
        `;
        break;
      case 'arrow_outward': {
        const size = 19;
        const m = Math.min(R / 9.1809, size / 18.361);
        const tx = (cx - size * 0.5 - m * (cx - 9.1809)).toFixed(2);
        const ty = (cy - R - size * 0.5 - 5.8262 * m).toFixed(2);
        shape = svg`
          <g transform="translate(${tx} ${ty}) scale(${m.toFixed(4)})">
            <path d="M${cx} 0v23l-8 7z" fill="var(--tone-ink)" stroke="var(--tone-ink)" stroke-width=".5" />
            <path d="M${cx} 0v23l8 7z" fill="var(--tone-ink)" />
            <path d="M${cx} 0v23l8 7z" fill="white" opacity="0.35" stroke="white" stroke-width=".5" />
          </g>
        `;
        break;
      }
      case 'circle': {
        const size = 19;
        const m = size / 18.361;
        const tx = (cx - m * cx).toFixed(2);
        const ty = (cy - R - 15.0071 * m).toFixed(2);
        shape = svg`
          <g transform="translate(${tx} ${ty}) scale(${m.toFixed(4)})">
            <path d="m${cx} 5.8262a9.1809 9.1809 0 0 0-0.0244 0 9.1809 9.1809 0 0 0-9.1813 9.18 9.1809 9.1813 0 0 0 9.1813 9.1813 9.1809 9.1809 0 0 0 0.0244 0z" fill="var(--tone-ink)" />
            <path d="m${cx} 5.8262v18.361a9.1809 9.1809 0 0 0 9.1556-9.1813 9.1809 9.1809 0 0 0-9.1556-9.18z" fill="var(--tone-ink)" />
            <path d="m${cx} 5.8262v18.361a9.1809 9.1809 0 0 0 9.1556-9.1813 9.1809 9.1809 0 0 0-9.1556-9.18z" fill="white" opacity="0.35" />
          </g>
        `;
        break;
      }
      case 'arrow_inward': {
        const size = 19;
        const m = Math.min(R / 9.1809, size / 18.361);
        const tx = (cx - size * 0.5 - m * (cx - 9.1809)).toFixed(2);
        const ty = (cy - R - size * 0.5 - 5.8262 * m).toFixed(2);
        shape = svg`
          <g transform="translate(${tx} ${ty}) scale(${m.toFixed(4)})">
            <path d="M${cx} 30.664v-23l-8-7z" fill="var(--tone-ink)" stroke="var(--tone-ink)" stroke-width=".5" />
            <path d="M${cx} 30.664v-23l8-7z" fill="var(--tone-ink)" />
            <path d="M${cx} 30.664v-23l8-7z" fill="white" opacity="0.35" stroke="white" stroke-width=".5" />
          </g>
        `;
        break;
      }
      case 'pointer':
      default:
        shape = svg`
          <circle cx=${cx} cy=${yTop} r=${r + 3.5} fill="var(--fluvy-card)" />
          <circle cx=${cx} cy=${yTop} r=${r} fill="var(--fv-solid-card, var(--fluvy-card))" stroke="var(--tone-ink)" stroke-width="1.25" />
          <path d="M ${(cx - r * 0.36).toFixed(2)} ${(yTop - r * 0.2).toFixed(2)} L ${cx} ${(yTop + r * 0.32).toFixed(2)} L ${(cx + r * 0.36).toFixed(2)} ${(yTop - r * 0.2).toFixed(2)}" fill="none" stroke="var(--tone-ink)" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" />
        `;
        break;
    }

    return svg`<g opacity=${opacity} transform="rotate(${parsed.exact.toFixed(1)}, ${cx}, ${cy})">${shape}</g>`;
  }

  protected renderCard(): TemplateResult {
    const c = this.config!;
    const primaryId = c.entity ?? c.direction_entity ?? '';
    const dirId = c.direction_entity ?? c.entity ?? '';
    const view = this.entity(primaryId);
    const dirView = this.entity(dirId);
    const secDirView = c.secondary_direction_entity
      ? this.entity(c.secondary_direction_entity)
      : undefined;

    const unusable = !isUsable(view) && !isUsable(dirView);
    const parsedPrimary = parseDirection(dirView);
    const parsedSecondary = parseDirection(secDirView);

    const parts = c.entity ? askedParts(this.hass, view, c) : null;
    const numeric = view.number;

    let baseTone: Tone = toneOf(c, 'solar');
    if (numeric !== null) {
      if (typeof c.danger_above === 'number' && numeric >= c.danger_above) {
        baseTone = 'danger';
      } else if (typeof c.warn_above === 'number' && numeric >= c.warn_above) {
        baseTone = 'warning';
      }
    }
    const headTone: Tone = unusable ? 'off' : baseTone;

    const abbr = parsedPrimary ? weatherWords(this.hass, parsedPrimary.key) : null;
    const degText = parsedPrimary
      ? `${formatNumber(this.hass, parsedPrimary.degrees, { digits: 0 })}°`
      : null;

    const ownBadge = this.ownText(c.badge, false)?.text;
    const badgeText = !this.showBadge
      ? null
      : unusable
        ? stateWord(this.hass, view)
        : (ownBadge ?? abbr);
    const badge = badgeText
      ? { text: badgeText, tone: headTone, own: !unusable && ownBadge !== undefined }
      : null;

    const defaultSub =
      !unusable && abbr && degText ? `${s(this.hass, 'direction')}: ${abbr} (${degText})` : '';
    const subSpec = c.subtitle !== undefined ? this.subtitle(view.areaName) : { sub: defaultSub };

    const width = this.contentWidth;
    const name = this.nameFor(view, c.name);
    const fitted = this.head.fit({
      width,
      title: name,
      ...subSpec,
      badge,
    });

    const offset = typeof c.north_offset === 'number' ? c.north_offset : 0;
    const showTicks = c.show_ticks !== false;
    const showCardinals = c.show_cardinals !== false;
    const indStyle = c.indicator ?? 'pointer';
    const indOpacity = typeof c.indicator_opacity === 'number' ? c.indicator_opacity : 1;
    const secStyle = c.secondary_indicator ?? 'knob';
    const secOpacity = typeof c.secondary_opacity === 'number' ? c.secondary_opacity : 0.55;
    const labelText = c.label !== undefined ? c.label : classWord(this.hass, view.deviceClass);
    const labelFits = this.head.ruler.width('fv-readout__label', labelText) <= LABEL_ROOM;
    const innerLabel = labelFits || c.label !== undefined ? labelText : '';
    const innerLabelCut = c.label !== undefined && !labelFits;

    const statConfigs = this.statItems();
    const stats = statConfigs.map((item) => {
      const sv = this.entity(item.entity);
      const sp = askedParts(this.hass, sv, {
        unit: item.unit ?? c.unit,
        decimals: item.decimals ?? c.decimals,
      });
      return {
        label: this.nameFor(sv, item.name),
        value: isUsable(sv) ? sp.value : '—',
        unit: isUsable(sv) ? sp.unit : '',
      };
    });

    const row = stats.length
      ? width < 171
        ? { columns: 1, size: statsSize(this.head.ruler, width, stats, 1), odd: false }
        : statsRow(this.head.ruler, width, stats)
      : null;

    return html`<article
      class="fv-card so-card ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
    >
      ${head({
        icon: fitted.icon ? iconOf(view, c.icon) : null,
        tone: headTone,
        title: name,
        sub: fitted.sub,
        trailing: fitted.badge,
        cut: fitted.cut,
        ...this.headActions(primaryId),
        name: true,
      })}
      <div class="cp-dial fv-tone--${headTone}">
        <!-- 152/76/62: the dial's own geometry, after tomvanswam/compass-card's CIRCLE constants -->
        <svg viewBox="0 0 152 152" preserveAspectRatio="xMidYMid meet" class="cp-svg">
          <circle class="cp-ring" cx="76" cy="76" r="62" />
          <circle class="cp-ring-inner" cx="76" cy="76" r="52" />
          <g transform="rotate(${offset}, 76, 76)">
            ${showTicks ? this.drawTicks(62, 7.5) : nothing}
            ${
              showCardinals
                ? svg`
                  <text class="cp-cardinal cp-cardinal--north" x="76" y="7">${weatherWords(this.hass, 'dir.n')}</text>
                  <text class="cp-cardinal" x="146" y="79.5">${weatherWords(this.hass, 'dir.e')}</text>
                  <text class="cp-cardinal" x="76" y="151">${weatherWords(this.hass, 'dir.s')}</text>
                  <text class="cp-cardinal" x="6" y="79.5">${weatherWords(this.hass, 'dir.w')}</text>
                `
                : nothing
            }
            ${this.drawIndicator(parsedSecondary, secStyle, secOpacity)}
            ${this.drawIndicator(parsedPrimary, indStyle, indOpacity)}
          </g>
        </svg>
        <div class="cp-center" data-align="center">
          ${
            parts
              ? readout({
                  label: innerLabel,
                  name: innerLabelCut,
                  glyph: innerLabel === '' ? null : undefined,
                  value: isUsable(view) ? parts.value : '—',
                  unit: isUsable(view) ? parts.unit : '',
                  size: 'l',
                })
              : nothing
          }
          <div class="cp-dir">
            <span class="cp-dir__abbr">${abbr ?? '—'}</span>
            ${degText ? html`<span> · ${degText}</span>` : nothing}
          </div>
        </div>
      </div>
      ${
        stats.length && row
          ? html`<div
              class="so-cols fv-cols so-cols--center ${row.odd ? 'fv-cols--odd' : ''}"
              style="grid-template-columns:repeat(${row.columns}, minmax(0, 1fr))"
              data-align="center"
            >
              ${stats.map((stat) => readout({ ...stat, size: row.size }))}
            </div>`
          : nothing
      }
    </article>`;
  }
}
