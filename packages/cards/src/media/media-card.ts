import {
  formatDuration,
  formatNumber,
  formatTime,
  isUsable,
  numberAttr,
  relativeTime,
  stateText,
  strings,
  textAttr,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  clamp,
  clickPress,
  glyph,
  ico,
  icon,
  label,
  preventMenu,
  round,
  sheetStyles,
  startPress,
  type ChipItem,
  type IconRef,
  type RulerChangeDetail,
} from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { keyed } from 'lit/directives/keyed.js';

import { Card } from '../shared/base.js';

import {
  actionFields,
  boolField,
  colourFields,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  selectField,
} from '../shared/form.js';
import {
  MEDIA,
  playable,
  isActive,
  isPlaying,
  mediaPicture,
  playPauseAction,
  trackPosition,
} from '../shared/media.js';
import { configKeys, type RowStyle } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';

const s = strings('media');

export type MediaVariant = 'full' | 'mini' | 'hero';

export interface MediaCardConfig extends FluvyCardConfig {
  /** `full` = the player card, `mini` = the 44 row, `hero` = the 200 artwork layout. */
  variant?: MediaVariant;
  /** Sources as chips filling the row (default) or content-sized. */
  source_style?: RowStyle;
  show_source?: boolean;
  show_volume?: boolean;
}

/** The click of a held artwork or row, seen before its own buttons': a hold never also taps. */
const clickHeld = { handleEvent: clickPress, capture: true };

const VARIANTS: readonly MediaVariant[] = ['full', 'mini', 'hero'];
const SEEK_STEP = 10; // seconds per arrow key
const MAX_SOURCES = 6;

