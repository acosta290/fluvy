import { strings, type HomeAssistant } from '@fluvy/core';
import { baseStyles } from '@fluvy/ui';
import { css, html, LitElement } from 'lit';

const s = strings('panel');

/*
 * "Wall paused · Resume": a small bar at the foot of the page while the wall is paused, the way back. It stays as
 * long as the pause does (the pause ends by itself when the screensaver would have come).
 */
export class FluvyWallToast extends LitElement {
  static override properties = { hass: { attribute: false } };

  static override styles = [
    ...baseStyles,
    css`
      :host {
        position: fixed;
        left: 50%;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
        z-index: 7;
        transform: translateX(-50%);
        animation: rise 240ms ease;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translate(-50%, 8px);
        }
      }
      .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 44px;
        padding: 0 8px 0 16px;
        border-radius: var(--fluvy-radius-control, 12px);
        background: var(--fluvy-card);
        color: var(--fluvy-text);
        box-shadow:
          0 0 0 1px var(--fluvy-border),
          0 16px 32px -16px rgb(0 0 0 / 0.35);
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
      button {
        height: 32px;
        padding: 0 12px;
        border: 0;
        border-radius: var(--fluvy-radius-control, 12px);
        background: var(--fluvy-accent-fill);
        color: var(--fluvy-accent-on-fill);
        font: inherit;
        cursor: pointer;
      }
    `,
  ];

  declare hass: HomeAssistant | undefined;
  onResume: () => void = () => undefined;

  protected override render() {
    return html`<div class="toast" role="status">
      <span>${s(this.hass, 'wall.paused')}</span>
      <button @click=${() => this.onResume()}>${s(this.hass, 'wall.resume')}</button>
    </div>`;
  }
}
