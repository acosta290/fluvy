import {
  type EntityView,
  type FluvyCardConfig,
  formatDuration,
  formatNumber,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  numberAttr,
  stateText,
  textAttr,
} from '@fluvy/core';

import { glyph, ico, icon, round, sheetStyles } from '@fluvy/ui';

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

import { entityField, formLabels, nameIconFields } from '../shared/form.js';
import {
  MEDIA,
  playable,
  isPlaying,
  mediaPicture,
  playPauseAction,
  trackPosition,
} from '../shared/media.js';

import { s } from './strings.js';

export interface NowPlayingCardConfig extends FluvyCardConfig {
  /** Speaker name shown after the artist. Defaults to the entity's name. */
  name?: string;
}

/** Under this content width the centred trio would meet the volume round (W / 2 − 136 < 16). */
const CENTRED_FROM = 304;

/**
 * The compact "now playing" of the home sheet (`.hm-media`): 64 artwork, what is on, a 4 px progress
 * line with its times, and four 48 rounds — the transport centred on the card, volume on the right
 * edge. `fluvy-media-card` is the full player (seek knob, volume ruler, sources, mini and hero);
 * this is the strip a home view puts between its tiles, and it leaves volume and everything else
 * to the entity's own dialog.
 */
export class FluvyNowPlayingCard extends Card<NowPlayingCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      /* the sheet's 1fr column would grow with a long title */
      .hm-media {
        grid-template-columns: 64px minmax(0, 1fr);
      }

      /* the fill slides on the compositor inside the clipped track (its round end stays round), one step a second */
      .hm-progress {
        overflow: hidden;
      }
      .hm-progress__fill {
        width: 100%;
        transform: translateX(calc((var(--played, 0) - 1) * 100%));
      }
      .is-playing .hm-progress__fill {
        transition: transform 1s linear;
      }

      /* the sheet pins the rounds at 72 / 136 / 200 / 272 of its 320 column: the trio centred with 16
         gaps, volume on the right edge. The same picture at 320, fluid everywhere else. */
      .hm-transport {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }
      .hm-transport > .hm-transport__btn {
        position: static;
        flex: 0 0 48px;
      }
      .hm-transport > .hm-transport__volume {
        position: absolute;
        top: 0;
        right: 0;
        left: auto;
      }
      /* a narrow column spreads all four instead of letting the trio meet the volume round */
      .hm-transport--spread {
        justify-content: space-between;
        gap: 0;
      }
      .hm-transport--spread > .hm-transport__volume {
        position: static;
      }
      /* four 48 rounds in 260 would land on third-pixels; the compact card's 44 rounds give 4 × 44 + 3 × 28 = 260 */
      .hm-transport--spread > .hm-transport__btn {
        flex-basis: 44px;
        width: 44px;
        height: 44px;
      }
      .hm-transport--spread .hm-transport__btn svg {
        width: 20px;
        height: 20px;
      }
      .hm-transport__btn > .fv-swap {
        display: flex;
      }

      .hm-media--off {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    `,
  ];

  static override properties = { ...Card.properties, tick_: { state: true } };

  /** Beats once a second while a track with a duration is playing: the position advances with no state change. */
  declare tick_: number;

  private clock: number | undefined;

  constructor() {
    super();
    this.tick_ = 0;
  }

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [entityField(['media_player']), nameIconFields()],
      ...formLabels({ entity: 'editor.entity', name: 'editor.name', icon: 'editor.icon' }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): NowPlayingCardConfig {
    return {
      type: 'custom:fluvy-now-playing-card',
      entity: entities.find((id) => id.startsWith('media_player.')) ?? '',
    };
  }

  protected override prepare(config: NowPlayingCardConfig): NowPlayingCardConfig {
    if (!config.entity) throw new Error('fluvy-now-playing-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return 4;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- the clock ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate(); // a card that is re-attached picks its clock up again in `updated`
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopClock();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const view = this.entity();
    // Lit still updates an element that has left the page (one last `hass`): it must not start a clock nobody will stop
    if (this.isConnected && this.isPlaying(view) && numberAttr(view, 'media_duration') !== null)
      this.clock ??= window.setInterval(() => {
        this.tick_ += 1;
      }, 1000);
    else this.stopClock();
  }

  private stopClock(): void {
    clearInterval(this.clock);
    this.clock = undefined;
  }

  /* ---------- facts ---------- */

  private isPlaying(view: EntityView): boolean {
    return view.status === 'ok' && isPlaying(this.stateOf(view));
  }

  private playPause(view: EntityView): void {
    const { service, expect } = playPauseAction(view, this.stateOf(view));
    this.expect(view.id, expect);
    this.call('media_player', service);
  }

  /* ---------- pieces ---------- */

  /** The sheet's gradient plate; the entity picture fades in over it once it has loaded, and a picture that fails leaves the plate. */
  private art(view: EntityView, active: boolean): TemplateResult {
    const picture = active ? mediaPicture(this.hass, view) : '';
    const loaded = (event: Event): void =>
      (event.currentTarget as HTMLElement).classList.add('is-on');
    return html`<span class="fv-art hm-art ${active ? '' : 'fv-art--idle'}">
      ${icon(this.config?.icon, 'speaker')}
      ${picture ? keyed(picture, html`<img class="fv-art__img" src=${picture} alt="" draggable="false" @load=${loaded} />`) : nothing}
    </span>`;
  }

  private progress(view: EntityView, track: string): TemplateResult | typeof nothing {
    const duration = numberAttr(view, 'media_duration');
    const position = duration !== null && duration > 0 ? trackPosition(view, duration) : null;
    if (duration === null || position === null) return nothing;
    const text = s(this.hass, 'progress', {
      position: formatDuration(position),
      duration: formatDuration(duration),
    });
    return html`<div
        class="hm-progress"
        role="progressbar"
        aria-label=${text}
        aria-valuemin="0"
        aria-valuemax=${Math.round(duration)}
        aria-valuenow=${Math.round(position)}
      >
        ${keyed(track, html`<span class="hm-progress__fill" data-measure="value" style="--played:${(position / duration).toFixed(4)}"></span>`)}
      </div>
      <div class="hm-times">
        <span>${formatDuration(position)}</span><span>${formatDuration(duration)}</span>
      </div>`;
  }

  private transport(view: EntityView, active: boolean): TemplateResult {
    const playing = this.isPlaying(view);
    const canPlay = playable(view);
    const playText = playing ? this.t('media.pause') : this.t('media.play');
    const level = numberAttr(view, 'volume_level');
    const muted = view.attr<boolean | null>('is_volume_muted') === true;
    const volumeText = [
      this.t('media.volume'),
      muted
        ? s(this.hass, 'muted')
        : level === null
          ? ''
          : `${formatNumber(this.hass, Math.round(level * 100), { digits: 0 })} %`,
    ]
      .filter(Boolean)
      .join(' · ');

    return html`<div
      class="hm-transport ${this.contentWidth < CENTRED_FROM ? 'hm-transport--spread' : ''}"
    >
      ${round('prev', 'quiet', this.t('media.previous'), () => this.call('media_player', 'media_previous_track'), !(active && view.supports(MEDIA.PREVIOUS)), 'hm-transport__btn')}
      <button
        class="fv-round ${active ? 'fv-round--accent' : 'fv-round--quiet'} hm-transport__btn"
        data-control
        data-target
        aria-label=${playText}
        title=${playText}
        ?disabled=${!canPlay}
        @click=${() => this.playPause(view)}
      >
        ${keyed(playing, html`<span class="fv-swap">${glyph(playing ? 'pause' : 'play')}</span>`)}
      </button>
      ${round('next', 'quiet', this.t('media.next'), () => this.call('media_player', 'media_next_track'), !(active && view.supports(MEDIA.NEXT)), 'hm-transport__btn')}
      ${round(muted ? 'volumeOff' : 'volume', 'quiet', volumeText, () => this.tap(view.id, { action: 'more-info' }), false, 'hm-transport__btn hm-transport__volume')}
    </div>`;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const speaker = this.config?.name ?? view.name;

    if (view.status === 'missing' || view.status === 'unavailable') {
      return html`<article class="fv-card is-off hm-media--off" data-card>
        ${ico('ban', 'off')}
        <div class="fv-row__text">
          <span class="fv-row__title">${speaker}</span
          ><span class="fv-row__sub">${stateText(this.hass, view)}</span>
        </div>
      </article>`;
    }

    const state = this.stateOf(view);
    const playing = this.isPlaying(view);
    const active = playing || state === 'paused';
    const title = active
      ? textAttr(view, 'media_title') || textAttr(view, 'app_name') || speaker
      : this.t('media.nothing');
    const artist = active
      ? textAttr(view, 'media_artist') || textAttr(view, 'media_series_title')
      : '';
    // segments after "·" are lower-case unless they are names
    const sub = active
      ? [artist, speaker === title ? '' : speaker].filter(Boolean).join(' · ') ||
        stateText(this.hass, view)
      : `${speaker} · ${stateText(this.hass, view).toLocaleLowerCase()}`;

    return html`<article class="fv-card hm-media ${playing ? 'is-playing' : ''}" data-card>
      ${this.art(view, active)}
      <div class="hm-media__titles">
        <h3 class="fv-card__title hm-media__title">${title}</h3>
        <p class="fv-card__sub">${sub}</p>
      </div>
      ${active ? this.progress(view, title) : nothing} ${this.transport(view, active)}
    </article>`;
  }
}
