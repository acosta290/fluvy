import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import type { PaletteName } from '@fluvy/tokens/runtime';
import { isLanguageCode, offeredLanguages } from '@fluvy/core';
import {
  baseStyles,
  chips,
  fitPills,
  glyph,
  reducedMotion,
  sideScroll,
  type ChipItem,
} from '@fluvy/ui';
import '@fluvy/ui/select';
import type { SelectChangeDetail, SelectOption } from '@fluvy/ui/select';
import { FAMILIES, familyOf } from './families.js';
import { DEVICE_NAMES, isDevice, type DemoState, type DemoView } from './state.js';
import { t } from './strings.js';

/** A preset on the palette row: its accent as the dot's colour. */
export interface PaletteDot {
  readonly name: PaletteName;
  readonly title: string;
  readonly ink: string;
}

const REPO = 'https://github.com/acosta290/fluvy';
/** Where the page leads: the installation and the repository, in words, or as rounds on a phone. */
const LINKS = [
  { href: `${REPO}#installation`, label: 'links.install', glyph: 'download' },
  { href: REPO, label: 'links.github', glyph: 'code' },
] as const;
/** The device field's value while a link's own width is shown. */
const WIDTH = 'width';
const BANNER_KEY = 'fluvy-demo:banner';

/** The languages as the settings panel offers them: each by its own name, its English one beside it. */
const LANGUAGE_OPTIONS: readonly SelectOption[] = offeredLanguages().map((language) => ({
  value: language.code,
  label: language.name,
  ...(language.english !== language.name ? { hint: language.english } : {}),
}));

