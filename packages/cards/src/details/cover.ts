import { formatNumber, numberAttr, sliderStill, sliderStyleOf, type EntityView } from '@fluvy/core';
import {
  clamp,
  label,
  rulerLabels,
  stepper,
  type DialChangeDetail,
  type RulerChangeDetail,
  type Tone,
} from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { Hold, releasePresses, shownStateText, StableTemplate } from '../cover/common.js';
import type { DaySpec } from './history.js';
import { keys, sheetRows, STEPS_END, type Key } from './parts.js';
import { DetailsSheet, type Status } from './sheet.js';

/* cover / valve supported_features */
const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;
const OPEN_TILT = 16;
const CLOSE_TILT = 32;
const SET_TILT_POSITION = 128;

type Percent = number | null;

/** Positions are whole percents; a device that answers 59 for 60 has arrived. */
const near = (a: Percent, b: Percent): boolean => a !== null && b !== null && Math.abs(a - b) <= 1;

const percentAttr = (view: EntityView, key: string): Percent => {
  const value = numberAttr(view, key);
  return value === null ? null : clamp(Math.round(value), 0, 100);
};

/** A cover as it stands, and the state it is drawn in, read as the cover card reads it. */
interface Motion {
  /** The position it reports; none for a cover that has none. */
  readonly reported: Percent;
  readonly fullyOpen: boolean;
  readonly fullyClosed: boolean;
  /** The state drawn: the one expected, until the cover says its travel is over. */
  readonly shown: string;
  readonly moving: boolean;
}

/**
 * A cover's details, and a valve's: its position on the dial, the dial every sheet is built round — closed at its
 * start, open at its end, the knob where the cover stands and holding where it was sent while it travels; under it
 * open, stop and close, each one it takes; then its tilt, on a ruler where it takes an angle, as two steps where it
 * only opens and closes. A cover with no position is its ring, lit while it is open, and its commands.
 */
