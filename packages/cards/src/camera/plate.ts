import { glyph, round } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';

import { CLOCK_PLATE, ROUNDS_PLATE } from '../devices-family.js';
import type { CameraFeed } from './feed.js';

/** What fits inside a camera's plate at its size. */
export interface PlateLayout {
  /** "Live"'s pill: as wide as its word (12 in, the dot and its 6, 10 out, on the 4 grid), never under 64. */
  readonly live: number;
  /** "Live" folds to its dot (32), the words its label: too narrow for the word beside the one round left, or at all. */
  readonly dot: boolean;
  /** How many of its rounds the plate's bottom end keeps (a low plate gives the first ones up before "Live"). */
  readonly rounds: number;
  /** The clock has its room: a plate from 108 high, its pill 8 clear of "Live". */
  readonly clock: boolean;
}

/** What the bottom end's `n` rounds (44, 8 apart) take beside "Live": 8 before them, 12 after; 12 for none. */
const besideLive = (n: number): number => (n ? 8 + n * 44 + (n - 1) * 8 + 12 : 12);

/**
 * What fits a plate `width` × `height` whose "Live" word is `liveWord` wide and whose bottom end holds `rounds` rounds
 * (the camera's snapshot and full screen; a tile's full screen alone, or none). Under 100 high the rounds share "Live"'s rows
 * (12 + 24 + 8 + 44 + 12): the first ones go before they would come within 8 of it, the last one stays; then "Live"
 * folds to its dot where even that one would. On a taller plate the clock goes before it would come within 8 of
 * "Live". The words never go under their pill: where the plate is too narrow for them at all, the dot.
 */
export function plateLayout(
  width: number,
  height: number,
  liveWord: number,
  rounds: number,
): PlateLayout {
  const live = Math.max(64, Math.ceil((26 + liveWord + 10) / 4) * 4);
  const low = height < ROUNDS_PLATE;
  let kept = rounds;
  while (low && kept > 1 && live + 12 + besideLive(kept) > width) kept -= 1;
  return {
    live,
    dot: (low && live + 12 + besideLive(kept) > width) || live + 24 > width,
    rounds: kept,
    clock: height >= CLOCK_PLATE && live + 12 + 8 + 80 + 12 <= width,
  };
}

export interface PlateOptions {
  /** The camera's feed: its picture (the stills or the stream), when its frame arrived, whether it is fresh. */
  readonly feed: CameraFeed;
  /** The plate's height: its shape across its width, on the 4 grid. */
  readonly height: number;
  /** The shape (width over height) the stream is asked to keep. */
  readonly ratio: number;
  /** What fits inside (`plateLayout`). */
  readonly layout: PlateLayout;
  /** "Live", or "Stream unavailable" on a live plate whose stream could not play; none where it is not shown. */
  readonly live?: string | undefined;
  /**
   * The camera cannot be shown: why, and on how many lines those words go across the plate (none on a plate too low for
   * them: its glyph alone, the words said where the plate's card says the camera's state).
   */
  readonly off?: { readonly text: string; readonly lines: number } | undefined;
  /** `contain`: the whole picture, on the screen's dark. */
  readonly contain: boolean;
  /** Frames under a second apart: they cut, as a video does. */
  readonly quick: boolean;
  /** The plate fills the screen: "Live" keeps its words, the rounds left out are back, its round says how to leave. */
  readonly fullscreen: boolean;
  /** The shown frame's time, in the top end's pill; none where the plate has no clock (a tile). */
  readonly clock?: string;
  /** The picture's own button: its words and what it does (none where a button over its tile is the picture's). */
  readonly label?: string;
  readonly open?: (() => void) | undefined;
  /** The snapshot round's words, where the plate has one before full screen's (it opens what the picture does). */
  readonly snapshot?: string;
  /** The full-screen round: its words to enter and to leave, and what it does; none where it is not offered. */
  readonly screen?:
    { readonly enter: string; readonly leave: string; readonly run: () => void } | undefined;
}

/**
 * A camera's plate: the picture in its shape, "Live" at the top start, the clock at the top end, the rounds at the
 * bottom end; a skeleton until the first frame; out of reach (or with no picture), the camera's glyph and why.
 */
