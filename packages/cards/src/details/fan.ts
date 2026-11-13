import { formatNumber, numberAttr, strings, type EntityView } from '@fluvy/core';
import { clamp, type DialChangeDetail, type Tone } from '@fluvy/ui';
import { html, type TemplateResult } from 'lit';
import { Burst, Hold, shownStateText } from '../cover/common.js';
import { speedCount } from '../fan/fan-card.js';
import { modeWord } from '../shared/mode-words.js';
import { fanPercentage } from '../shared/scale.js';
import type { DaySpec } from './history.js';
import { keys, listAttr, sheetRows, type Key, type SheetRow } from './parts.js';
import { DetailsSheet, type Status } from './sheet.js';

const fanStrings = strings('fan');

/* fan supported_features */
const SET_SPEED = 1;
const OSCILLATE = 2;
const DIRECTION = 4;
const PRESET_MODE = 8;

type Direction = 'forward' | 'reverse';

/**
 * A fan's details: its speed on the dial, in the fan's own speeds (a three-speed fan has three stops); under it one
 * speed down, its switch and one up; then its oscillation, its direction and its preset, each a row. A fan that only
 * switches is its ring, lit while it runs, and its switch.
 */
export class FluvyDetailsFan extends DetailsSheet {
  static override properties = { ...DetailsSheet.properties, dragged: { state: true } };

  /** The speed under the finger while the dial's knob is held: a fan that is off shows it, not its word for off. */
  declare dragged: number | null;

  /** The speed set, shown until the fan reports it; the keys' steps are one call once they stop. */
  private readonly speed = new Hold<number | null>(this);
  private readonly burst = new Burst();
  private readonly oscillating = new Hold<boolean>(this);
  private readonly direction = new Hold<Direction | null>(this);
  private readonly preset = new Hold<string | null>(this);

  constructor() {
    super();
    this.dragged = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.burst.flush();
    for (const hold of [this.speed, this.oscillating, this.direction, this.preset]) hold.clear();
  }

  /** The speed to draw, as the fan card reads it: none when the fan cannot say (unknown, or a preset that runs its own). */
  private speedOf(view: EntityView, on: boolean): number | null {
    const reported = numberAttr(view, 'percentage');
    const speed =
      view.status !== 'ok' ? null : !on ? 0 : reported === null ? null : clamp(reported, 0, 100);
    // a fan that answers within half a speed of what was asked has arrived
    const tolerance = 50 / speedCount(view);
    return this.speed.read(
      speed,
      (a, b) => a !== null && b !== null && Math.abs(a - b) <= tolerance,
    );
  }

  /** The speed set, held until the fan reports it; the keys' steps coalesce into one call (`fanPercentage`). */
  private setSpeed(view: EntityView, value: number, coalesce: boolean): void {
    const percentage = fanPercentage(value);
    this.speed.set(percentage);
    this.expect(view.id, percentage > 0 ? 'on' : 'off');
    const send = (): void => this.call('fan', 'set_percentage', { percentage });
    if (coalesce) this.burst.push(send);
    else {
      this.burst.flush();
      send();
    }
  }

  /** One of the fan's own speeds up or down from the nearest one, counted from what is on screen. */
  private stepSpeed(view: EntityView, direction: 1 | -1): void {
    const count = speedCount(view);
    const current = this.speedOf(view, this.on(view)) ?? 0;
    const index = clamp(Math.round((current * count) / 100) + direction, 0, count);
    this.setSpeed(view, (index * 100) / count, true);
  }

  /** The fan's switch: what the keys still held goes first, and the speed held lets go. */
  private power(view: EntityView, next: boolean): void {
    this.burst.flush();
    this.speed.clear();
    this.expect(view.id, next ? 'on' : 'off');
    this.call('fan', next ? 'turn_on' : 'turn_off');
  }

  private on(view: EntityView): boolean {
    return this.stateOf(view) === 'on';
  }

  private percent(value: number): string {
    return formatNumber(this.hass, value, { digits: 0 });
  }

  protected tone(): Tone {
    return 'fan';
  }

  protected active(view: EntityView): boolean {
    return this.on(view);
  }

