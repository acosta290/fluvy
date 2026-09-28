import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit';

export type Slot = 'a' | 'b';

/**
 * Two stacked images that cross-fade: a new picture is loaded into the one behind and shown, decoded, once it
 * has arrived — a camera's next frame, a room's photo — so nothing ever paints half-loaded. The host renders
 * `render()` inside a `.fv-plate` (surfaces.css) and hears of each picture shown or failed.
 */
export class Crossfade implements ReactiveController {
  private a = '';
  private b = '';
  /** Which image is the one being shown ('' until the first picture lands). */
  front: Slot | '' = '';

  constructor(
    private readonly host: ReactiveControllerHost & { readonly isConnected: boolean },
    private readonly onShown?: () => void,
    private readonly onFailed?: () => void,
  ) {
    host.addController(this);
  }

  hostConnected(): void {}

  /** Loads a picture into the image behind; it is shown once it has arrived. */
  show(url: string): void {
    if (this.front === 'a') this.b = url;
    else this.a = url;
    this.host.requestUpdate();
  }

  private onLoad(slot: Slot, event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    const show = (): void => {
      if (!this.host.isConnected) return;
      this.front = slot;
      this.host.requestUpdate();
      this.onShown?.();
    };
    if (typeof image.decode === 'function')
      image.decode().then(show, show); // fade in a decoded picture, not a half-painted one
    else show();
  }

  /** The two images, in `cls` (the plate's `fv-plate__img`); the shown one is `is-on`, the other `is-under`. */
  render(cls = 'fv-plate__img'): TemplateResult {
    const state = (slot: Slot): string =>
      this.front === slot ? 'is-on' : this.front ? 'is-under' : '';
    return html`<img
        class="${cls} ${state('a')}"
        alt=""
        decoding="async"
        draggable="false"
        src=${this.a || nothing}
        @load=${(event: Event) => this.onLoad('a', event)}
        @error=${() => this.onFailed?.()}
      /><img
        class="${cls} ${state('b')}"
        alt=""
        decoding="async"
        draggable="false"
        src=${this.b || nothing}
        @load=${(event: Event) => this.onLoad('b', event)}
        @error=${() => this.onFailed?.()}
      />`;
  }
}
