import {
  formatNumber,
  formatTime,
  numberAttr,
  stateText,
  strings,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  actions,
  badge,
  chips,
  clamp,
  head,
  label,
  readout,
  rulerLabels,
  sheetStyles,
  type ActionItem,
  type ChipItem,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import {
  editorLabels,
  entityField,
  fieldRow,
  nameIconFields,
  selectField,
  textField,
} from '../shared/form.js';
import { actionGap, headSub, Hold, motionStyles, pretty, shownStateText } from '../cover/common.js';

const vacuumStrings = strings('vacuum');

export interface VacuumCardConfig extends FluvyCardConfig {
  subtitle?: string;
  /** Sensors the integration exposes beside the robot itself. A column exists only for what is configured. */
  area_entity?: string;
  duration_entity?: string;
  remaining_entity?: string;
  /** The battery sensor. Left out, the card looks for one on the robot's own device. */
  battery_entity?: string;
  /** Suction speeds: chips that fill the row (default) or content-sized chips. */
  suction_style?: 'full' | 'chips';
}

type Command = 'start' | 'pause' | 'stop' | 'dock' | 'locate';

interface Robot {
  readonly running: string;
  readonly bits: Readonly<Record<Command | 'suction' | 'battery', number>>;
  /** Command → the service to call and the state to show until Home Assistant answers. */
  readonly services: Readonly<
    Partial<Record<Command, readonly [service: string, expect: string | null]>>
  >;
}

const VACUUM: Robot = {
  running: 'cleaning',
  bits: { pause: 4, stop: 8, dock: 16, suction: 32, battery: 64, locate: 512, start: 8192 },
  services: {
    start: ['start', 'cleaning'],
    pause: ['pause', 'paused'],
    stop: ['stop', 'idle'],
    dock: ['return_to_base', 'returning'],
    locate: ['locate', null],
  },
};

/** A lawn mower is the same machine outdoors, with three features of its own. */
const MOWER: Robot = {
  running: 'mowing',
  bits: { start: 1, pause: 2, dock: 4, stop: 0, locate: 0, suction: 0, battery: 0 },
  services: {
    start: ['start_mowing', 'mowing'],
    pause: ['pause', 'paused'],
    dock: ['dock', 'returning'],
  },
};

const GAUGE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.25, 25],
  [0.5, 50],
  [0.75, 75],
  [1, 100],
];

/**
 * The robot: what it is doing, the numbers the integration exposes (area, elapsed, remaining — only
 * the ones that are configured), the battery as a read-only marker gauge, the command row, and
 * suction as chips. Lawn mowers are served by the same card.
 */
