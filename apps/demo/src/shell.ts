import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import type { PaletteName } from '@fluvy/tokens/runtime';
import { baseStyles, chips, fitPills, glyph, type ChipItem } from '@fluvy/ui';
import { FAMILIES, familyOf } from './families.js';
import { DEVICE_NAMES, type DemoState, type DemoView, type DeviceName } from './state.js';
import { t } from './strings.js';

/** A preset on the palette row: its accent as the dot's colour. */
export interface PaletteDot {
  readonly name: PaletteName;
  readonly title: string;
  readonly ink: string;
}

const REPO = 'https://github.com/acosta290/fluvy';
const BANNER_KEY = 'fluvy-demo:banner';

/**
 * The demo's chrome: the brand, what to look at (the card families, the pages), and how (the palette, the mode,
 * the device, the language), drawn with the design system's own parts. Changes go out as `demo-change` with the
 * fields to change; the page answers by setting `state` again.
 */
export class FluvyDemoShell extends LitElement {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        position: sticky;
        top: 0;
        z-index: 3;
        display: block;
        color: var(--fluvy-text);
        background: color-mix(in srgb, var(--fluvy-page) 90%, transparent);
        box-shadow: 0 1px 0 var(--fluvy-border);
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        font-family: Inter, system-ui, sans-serif;
      }
      .demo-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px 16px;
        max-width: 1408px;
        margin: 0 auto;
        padding: 12px 16px;
      }
      .demo-bar--look {
        padding-top: 0;
      }
      .demo-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-right: auto;
        color: inherit;
        text-decoration: none;
      }
      .demo-brand__mark {
        width: 40px;
        height: 40px;
        border-radius: 12px;
      }
      .demo-brand__text {
        display: flex;
        flex-direction: column;
      }
      .demo-brand__name {
        font-size: 20px;
        line-height: 24px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .demo-brand__sub {
        font-size: 13px;
        line-height: 16px;
        font-weight: 500;
        color: var(--fluvy-text-secondary);
      }
      .demo-links {
        display: flex;
        gap: 8px;
      }
      .demo-links a {
        text-decoration: none;
      }
      .demo-palette {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        margin-right: auto;
      }
      .demo-dot {
        position: relative;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        color: var(--fluvy-text-secondary);
      }
      .demo-dot::before {
        content: '';
        position: absolute;
        top: 10px;
        left: 10px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--dot, var(--fluvy-card));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--fluvy-text) 14%, transparent);
        transition: transform 180ms var(--fv-ease, ease);
      }
      .demo-dot.is-active::before {
        box-shadow:
          0 0 0 2px var(--fluvy-page),
          0 0 0 4px var(--dot, var(--fluvy-accent));
      }
      .demo-dot:focus-visible {
        outline: none;
      }
      .demo-dot:focus-visible::before {
        box-shadow:
          0 0 0 2px var(--fluvy-page),
          0 0 0 4px var(--fluvy-accent);
      }
      @media (hover: hover) {
        .demo-dot:hover::before {
          transform: scale(1.12);
        }
      }
      .demo-dot--custom svg {
        position: absolute;
        top: 14px;
        left: 14px;
        width: 16px;
        height: 16px;
      }
      .demo-banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
        max-width: 1408px;
        margin: 0 auto;
        padding: 0 16px 12px;
        font-size: 14px;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      .demo-banner p {
        flex: 1 1 480px;
        margin: 0;
      }
      .demo-toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 4;
        max-width: calc(100vw - 32px);
        box-sizing: border-box;
        padding: 12px 16px;
        border-radius: var(--fluvy-radius-control, 12px);
        background: var(--fluvy-card);
        color: var(--fluvy-text);
        box-shadow:
          0 0 0 1px var(--fluvy-border),
          var(--fluvy-shadow-lift, 0 8px 24px rgba(0, 0, 0, 0.12));
        font-size: 14px;
        line-height: 20px;
        transform: translateX(-50%);
        animation: demo-toast 240ms var(--fv-ease-out, ease-out) both;
      }
      @keyframes demo-toast {
        from {
          opacity: 0;
          transform: translate(-50%, 8px);
        }
      }
      /* a phone keeps its screen for the cards: the chrome scrolls away with the page */
      @media (max-width: 720px) {
        :host {
          position: static;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .demo-toast {
          animation: none;
        }
        .demo-dot::before {
          transition: none;
        }
      }
    `,
  ];

  static override properties = {
    state: { attribute: false },
    palettes: { attribute: false },
    mark: { attribute: false },
    notice: { state: true },
    banner: { state: true },
  };

  declare state: DemoState | undefined;
  declare palettes: readonly PaletteDot[];
  /** The brand mark's URL. */
  declare mark: string;
  declare notice: string;
  declare banner: boolean;
  private timer = 0;
  private refit: (() => void) | undefined;

  constructor() {
    super();
    this.palettes = [];
    this.mark = '';
    this.notice = '';
    this.banner = true;
    try {
      this.banner = localStorage.getItem(BANNER_KEY) !== 'seen';
    } catch {
      this.banner = true;
    }
  }

  /** The pills sized from their text on the 4 px grid, as every card does (again once the web font is in). */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    fitPills(this.renderRoot);
    if (!this.refit) {
      this.refit = () => fitPills(this.renderRoot, true);
      void document.fonts.ready.then(this.refit);
    }
  }

  /** A word for the visitor, gone by itself. */
  say(text: string): void {
    this.notice = text;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.notice = ''), 2800);
  }

  private change(patch: Partial<DemoState>): void {
    this.dispatchEvent(new CustomEvent('demo-change', { detail: patch }));
  }

  private view(view: DemoView): void {
    this.change({ view });
  }

  private dismiss(): void {
    this.banner = false;
    try {
      localStorage.setItem(BANNER_KEY, 'seen');
    } catch {
      // a private window: the banner comes back next time, which is fine
    }
  }

  override render(): TemplateResult | typeof nothing {
    const state = this.state;
    if (!state) return nothing;
    const lang = state.language;
    const { view } = state;
    const current = view.kind === 'sheet' ? familyOf(view.name) : view.kind;
    const views: ChipItem[] = [
      ...FAMILIES.map((family) => ({
        key: family.key,
        label: t(lang, family.label),
        active: current === family.key,
      })),
      { key: 'panel', label: t(lang, 'page.panel'), active: current === 'panel' },
      {
        key: 'activity',
        label: t(lang, 'page.activity'),
        active: current === 'activity',
      },
      {
        key: 'history',
        label: t(lang, 'page.history'),
        active: current === 'history',
      },
    ];
    const modes: ChipItem[] = [
      { key: 'light', label: t(lang, 'mode.light'), active: state.mode === 'light' },
      { key: 'dark', label: t(lang, 'mode.dark'), active: state.mode === 'dark' },
    ];
    const devices: ChipItem[] = DEVICE_NAMES.map((device) => ({
      key: device,
      label: t(lang, `device.${device}`),
      active: !state.frameWidth && state.device === device,
    }));
    const languages: ChipItem[] = [
      { key: 'en', label: 'EN', active: lang === 'en' },
      { key: 'es', label: 'ES', active: lang === 'es' },
    ];
    const chosen = typeof state.look.palette === 'string' ? state.look.palette : '';
    return html`
      <div class="demo-bar">
        <a class="demo-brand" href=${REPO}>
          ${this.mark ? html`<img class="demo-brand__mark" src=${this.mark} alt="" />` : nothing}
          <span class="demo-brand__text">
            <span class="demo-brand__name">Fluvy</span>
            <span class="demo-brand__sub">${t(lang, 'brand.sub')}</span>
          </span>
        </a>
        ${chips(views, (key) => this.pick(key))}
        <div class="demo-links">
          <a class="fv-btn fv-btn--quiet" data-target data-fit="32" href="${REPO}#installation"
            >${t(lang, 'links.install')}</a
          >
          <a class="fv-btn fv-btn--quiet" data-target data-fit="32" href=${REPO}
            >${t(lang, 'links.github')}</a
          >
        </div>
      </div>
      <div class="demo-bar demo-bar--look">
        <div class="demo-palette" role="group" aria-label=${t(lang, 'palette.title')}>
          ${this.palettes.map(
            (palette) =>
              html`<button
                class="demo-dot ${chosen === palette.name ? 'is-active' : ''}"
                data-target
                style="--dot:${palette.ink}"
                title=${palette.title}
                aria-label=${palette.title}
                aria-pressed=${chosen === palette.name ? 'true' : 'false'}
                @click=${() => this.change({ look: { ...state.look, palette: palette.name } })}
              ></button>`,
          )}
          <button
            class="demo-dot demo-dot--custom ${chosen === '' ? 'is-active' : ''}"
            data-target
            title=${t(lang, 'palette.custom')}
            aria-label=${t(lang, 'palette.custom')}
            @click=${() => this.view({ kind: 'panel', tab: 'appearance' })}
          >
            ${glyph('plus')}
          </button>
        </div>
        ${chips(modes, (key) => this.change({ mode: key === 'dark' ? 'dark' : 'light' }))}
        ${chips(devices, (key) => this.change({ device: key as DeviceName, frameWidth: undefined }))}
        ${chips(languages, (key) => this.change({ language: key === 'es' ? 'es' : 'en' }))}
      </div>
      ${
        this.banner
          ? html`<div class="demo-banner">
              <p>${t(lang, 'banner.text')}</p>
              <button class="fv-btn fv-btn--quiet" data-target @click=${() => this.dismiss()}>
                ${t(lang, 'banner.ok')}
              </button>
            </div>`
          : nothing
      }
      ${this.notice ? html`<div class="demo-toast" role="status">${this.notice}</div>` : nothing}
    `;
  }

  private pick(key: string): void {
    if (key === 'panel') this.view({ kind: 'panel', tab: 'appearance' });
    else if (key === 'activity' || key === 'history') this.view({ kind: key });
    else this.view({ kind: 'sheet', name: key });
  }
}

if (!customElements.get('fluvy-demo-shell'))
  customElements.define('fluvy-demo-shell', FluvyDemoShell);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-demo-shell': FluvyDemoShell;
  }
}