export class FluvyDetailsCover extends DetailsSheet {
  private travelling = false;
  private readonly target = new Hold<Percent>(this, () => this.travelling);
  private readonly tilt = new Hold<Percent>(this);
  private readonly tiltSteps = new StableTemplate(this);

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.target.clear();
    this.tilt.clear();
  }

  private motion(view: EntityView): Motion {
    const reported = percentAttr(view, 'current_position');
    // Home Assistant's own rule for the ends: the position when there is one, the state otherwise
    const fullyOpen = reported !== null ? reported >= 100 : view.state === 'open';
    const fullyClosed = reported !== null ? reported <= 0 : view.state === 'closed';
    // the travel is over once the cover says so, even if the "Opening" expected never came
    const expected = this.stateOf(view);
    const shown =
      (expected === 'opening' && fullyOpen) || (expected === 'closing' && fullyClosed)
        ? view.state
        : expected;
    return {
      reported,
      fullyOpen,
      fullyClosed,
      shown,
      moving: shown === 'opening' || shown === 'closing',
    };
  }

  /**
   * The commands the cover takes, in their row's order: open, stop and close, each one it supports, still where it
   * would do nothing (open while fully open or opening). A cover whose state is only assumed (one-way radio) keeps
   * both directions live, as Home Assistant does.
   */
  private commands(view: EntityView, motion: Motion, name: string, unusable: boolean): Key[] {
    const assumed = view.attr<boolean>('assumed_state') === true;
    const key = (id: string, glyph: string, word: string, disabled: boolean): Key => ({
      key: id,
      glyph,
      label: `${name} · ${word}`,
      disabled: unusable || disabled,
    });
    return [
      ...(view.supports(OPEN)
        ? [
            key(
              'open',
              'up',
              this.t('cover.open'),
              !assumed && (motion.fullyOpen || motion.shown === 'opening'),
            ),
          ]
        : []),
      ...(view.supports(STOP) ? [key('stop', 'stop', this.t('cover.stop'), false)] : []),
      ...(view.supports(CLOSE)
        ? [
            key(
              'close',
              'down',
              this.t('cover.close'),
              !assumed && (motion.fullyClosed || motion.shown === 'closing'),
            ),
          ]
        : []),
    ];
  }

  /**
   * Runs a command: stop drops the position asked for and the travel expected; open and close show the travel at once
   * and, on a cover that has a position, hold the end they go to while it travels.
   */
  private command(view: EntityView, key: string): void {
    const valve = view.domain === 'valve';
    if (key === 'stop') {
      this.target.clear();
      this.expect(view.id, view.state); // drops an "Opening" still expected
      this.call(view.domain, valve ? 'stop_valve' : 'stop_cover');
      return;
    }
    const open = key === 'open';
    if (view.supports(SET_POSITION) && percentAttr(view, 'current_position') !== null)
      this.target.set(open ? 100 : 0);
    this.expect(view.id, open ? 'opening' : 'closing');
    this.call(
      view.domain,
      valve ? (open ? 'open_valve' : 'close_valve') : open ? 'open_cover' : 'close_cover',
    );
  }

  /** Sends the cover to a position, held until it arrives. */
  private moveTo(view: EntityView, position: number): void {
    const value = clamp(Math.round(position), 0, 100);
    this.target.set(value);
    this.expect(view.id, view.state); // a new destination: drops an "Opening" still expected from the keys
    this.call(view.domain, view.domain === 'valve' ? 'set_valve_position' : 'set_cover_position', {
      position: value,
    });
  }

  /** Where the cover stands as it is drawn: where it was sent while it travels there; none for one with no position. */
  private position(motion: Motion): Percent {
    return motion.reported === null ? null : this.target.read(motion.reported, near);
  }

  private percent(value: number): string {
    return formatNumber(this.hass, value, { digits: 0 });
  }

  protected tone(view: EntityView): Tone {
    return view.domain === 'valve' ? 'water' : 'accent';
  }

  /** Open at all, or on its way: what its circle and its dial light for. */
  protected active(view: EntityView): boolean {
    const motion = this.motion(view);
    const position = this.position(motion);
    return motion.moving || (position !== null ? position > 0 : motion.shown !== 'closed');
  }

  protected status(view: EntityView): Status {
    const motion = this.motion(view);
    const position = this.position(motion);
    const state = shownStateText(this.hass, view, motion.shown);
    return {
      parts:
        position !== null && position > 0 && position < 100
          ? [state, `${this.percent(position)} %`]
          : [state],
    };
  }

  protected daySpec(view: EntityView): DaySpec {
    return {
      kind: 'state',
      active: (state) => state === 'open' || state === 'opening' || state === 'closing',
      word: shownStateText(this.hass, view, 'open'),
    };
  }

  protected dayLevel(view: EntityView): number {
    return this.active(view) ? 1 : 0;
  }

  /** The tilt under the keys: a ruler where the cover takes an angle, two steps where it only opens and closes it. */
  private renderTilt(view: EntityView, name: string, unusable: boolean): TemplateResult {
    const title = this.t('cover.tilt');
    if (!view.supports(SET_TILT_POSITION))
      return html`${sheetRows(this.ruler, this.room, [
        {
          kind: 'control',
          icon: 'tilt',
          title,
          disabled: unusable,
          end: STEPS_END,
          control: this.tiltSteps.get(`${name}|${title}|${unusable}`, () =>
            stepper(
              (direction) =>
                this.call('cover', direction > 0 ? 'open_cover_tilt' : 'close_cover_tilt'),
              {
                disabled: unusable,
                decrease: `${name} · ${title} · ${this.t('cover.close')}`,
                increase: `${name} · ${title} · ${this.t('cover.open')}`,
              },
            ),
          ),
        },
      ])}`;
    const tilt = this.tilt.read(percentAttr(view, 'current_tilt_position'), near);
    return html`${label(title)}
      <fluvy-ruler
        .value=${tilt ?? 0}
        .min=${0}
        .max=${100}
        .step=${1}
        .length=${this.room}
        .tone=${this.tone(view)}
        ?inactive=${tilt === null}
        ?disabled=${unusable}
        .look=${sliderStyleOf(undefined)}
        ?still=${sliderStill()}
        unit="%"
        .label=${`${name} · ${title}`}
        .format=${(value: number) => this.percent(value)}
        @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => {
          const value = Math.round(event.detail.value);
          this.tilt.set(value);
          this.call('cover', 'set_cover_tilt_position', { tilt_position: value });
        }}
      ></fluvy-ruler>
      ${rulerLabels([
        [0, this.percent(0)],
        [0.5, this.percent(50)],
        [1, this.percent(100)],
      ])}`;
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const motion = this.motion(view);
    this.travelling = motion.moving;
    const position = this.position(motion);
    const lit = !unusable && this.active(view);
    const positioned = view.supports(SET_POSITION);
    const tilts =
      view.domain === 'cover' &&
      (view.supports(SET_TILT_POSITION) || view.supports(OPEN_TILT) || view.supports(CLOSE_TILT));
    const where = this.t('cover.position');
    return html`<div class="dt-hero">
        <fluvy-dial
          .radius=${this.ring}
          .large=${this.large}
          .stepper=${false}
          .tone=${lit ? this.tone(view) : 'neutral'}
          .min=${0}
          .max=${100}
          .step=${1}
          .value=${positioned ? (position ?? undefined) : undefined}
          .gauge=${!positioned}
          .fill=${positioned ? undefined : lit ? 1 : 0}
          .unit=${'%'}
          .sub=${positioned ? this.dialWords(where) : ''}
          .text=${unusable || (positioned && position === null) ? '—' : positioned ? undefined : shownStateText(this.hass, view, motion.shown)}
          .name=${`${name} · ${where}`}
          min-label=${positioned ? this.percent(0) : ''}
          max-label=${positioned ? this.percent(100) : ''}
          ?disabled=${unusable || (positioned && position === null)}
          .format=${(value: number) => this.percent(value)}
          @fluvy-change=${(event: CustomEvent<DialChangeDetail>) =>
            this.moveTo(view, event.detail.value ?? 0)}
        ></fluvy-dial>
      </div>
      ${keys(this.commands(view, motion, name, unusable), this.room, (key) =>
        this.command(view, key),
      )}
      ${tilts ? this.renderTilt(view, name, unusable) : nothing}`;
  }
}

if (!customElements.get('fluvy-details-cover'))
  customElements.define('fluvy-details-cover', FluvyDetailsCover);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-cover': FluvyDetailsCover;
  }
}
