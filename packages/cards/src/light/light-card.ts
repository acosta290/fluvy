import {
  formatNumber,
  stateText,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  head,
  label,
  readout,
  rulerLabels,
  sheetStyles,
  stepper,
  toggle,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import { boolField, entityField, formLabels, nameIconFields } from '../shared/form.js';

export interface LightCardConfig extends FluvyCardConfig {
  /** Send brightness while dragging (throttled) instead of only on release. */
  live_update?: boolean;
  show_temperature?: boolean;
  /** The colour-temperature ruler's ticks take a faint warm → cool tint (default). Off = neutral ticks like the brightness ruler. */
  temperature_tint?: boolean;
}

const DIMMABLE = new Set(['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white']);

/**
 * The precision dimmer: a big tabular value with its stepper, the ruler underneath (relative drag,
 * slide away to slow down, hold for the 1 % scale), and a second ruler for colour temperature.
 */
export class FluvyLightCard extends Card<LightCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.slider,
    css`
      .sl-card {
        height: auto;
        min-height: 256px;
      } /* the sheet fixes 256 so its five states line up; a colour-temperature ruler makes the card taller */
      .sl-bubble-row {
        pointer-events: none;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    preview_: { state: true },
    window_: { state: true },
  };

  /** Value under the finger while a drag is in flight. */
  declare preview_: number | null;
  declare window_: RulerWindowDetail | null;

  private lastSend = 0;
  /** The level the user chose, shown until the lamp reports it (slow lamps take seconds) or 5 s pass. */
  private held: { value: number; expires: number } | null = null;
  private heldTimer = 0;
  private sendTimer = 0;
  /** The level on screen right now; the stepper counts from here, never from a value captured at render time. */
  private level = 0;

  constructor() {
    super();
    this.preview_ = null;
    this.window_ = null;
  }

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['light']),
        nameIconFields(),
        boolField('show_temperature'),
        boolField('temperature_tint'),
        boolField('live_update'),
      ],
      ...formLabels({
        show_temperature: 'light.temperature',
        temperature_tint: 'editor.temperature_tint',
        live_update: 'editor.live_update',
      }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): LightCardConfig {
    return {
      type: 'custom:fluvy-light-card',
      entity: entities.find((id) => id.startsWith('light.')) ?? '',
    };
  }

  protected override prepare(config: LightCardConfig): LightCardConfig {
    if (!config.entity) throw new Error('fluvy-light-card: "entity" is required');
    return {
      ...config,
      show_temperature: config.show_temperature ?? true,
      temperature_tint: config.temperature_tint ?? true,
      live_update: config.live_update ?? false,
    };
  }

  override getCardSize(): number {
    return 4;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 9 };
  }

  private hold(value: number): void {
    this.held = { value, expires: Date.now() + 5000 };
    clearTimeout(this.heldTimer);
    this.heldTimer = window.setTimeout(() => {
      this.held = null;
      this.requestUpdate();
    }, 5000);
    this.requestUpdate();
  }

  private send(value: number): void {
    if (value <= 0) this.call('light', 'turn_off');
    else this.call('light', 'turn_on', { brightness_pct: value });
  }

  /** From the ruler: the choice is final, send it now. */
  private setBrightness(value: number): void {
    this.hold(value);
    clearTimeout(this.sendTimer);
    this.send(value);
  }

  /** From the stepper: every tap counts from what is on screen, and a burst of taps is one call. */
  private stepBrightness(direction: 1 | -1): void {
    const next = Math.min(100, Math.max(0, this.level + direction));
    this.hold(next);
    clearTimeout(this.sendTimer);
    this.sendTimer = window.setTimeout(() => this.send(next), 650); // longer than the 530 ms before a held button starts repeating
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.heldTimer);
    clearTimeout(this.sendTimer);
  }

  private onInput(value: number): void {
    this.preview_ = value;
    if (!this.config?.live_update) return;
    const now = performance.now();
    if (now - this.lastSend > 200) {
      this.lastSend = now;
      this.setBrightness(value);
    }
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);
    const unusable = view.status === 'unavailable';
    const on = this.stateOf(view) === 'on' || (this.held !== null && this.held.value > 0);
    const modes = view.attr<string[]>('supported_color_modes') ?? [];
    const dimmable = modes.some((m) => DIMMABLE.has(m));
    const raw = view.attr<number | null>('brightness');
    const reported = on && typeof raw === 'number' ? Math.max(1, Math.round((raw / 255) * 100)) : 0;
    // released only by an exact match or by time: a ±1 tolerance would swallow every single-step change
    if (this.held && (this.held.value === reported || Date.now() > this.held.expires))
      this.held = null;
    const level = this.held ? this.held.value : reported;
    this.level = level;
    const shownLevel = this.preview_ ?? level;
    const tone: Tone = unusable ? 'off' : 'light';
    const w = this.contentWidth;
    const win = this.window_?.fine ? this.window_ : null;
    // on the fine scale the labels are the major ticks themselves (whole values); the ones too close to an end are left out
    const ticks: [number, string][] = win
      ? win.marks
          .filter(([f]) => f > 0.06 && f < 0.94)
          .map(([f, v]) => [f, formatNumber(this.hass, v, { digits: 0 })])
      : [
          [0, '0'],
          [0.25, '25'],
          [0.5, '50'],
          [0.75, '75'],
          [1, '100'],
        ];

    const kelvin = view.attr<number | null>('color_temp_kelvin');
    const minK = view.attr<number>('min_color_temp_kelvin') ?? 2000;
    const maxK = view.attr<number>('max_color_temp_kelvin') ?? 6500;
    const hasTemp = modes.includes('color_temp') && this.config?.show_temperature !== false;

    return html`<article
      class="fv-card sl-card ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
    >
      ${head({
        icon: this.config?.icon ?? glyphFor(view),
        tone: on ? tone : unusable ? 'off' : 'neutral',
        title: name,
        sub: view.areaName || stateText(this.hass, view),
        trailing: unusable
          ? nothing
          : toggle(
              on,
              'light',
              (next) => {
                this.expect(view.id, next ? 'on' : 'off');
                this.call('light', next ? 'turn_on' : 'turn_off');
              },
              name,
            ),
        onIconTap: () => this.tap(view.id, { action: 'more-info' }),
        iconLabel: name,
      })}
      ${
        dimmable
          ? html` <div class="sl-value fv-value-row">
                ${readout({ label: this.t('light.brightness'), value: unusable ? '—' : on || this.preview_ !== null ? formatNumber(this.hass, shownLevel, { digits: 0 }) : this.t('common.off'), unit: unusable || (!on && this.preview_ === null) ? '' : '%', size: 'l' })}
                ${unusable ? nothing : stepper((d) => this.stepBrightness(d), { decrease: this.t('common.decrease'), increase: this.t('common.increase') })}
              </div>
              <div class="sl-bubble-row"></div>
              <fluvy-ruler
                .value=${level}
                .min=${0}
                .max=${100}
                .step=${1}
                .length=${w}
                .tone=${on ? 'light' : 'neutral'}
                ?disabled=${unusable}
                ?inactive=${!on}
                ?wake=${!unusable}
                unit="%"
                .label=${`${name} · ${this.t('light.brightness')}`}
                .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
                @fluvy-input=${(e: CustomEvent<RulerChangeDetail>) => this.onInput(e.detail.value)}
                @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => {
                  this.preview_ = null;
                  this.setBrightness(e.detail.value);
                }}
                @fluvy-window=${(e: CustomEvent<RulerWindowDetail>) => {
                  this.window_ = e.detail;
                }}
              ></fluvy-ruler>
              ${rulerLabels(ticks)}`
          : nothing
      }
      ${
        hasTemp && !unusable
          ? html` ${label(this.t('light.temperature'))}
              <fluvy-ruler
                .value=${kelvin ?? minK}
                .min=${minK}
                .max=${maxK}
                .step=${50}
                .length=${w}
                tone="accent"
                .minor=${0.1}
                .major=${0.5}
                ?inactive=${!on}
                .tint=${this.config?.temperature_tint === false ? '' : 'warm-cool'}
                unit="K"
                .label=${`${name} · ${this.t('light.temperature')}`}
                .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
                @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => this.call('light', 'turn_on', { color_temp_kelvin: e.detail.value })}
              ></fluvy-ruler>
              ${rulerLabels([
                [0, this.t('light.warm')],
                [1, this.t('light.cool')],
              ])}`
          : nothing
      }
    </article>`;
  }
}
