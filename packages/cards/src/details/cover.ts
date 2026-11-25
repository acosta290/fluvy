import { formatNumber, sliderStill, sliderStyleOf, type EntityView } from '@fluvy/core';
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
import {
  mirror,
  motionOf,
  near,
  percentAttr,
  percentText,
  tiltAngleOf,
  type CoverReads,
  type Motion,
  type Percent,
} from '../cover/reads.js';
import type { DaySpec } from './history.js';
import { keys, sheetRows, STEPS_END, type Key } from './parts.js';
import { configOf, DetailsSheet, type DetailsConfig, type LiveHass, type Status } from './sheet.js';

/* cover / valve supported_features */
const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;
const OPEN_TILT = 16;
const CLOSE_TILT = 32;
const SET_TILT_POSITION = 128;

/**
 * What the card that opened a sheet says of its cover's figures (#258): a Cover card's own keys, for the cover it is
 * the card of. Nothing where any other card opened it: a tile reads a cover as Home Assistant does.
 */
function readsOf(card: unknown, entityId: string | undefined): CoverReads {
  const config = configOf(card);
  return config &&
    config['entity'] === entityId &&
    String(config['type']).endsWith('fluvy-cover-card')
    ? (config as CoverReads)
    : {};
}

/**
 * A cover's details, and a valve's: its position on the dial, the dial every sheet is built round — closed at its
 * start, open at its end, the knob where the cover stands and holding where it was sent while it travels; under it
 * open, stop and close, each one it takes; then its tilt, on a ruler where it takes an angle, as two steps where it
 * only opens and closes. A cover with no position is its ring, lit while it is open, and its commands.
 *
 * It reads its cover as the Cover card that opened it does (#258): a position reported turned round
 * (`invert_position`) or counted as the blind comes down (`direction: down`, the dial then counting so too), a tilt
 * turned round or in degrees (`invert_tilt`, `tilt_angle`), so the card and its sheet never say two figures of one
 * blind.
 */
export class FluvyDetailsCover extends DetailsSheet {
  private travelling = false;
  private readonly target = new Hold<Percent>(this, () => this.travelling);
  private readonly tilt = new Hold<Percent>(this);
  private readonly tiltSteps = new StableTemplate(this);
  /** What its own config says of the cover's figures (docked, the playground's). */
  private own: CoverReads = {};
  /** What the card that opened the sheet says of them (`readsOf`); opened by none, or docked, what its own config says. */
  private reads: CoverReads = {};

  override setConfig(config: DetailsConfig & CoverReads): void {
    super.setConfig(config);
    this.own = this.reads = config;
  }

  override open(openedBy?: HTMLElement, source?: LiveHass, zoom?: number): void {
    this.reads = source ? readsOf(source, this.config?.entity) : this.own;
    super.open(openedBy, source, zoom);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.target.clear();
    this.tilt.clear();
  }

  /** The cover reports 100 % where it is closed, as its card says (`invert_position`). */
  private get inverted(): boolean {
    return this.reads.invert_position === true;
  }

  /** The figure said for how open the cover is: 100 less it where its card counts as the blind comes down. */
  private said(opening: number): number {
    return mirror(this.reads.direction === 'down', opening);
  }

  private motion(view: EntityView): Motion {
    return motionOf(view, this.stateOf(view));
  }

  /**
   * The commands the cover takes, in their row's order: open, stop and close, each one it supports, still where it
   * would do nothing (open while fully open or opening). A cover whose state is only assumed (one-way radio), or whose
   * position its card turns round, keeps both directions live, as Home Assistant does for the first.
   */
  private commands(view: EntityView, motion: Motion, name: string, unusable: boolean): Key[] {
    const live = view.attr<boolean>('assumed_state') === true || this.inverted;
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
              !live && (motion.fullyOpen || motion.shown === 'opening'),
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
              !live && (motion.fullyClosed || motion.shown === 'closing'),
            ),
          ]
        : []),
    ];
  }

  /**
   * Runs a command: stop drops the position asked for and the travel expected; open and close show the travel at once
   * and, on a cover that has a position, hold the end they go to while it travels — never for one that reports its
   * position turned round, which goes to an end the sheet cannot know.
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
    if (
      view.supports(SET_POSITION) &&
      percentAttr(view, 'current_position') !== null &&
      !this.inverted
    )
      this.target.set(open ? 100 : 0);
    this.expect(view.id, open ? 'opening' : 'closing');
    this.call(
      view.domain,
      valve ? (open ? 'open_valve' : 'close_valve') : open ? 'open_cover' : 'close_cover',
    );
  }

  /** Sends the cover to `opening` (how open it is, as the sheet draws it): Home Assistant's own number, held until it arrives. */
  private moveTo(view: EntityView, opening: number): void {
    const value = mirror(this.inverted, clamp(Math.round(opening), 0, 100));
    this.target.set(value);
    this.expect(view.id, view.state); // a new destination: drops an "Opening" still expected from the keys
    this.call(view.domain, view.domain === 'valve' ? 'set_valve_position' : 'set_cover_position', {
      position: value,
    });
  }

  /**
   * How open the cover is as it is drawn: its own number, turned round where it reports it so, and where it was sent
   * while it travels there; none for one with no position.
   */
  private position(motion: Motion): Percent {
    return motion.reported === null
      ? null
      : mirror(this.inverted, this.target.read(motion.reported, near) ?? motion.reported);
  }

  /** The tilt as the sheet shows it: the cover's own number, held where one was just chosen, turned round where its card says. */
  private tilted(view: EntityView): Percent {
    const tilt = this.tilt.read(percentAttr(view, 'current_tilt_position'), near);
    return tilt === null ? null : mirror(this.reads.invert_tilt === true, tilt);
  }

  /** Sends the tilt to `tilt` as the sheet shows it: Home Assistant's own number for it, held until it answers. */
  private tiltTo(tilt: number): void {
    const value = mirror(this.reads.invert_tilt === true, clamp(Math.round(tilt), 0, 100));
    this.tilt.set(value);
    this.call('cover', 'set_cover_tilt_position', { tilt_position: value });
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
          ? [state, percentText(this.hass, this.said(position))]
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

  /**
   * The tilt under the keys: a ruler where the cover takes an angle, in degrees where its card reads it so
   * (`tilt_angle`), two steps where it only opens and closes it.
   */
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
    const tilt = this.tilted(view);
    const angle = tiltAngleOf(this.reads);
    const figure = (value: number): string => this.percent(angle ? (value * angle) / 100 : value);
    const edge = (value: number): string => `${figure(value)}${angle ? '°' : ''}`;
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
        unit=${angle ? '°' : '%'}
        .label=${`${name} · ${title}`}
        .format=${figure}
        @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.tiltTo(event.detail.value)}
      ></fluvy-ruler>
      ${rulerLabels([
        [0, edge(0)],
        [0.5, edge(50)],
        [1, edge(100)],
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
          .value=${positioned && position !== null ? this.said(position) : undefined}
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
            this.moveTo(view, this.said(event.detail.value ?? 0))}
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