export class FluvyVacuumCard extends Card<VacuumCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet's 3 × 96 + 2 × 16 at 320, fluid; one or two readouts keep their third of the column */
      .dv-cols {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    `,
  ];

  private readonly suctionHold = new Hold<string | null>(this);
  private battery:
    | {
        readonly registry: HomeAssistant['entities'] | undefined;
        readonly robot: string;
        readonly id: string | undefined;
      }
    | undefined;

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['vacuum', 'lawn_mower']),
        nameIconFields(),
        fieldRow(textField('subtitle'), entityField(['sensor'], 'battery_entity', false)),
        fieldRow(
          entityField(['sensor'], 'area_entity', false),
          entityField(['sensor'], 'duration_entity', false),
        ),
        fieldRow(
          entityField(['sensor'], 'remaining_entity', false),
          selectField('suction_style', ['full', 'chips']),
        ),
      ],
      ...editorLabels(
        vacuumStrings,
        { area_entity: 'area', duration_entity: 'elapsed' },
        {
          battery_entity: 'vacuum.battery',
          remaining_entity: 'timer.remaining',
          suction_style: 'editor.suction_style',
        },
      ),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): VacuumCardConfig {
    return {
      type: 'custom:fluvy-vacuum-card',
      entity: entities.find((id) => /^(vacuum|lawn_mower)\./.test(id)) ?? '',
    };
  }

  protected override prepare(config: VacuumCardConfig): VacuumCardConfig {
    if (!config.entity) throw new Error('fluvy-vacuum-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return 6;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 9 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.suctionHold.clear();
  }

  protected override watched(): readonly string[] {
    const c = this.config;
    return [
      c?.entity,
      c?.area_entity,
      c?.duration_entity,
      c?.remaining_entity,
      this.batteryId(),
    ].filter((id): id is string => Boolean(id));
  }

  /**
   * The battery sensor: the configured one, or the `battery` sensor on the robot's own device —
   * Home Assistant moved the battery out of the vacuum's attributes into a sensor of its own.
   * Looked up once per entity registry, not per render.
   */
  private batteryId(): string | undefined {
    if (this.config?.battery_entity) return this.config.battery_entity;
    const robot = this.config?.entity ?? '';
    const registry = this.hass?.entities;
    const known = this.battery;
    if (known && known.registry === registry && known.robot === robot) return known.id;
    const device = registry?.[robot]?.device_id;
    const found =
      device && registry
        ? Object.values(registry).find(
            (entry) =>
              entry.device_id === device &&
              entry.entity_id.startsWith('sensor.') &&
              this.hass?.states[entry.entity_id]?.attributes.device_class === 'battery',
          )
        : undefined;
    this.battery = { registry, robot, id: found?.entity_id };
    return found?.entity_id;
  }

  private command(view: EntityView, robot: Robot, key: Command): void {
    const entry = robot.services[key];
    if (!entry) return;
    const [service, expected] = entry;
    if (expected) this.expect(view.id, expected);
    this.call(view.domain, service);
  }

  /** A readout for a configured sensor; nothing when it is not configured or does not exist. */
  private column(id: string | undefined, text: string): TemplateResult | null {
    if (!id) return null;
    const view = this.entity(id);
    if (view.status === 'missing') return null;
    const parts = valueParts(this.hass, view);
    return readout({ label: text, value: parts.value, unit: parts.unit, size: 's' });
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const robot = view.domain === 'lawn_mower' ? MOWER : VACUUM;
    const unusable = view.status === 'unavailable';
    const shown = this.stateOf(view);
    const running = shown === robot.running;
    const tone: Tone = unusable
      ? 'off'
      : shown === 'error'
        ? 'warning'
        : running || shown === 'returning'
          ? 'accent'
          : 'neutral';
    const w = this.contentWidth;
    const has = (key: Command | 'suction' | 'battery'): boolean =>
      robot.bits[key] !== 0 && view.supports(robot.bits[key]);

    const columns = [
      this.column(this.config?.area_entity, vacuumStrings(this.hass, 'area')),
      this.column(this.config?.duration_entity, vacuumStrings(this.hass, 'elapsed')),
      this.column(this.config?.remaining_entity, this.t('timer.remaining')),
    ].filter((column): column is TemplateResult => column !== null);

    // the battery: its own sensor where there is one, the legacy attribute otherwise; an unavailable robot keeps the empty gauge
    const batteryId = this.batteryId();
    const sensor = batteryId ? this.entity(batteryId) : undefined;
    const level =
      sensor && sensor.status !== 'missing' ? sensor.number : numberAttr(view, 'battery_level');
    const hasBattery =
      level !== null ||
      (sensor !== undefined && sensor.status !== 'missing') ||
      (unusable && has('battery'));
    const battery = level === null || unusable ? null : clamp(Math.round(level), 0, 100);

    const row: ActionItem[] = [];
    if (has('start') || has('pause')) {
      row.push(
        running
          ? {
              key: 'pause',
              glyph: 'pause',
              label: this.t('vacuum.pause'),
              primary: !unusable,
              disabled: unusable || !has('pause'),
            }
          : {
              key: 'start',
              glyph: 'play',
              label: this.t('vacuum.start'),
              primary: !unusable,
              disabled: unusable || !has('start'),
            },
      );
    }
    if (has('stop'))
      row.push({ key: 'stop', glyph: 'stop', label: this.t('vacuum.stop'), disabled: unusable });
    if (has('dock'))
      row.push({
        key: 'dock',
        glyph: 'dock',
        label: this.t('vacuum.dock'),
        disabled: unusable || shown === 'docked' || shown === 'returning',
      });
    if (has('locate'))
      row.push({
        key: 'locate',
        glyph: 'locate',
        label: this.t('vacuum.locate'),
        disabled: unusable,
      });

    const speeds = has('suction')
      ? ((view.attr<unknown>('fan_speed_list') as unknown[] | undefined) ?? []).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const speed = this.suctionHold.read(view.attr<string | null>('fan_speed') ?? null);
    const chipItems: ChipItem[] = speeds.map((item) => ({
      key: item,
      label: pretty(item),
      active: !unusable && item === speed,
    }));

    const started =
      running && view.stateObj
        ? vacuumStrings(this.hass, 'started', {
            time: formatTime(this.hass, new Date(view.stateObj.last_changed)),
          })
        : '';
    const sub =
      this.config?.subtitle ??
      (view.areaName && started
        ? `${view.areaName} · ${started}`
        : view.areaName || started.charAt(0).toUpperCase() + started.slice(1));
    const batteryText = `${this.t('vacuum.battery')} · ${battery === null ? '—' : `${formatNumber(this.hass, battery, { digits: 0 })} %`}`;

    return html`<article
      class="fv-card dv-card ${unusable ? 'is-unavailable is-off' : ''}"
      style="--dv-action-gap:${actionGap(w, row.length)}px"
      data-card
    >
      ${head({
        icon: this.config?.icon ?? (robot === MOWER ? 'leaf' : glyphFor(view)),
        tone,
        title: name,
        sub: headSub(sub, w),
        trailing: badge(shownStateText(this.hass, view, shown), tone),
        onIconTap: () => this.tap(view.id, { action: 'more-info' }),
        iconLabel: name,
      })}
      ${columns.length ? html`<div class="dv-cols fv-cols">${columns}</div>` : nothing}
      ${
        hasBattery
          ? html` ${label(batteryText)}
              <div class="dv-gauge">
                <fluvy-ruler
                  marker
                  ?inactive=${battery === null}
                  .value=${battery ?? 0}
                  .min=${0}
                  .max=${100}
                  .step=${1}
                  .length=${w}
                  .tone=${battery !== null && battery <= 20 ? 'warning' : 'accent'}
                  unit="%"
                  .label=${`${name} · ${this.t('vacuum.battery')}`}
                  .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                ></fluvy-ruler>
              </div>
              ${rulerLabels(GAUGE.map(([fraction, value]) => [fraction, formatNumber(this.hass, value, { digits: 0 })] as const))}`
          : nothing
      }
      ${row.length ? actions(row, (key) => this.command(view, robot, key as Command)) : nothing}
      ${
        chipItems.length
          ? html`${label(this.t('vacuum.suction'))}${chips(
              chipItems,
              (key) => {
                if (unusable) return;
                this.suctionHold.set(key);
                this.call('vacuum', 'set_fan_speed', { fan_speed: key });
              },
              '',
              this.config?.suction_style !== 'chips',
            )}`
          : nothing
      }
    </article>`;
  }
}