  protected status(view: EntityView): Status {
    const on = this.on(view);
    const state = shownStateText(this.hass, view, this.stateOf(view));
    const speed = view.supports(SET_SPEED) ? this.speedOf(view, on) : null;
    return { parts: on && speed !== null ? [state, `${this.percent(speed)} %`] : [state] };
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

  /** Its oscillation, its direction and its preset, each where the fan has it. */
  private rows(view: EntityView, unusable: boolean): SheetRow[] {
    const rows: SheetRow[] = [];
    if (view.supports(OSCILLATE))
      rows.push({
        kind: 'switch',
        icon: 'swing',
        title: this.t('fan.oscillate'),
        on: this.oscillating.read(view.attr<boolean | null>('oscillating') === true),
        tone: 'fan',
        disabled: unusable,
        toggle: (next) => {
          this.oscillating.set(next);
          this.call('fan', 'oscillate', { oscillating: next });
        },
      });
    if (view.supports(DIRECTION)) {
      const raw = view.attr<string | null>('direction');
      const direction = this.direction.read(raw === 'forward' || raw === 'reverse' ? raw : null);
      const flipped: Direction = direction === 'reverse' ? 'forward' : 'reverse';
      rows.push({
        kind: 'tap',
        icon: 'auto',
        title: this.t('fan.direction'),
        sub: direction ? fanStrings(this.hass, direction) : '',
        disabled: unusable,
        tap: () => {
          this.direction.set(flipped);
          this.call('fan', 'set_direction', { direction: flipped });
        },
      });
    }
    const presets = view.supports(PRESET_MODE) ? listAttr(view.attr('preset_modes')) : [];
    if (presets.length)
      rows.push({
        kind: 'choice',
        icon: 'sliders',
        title: this.t('fan.preset'),
        chosen: this.preset.read(view.attr<string | null>('preset_mode') ?? null),
        options: presets,
        word: (option) => modeWord(this.rawHass, view, 'preset_mode', option),
        disabled: unusable,
        choose: (option) => {
          this.preset.set(option);
          this.expect(view.id, 'on');
          this.call('fan', 'set_preset_mode', { preset_mode: option });
        },
      });
    return rows;
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const on = !unusable && this.on(view);
    const speeds = view.supports(SET_SPEED);
    const speed = speeds ? this.speedOf(view, on) : null;
    // running, or the finger on the knob of a fan that is off: the figure is the speed, in the fan's tone
    const lit = on || this.dragged !== null;
    const words = this.t('fan.speed');
    const step = (direction: 1 | -1, glyph: 'minus' | 'plus', word: string): Key => ({
      key: glyph,
      glyph,
      label: `${name} · ${words} · ${word}`,
      step: direction,
      disabled: unusable,
    });
    const row: Key[] = [
      ...(speeds ? [step(-1, 'minus', this.t('common.decrease'))] : []),
      {
        key: 'power',
        glyph: 'power',
        label: `${name} · ${this.t('sheets.power')}`,
        on,
        tone: 'fan',
        disabled: unusable,
      },
      ...(speeds ? [step(1, 'plus', this.t('common.increase'))] : []),
    ];
    return html`<div class="dt-hero">
        <fluvy-dial
          .radius=${this.ring}
          .large=${this.large}
          .stepper=${false}
          .tone=${lit ? 'fan' : 'neutral'}
          .min=${0}
          .max=${100}
          .step=${100 / speedCount(view)}
          .value=${speeds ? (speed ?? undefined) : undefined}
          .gauge=${!speeds}
          .fill=${speeds ? undefined : on ? 1 : 0}
          .unit=${'%'}
          .sub=${speeds ? this.dialWords(words) : ''}
          .text=${unusable || (speeds && on && speed === null) ? '—' : speeds && lit ? undefined : shownStateText(this.hass, view, on ? 'on' : 'off')}
          .name=${`${name} · ${words}`}
          min-label=${speeds ? this.percent(0) : ''}
          max-label=${speeds ? this.percent(100) : ''}
          ?disabled=${unusable || (speeds && speed === null)}
          .format=${(value: number) => this.percent(value)}
          @fluvy-input=${(event: CustomEvent<DialChangeDetail>) => {
            this.dragged = event.detail.value ?? null;
          }}
          @fluvy-change=${(event: CustomEvent<DialChangeDetail>) => {
            this.dragged = null;
            this.setSpeed(view, event.detail.value ?? 0, false);
          }}
        ></fluvy-dial>
      </div>
      ${keys(
        row,
        this.room,
        () => this.power(view, !on),
        (direction) => this.stepSpeed(view, direction),
      )}
      ${sheetRows(this.ruler, this.room, this.rows(view, unusable))}`;
  }
}

if (!customElements.get('fluvy-details-fan'))
  customElements.define('fluvy-details-fan', FluvyDetailsFan);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-fan': FluvyDetailsFan;
  }
}
