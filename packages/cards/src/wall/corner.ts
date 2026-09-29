import { haptic } from '@fluvy/core';
import { css, html, LitElement, svg } from 'lit';

/*
 * The way out of a wall: a 44 corner at the top right, invisible until pressed. A hold of a second and a half fills a
 * ring, the tablet taps back, and the wall pauses; letting go before cancels. Nothing else on the page is a
 * gesture of Fluvy's.
 */

const HOLD = 1500;
const RING = 2 * Math.PI * 18;

export class FluvyWallCorner extends LitElement {
  static override properties = { pressing: { state: true } };

  static override styles = css`
    :host {
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      right: env(safe-area-inset-right, 0px);
      z-index: 7;
      width: 44px;
      height: 44px;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }
    button {
      display: block;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      background: none;
      cursor: pointer;
      color: var(--fluvy-accent, #8a6b2a);
    }
    svg {
      display: block;
      width: 44px;
      height: 44px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .is-pressing svg {
      opacity: 1;
    }
    .track {
      fill: none;
      stroke: currentColor;
      stroke-opacity: 0.2;
      stroke-width: 2;
    }
    .fill {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-dasharray: ${RING};
      stroke-dashoffset: ${RING};
      transform: rotate(-90deg);
      transform-origin: 22px 22px;
    }
    .is-pressing .fill {
      stroke-dashoffset: 0;
      transition: stroke-dashoffset ${HOLD}ms linear;
    }
  `;

  declare pressing: boolean;
  /** Called once the hold completes. */
  onLeave: () => void = () => undefined;
  private timer = 0;

  constructor() {
    super();
    this.pressing = false;
  }

  private readonly start = (event: PointerEvent): void => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pressing = true;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.pressing = false;
      haptic(this, 'medium');
      this.onLeave();
    }, HOLD);
  };

  private readonly cancel = (): void => {
    clearTimeout(this.timer);
    this.pressing = false;
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
  }

  protected override render() {
    return html`<button
      class=${this.pressing ? 'is-pressing' : ''}
      aria-label="Hold to leave the wall"
      @pointerdown=${this.start}
      @pointerup=${this.cancel}
      @pointercancel=${this.cancel}
      @pointerleave=${this.cancel}
      @contextmenu=${(event: Event) => event.preventDefault()}
    >
      ${svg`<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="track" cx="22" cy="22" r="18"/><circle class="fill" cx="22" cy="22" r="18"/></svg>`}
    </button>`;
  }
}
