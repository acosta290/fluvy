import { reducedMotion } from '@fluvy/ui';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

interface LayerHost extends ReactiveControllerHost {
  readonly renderRoot: DocumentFragment | HTMLElement;
}

/**
 * The floating layers of a page (its dates, its sources): which one is open, which is leaving — it animates out
 * before it goes, whatever happens to the animation — Escape closing the top one, and the focus moving into a layer
 * that opens and back to whatever opened it. One layer shows at a time.
 */
export class Layers<K extends string> implements ReactiveController {
  /** The layer on screen, '' for none. */
  open: K | '' = '';
  /** The layer on its way out (it is still drawn while it animates). */
  leaving: K | '' = '';

  private opener: HTMLElement | null = null;
  private timer = 0;

  constructor(private readonly host: LayerHost) {
    host.addController(this);
  }

  hostDisconnected(): void {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  /** Whether `which` is drawn (open, or leaving). */
  is(which: K): boolean {
    return this.open === which;
  }

  show(which: K): void {
    if (this.open === which) return;
    clearTimeout(this.timer);
    this.leaving = '';
    this.open = which;
    this.host.requestUpdate();
    // the layer takes the focus once it is drawn: Escape and Tab then work inside it
    void this.host.updateComplete.then(() => {
      const root = this.host.renderRoot;
      const active = root instanceof ShadowRoot ? root.activeElement : null;
      this.opener = (active as HTMLElement | null) ?? null;
      root
        .querySelector<HTMLElement>(`[data-autofocus="${which}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  /** The layer leaves as it came (it slides and fades), then goes; with reduced motion, at once. */
  dismiss(which: K = this.open as K): void {
    if (this.open !== which || this.leaving === which) return;
    if (reducedMotion()) {
      this.gone(which);
      return;
    }
    this.leaving = which;
    this.host.requestUpdate();
    // whatever happens to the animation (a tab in the background, a style that overrides it), the layer goes
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.gone(which), 400);
  }

  private gone(which: K): void {
    if (this.open !== which) return;
    this.open = '';
    this.leaving = '';
    this.host.requestUpdate();
    this.opener?.focus({ preventScroll: true });
    this.opener = null;
  }

  /** The layer's own animation ending is what usually takes it away (the timer is only the safety net). */
  readonly onLeft = (event: AnimationEvent): void => {
    if (event.target !== event.currentTarget || !this.leaving) return;
    this.gone(this.leaving as K);
  };

  /** Escape closes the layer on screen, and says so (the page behind must not act on the same key). */
  readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.open) return;
    this.dismiss(this.open as K);
    event.stopPropagation();
  };
}
