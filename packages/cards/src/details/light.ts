import { formatNumber, sliderStill, sliderStyleOf, type EntityView } from '@fluvy/core';
import {
  clamp,
  label,
  rulerLabels,
  type DialChangeDetail,
  type RulerChangeDetail,
  type Tone,
} from '@fluvy/ui';
import { html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { Hold, shownStateText } from '../cover/common.js';
import * as colour from '../light/colour.js';
import { Level } from '../shared/level.js';
import { COLOURED, dims, hexOf, litColour, withMembers } from '../shared/light.js';
import { modeWord } from '../shared/mode-words.js';
import type { DaySpec } from './history.js';
import { keys, listAttr, sheetRows, type Key } from './parts.js';
import { DetailsSheet, type Status } from './sheet.js';

/** A light's `supported_features` bit for its effects. */
const EFFECT = 4;
/** How long a colour chosen is shown while the bulb has not reported it. */
const HOLD_MS = 5000;

/**
 * A light's details: its brightness on the dial, in the lamp's own colour; under it one step down, its switch and one
 * step up; then the light card's own colour controls — the hue ruler or the temperature ruler in one slot, and the
 * quick colours — and its effect where it has some. A light that only switches is its ring, lit or not, and its
 * switch.
 */
export class FluvyDetailsLight extends DetailsSheet {
  static override styles: CSSResultGroup = [
    ...(DetailsSheet.styles as CSSResultGroup[]),
    colour.styles,
  ];

  /** The brightness the finger sets: held until the lamp reports it, the keys' taps sent as one call. */
  private readonly level = new Level(this, (value) => this.send(value));
  /** The colour the finger chose, shown (the check, the ruler, the accent) until the bulb reports it or 5 s pass. */
  private heldColour: { choice: colour.HeldColour; expires: number } | null = null;
  private colourTimer = 0;
  private readonly effect = new Hold<string | null>(this);

  /** A light group's members are watched too: its colour is theirs. */
  protected override watched(): readonly string[] {
    return withMembers(super.watched(), this.hass);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.colourTimer);
    this.effect.clear();
  }

  private send(value: number): void {
    if (value <= 0) this.call('light', 'turn_off');
    else this.call('light', 'turn_on', { brightness_pct: value });
  }

  /** On, or about to be: the switch flipped, or a level chosen that the lamp has not reported yet. */
  private on(view: EntityView): boolean {
    return this.stateOf(view) === 'on' || (this.level.chosen ?? 0) > 0;
  }

  /** The brightness the lamp reports, in percent: 1 at the least while it is on, 0 while it is off. */
  private reported(view: EntityView): number {
    const raw = view.attr<number | null>('brightness');
    return this.on(view) && typeof raw === 'number'
      ? Math.max(1, Math.round((raw / 255) * 100))
      : 0;
  }

  private percent(value: number): string {
    return formatNumber(this.hass, value, { digits: 0 });
  }

  protected tone(): Tone {
    return 'light';
  }

  protected active(view: EntityView): boolean {
    return this.on(view);
  }

  /** The colour the lamp glows (a group: its lit members'), the finger's choice while it is held: what the sheet wears. */
  protected override accent(view: EntityView): string | undefined {
    const choice = this.heldColour?.choice;
    const glow =
      choice && 'rgb' in choice
        ? hexOf(choice.rgb)
        : litColour(view, this.on(view), undefined, this.hass);
    return glow ? this.accents.item(glow) : undefined;
  }

  protected status(view: EntityView): Status {
    const on = this.on(view);
    const state = shownStateText(this.hass, view, on ? 'on' : this.stateOf(view));
    const level = this.level.preview ?? this.level.read(this.reported(view));
    return {
      parts:
        on && dims(listAttr(view.attr('supported_color_modes'))) && level > 0
          ? [state, `${this.percent(level)} %`]
          : [state],
    };
  }

  protected daySpec(view: EntityView): DaySpec {
    return {
      kind: 'state',
      active: (state) => state === 'on',
      word: shownStateText(this.hass, view, 'on'),
    };
  }

  protected dayLevel(view: EntityView): number {
    return this.on(view) ? 1 : 0;
  }

  /** A swatch, the hue ruler or the picker: the colour is held for five seconds, as a level is, and the bulb wakes to it. */
  private pickColour(
    view: EntityView,
    choice: colour.HeldColour,
    data: Record<string, unknown>,
  ): void {
    this.heldColour = { choice, expires: Date.now() + HOLD_MS };
    clearTimeout(this.colourTimer);
    this.colourTimer = window.setTimeout(() => {
      this.heldColour = null;
      this.requestUpdate();
    }, HOLD_MS);
    this.expect(view.id, 'on');
    this.call('light', 'turn_on', data);
  }

  /**
   * The colour-temperature ruler under its label, warm to cool, as the light card draws it: 50 K a step, its ticks in
   * the warm → cool tint, at rest while the lamp is off. Its label takes its short form where the column does not hold
   * the long one.
   */
  private renderTemperature(
    name: string,
    on: boolean,
    kelvin: number,
    minK: number,
    maxK: number,
    unusable: boolean,
  ): TemplateResult {
    const words = this.t('light.temperature');
    return html`${label(this.ruler.width('fv-label', words) <= this.room ? words : this.t('light.temperature_short'))}
      <fluvy-ruler
        .value=${kelvin}
        .min=${minK}
        .max=${maxK}
        .step=${50}
        .length=${this.room}
        tone="accent"
        .minor=${0.1}
        .major=${0.5}
        ?inactive=${!on}
        ?disabled=${unusable}
        .look=${sliderStyleOf(undefined)}
        ?still=${sliderStill()}
        tint="warm-cool"
        unit="K"
        .label=${`${name} · ${words}`}
        .format=${(value: number) => this.percent(value)}
        @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) =>
          this.call('light', 'turn_on', { color_temp_kelvin: event.detail.value })}
      ></fluvy-ruler>
      ${rulerLabels([
        [0, this.t('light.warm')],
        [1, this.t('light.cool')],
      ])}`;
  }

  /** The colour bulb's controls, the white bulb's temperature ruler, or nothing for a lamp that has neither. */
  private renderColour(
    view: EntityView,
    name: string,
    on: boolean,
    modes: readonly string[],
    unusable: boolean,
  ): TemplateResult | typeof nothing {
    const kelvin = view.attr<number | null>('color_temp_kelvin');
    const minK = view.attr<number>('min_color_temp_kelvin') ?? 2000;
    const maxK = view.attr<number>('max_color_temp_kelvin') ?? 6500;
    // the held colour lets go when the bulb reports it, or when its time is up
    if (
      this.heldColour &&
      (Date.now() > this.heldColour.expires ||
        colour.reported(view, this.heldColour.choice, maxK - minK))
    )
      this.heldColour = null;
    const temperature = modes.includes('color_temp')
      ? () => this.renderTemperature(name, on, kelvin ?? minK, minK, maxK, unusable)
      : undefined;
    if (!modes.some((mode) => COLOURED.has(mode))) return temperature?.() ?? nothing;
    return colour.colourControls({
      bulb: colour.bulbOf(view, on, this.heldColour?.choice ?? null),
      t: (key) => this.t(key),
      name,
      width: this.room,
      on,
      colors: undefined,
      minK,
      maxK,
      format: (value) => this.percent(value),
      temperature,
      disabled: unusable,
      look: sliderStyleOf(undefined),
      still: sliderStill(),
      words: (items) => items,
      host: this,
      pick: (choice, data) => this.pickColour(view, choice, data),
    });
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const on = !unusable && this.on(view);
    const modes = listAttr(view.attr('supported_color_modes'));
    const dimmable = dims(modes);
    const level = this.level.read(this.reported(view));
    // lit, or the finger on the knob of a lamp that is off: the figure is the level, in the light's tone
    const lit = on || this.level.preview !== null;
    const tone: Tone = unusable || !lit ? 'neutral' : 'light';
    const brightness = this.t('light.brightness');
    const row: Key[] = [
      ...(dimmable
        ? [
            {
              key: 'down',
              glyph: 'minus' as const,
              label: `${name} · ${this.t('common.decrease')}`,
              step: -1 as const,
              disabled: unusable,
            },
          ]
        : []),
      {
        key: 'power',
        glyph: 'power',
        label: `${name} · ${this.t('sheets.power')}`,
        on,
        tone: 'light',
        disabled: unusable,
      },
      ...(dimmable
        ? [
            {
              key: 'up',
              glyph: 'plus' as const,
              label: `${name} · ${this.t('common.increase')}`,
              step: 1 as const,
              disabled: unusable,
            },
          ]
        : []),
    ];
    const effects = view.supports(EFFECT) ? listAttr(view.attr('effect_list')) : [];
    const effect = this.effect.read(view.attr<string | null>('effect') ?? null);
    return html`<div class="dt-hero">
        <fluvy-dial
          .radius=${this.ring}
          .large=${this.large}
          .stepper=${false}
          .tone=${tone}
          .min=${0}
          .max=${100}
          .step=${1}
          .value=${dimmable ? level : undefined}
          .gauge=${!dimmable}
          .fill=${dimmable ? undefined : on ? 1 : 0}
          .unit=${'%'}
          .sub=${dimmable ? this.dialWords(brightness) : ''}
          .text=${unusable ? '—' : dimmable && lit ? undefined : shownStateText(this.hass, view, on ? 'on' : 'off')}
          .name=${`${name} · ${brightness}`}
          min-label=${dimmable ? this.percent(0) : ''}
          max-label=${dimmable ? this.percent(100) : ''}
          ?disabled=${unusable}
          .format=${(value: number) => this.percent(value)}
          @fluvy-input=${(event: CustomEvent<DialChangeDetail>) =>
            this.level.input(event.detail.value ?? 0, false)}
          @fluvy-change=${(event: CustomEvent<DialChangeDetail>) =>
            this.level.set(event.detail.value ?? 0)}
        ></fluvy-dial>
      </div>
      ${keys(
        row,
        this.room,
        () => {
          this.expect(view.id, on ? 'off' : 'on');
          this.call('light', on ? 'turn_off' : 'turn_on');
        },
        (direction) => this.level.step(clamp(this.level.current + direction, 0, 100)),
      )}
      ${dimmable ? this.renderColour(view, name, on, modes, unusable) : nothing}
      ${sheetRows(
        this.ruler,
        this.room,
        effects.length
          ? [
              {
                kind: 'choice',
                icon: 'sparkle',
                title: this.t('sheets.effect'),
                chosen: effect,
                options: effects,
                word: (option) => modeWord(this.rawHass, view, 'effect', option),
                disabled: unusable,
                choose: (option) => {
                  this.effect.set(option);
                  this.expect(view.id, 'on');
                  this.call('light', 'turn_on', { effect: option });
                },
              },
            ]
          : [],
      )}`;
  }
}

if (!customElements.get('fluvy-details-light'))
  customElements.define('fluvy-details-light', FluvyDetailsLight);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-light': FluvyDetailsLight;
  }
}
