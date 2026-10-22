import type { EntityView, HomeAssistant } from '@fluvy/core';
import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

import { Crossfade } from '../shared/crossfade.js';
import { StreamHolder, type StreamElement } from './stream.js';

/** A request that has not answered after this long no longer holds the next one back. */
export const STALL_MS = 30_000;
/** This many failures in a row and the last good frame stops standing in for the camera. */
export const GIVE_UP = 3;

/** Each camera's own shape once a frame has said it: in memory for this page, in the browser for the next. */
const NATIVE_KEY = 'fluvy-camera-shape';
const natives = new Map<string, number>();
function nativeOf(entity: string | undefined): number {
  if (!entity) return 0;
  if (!natives.size)
    try {
      const stored = JSON.parse(localStorage.getItem(NATIVE_KEY) ?? '{}') as Record<
        string,
        unknown
      >;
      for (const [id, ratio] of Object.entries(stored))
        if (typeof ratio === 'number' && ratio > 0) natives.set(id, ratio);
    } catch {
      // a private window or blocked storage: the shape is read again from the first frame
    }
  return natives.get(entity) ?? 0;
}
function rememberNative(entity: string | undefined, ratio: number): void {
  if (!entity || !(ratio > 0)) return;
  natives.set(entity, ratio);
  try {
    localStorage.setItem(NATIVE_KEY, JSON.stringify(Object.fromEntries(natives)));
  } catch {
    // kept for this page only
  }
}

/** What a card wants of its feed, read afresh each time the feed acts: its config and the house as they are now. */
export interface FeedWant {
  readonly hass: HomeAssistant | undefined;
  /** The picture's entity: a camera, or the image a printer's job shows; null where there is none. */
  readonly view: EntityView | null;
  /** Home Assistant's stream wanted in the stills' place (a camera on `camera_view: live`). */
  readonly live: boolean;
  /** Seconds between two stills. */
  readonly refresh: number;
  /** A picture that changes with its job, not with time (a printer's preview): fetched again only when its path does. */
  readonly once?: boolean;
  /** The camera's own shape wanted (`aspect_ratio: native`): remembered, and read off its first frame. */
  readonly native?: boolean;
  /** The width a still is asked at, in CSS pixels: the plate's (the screen's in full screen). */
  readonly width: number;
}

/**
 * One camera's picture in a card: stills that refresh themselves, or Home Assistant's stream where the card wants it
 * live. Two stacked images take turns: the next frame loads behind the current one and fades in over it once decoded,
 * so the picture never blinks. One interval, which only runs while the picture is on screen and the tab is in front,
 * and is gone with the card; one request at a time, so a slow camera is waited for, not piled onto. The camera and
 * the printer cards hold one each.
 */
export class CameraFeed implements ReactiveController {
  /** When the shown frame arrived; 0 until one has. */
  stamp = 0;
  /** No frame to show: none ever came, or the camera kept failing. */
  failed = false;
  /** The shown frame is older than it should be: the last request failed, or the stills are stopped. */
  stale = false;
  /** The camera's own shape (width over height) where it is wanted, remembered or read off a frame; 0 until known. */
  native = 0;
  /** Home Assistant's stream: one element, kept while the picture is on screen or only just off it. */
  readonly holder: StreamHolder;