export function renderPlate(o: PlateOptions): TemplateResult {
  const { feed, layout } = o;
  const streaming = feed.streaming;
  const stale = feed.stale && !streaming;
  const dot = layout.dot && !o.fullscreen;
  // the off block: the 44 glyph, and 8 and its lines of 24 where it has words, centred on the 4 grid
  const lines = o.off?.lines ?? 1;
  const offHeight = 44 + (lines ? 8 + 24 * lines : 0);
  const offTop = Math.max(0, Math.round((o.height - offHeight) / 2 / 4) * 4);
  return html`<div
    class="dv-cam fv-plate ${o.off ? 'is-off' : ''} ${o.contain ? 'is-contain' : ''} ${
      o.quick ? 'is-quick' : ''
    }"
    style="height:${o.height}px"
  >
    ${feed.render(o.fullscreen || o.contain ? 'contain' : 'cover', o.ratio, 'dv-cam__stream')}
    ${
      o.off
        ? html`<div class="dv-cam__off" style="top:${offTop}px;height:${offHeight}px">
            <span class="fv-ico fv-ico--off" data-icon>${glyph('camera')}</span>
            ${lines ? html`<p>${o.off.text}</p>` : nothing}
          </div>`
        : !feed.stamp && !streaming
          ? html`<span class="fv-skeleton dv-cam__skeleton"></span>`
          : html` <span class="dv-cam__shade" data-measure="skip"></span>
              ${
                o.open
                  ? html`<button
                      class="dv-cam__tap"
                      data-target
                      aria-label=${o.label ?? nothing}
                      @click=${o.open}
                    ></button>`
                  : nothing
              }
              ${
                o.live === undefined
                  ? nothing
                  : html`<span
                      class="dv-cam__pill dv-cam__live ${stale ? 'is-stale' : ''} ${dot ? 'is-dot' : ''} ${feed.unplayable ? 'is-failed' : ''}"
                      style="width:${dot ? 32 : layout.live}px"
                      role="img"
                      aria-label=${o.live}
                      aria-hidden=${stale ? 'true' : nothing}
                      ><i></i><span aria-hidden="true">${o.live}</span></span
                    >`
              }
              ${
                streaming || o.clock === undefined
                  ? nothing
                  : html`<span class="dv-cam__pill dv-cam__time ${layout.clock ? '' : 'is-low'}"
                      >${o.clock}</span
                    >`
              }
              <div class="dv-cam__actions">
                ${
                  o.snapshot === undefined || !o.open
                    ? nothing
                    : html`<span class="dv-cam__snap ${layout.rounds > 1 ? '' : 'is-low'}"
                        >${round('snapshot', 'quiet', o.snapshot, o.open)}</span
                      >`
                }
                ${
                  !o.screen
                    ? nothing
                    : o.fullscreen
                      ? round('close', 'quiet', o.screen.leave, o.screen.run)
                      : round('expand', 'quiet', o.screen.enter, o.screen.run)
                }
              </div>`
    }
  </div>`;
}

/** The plate's own rules, over the devices sheet's base plate (`devices.css`): what a card drawing `renderPlate` adopts. */
export const plateStyles = css`
  .dv-cam {
    background: none;
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
  /* the stream could not play (the stills show meanwhile): the pill says so, its dot the glass's own white */
  .dv-cam__live.is-failed i {
    background: rgb(255 255 255 / 0.55);
    box-shadow: none;
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
  .dv-cam.is-off .fv-plate__img {
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
  /* one line, or two on a narrow plate ("No image from the camera" in a 211 column): never a word cut */
  .dv-cam__off p {
    max-width: 100%;
    font-size: 13px;
    font-weight: 500;
    line-height: 24px;
    color: var(--fluvy-unavailable);
    text-align: center;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .dv-cam:fullscreen {
    border-radius: 0;
    background: var(--fluvy-neutral-05);
  }
  .dv-cam:fullscreen .fv-plate__img {
    object-fit: contain;
  }
  /* a low picture leaves its clock out (the rounds would sit on it); full screen has the room for it */
  .dv-cam__time.is-low {
    display: none;
  }
  .dv-cam:fullscreen .dv-cam__time.is-low {
    display: inline-flex;
  }
  /* the snapshot round, left out of a low narrow plate, is back in full screen */
  .dv-cam__snap {
    display: contents;
  }
  .dv-cam__snap.is-low {
    display: none;
  }
  .dv-cam:fullscreen .dv-cam__snap.is-low {
    display: contents;
  }
  /* the whole picture: what the shape does not fill is the screen's dark, as a player's bands are */
  .dv-cam.is-contain:not(.is-off) {
    background: var(--fluvy-neutral-05);
  }
  .dv-cam.is-contain .fv-plate__img {
    object-fit: contain;
  }
  /* frames under a second apart cut as a video does: a fade would never finish before the next */
  .dv-cam.is-quick .fv-plate__img.is-on {
    animation: none;
  }
  /* Home Assistant's stream fills the plate as the stills do */
  .dv-cam__stream {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }
  .dv-cam:fullscreen .dv-cam__shade {
    display: none;
  }
`;