/** A picture URL that is safe inside `url("…")` — quotes and backslashes can never reach the stylesheet. */
const cssUrl = (url: string): string => url.replace(/["\\]/g, '');

/**
 * The media player: artwork, what is playing, the seek bar with its times, the five-round transport
 * and the volume ruler — in three sizes (`full`, `mini`, `hero`).
 *
 * Everything on a `media_player` is optional, so every line degrades: no artwork falls back to the
 * gradient plate, no duration hides the seek bar, no feature bit hides its control, and an idle or
 * unreachable speaker (the dead Cast device every instance has) reads as calm, not broken.
 */
export class FluvyMediaCard extends Card<MediaCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: MediaCardConfig): number {
    // artwork, title and controls (264), the volume under them (88); the sources a player has are its own
    if (config.variant === 'hero') return 600;
    if (config.variant === 'mini') return 76;
    return config.show_volume === false ? 264 : 352;
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.media,
    css`
      /* the sheet fixes 360; a dashboard column decides here */
      .md-card,
      .md-mini {
        width: auto;
      }

      /* artwork: the language's plate (.fv-art), the entity picture crossfading over it; the mini's glyph is 20, the
         hero's 32, and an idle hero sits flat like the sheet's empty panel */
      .md-art--s svg {
        width: 20px;
        height: 20px;
      }
      .md-art--l svg {
        width: 32px;
        height: 32px;
      }
      .md-art--l.fv-art--idle {
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
      }
      .md-art-tap {
        display: block;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
      }

      /* fluid text: the source line ellipsizes instead of pushing the card open */
      .md-source__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .md-hero__title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .md-card--hero .md-source {
        justify-content: center;
      }

      /* seek: the fill and the knob move on the compositor, one step a second while playing */
      .md-progress {
        max-width: 100%;
        touch-action: pan-y;
      }
      .md-progress[role='slider'] {
        cursor: pointer;
      }
      .md-progress .fv-knob {
        left: 0;
        top: 0;
      }
      .md-progress__fill {
        width: 100%;
        transform-origin: left center;
      }
      .is-playing .md-progress__fill {
        transition: transform 1s linear;
      }
      .is-playing .md-progress .fv-knob {
        transition: translate 1s linear;
      }
      .is-scrubbing .md-progress__fill,
      .is-scrubbing .md-progress .fv-knob {
        transition: none;
      }

      /* the sheet's 20 px transport gap, kept centred: it closes on a narrow column instead of clipping,
         and a wide column keeps the rhythm instead of flinging the rounds to the edges */
      .md-controls {
        justify-content: center;
      }

      /* the play glyph swaps under the finger */
      .md-swap {
        display: flex;
        animation: md-swap 200ms var(--fv-ease-out) both;
      }
      @keyframes md-swap {
        from {
          opacity: 0;
          transform: scale(0.72);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .md-volume fluvy-ruler {
        flex: 0 0 auto;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    tick_: { state: true },
    scrub_: { state: true },
  };

  /** Beats the local clock: while playing the position advances once a second without a state change. */
  declare tick_: number;
  /** Fraction under the finger while the seek bar is being dragged. */
  declare scrub_: number | null;

  private timer = 0;
  /** Two stacked artwork layers; the front one holds the current picture so a change crossfades. */
  private readonly layers: [string, string] = ['', ''];
  private front = 0;

  constructor() {
    super();
    this.tick_ = 0;
    this.scrub_ = null;
  }

  static override keys = configKeys<MediaCardConfig>()([
    'variant',
    'source_style',
    'show_source',
    'show_volume',
  ]);
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['media_player']),
        nameIconFields(),
        fieldRow(selectField('variant', VARIANTS), selectField('source_style', ['full', 'chips'])),
        fieldRow(boolField('show_source'), boolField('show_volume')),
        colourFields(),
        actionFields(),
      ],
      ...formLabels({}),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): MediaCardConfig {
    return {
      type: 'custom:fluvy-media-card',
      entity: entities.find((id) => id.startsWith('media_player.')) ?? '',
    };
  }

  protected override prepare(config: MediaCardConfig): MediaCardConfig {
    if (!config.entity) throw new Error('fluvy-media-card: "entity" is required');
    const variant = config.variant && VARIANTS.includes(config.variant) ? config.variant : 'full';
    return { ...config, variant };
  }

  private get variant(): MediaVariant {
    return this.config?.variant ?? 'full';
  }

  override getCardSize(): number {
    return this.variant === 'mini' ? 2 : this.variant === 'hero' ? 12 : 7;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: this.variant === 'hero' ? 8 : 6 };
  }

  /* ---------- lifecycle ---------- */

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  /** One interval, only while a playing track has a duration to advance along. */
  private syncTimer(): void {
    const view = this.entity();
    // `isConnected`: Home Assistant keeps pushing `hass` at a card it has already removed
    const needed =
      this.isConnected &&
      view.status === 'ok' &&
      this.isPlaying(view) &&
      numberAttr(view, 'media_duration') !== null;
    if (needed && !this.timer)
      this.timer = window.setInterval(() => {
        this.tick_ = Date.now();
      }, 1000);
    else if (!needed) this.stopTimer();
  }

  /* ---------- reading the entity ---------- */

  private isPlaying(view: EntityView): boolean {
    return isPlaying(this.stateOf(view));
  }

  private isActive(view: EntityView): boolean {
    return isActive(this.stateOf(view));
  }

  /** Artist · album, a series title for television, the app as a last resort. */
  private secondary(view: EntityView): string {
    const parts = [
      textAttr(view, 'media_series_title'),
      textAttr(view, 'media_artist'),
      textAttr(view, 'media_album_name'),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : textAttr(view, 'app_name');
  }

  /** The speaker line under the track: the device, plus its input when one is selected. */
  private sourceLine(view: EntityView, name: string, said: string): string {
    const source = textAttr(view, 'source');
    return source && source !== name && source !== said ? `${name} · ${source}` : name;
  }

  private idleLine(view: EntityView): string {
    const text = stateText(this.hass, view);
    const when = view.stateObj?.last_changed;
    if (!when) return text;
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return text;
    return `${text} · ${s(this.hass, 'last_played', { time: relativeTime(this.hass, date) })}`;
  }

  private unavailableLine(view: EntityView): string {
    const text = stateText(this.hass, view);
    const when = view.stateObj?.last_changed;
    if (!when) return text;
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return text;
    const sameDay = date.toDateString() === new Date().toDateString();
    return `${text} · ${sameDay ? s(this.hass, 'since', { time: formatTime(this.hass, date) }) : relativeTime(this.hass, date)}`;
  }

  /* ---------- commands ---------- */

  private playPause(view: EntityView): void {
    const { service, expect } = playPauseAction(view, this.stateOf(view));
    this.expect(view.id, expect);
    this.call('media_player', service);
  }

  private seek(seconds: number): void {
    this.call('media_player', 'media_seek', { seek_position: Math.round(seconds) });
  }

  /* ---------- pieces ---------- */

  /** The gradient plate with the entity picture over it; a picture change crossfades the two layers. */
  private art(size: number, picture: string, extra = ''): TemplateResult {
    if (this.layers[this.front] !== picture) {
      this.front = this.front === 0 ? 1 : 0;
      this.layers[this.front] = picture;
    }
    return html`<span
      class="fv-art ${extra}"
      data-measure="skip"
      style="width:${size}px;height:${size}px"
    >
      ${this.layers.map(
        (url, index) =>
          html`<span
            class="fv-art__img ${url && index === this.front ? 'is-on' : ''}"
            style=${url ? `background-image:url("${cssUrl(url)}")` : nothing}
          ></span>`,
      )}
      ${picture ? nothing : glyph('speaker')}
    </span>`;
  }

  private transportRound(
    ref: IconRef,
    on: boolean,
    text: string,
    onClick: () => void,
  ): TemplateResult {
    return html`<button
      class="fv-round ${on ? 'is-on' : 'fv-round--quiet'}"
      data-control
      data-target
      aria-label=${text}
      title=${text}
      aria-pressed=${on ? 'true' : 'false'}
      @click=${onClick}
    >
      ${icon(ref)}
    </button>`;
  }

  private playRound(view: EntityView): TemplateResult {
    const playing = this.isPlaying(view);
    const active = this.isActive(view);
    const name = playing ? 'pause' : 'play';
    const text = playing ? this.t('media.pause') : this.t('media.play');
    return html`<button
      class="fv-round ${active ? 'fv-round--accent' : 'fv-round--quiet'}"
      data-control
      data-target
      aria-label=${text}
      title=${text}
      @click=${() => this.playPause(view)}
    >
      ${keyed(name, html`<span class="md-swap">${glyph(name)}</span>`)}
    </button>`;
  }

  private repeatRound(view: EntityView): TemplateResult {
    const mode = textAttr(view, 'repeat') || 'off';
    const next = mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';
    const text = s(
      this.hass,
      mode === 'one' ? 'repeat_one' : mode === 'all' ? 'repeat_all' : 'repeat_off',
    );
    return this.transportRound(mode === 'one' ? 'repeatOne' : 'repeat', mode !== 'off', text, () =>
      this.call('media_player', 'repeat_set', { repeat: next }),
    );
  }

  /**
   * The transport: five equal rounds 20 apart on the sheet. A column that cannot hold them 8 apart loses the ends
   * (shuffle and repeat: the modes, which more-info still offers) before the three that move the track; one that
   * cannot hold even those steps the rounds down to 44.
   */
  private renderTransport(view: EntityView, big: boolean): TemplateResult | typeof nothing {
    const active = this.isActive(view);
    const canPlay = playable(view);
    const items: { readonly round: TemplateResult; readonly mode?: boolean }[] = [];
    if (active && view.supports(MEDIA.SHUFFLE)) {
      const on = view.attr<boolean>('shuffle') === true;
      items.push({
        round: this.transportRound('shuffle', on, this.t('media.shuffle'), () =>
          this.call('media_player', 'shuffle_set', { shuffle: !on }),
        ),
        mode: true,
      });
    }
    if (active && view.supports(MEDIA.PREVIOUS)) {
      items.push({
        round: round('prev', 'quiet', this.t('media.previous'), () =>
          this.call('media_player', 'media_previous_track'),
        ),
      });
    }
    if (canPlay) items.push({ round: this.playRound(view) });
    if (active && view.supports(MEDIA.NEXT)) {
      items.push({
        round: round('next', 'quiet', this.t('media.next'), () =>
          this.call('media_player', 'media_next_track'),
        ),
      });
    }
    if (active && view.supports(MEDIA.REPEAT))
      items.push({ round: this.repeatRound(view), mode: true });
    if (!items.length) return nothing;
    const width = this.contentWidth;
    const needs = (count: number, size: number): number => count * size + (count - 1) * 8;
    let size = big ? 56 : 48;
    const shown = needs(items.length, size) <= width ? items : items.filter((item) => !item.mode);
    if (needs(shown.length, size) > width) size = 44;
    const gap =
      shown.length > 1
        ? `min(20px, calc((100% - ${shown.length * size}px) / ${shown.length - 1}))`
        : '0px';
    return html`<div
      class="md-controls ${size === 48 ? '' : `md-controls--${size}`}"
      style="gap:${gap}"
    >
      ${shown.map((item) => item.round)}
    </div>`;
  }

  private renderSeek(view: EntityView, big: boolean): TemplateResult | typeof nothing {
    const duration = numberAttr(view, 'media_duration');
    const position = trackPosition(view, duration);
    if (duration === null || position === null) return nothing;
    const width = this.contentWidth;
    const fraction = this.scrub_ ?? position / duration;
    const shown = this.scrub_ === null ? position : this.scrub_ * duration;
    const seekable = view.supports(MEDIA.SEEK);
    const moving = this.isPlaying(view) && this.scrub_ === null;
    // the knob keeps a 4 px optical overhang at the ends, never half outside the column (as fluvy-ruler does)
    const x = clamp(fraction * width - 14, -4, width - 24);
    const text = `${this.config?.name ?? view.name} · ${s(this.hass, 'position')}`;
    return html`<div class="md-seek ${big ? 'md-seek--sheet' : ''}">
      <div
        class="md-progress"
        data-control
        data-target
        style="width:${width}px"
        role=${seekable ? 'slider' : nothing}
        tabindex=${seekable ? 0 : nothing}
        aria-label=${seekable ? text : nothing}
        aria-valuemin=${seekable ? 0 : nothing}
        aria-valuemax=${seekable ? Math.round(duration) : nothing}
        aria-valuenow=${seekable ? Math.round(shown) : nothing}
        aria-valuetext=${seekable ? formatDuration(shown) : nothing}
        @pointerdown=${this.onSeekDown}
        @pointermove=${this.onSeekMove}
        @pointerup=${this.onSeekUp}
        @pointercancel=${this.onSeekCancel}
        @keydown=${this.onSeekKey}
      >
        <span
          class="md-progress__fill"
          data-measure="value"
          style="transform:scaleX(${fraction.toFixed(5)})"
        ></span>
        <span
          class="fv-knob fv-knob--accent"
          data-measure="value"
          style="width:28px;height:28px;translate:${moving ? x.toFixed(2) : Math.round(x)}px 8px"
        ></span>
      </div>
      <div class="md-times">
        <span>${formatDuration(shown)}</span><span>${formatDuration(duration)}</span>
      </div>
    </div>`;
  }

  private renderVolume(view: EntityView): TemplateResult | typeof nothing {
    if (this.config?.show_volume === false) return nothing;
    const canSet = view.supports(MEDIA.VOLUME_SET);
    const canMute = view.supports(MEDIA.VOLUME_MUTE);
    if (!canSet && !canMute) return nothing;
    const muted = view.attr<boolean>('is_volume_muted') === true;
    const level = numberAttr(view, 'volume_level');
    const value = level === null ? 0 : Math.round(clamp(level, 0, 1) * 100);
    const name = this.config?.name ?? view.name;
    const length = this.contentWidth - (canMute ? 64 : 0);
    const muteText = muted ? s(this.hass, 'unmute') : this.t('media.mute');
    return html`${label(this.t('media.volume'))}
      <div class="md-volume">
        ${
          canSet
            ? html`<fluvy-ruler
                .value=${value}
                .min=${0}
                .max=${100}
                .step=${1}
                .length=${length}
                .tone=${muted ? 'neutral' : 'accent'}
                unit="%"
                .label=${`${name} · ${this.t('media.volume')}`}
                .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
                @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.call('media_player', 'volume_set', { volume_level: event.detail.value / 100 })}
              ></fluvy-ruler>`
            : nothing
        }
        ${canMute ? round(muted ? 'volumeOff' : 'volume', 'quiet', muteText, () => this.call('media_player', 'volume_mute', { is_volume_muted: !muted })) : nothing}
      </div>`;
  }

  private renderSources(view: EntityView): TemplateResult | typeof nothing {
    if (this.config?.show_source === false) return nothing;
    const list = view.attr<readonly string[]>('source_list');
    if (!Array.isArray(list) || !list.length || !view.supports(MEDIA.SELECT_SOURCE)) return nothing;
    const current = textAttr(view, 'source');
    const names = list.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    const shown = names.slice(0, MAX_SOURCES);
    if (current && !shown.includes(current)) {
      shown.pop();
      shown.unshift(current);
    }
    if (!shown.length) return nothing;
    const items: ChipItem[] = shown.map((source) => ({
      key: source,
      label: source,
      active: source === current,
    }));
    return html`${label(this.t('media.source'))}${chipRow(items, (key) => this.call('media_player', 'select_source', { source: key }), this.config?.source_style)}`;
  }

  /* ---------- seek gestures ---------- */

  private fractionAt(event: PointerEvent): number {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
  }

  private readonly onSeekDown = (event: PointerEvent): void => {
    if (!this.entity().supports(MEDIA.SEEK)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    this.scrub_ = this.fractionAt(event);
  };

  private readonly onSeekMove = (event: PointerEvent): void => {
    if (this.scrub_ === null) return;
    this.scrub_ = this.fractionAt(event);
  };

  private readonly onSeekUp = (event: PointerEvent): void => {
    if (this.scrub_ === null) return;
    const fraction = this.fractionAt(event);
    this.scrub_ = null;
    const duration = numberAttr(this.entity(), 'media_duration');
    if (duration !== null) this.seek(fraction * duration);
  };

  private readonly onSeekCancel = (): void => {
    this.scrub_ = null;
  };

  private readonly onSeekKey = (event: KeyboardEvent): void => {
    const view = this.entity();
    if (!view.supports(MEDIA.SEEK)) return;
    const duration = numberAttr(view, 'media_duration');
    if (duration === null) return;
    const position = trackPosition(view, duration) ?? 0;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = position + SEEK_STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = position - SEEK_STEP;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = duration;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.seek(clamp(next, 0, duration));
  };

  /* ---------- variants ---------- */

  private renderPlayer(view: EntityView, name: string, hero: boolean): TemplateResult {
    const active = this.isActive(view);
    const picture = mediaPicture(this.hass, view);
    const title = active
      ? textAttr(view, 'media_title') || textAttr(view, 'app_name') || name
      : this.t('media.nothing');
    let second = active ? this.secondary(view) : this.idleLine(view);
    if (active && (second === title || !second)) second = stateText(this.hass, view);
    const speaker = this.sourceLine(view, name, second);
    const saysSpeaker = speaker !== title;
    const classes = `fv-card md-card ${hero ? 'md-card--hero' : ''} ${this.isPlaying(view) ? 'is-playing' : ''} ${this.scrub_ === null ? '' : 'is-scrubbing'}`;
    const wide = this.contentWidth >= 312;
    const body = html` ${this.renderSeek(view, hero)} ${this.renderTransport(view, hero && wide)}
    ${this.renderVolume(view)} ${this.renderSources(view)}`;

    // the artwork is the card's icon: a tap is the tap action, a still press the hold action
    const tap = (): void => this.tap(view.id);
    const hold = (): void => this.hold(view.id);
    if (hero) {
      const size = Math.min(200, Math.floor(this.contentWidth / 4) * 4);
      return html`<article class=${classes} data-card>
        <div class="md-hero">
          <button
            class="md-art-tap fv-ico--tap"
            aria-label=${name}
            .fvTap=${tap}
            .fvHold=${hold}
            @pointerdown=${startPress}
            @contextmenu=${preventMenu}
            @click=${clickPress}
          >
            ${this.art(size, picture, `md-art--l ${active || picture ? '' : 'fv-art--idle'}`)}
          </button>
        </div>
        <div class="md-hero__text" data-align="center">
          <h3 class="md-hero__title" data-name>${title}</h3>
          ${second ? html`<p class="fv-card__sub">${second}</p>` : nothing}
          ${saysSpeaker ? html`<p class="fv-card__sub md-source">${glyph('speaker')}<span class="md-source__text">${speaker}</span></p>` : nothing}
        </div>
        ${body}
      </article>`;
    }

    return html`<article class=${classes} data-card>
      <div
        class="md-now fv-card__head--hold"
        .fvHold=${hold}
        @pointerdown=${startPress}
        @contextmenu=${preventMenu}
        @click=${clickHeld}
      >
        <button class="md-art-tap fv-ico--tap" aria-label=${name} @click=${tap}>
          ${this.art(80, picture, active || picture ? '' : 'fv-art--idle')}
        </button>
        <div class="md-now__text">
          <h3 class="fv-card__title md-title" data-name>${title}</h3>
          ${second ? html`<p class="fv-card__sub">${second}</p>` : nothing}
          ${saysSpeaker ? html`<p class="fv-card__sub md-source">${glyph('speaker')}<span class="md-source__text">${speaker}</span></p>` : nothing}
        </div>
        ${round('dots', 'quiet', this.t('common.more'), () => this.tap(view.id, { action: 'more-info' }))}
      </div>
      ${body}
    </article>`;
  }

  private renderMini(view: EntityView, name: string): TemplateResult {
    const active = this.isActive(view);
    const picture = mediaPicture(this.hass, view);
    const duration = numberAttr(view, 'media_duration');
    const position = trackPosition(view, duration);
    const title = active
      ? textAttr(view, 'media_title') || textAttr(view, 'app_name') || name
      : name;
    const second = this.secondary(view);
    const sub = active
      ? [name, position === null ? second : formatDuration(position)].filter(Boolean).join(' · ')
      : this.idleLine(view);
    const canPlay = playable(view);
    return html`<article
      class="fv-card md-mini__card ${this.isPlaying(view) ? 'is-playing' : ''}"
      data-card
    >
      <div
        class="md-mini__row fv-card__head--hold"
        .fvHold=${() => this.hold(view.id)}
        @pointerdown=${startPress}
        @contextmenu=${preventMenu}
        @click=${clickHeld}
      >
        ${
          picture
            ? html`<button
                class="md-art-tap fv-ico--tap"
                aria-label=${name}
                @click=${() => this.tap(view.id)}
              >
                ${this.art(44, picture, 'md-art--s')}
              </button>`
            : ico(this.config?.icon ?? 'speaker', active ? 'media' : 'neutral', {
                onTap: () => this.tap(view.id),
                label: name,
              })
        }
        <div class="fv-row__text">
          <span class="fv-row__title" data-name>${title}</span>
          <span class="fv-row__sub">${sub}</span>
        </div>
        ${canPlay ? this.playRound(view) : nothing}
        ${active && view.supports(MEDIA.NEXT) ? round('next', 'quiet', this.t('media.next'), () => this.call('media_player', 'media_next_track')) : nothing}
      </div>
    </article>`;
  }

  /** Unreachable: the calm dashed row every instance needs for its dead Cast devices. */
  private renderOff(view: EntityView, name: string, variant: MediaVariant): TemplateResult {
    const text = html`<div class="fv-row__text">
      <span class="fv-row__title" data-name>${name}</span>
      <span class="fv-row__sub">${this.unavailableLine(view)}</span>
    </div>`;
    if (variant === 'mini') {
      return html`<article class="fv-tile fv-tile--off" data-card>
        ${ico('ban', 'off')}${text}
      </article>`;
    }
    return html`<article class="fv-card md-card is-off is-unavailable" data-card>
      <div class="md-mini__row">${ico('ban', 'off')}${text}</div>
    </article>`;
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);
    const variant = this.variant;
    if (!isUsable(view)) return this.renderOff(view, name, variant);
    if (variant === 'mini') return this.renderMini(view, name);
    return this.renderPlayer(view, name, variant === 'hero');
  }
}