  private readonly frames: Crossfade;
  private timer = 0;
  /** Seconds the running interval was started with, so another refresh restarts it. */
  private period = 0;
  /** When the request now in flight was made; 0 when there is none. */
  private inFlight = 0;
  private failures = 0;
  private inFront = true;
  /** Whether the host last drew the stream. */
  private shownStream = false;
  /** What the last sync was asked for: another camera, or stills instead of the stream, ends the stream's session. */
  private last: FeedWant | undefined;
  /** The path of the picture fetched once (a preview): fetched again when it changes. */
  private fetched = '';
  /** The first frame has been checked against the remembered shape. */
  private nativeChecked = false;

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    private readonly want: () => FeedWant,
    /** The plate the picture is drawn in, where the card holds more than one: its place on screen counts. */
    private readonly target?: () => Element | null,
  ) {
    // the holder first: back in the page, it has heard it is off screen before the feed's first look reads it
    this.holder = new StreamHolder(host, () => this.sync(), target);
    this.frames = new Crossfade(
      host,
      () => this.landed(),
      () => this.missed(),
    );
    host.addController(this);
  }

  hostConnected(): void {
    this.inFront = document.visibilityState !== 'hidden';
    document.addEventListener('visibilitychange', this.onTabChange);
    this.sync();
  }

  hostDisconnected(): void {
    document.removeEventListener('visibilitychange', this.onTabChange);
    this.stop();
    this.fetched = '';
  }

  /** The host is about to draw: its config or the house may have changed what the feed should do. */
  hostUpdate(): void {
    this.sync();
  }

  private readonly onTabChange = (): void => {
    this.inFront = document.visibilityState !== 'hidden';
    this.sync();
  };

  /** Home Assistant's stream is what the plate shows now (asked for, defined, on screen or only just off it). */
  get streaming(): boolean {
    return this.streams(this.want());
  }

  /** A live picture whose stream could not play: the stills show meanwhile, and the stream is asked for again later. */
  get unplayable(): boolean {
    return this.want().live && this.holder.state === 'none';
  }

  private streams(want: FeedWant): boolean {
    return want.live && this.holder.playing && want.view?.status === 'ok';
  }

  /**
   * Runs the stills exactly while they are worth running: connected, on screen, tab in front, a picture to fetch, and
   * no stream in their place (asked for on a live card, and again a while after it could not play; stills meanwhile
   * and where there is none). A picture that changes with its job is fetched once each time it changes.
   */
  private sync(): void {
    const want = this.want();
    const { view } = want;
    const last = this.last;
    this.last = want;
    // another camera, or stills instead of the stream: the stream goes, and its session with it
    if (last && (last.view?.id !== view?.id || last.live !== want.live)) this.holder.teardown();
    // another camera, or its own shape asked for anew: laid out in the one remembered from the last time (so the page
    // does not move before the first frame), then checked against the first frame shown
    if (!last || last.view?.id !== view?.id || Boolean(last.native) !== Boolean(want.native)) {
      this.native = want.native ? nativeOf(view?.id) : 0;
      this.nativeChecked = false;
      this.host.requestUpdate();
      // the same camera's frame already shown says its shape at once
      if (last?.view?.id === view?.id) void this.host.updateComplete.then(() => this.check());
    }
    const ok = view?.status === 'ok';
    if (want.live && ok) this.holder.ask(view.id);
    // the stream comes and goes with the screen, which is not the card's state: draw it again
    const streaming = this.streams(want);
    if (streaming !== this.shownStream) {
      this.shownStream = streaming;
      this.host.requestUpdate();
    }
    const picture = ok ? view.attr<string | null>('entity_picture') : null;
    const ready =
      this.host.isConnected &&
      this.holder.onScreen &&
      this.inFront &&
      Boolean(want.hass) &&
      Boolean(picture);
    if (want.once) {
      if (this.timer) this.stop();
      // remembered once its fetch has started: a hidden page, a picture off screen or a still in flight puts it off
      if (picture && picture !== this.fetched && ready && this.pull()) this.fetched = picture;
      return;
    }
    this.fetched = '';
    const wanted = ready && !streaming;
    if (this.timer && (!wanted || want.refresh !== this.period)) this.stop();
    if (wanted && !this.timer) {
      this.period = want.refresh;
      this.timer = window.setInterval(() => this.pull(), want.refresh * 1000);
      this.pull();
    }
  }

  private stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.period = 0;
    this.inFlight = 0;
    if (this.stamp && !this.stale) {
      this.stale = true;
      this.host.requestUpdate();
    }
  }

  /**
   * Asks the image behind for a fresh still; false where none could be asked (no picture, or one still in flight).
   * One request at a time: a slow camera is waited for, not piled onto.
   */
  pull(): boolean {
    const want = this.want();
    const picture = want.view?.attr<string | null>('entity_picture');
    if (!want.hass || !picture) return false;
    const now = Date.now();
    if (this.inFlight && now - this.inFlight < STALL_MS) return false;
    this.inFlight = now;
    const base = want.hass.hassUrl(picture);
    // the signed token in the URL stays; the still is asked at the plate's width in device pixels (the screen's in
    // full screen: sharp, and no heavier than it needs to be — Home Assistant's own picture cards do the same), and
    // the extra bit keeps the browser from serving one frame forever
    const width = Math.ceil(want.width * (window.devicePixelRatio || 1));
    this.frames.show(
      base.startsWith('data:')
        ? `${base}#${now}`
        : `${base}${base.includes('?') ? '&' : '?'}width=${width}&_=${now}`,
    );
    return true;
  }

  /** The plate changed its width (full screen, and back): a still at that width at once, where the stills run. */
  resized(): void {
    if (this.timer) this.pull();
  }

  private landed(): void {
    this.inFlight = 0;
    this.failures = 0;
    this.stamp = Date.now();
    this.failed = false;
    this.stale = false;
    this.host.requestUpdate();
    // the frame is the front one once this update has drawn it: its shape is read then
    void this.host.updateComplete.then(() => this.check());
  }

  private missed(): void {
    this.inFlight = 0;
    this.failures += 1;
    if (!this.stamp || this.failures >= GIVE_UP) this.failed = true;
    else this.stale = true;
    this.host.requestUpdate();
  }

  /**
   * The camera's own shape, checked against the first frame shown, once: a camera that changed its shape (another
   * profile, turned upright) is taken and remembered anew.
   */
  private check(): void {
    const want = this.want();
    if (!want.native || this.nativeChecked) return;
    const front = (this.target?.() ?? this.host.shadowRoot)?.querySelector<HTMLImageElement>(
      '.fv-plate__img.is-on',
    );
    if (!front?.naturalWidth || !front.naturalHeight) return;
    this.nativeChecked = true;
    const ratio = front.naturalWidth / front.naturalHeight;
    if (this.native && Math.abs(ratio - this.native) / this.native <= 0.01) return;
    this.native = ratio;
    rememberNative(want.view?.id, ratio);
    this.host.requestUpdate();
  }

  /**
   * The picture: Home Assistant's stream where it plays (made once, its camera, fit and shape kept current), else the
   * two stills.
   */
  render(
    fit: 'cover' | 'contain',
    ratio: number,
    className: string,
  ): TemplateResult | StreamElement {
    const want = this.want();
    if (!this.streams(want)) return this.frames.render();
    return this.holder.draw({
      hass: want.hass,
      stateObj: want.view?.stateObj,
      fitMode: fit,
      aspectRatio: ratio,
      className,
    });
  }
}
