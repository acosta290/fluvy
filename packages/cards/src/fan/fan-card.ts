import {
  formatNumber,
  numberAttr,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  badge,
  chips,
  clamp,
  head,
  label,
  listRow,
  readout,
  rulerLabels,
  sheetStyles,
  stepper,
  toggle,
  type ChipItem,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import { boolField, entityField, formLabels, nameIconFields, textField } from '../shared/form.js';
import {
  Burst,
  Hold,
  motionStyles,
  pretty,
  releasePresses,
  StableTemplate,
} from '../cover/common.js';

const fanStrings = strings('fan');

export interface FanCardConfig extends FluvyCardConfig {
  subtitle?: string;
  show_presets?: boolean;
}

/* fan supported_features */
const SET_SPEED = 1;
const OSCILLATE = 2;
const DIRECTION = 4;
const PRESET_MODE = 8;

type Labels = ReadonlyArray<readonly [number, string]>;
type Direction = 'forward' | 'reverse';

/** How many speeds the fan has: `percentage_step` is 100 / speed_count, and 1 on a continuous fan. */
function speedCount(view: EntityView): number {
  const step = numberAttr(view, 'percentage_step');
  return step !== null && step > 0 && step <= 100 ? Math.max(1, Math.round(100 / step)) : 100;
}

/**
 * The fan: the speed as the card's one big number with its stepper and ruler, then oscillation and
 * direction as rows and the integration's presets as chips. Everything moves in the fan's own
 * speeds — a three-speed fan has three stops, named Low · Mid · High under the ruler, and the
 * percentage sent is the one Home Assistant maps back onto that speed. The head glyph turns while it runs.
 */
export class FluvyFanCard extends Card<FanCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet's own 12 px above the ruler: in a card the ruler is a custom element */
      .dv-card > fluvy-ruler {
        display: block;
        margin-top: 12px;
      }
      /* an unavailable card already dims as a whole: its rows do not dim a second time */
      .is-unavailable .is-unavailable {
        opacity: 1;
      }

      /*
       * The blades turn while the fan runs, on the compositor and in CSS alone. Two turns are stacked —
       * the circle and the glyph inside it — and the speed is which of them run (slow, fast, both), so a
       * change of speed pauses or resumes a turn and the blades never jump; off pauses both where they are.
       */
      @keyframes dv-fan-turn {
        to {
          rotate: 360deg;
        }
      }
      .dv-fan .fv-card__head .fv-ico {
        animation: dv-fan-turn 7.2s linear infinite;
        animation-play-state: var(--dv-fan-slow, paused);
      }
      .dv-fan .fv-card__head .fv-ico > * {
        animation: dv-fan-turn 3.6s linear infinite;
        animation-play-state: var(--dv-fan-fast, paused);
      }

      @media (prefers-reduced-motion: reduce) {
        .dv-fan .fv-card__head .fv-ico,
        .dv-fan .fv-card__head .fv-ico > * {
          animation: none !important;
        }
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    dragged: { state: true },
    fine: { state: true },
  };

  /** Speed under the finger while the ruler is being dragged. */
  declare dragged: number | null;
  /** The tenth of the range the ruler shows while its fine scale is up. */
  declare fine: RulerWindowDetail | null;

  private readonly speedHold = new Hold<number | null>(this);
  private readonly oscillatingHold = new Hold<boolean>(this);
  private readonly directionHold = new Hold<Direction | null>(this);
  private readonly presetHold = new Hold<string | null>(this);
  private readonly speedBurst = new Burst();
  private readonly speedStepper = new StableTemplate(this);

  constructor() {
    super();
    this.dragged = null;
    this.fine = null;
  }

  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['fan']),
        nameIconFields(),
        textField('subtitle'),
        boolField('show_presets'),
      ],
      ...formLabels({
        show_presets: 'fan.preset',
      }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): FanCardConfig {
    return {
      type: 'custom:fluvy-fan-card',
      entity: entities.find((id) => id.startsWith('fan.')) ?? '',
    };
  }

  protected override prepare(config: FanCardConfig): FanCardConfig {
    if (!config.entity) throw new Error('fluvy-fan-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    const view = this.entity();
    return (
      2 +
      (view.supports(SET_SPEED) ? 3 : 0) +
      (view.supports(OSCILLATE) ? 1 : 0) +
      (view.supports(DIRECTION) ? 1 : 0) +
      (view.supports(PRESET_MODE) ? 2 : 0)
    );
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 9 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.speedBurst.flush();
    for (const hold of [this.speedHold, this.oscillatingHold, this.directionHold, this.presetHold])
      hold.clear();
  }

  /** The speed to draw: null when the fan cannot say (unknown, or a preset that runs its own speed). */
  private speedOf(view: EntityView, on: boolean): number | null {
    const reported = numberAttr(view, 'percentage');
    const speed =
      view.status !== 'ok' ? null : !on ? 0 : reported === null ? null : clamp(reported, 0, 100);
    const tolerance = 50 / speedCount(view);
    return this.speedHold.read(
      speed,
      (a, b) => a !== null && b !== null && Math.abs(a - b) <= tolerance,
    );
  }

  /**
   * Home Assistant truncates the percentage to an integer and maps it UP onto a speed, so the value
   * for a stop is its floor: 66 is speed 2 of 3 where 67 would already be speed 3.
   */
  private setSpeed(view: EntityView, value: number, coalesce: boolean): void {
    const percentage = Math.floor(clamp(value, 0, 100) + 1e-6);
    this.dragged = null;
    this.speedHold.set(percentage);
    this.expect(view.id, percentage > 0 ? 'on' : 'off');
    const send = (): void => this.call('fan', 'set_percentage', { percentage });
    if (coalesce) this.speedBurst.push(send);
    else {
      this.speedBurst.flush();
      send();
    }
  }

  /** One stop up or down from the nearest one — read at the moment of the step, so a held button keeps walking. */
  private stepSpeed(direction: 1 | -1): void {
    const view = this.entity();
    if (view.status === 'unavailable' || view.status === 'missing') return;
    const count = speedCount(view);
    const current = this.speedOf(view, this.stateOf(view) === 'on') ?? 0;
    const index = clamp(Math.round((current * count) / 100) + direction, 0, count);
    this.setSpeed(view, (index * 100) / count, true);
  }

  private power(view: EntityView, next: boolean): void {
    this.speedBurst.flush();
    this.speedHold.clear();
    this.expect(view.id, next ? 'on' : 'off');
    this.call('fan', next ? 'turn_on' : 'turn_off');
  }

  /** Ticks and words for the ruler. Two and three speeds are named stops; anything finer is a plain 0–100 scale. */
  private scale(count: number): { minor: number; major: number; labels: Labels } {
    const off = this.t('common.off');
    const low = fanStrings(this.hass, 'low');
    const mid = fanStrings(this.hass, 'mid');
    const high = fanStrings(this.hass, 'high');
    if (count === 2)
      return {
        minor: 0.05,
        major: 0.5,
        labels: [
          [0, off],
          [0.5, low],
          [1, high],
        ],
      };
    if (count === 3)
      return {
        minor: 1 / 18,
        major: 1 / 3,
        labels: [
          [0, off],
          [1 / 3, low],
          [2 / 3, mid],
          [1, high],
        ],
      };
    const max = this.t('common.max');
    // five words need the design's column; a narrow one keeps the ends and the middle ("Apagado" would run into "Baja")
    return {
      minor: 0.05,
      major: 0.25,
      labels:
        this.contentWidth < 300
          ? [
              [0, off],
              [0.5, mid],
              [1, max],
            ]
          : [
              [0, off],
              [0.25, low],
              [0.5, mid],
              [0.75, high],
              [1, max],
            ],
    };
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const unusable = view.status === 'unavailable';
    const on = this.stateOf(view) === 'on';
    const count = speedCount(view);
    const step = 100 / count;
    const speed = this.speedOf(view, on);
    const figure = this.dragged ?? speed;
    const tone: Tone = unusable ? 'off' : on ? 'fan' : 'neutral';

    const oscillating = this.oscillatingHold.read(
      view.attr<boolean | null>('oscillating') === true,
    );
    const rawDirection = view.attr<string | null>('direction');
    const direction = this.directionHold.read(
      rawDirection === 'forward' || rawDirection === 'reverse' ? rawDirection : null,
    );
    const flipped: Direction = direction === 'reverse' ? 'forward' : 'reverse';
    const presets = ((view.attr<unknown>('preset_modes') as unknown[] | undefined) ?? []).filter(
      (item): item is string => typeof item === 'string',
    );
    const preset = this.presetHold.read(view.attr<string | null>('preset_mode') ?? null);
    const chipItems: ChipItem[] = presets.map((item) => ({
      key: item,
      label: pretty(item),
      active: !unusable && item === preset,
    }));
    const showPresets =
      chipItems.length > 0 && view.supports(PRESET_MODE) && this.config?.show_presets !== false;

    const rows: TemplateResult[] = [];
    if (view.supports(OSCILLATE)) {
      rows.push(
        listRow({
          icon: 'swing',
          tone: unusable ? 'off' : oscillating ? 'fan' : 'neutral',
          title: this.t('fan.oscillate'),
          trailing: 'switch',
          on: oscillating,
          switchTone: 'fan',
          unavailable: unusable,
          onToggle: (next) => {
            if (unusable) return;
            this.oscillatingHold.set(next);
            this.call('fan', 'oscillate', { oscillating: next });
          },
        }),
      );
    }
    if (view.supports(DIRECTION)) {
      rows.push(
        listRow({
          icon: 'auto',
          tone: unusable ? 'off' : 'neutral',
          title: this.t('fan.direction'),
          sub: direction ? fanStrings(this.hass, direction) : '',
          trailing: 'chevron',
          onTap: unusable
            ? undefined
            : () => {
                this.directionHold.set(flipped);
                this.call('fan', 'set_direction', { direction: flipped });
              },
        }),
      );
    }

    // the blades: slow up to a third, fast up to two thirds, both above; a fan that cannot say its speed turns at the middle one.
    // Only blades turn: an icon the user chose for an air purifier stays still.
    const iconRef = this.config?.icon ?? glyphFor(view);
    const blades = iconRef === 'fan' || iconRef === 'mdi:fan' || iconRef === 'mdi:ceiling-fan';
    const level =
      !on || unusable || !blades
        ? 0
        : speed === null
          ? 2
          : speed <= 0
            ? 0
            : speed <= 34
              ? 1
              : speed <= 67
                ? 2
                : 3;
    const turn = `--dv-fan-slow:${level === 1 || level === 3 ? 'running' : 'paused'};--dv-fan-fast:${level >= 2 ? 'running' : 'paused'}`;

    const fine = this.fine;
    const scale = this.scale(count);
    const labels: Labels = fine
      ? [0, 0.2, 0.4, 0.6, 0.8, 1].map(
          (f) =>
            [
              f,
              formatNumber(this.hass, fine.min + f * (fine.max - fine.min), { digits: 0 }),
            ] as const,
        )
      : scale.labels;
    const speedLabel = this.t('fan.speed');

    return html`<article
      class="fv-card dv-card dv-fan ${unusable ? 'is-unavailable is-off' : ''}"
      style=${turn}
      data-card
    >
      ${head({
        icon: iconRef,
        tone,
        title: name,
        sub:
          this.config?.subtitle ?? (view.areaName || (unusable ? '' : stateText(this.hass, view))),
        trailing: unusable
          ? badge(stateText(this.hass, view), 'off')
          : toggle(on, 'fan', (next) => this.power(view, next), name),
        onIconTap: () => this.tap(view.id, { action: 'more-info' }),
        iconLabel: name,
      })}
      ${
        view.supports(SET_SPEED)
          ? html` <div class="dv-value fv-value-row">
                ${readout({ label: speedLabel, value: figure === null ? '—' : formatNumber(this.hass, figure, { digits: 0 }), unit: figure === null ? '' : '%', size: 'l' })}
                ${unusable ? nothing : this.speedStepper.get(speedLabel, () => stepper((nudge) => this.stepSpeed(nudge), { decrease: `${speedLabel} · ${this.t('common.decrease')}`, increase: `${speedLabel} · ${this.t('common.increase')}` }))}
              </div>
              <fluvy-ruler
                .value=${Math.round((speed ?? 0) / step) * step}
                .min=${0}
                .max=${100}
                .step=${step}
                .length=${this.contentWidth}
                .minor=${scale.minor}
                .major=${scale.major}
                .tone=${on && !unusable ? 'fan' : 'neutral'}
                ?inactive=${speed === null || !on}
                ?wake=${!unusable && speed !== null}
                ?disabled=${unusable}
                unit="%"
                .label=${`${name} · ${speedLabel}`}
                .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => {
                  this.dragged = event.detail.value;
                }}
                @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.setSpeed(view, event.detail.value, false)}
                @fluvy-window=${(event: CustomEvent<RulerWindowDetail>) => {
                  this.fine = event.detail.fine ? event.detail : null;
                }}
              ></fluvy-ruler>
              ${rulerLabels(labels)}`
          : nothing
      }
      ${rows.length ? html`<div class="dv-rows">${rows}</div>` : nothing}
      ${
        showPresets
          ? html`${label(this.t('fan.preset'))}${chips(chipItems, (key) => {
              if (unusable) return;
              this.presetHold.set(key);
              this.call('fan', 'set_preset_mode', { preset_mode: key });
            })}`
          : nothing
      }
    </article>`;
  }
}