/**
 * The demo's chrome: the brand, what to look at (the card families, the pages), and how (the palette, the mode,
 * the device, the language), drawn with the design system's own parts. Changes go out as `demo-change` with the
 * fields to change; the page answers by setting `state` again. Two rows on a desktop or a tablet: the device and the
 * language are fields, and the views and the palettes scroll sideways where the row cannot hold them. On a phone it is
 * lower still, one row each in every language: the brand with the links as two rounds, the views, the palettes, the
 * dark mode as a round beside the language; the device is gone (a phone is a phone).
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
      .demo-bar .fv-chips {
        margin: 0;
      }
      /* a row that runs on past its room: it scrolls sideways (a finger, a trackpad, the wheel), never wraps, and
         fades only on a side where it goes on, as the panel's tabs do */
      .demo-scroll {
        flex: 1 1 0;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
        -webkit-mask-image: linear-gradient(
          90deg,
          var(--demo-fade-start, transparent),
          #000 24px,
          #000 calc(100% - 24px),
          var(--demo-fade-end, transparent)
        );
        mask-image: linear-gradient(
          90deg,
          var(--demo-fade-start, transparent),
          #000 24px,
          #000 calc(100% - 24px),
          var(--demo-fade-end, transparent)
        );
      }
      .demo-scroll.is-start {
        --demo-fade-start: #000;
      }
      .demo-scroll.is-end {
        --demo-fade-end: #000;
      }
      .demo-scroll::-webkit-scrollbar {
        display: none;
      }
      .demo-views .fv-chips,
      .demo-palette {
        flex-wrap: nowrap;
        width: max-content;
      }
      /* the views beside the links while they fit */
      .demo-views .fv-chips {
        margin-left: auto;
      }
      .demo-links {
        display: flex;
        gap: 8px;
      }
      .demo-links a {
        text-decoration: none;
      }
      .demo-links--round,
      .demo-dark {
        display: none;
      }
      .demo-palette {
        display: flex;
        align-items: center;
      }
      .demo-dot {
        position: relative;
        flex: 0 0 auto;
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
      .demo-select {
        width: 176px;
      }
      .demo-select--language {
        width: 224px;
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
      /* a phone keeps its screen for the cards: the chrome is lower and scrolls away with the page; the views and the
         palettes run on past the screen's edge, each one row */
      @media (max-width: 720px) {
        :host {
          position: static;
        }
        .demo-bar {
          gap: 8px 16px;
          padding: 8px 16px;
        }
        .demo-bar--look {
          padding-top: 0;
        }
        .demo-links--words,
        .demo-modes {
          display: none;
        }
        .demo-links--round,
        .demo-dark {
          display: flex;
        }
        .demo-views {
          order: 1;
        }
        .demo-scroll {
          flex: 1 0 100%;
          margin: 0 -16px;
          padding: 0 16px;
        }
        .demo-views .fv-chips {
          margin-left: 0;
        }
        .demo-palette {
          margin: 0 -10px;
          padding: 0 6px;
        }
        .demo-select--device {
          display: none;
        }
        .demo-select--language {
          flex: 1 1 0;
          width: auto;
          min-width: 0;
        }
        .demo-banner {
          padding-bottom: 8px;
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
  /** The rows that scroll sideways, given the mouse's reach and their edges once. */
  private readonly rows = new WeakSet<HTMLElement>();
  /** A row's room changed (a narrower window, the pills fitted): its edges again. */
  private readonly resized = new ResizeObserver((entries) => {
    for (const entry of entries) edges(entry.target as HTMLElement);
  });

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
      this.refit = () => {
        fitPills(this.renderRoot, true);
        this.align(false);
      };
      void document.fonts.ready.then(this.refit);
    }
    if (changed.has('state')) this.align(changed.get('state') !== undefined);
  }

  /** Each sideways row with what is chosen in it in the middle: at once the first time, gliding after. */
  private align(glide: boolean): void {
    for (const row of this.renderRoot.querySelectorAll<HTMLElement>('.demo-scroll')) {
      if (!this.rows.has(row)) {
        this.rows.add(row);
        sideScroll(row);
        row.addEventListener('scroll', () => edges(row), { passive: true });
        this.resized.observe(row);
      }
      const chosen = row.querySelector<HTMLElement>('.is-active');
      if (chosen) centre(row, chosen, glide);
      edges(row);
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
    // a link's own width (the playground's `width=`) is said as it is, until a device is chosen
    const devices: SelectOption[] = [
      ...DEVICE_NAMES.map((device) => ({ value: device, label: t(lang, `device.${device}`) })),
      ...(state.frameWidth ? [{ value: WIDTH, label: `${state.frameWidth} px` }] : []),
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
        <nav class="demo-views demo-scroll">${chips(views, (key) => this.pick(key))}</nav>
        <div class="demo-links demo-links--words">
          ${LINKS.map(
            (link) =>
              html`<a class="fv-btn fv-btn--quiet" data-target data-fit="32" href=${link.href}
                >${t(lang, link.label)}</a
              >`,
          )}
        </div>
        <div class="demo-links demo-links--round">
          ${LINKS.map(
            (link) =>
              html`<a
                class="fv-round fv-round--on-page"
                data-target
                href=${link.href}
                title=${t(lang, link.label)}
                aria-label=${t(lang, link.label)}
                >${glyph(link.glyph)}</a
              >`,
          )}
        </div>
      </div>
      <div class="demo-bar demo-bar--look">
        <div class="demo-scroll">
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
        </div>
        ${chips(modes, (key) => this.change({ mode: key === 'dark' ? 'dark' : 'light' }), 'demo-modes')}
        <button
          class="demo-dark fv-round fv-round--on-page ${state.mode === 'dark' ? 'is-on' : ''}"
          data-target
          title=${t(lang, 'mode.dark')}
          aria-label=${t(lang, 'mode.dark')}
          aria-pressed=${state.mode === 'dark' ? 'true' : 'false'}
          @click=${() => this.change({ mode: state.mode === 'dark' ? 'light' : 'dark' })}
        >
          ${glyph('moon')}
        </button>
        <fluvy-select
          class="demo-select demo-select--device"
          on-page
          .label=${t(lang, 'device.title')}
          .value=${state.frameWidth ? WIDTH : state.device}
          .options=${devices}
          @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => {
            const { value } = event.detail;
            if (isDevice(value)) this.change({ device: value, frameWidth: undefined });
          }}
        ></fluvy-select>
        <fluvy-select
          class="demo-select demo-select--language"
          on-page
          .label=${t(lang, 'language.title')}
          .value=${lang}
          .options=${LANGUAGE_OPTIONS}
          @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => {
            const { value } = event.detail;
            if (isLanguageCode(value)) this.change({ language: value });
          }}
        ></fluvy-select>
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

/** How far from an end a row's fade reaches: within it, the row goes to the end itself. */
const FADE = 24;

/** Scrolls a row sideways (only it, never the page) to put an item in its middle, or to the end it is near. */
function centre(row: HTMLElement, item: HTMLElement, glide: boolean): void {
  const most = row.scrollWidth - row.clientWidth;
  if (most <= 0) return;
  const at = item.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
  const middle = at - (row.clientWidth - item.offsetWidth) / 2;
  const left = middle < FADE ? 0 : most - middle < FADE ? most : middle;
  row.scrollTo({ left, behavior: glide && !reducedMotion() ? 'smooth' : 'instant' });
}

/** A row fades only on a side where it goes on. */
function edges(row: HTMLElement): void {
  row.classList.toggle('is-start', row.scrollLeft <= 1);
  row.classList.toggle('is-end', row.scrollLeft >= row.scrollWidth - row.clientWidth - 1);
}

if (!customElements.get('fluvy-demo-shell'))
  customElements.define('fluvy-demo-shell', FluvyDemoShell);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-demo-shell': FluvyDemoShell;
  }
}
