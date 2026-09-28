import {
  formatTime,
  haptic,
  stateText,
  strings,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { glyph, head, round, sheetStyles } from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { RowsCard, type RowsCardConfig } from '../lock/rows.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import {
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  numberField,
  textField,
} from '../shared/form.js';
import type { RowsListSpec } from '../shared/rows-editor.js';

const s = strings('camera');

export interface CameraCardConfig extends RowsCardConfig {
  /** Seconds between two stills (1–300, default 10). */
  refresh?: number;
  /** Second line of the head ("Front of house · 1080p"). Default: area and state. */
  sub?: string;
}

type Slot = 'a' | 'b';

/** A request that has not answered after this long no longer holds the next one back. */
const STALL_MS = 30_000;
/** This many failures in a row and the last good frame stops standing in for the camera. */
const GIVE_UP = 3;

/**
 * The camera: a 16:9 still that refreshes itself, the live and time pills inside the picture and
 * two overlay actions. Two stacked images take turns: the next frame loads behind the current one
 * and fades in over it once decoded, so the picture never blinks. One interval, which only runs
 * while the card is on screen and the tab is in front, and is gone with the card.
 */
export class FluvyCameraCard extends RowsCard<CameraCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    css`
      .dv-card {
        width: auto;
      }
      .dv-cam {
        background: none;
      }
      .dv-cam__frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
      }
      .dv-cam__frame.is-under {
        opacity: 1;
      }
      .dv-cam__frame.is-on {
        z-index: 1;
        opacity: 1;
        animation: fv-fade 360ms var(--fv-ease) both;
      }
      /* the sheet's vignette, over the picture instead of under it, so the pills stay legible on a bright frame */
      .dv-cam__shade {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background: radial-gradient(
          120% 90% at 50% 40%,
          transparent 55%,
          color-mix(in srgb, var(--fluvy-neutral-05) 28%, transparent) 100%
        );
      }
      .dv-cam__skeleton {
        position: absolute;
        inset: 0;
        border-radius: 0;
      }
      .dv-cam__tap {
        position: absolute;
        inset: 0;
        z-index: 3;
        width: 100%;
        border-radius: var(--fluvy-radius-control);
      }
      .dv-cam__tap:focus-visible {
        outline-offset: -4px;
      }
      .dv-cam__pill {
        z-index: 4;
        pointer-events: none;
        transition: opacity var(--fv-base) var(--fv-ease);
      }
      .dv-cam__live.is-stale {
        opacity: 0;
      }
      .dv-cam__actions {
        z-index: 4;
      }
      /* error and unavailable: the unavailable skin — page fill, dashed hairline, one glyph, one line */
      .dv-cam.is-off {
        background: var(--fluvy-page);
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
      }
      .dv-cam.is-off .dv-cam__frame {
        display: none;
      }
      .dv-cam__off {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
      }
      .dv-cam__off p {
        max-width: 100%;
        font-size: 13px;
        font-weight: 500;
        line-height: 24px;
        color: var(--fluvy-unavailable);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dv-cam:fullscreen {
        border-radius: 0;
        background: var(--fluvy-neutral-05);
      }
      .dv-cam:fullscreen .dv-cam__frame {
        object-fit: contain;
      }
      .dv-cam:fullscreen .dv-cam__shade {
        display: none;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    a_: { state: true },
    b_: { state: true },
    front_: { state: true },
    stamp_: { state: true },
    failed_: { state: true },
    stale_: { state: true },
  };

  /** The two stacked images' sources. Only the one behind is ever given a new URL. */
  declare a_: string;
  declare b_: string;
  /** Which image is the one being shown ('' until the first frame lands). */
  declare front_: Slot | '';
  /** When the shown frame arrived. */
  declare stamp_: number;
  /** No frame to show: none ever came, or the camera kept failing. */
  declare failed_: boolean;
  /** The shown frame is older than it should be: the last request failed, or the loop is stopped. */
  declare stale_: boolean;

  private timer = 0;
  /** Seconds the running interval was started with, so a config change restarts it. */
  private period = 0;
  private observer: IntersectionObserver | undefined;
  private onScreen = false;
  private inFront = true;
  /** When the request now in flight was made; 0 when there is none. */
  private inFlight = 0;
  private failures = 0;

  constructor() {
    super();
    this.a_ = '';
    this.b_ = '';
    this.front_ = '';
    this.stamp_ = 0;
    this.failed_ = false;
    this.stale_ = false;
  }

  static override lists: readonly RowsListSpec[] = [
    { key: 'rows', title: 'editor.rows', schema: [entityField(), nameIconFields()] },
  ];
  static override getConfigForm(): LovelaceConfigForm {
    const shared = formLabels({
      sub: 'editor.subtitle',
      rows: 'editor.entities',
    });
    return {
      schema: [
        entityField(['camera']),
        nameIconFields(),
        fieldRow(textField('sub'), numberField('refresh', 1, 300)),
        entitiesField('rows'),
      ],
      computeLabel: (schema, localize) =>
        schema.name === 'refresh'
          ? s({ language: document.documentElement.lang || 'en' }, 'refresh')
          : shared.computeLabel?.(schema, localize),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): CameraCardConfig {
    return {
      type: 'custom:fluvy-camera-card',
      entity: entities.find((id) => id.startsWith('camera.')) ?? '',
    };
  }

  protected override prepare(config: CameraCardConfig): CameraCardConfig {
    if (!config.entity) throw new Error('fluvy-camera-card: "entity" is required');
    return super.prepare({
      ...config,
      refresh: Math.min(300, Math.max(1, Number(config.refresh) || 10)),
    });
  }

  override getCardSize(): number {
    return 5 + this.rowCount;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- the refresh loop ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    this.inFront = document.visibilityState !== 'hidden';
    document.addEventListener('visibilitychange', this.onTabChange);
    if (typeof IntersectionObserver === 'function') {
      this.onScreen = false; // the observer's first report, a frame from now, says otherwise
      this.observer = new IntersectionObserver((entries) => {
        const seen = entries[entries.length - 1]?.isIntersecting ?? true;
        if (seen === this.onScreen) return;
        this.onScreen = seen;
        this.sync();
      });
      this.observer.observe(this);
    } else {
      this.onScreen = true;
    }
    this.sync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onTabChange);
    this.observer?.disconnect();
    this.observer = undefined;
    this.stop();
  }

  private readonly onTabChange = (): void => {
    this.inFront = document.visibilityState !== 'hidden';
    this.sync();
  };

  private stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
    this.period = 0;
    this.inFlight = 0;
    if (this.stamp_ && !this.stale_) this.stale_ = true;
  }

  /** Runs the loop exactly while it is worth running: connected, on screen, tab in front, a camera with a picture. */
  private sync(): void {
    const view = this.entity();
    const wanted =
      this.isConnected &&
      this.onScreen &&
      this.inFront &&
      Boolean(this.hass) &&
      view.status === 'ok' &&
      Boolean(view.attr<string | null>('entity_picture'));
    const seconds = this.config?.refresh ?? 10;
    if (this.timer && (!wanted || seconds !== this.period)) this.stop();
    if (wanted && !this.timer) {
      this.period = seconds;
      this.timer = window.setInterval(() => this.pull(), seconds * 1000);
      this.pull();
    }
  }

  /** Asks the image behind for a fresh still. One request at a time: a slow camera is waited for, not piled onto. */
  private pull(): void {
    const picture = this.entity().attr<string | null>('entity_picture');
    if (!this.hass || !picture) return;
    const now = Date.now();
    if (this.inFlight && now - this.inFlight < STALL_MS) return;
    this.inFlight = now;
    const base = this.hass.hassUrl(picture);
    // the signed token in the URL stays; the extra bit only keeps the browser from serving one frame forever
    const url = base.startsWith('data:')
      ? `${base}#${now}`
      : `${base}${base.includes('?') ? '&' : '?'}_=${now}`;
    if (this.front_ === 'a') this.b_ = url;
    else this.a_ = url;
  }

  private onLoad(slot: Slot, event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    const show = (): void => {
      if (!this.isConnected) return;
      this.inFlight = 0;
      this.failures = 0;
      this.front_ = slot;
      this.stamp_ = Date.now();
      this.failed_ = false;
      this.stale_ = false;
    };
    if (typeof image.decode === 'function')
      image.decode().then(show, show); // fade in a decoded frame, not a half-painted one
    else show();
  }

  private onError(): void {
    this.inFlight = 0;
    this.failures += 1;
    if (!this.stamp_ || this.failures >= GIVE_UP) this.failed_ = true;
    else this.stale_ = true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('hass') || changed.has('config')) this.sync();
  }

  /* ---------- actions ---------- */

  private moreInfo(): void {
    if (this.renderRoot instanceof ShadowRoot && this.renderRoot.fullscreenElement) {
      void document.exitFullscreen();
      return;
    } // the dialog would open behind the picture
    this.tap(this.config?.entity, { action: 'more-info' });
  }

  private fullscreen(): void {
    haptic(this, 'light');
    if (this.renderRoot instanceof ShadowRoot && this.renderRoot.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const box = this.renderRoot.querySelector<HTMLElement>('.dv-cam');
    if (!box || typeof box.requestFullscreen !== 'function') {
      this.moreInfo();
      return;
    } // iPhone: Home Assistant's dialog has the player
    box.requestFullscreen().catch(() => this.moreInfo());
  }

  /* ---------- render ---------- */

  private clock(): string {
    if (!this.stamp_) return '';
    const date = new Date(this.stamp_);
    const full = formatTime(this.hass, date, true);
    return full.length > 9 ? formatTime(this.hass, date, false) : full; // a 12-hour locale keeps the pill's 80 px
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const unusable = view.status !== 'ok';
    const off = unusable || this.failed_ || !view.attr<string | null>('entity_picture');
    const height = Math.round((this.contentWidth * 9) / 16 / 4) * 4; // 16:9, landed on the 4 px grid
    const offTop = Math.max(0, Math.round((height - 76) / 2 / 4) * 4);
    const sub =
      this.config?.sub ?? [view.areaName, stateText(this.hass, view)].filter(Boolean).join(' · ');

    return html`<article
      class="fv-card dv-card ${view.status === 'unavailable' ? 'is-unavailable' : ''}"
      data-card
    >
      ${head({
        icon: this.config?.icon ?? glyphFor(view),
        tone: view.status === 'unavailable' ? 'off' : 'accent',
        title: name,
        sub,
        trailing: round('dots', 'quiet', this.t('common.more'), () => this.moreInfo()),
        onIconTap: () => this.moreInfo(),
        iconLabel: name,
      })}
      <div class="dv-cam ${off ? 'is-off' : ''}" style="height:${height}px">
        <img
          class="dv-cam__frame ${this.front_ === 'a' ? 'is-on' : this.front_ ? 'is-under' : ''}"
          alt=""
          decoding="async"
          draggable="false"
          src=${this.a_ || nothing}
          @load=${(event: Event) => this.onLoad('a', event)}
          @error=${() => this.onError()}
        />
        <img
          class="dv-cam__frame ${this.front_ === 'b' ? 'is-on' : this.front_ ? 'is-under' : ''}"
          alt=""
          decoding="async"
          draggable="false"
          src=${this.b_ || nothing}
          @load=${(event: Event) => this.onLoad('b', event)}
          @error=${() => this.onError()}
        />
        ${
          off
            ? html`<div class="dv-cam__off" style="top:${offTop}px;height:76px">
                <span class="fv-ico fv-ico--off" data-icon>${glyph('camera')}</span>
                <p>${unusable ? stateText(this.hass, view) : s(this.hass, 'offline')}</p>
              </div>`
            : !this.stamp_
              ? html`<span class="fv-skeleton dv-cam__skeleton"></span>`
              : html` <span class="dv-cam__shade" data-measure="skip"></span>
                  <button
                    class="dv-cam__tap"
                    data-target
                    aria-label=${s(this.hass, 'view', { name })}
                    @click=${() => this.moreInfo()}
                  ></button>
                  <span class="dv-cam__pill dv-cam__live ${this.stale_ ? 'is-stale' : ''}"
                    ><i></i>${s(this.hass, 'live')}</span
                  >
                  <span class="dv-cam__pill dv-cam__time">${this.clock()}</span>
                  <div class="dv-cam__actions">
                    ${round('snapshot', 'quiet', s(this.hass, 'snapshot'), () => this.moreInfo())}
                    ${round('expand', 'quiet', s(this.hass, 'fullscreen'), () => this.fullscreen())}
                  </div>`
        }
      </div>
      ${this.renderRows(true)}
    </article>`;
  }
}
