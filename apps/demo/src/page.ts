import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { paletteOf, type HomeAssistant, type LovelaceCardConfig } from '@fluvy/core';
import type { PaletteModeColors, PaletteName } from '@fluvy/tokens/runtime';
import { baseStyles, fitPills, glyph, options, type GlyphName } from '@fluvy/ui';
import '@fluvy/ui/select';
import type { SelectChangeDetail, SelectOption } from '@fluvy/ui/select';
import { cardOf, wordsOf } from './catalog.js';
import { CARD_GROUPS } from './families.js';
import { follow, hrefOf } from './nav.js';
import { DEVICE_NAMES, isDevice, type DemoState, type DemoView } from './state.js';
import { t } from './strings.js';

/** The device field's value while a link's own width is shown. */
const WIDTH = 'width';

/** A part of the page that opens another page or changes the look: the page's state, its words, and its links. */
abstract class PagePart extends LitElement {
  static override properties = { state: { attribute: false } };
  declare state: DemoState | undefined;

  protected link(view: DemoView): { href: string; go: (event: MouseEvent) => void } {
    return {
      href: hrefOf(this.state as DemoState, view),
      go: (event: MouseEvent) => follow(event, view),
    };
  }

  protected change(patch: Partial<DemoState>): void {
    this.dispatchEvent(
      new CustomEvent('demo-change', { detail: patch, bubbles: true, composed: true }),
    );
  }

  /** The pills sized from their text on the 4 px grid (again once the web font is in). */
  private refit = false;
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    fitPills(this.renderRoot);
    if (!this.refit) {
      this.refit = true;
      void document.fonts.ready.then(() => fitPills(this.renderRoot, true));
    }
  }
}

/** A link of a page's head: words that open a page of the demo, or a page elsewhere (`href`). */
export interface HeadAction {
  readonly label: string;
  readonly glyph?: GlyphName;
  readonly accent?: boolean;
  readonly view?: DemoView;
  readonly href?: string;
}

/** A chip of a page's head: a place on the page (a card's layout) or a page beside it (a dashboard's view). */
export interface HeadChip {
  readonly label: string;
  readonly view: DemoView;
  readonly active: boolean;
}

/** What a page's head says. */
export interface HeadSpec {
  /** The overview's: the mark over a larger title. */
  readonly hero?: boolean;
  /** Where the page stands (Cards › Control): a link where the place is a page. */
  readonly crumbs?: readonly { readonly label: string; readonly view?: DemoView }[];
  readonly title: string;
  readonly lead?: string;
  readonly actions?: readonly HeadAction[];
  readonly chips?: readonly HeadChip[];
  /** The words under the rest, in the secondary ink (what the demo house is). */
  readonly note?: string;
  /** The device the frames are drawn for, as a field beside the title (not on a phone, which is a phone). */
  readonly device?: boolean;
  /** The brand mark's URL, for the hero. */
  readonly mark?: string;
}

const partStyles = css`
  :host {
    display: block;
    color: var(--fluvy-text);
    font-family: Inter, system-ui, sans-serif;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
`;

/**
 * Tiles in equal columns across the page (`.dm-tiles`, `--cols` a row, set by the page's width): each column on the
 * 4 grid, the few pixels a division leaves over after the last.
 */
const tileStyles = css`
  :host {
    container-type: inline-size;
  }
  .dm-tiles {
    --gap: 12px;
    display: grid;
    grid-template-columns: repeat(
      var(--cols),
      round(down, calc((100% - (var(--cols) - 1) * var(--gap)) / var(--cols)), 4px)
    );
    gap: var(--gap);
  }
`;

/** A page's head: where it stands, its title, what it is, its links and chips, and the device field. */
export class FluvyDemoHead extends PagePart {
  static override styles = [
    ...baseStyles,
    partStyles,
    css`
      :host {
        margin-bottom: 24px;
      }
      .hd-mark {
        display: block;
        width: 56px;
        height: 56px;
        margin-bottom: 16px;
        border-radius: 16px;
      }
      /* where the page stands: words on the title's column, a link's target the row's 44 */
      .hd-crumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
      }
      .hd-crumbs a,
      .hd-crumbs span {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
      }
      .hd-crumbs a {
        color: var(--fluvy-accent-text, var(--fluvy-accent));
      }
      .hd-crumbs svg {
        width: 16px;
        height: 16px;
        color: var(--fluvy-text-disabled);
      }
      @media (hover: hover) {
        .hd-crumbs a:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      }
      .hd-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
      }
      h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        line-height: 40px;
        letter-spacing: -0.02em;
        text-wrap: balance;
      }
      .is-hero h1 {
        font-size: 40px;
        line-height: 48px;
      }
      .hd-device {
        flex: 0 0 176px;
      }
      .hd-lead {
        max-width: 720px;
        margin: 8px 0 0;
        font-size: 17px;
        font-weight: 400;
        line-height: 24px;
        color: var(--fluvy-text-secondary);
        text-wrap: pretty;
      }
      .is-hero .hd-lead {
        font-size: 19px;
        line-height: 28px;
      }
      .hd-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 20px;
      }
      .hd-actions .fv-btn {
        gap: 8px;
      }
      .hd-actions svg {
        width: 20px;
        height: 20px;
      }
      .hd-chips {
        margin-top: 16px;
      }
      .hd-chips .fv-chips {
        margin: 0;
      }
      .hd-note {
        max-width: 720px;
        margin: 16px 0 0;
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      @media (max-width: 719px) {
        h1 {
          font-size: 28px;
          line-height: 36px;
        }
        .is-hero h1 {
          font-size: 32px;
          line-height: 40px;
        }
        .hd-device {
          display: none;
        }
        .hd-lead,
        .is-hero .hd-lead {
          font-size: 16px;
          line-height: 24px;
        }
        .is-hero .hd-actions .fv-btn {
          flex: 1 1 auto;
        }
      }
    `,
  ];

  static override properties = { ...PagePart.properties, spec: { attribute: false } };
  declare spec: HeadSpec | undefined;

  private renderDevice(state: DemoState): TemplateResult {
    const lang = state.language;
    // a link's own width (the playground's `width=`) is said as it is, until a device is chosen
    const devices: SelectOption[] = [
      ...DEVICE_NAMES.map((device) => ({ value: device, label: t(lang, `device.${device}`) })),
      ...(state.frameWidth ? [{ value: WIDTH, label: `${state.frameWidth} px` }] : []),
    ];
    return html`<fluvy-select
      class="hd-device"
      on-page
      .label=${t(lang, 'device.title')}
      .value=${state.frameWidth ? WIDTH : state.device}
      .options=${devices}
      @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => {
        const { value } = event.detail;
        if (isDevice(value)) this.change({ device: value, frameWidth: undefined });
      }}
    ></fluvy-select>`;
  }

  private renderAction(action: HeadAction): TemplateResult {
    const kind = action.accent ? 'fv-btn--accent' : 'fv-btn--on-page';
    const inner = html`${action.glyph ? glyph(action.glyph) : nothing}${action.label}`;
    if (action.view) {
      const link = this.link(action.view);
      return html`<a class="fv-btn ${kind}" data-target href=${link.href} @click=${link.go}
        >${inner}</a
      >`;
    }
    return html`<a class="fv-btn ${kind}" data-target href=${action.href ?? ''}>${inner}</a>`;
  }

  override render(): TemplateResult | typeof nothing {
    const { spec, state } = this;
    if (!spec || !state) return nothing;
    return html`<div class=${spec.hero ? 'is-hero' : ''}>
      ${spec.hero && spec.mark ? html`<img class="hd-mark" src=${spec.mark} alt="" />` : nothing}
      ${
        spec.crumbs?.length
          ? html`<p class="hd-crumbs">
              ${spec.crumbs.map((crumb, index) => {
                const link = crumb.view ? this.link(crumb.view) : undefined;
                return html`${index ? glyph('chevron') : nothing}${
                  link
                    ? html`<a href=${link.href} @click=${link.go}>${crumb.label}</a>`
                    : html`<span>${crumb.label}</span>`
                }`;
              })}
            </p>`
          : nothing
      }
      <div class="hd-row">
        <h1>${spec.title}</h1>
        ${spec.device ? this.renderDevice(state) : nothing}
      </div>
      ${spec.lead ? html`<p class="hd-lead">${spec.lead}</p>` : nothing}
      ${
        spec.actions?.length
          ? html`<div class="hd-actions">
              ${spec.actions.map((action) => this.renderAction(action))}
            </div>`
          : nothing
      }
      ${
        spec.chips?.length
          ? html`<div class="hd-chips">
              <div class="fv-chips">
                ${spec.chips.map((chip) => {
                  const link = this.link(chip.view);
                  return html`<a
                    class="fv-chip ${chip.active ? 'is-active' : ''}"
                    data-target
                    data-fit="28"
                    href=${link.href}
                    aria-current=${chip.active ? 'true' : nothing}
                    @click=${link.go}
                    ><span class="fv-chip__pill" data-control
                      ><span class="fv-chip__label">${chip.label}</span></span
                    ></a
                  >`;
                })}
              </div>
            </div>`
          : nothing
      }
      ${spec.note ? html`<p class="hd-note">${spec.note}</p>` : nothing}
    </div>`;
  }
}

/** A card as its frame holds it, for its YAML: its configuration as a person writes it, and the house it reads. */
export interface YamlCard {
  readonly config: LovelaceCardConfig;
  readonly hass: HomeAssistant | undefined;
}

/** `demo-yaml`: a plate asks for the YAML of the cards on it; `opener` gets the focus back. */
export interface YamlAsk {
  readonly cards: readonly YamlCard[];
  /** On a card's page, the layout the plate shows (`variant: compact`), empty on the card's base; none elsewhere. */
  readonly layout?: string;
  readonly opener: HTMLElement;
}

/**
 * A frame on a plate: the section's edge around a head — what the frame is, then its links at the row's end, "View
 * YAML" the last — and the frame under it (its slot). "View YAML" asks for the YAML of the cards the frame holds
 * (`source`, read as it is asked: the house they read is the one they are drawn on then).
 */
abstract class Plate extends PagePart {
  static override styles = [
    ...baseStyles,
    partStyles,
    css`
      :host {
        border-radius: 24px;
        background: var(--fluvy-page);
        box-shadow: 0 0 0 1px var(--fluvy-border-strong);
      }
      /* what the frame is, then its links at the row's end; where a column cannot hold them beside it, "View YAML"
         says "YAML" alone, and where it still cannot, the links go under it, every word whole */
      .ex-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0 8px;
        padding: 12px 16px 0;
      }
      .ex-name {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        white-space: nowrap;
      }
      .ex-links {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ex-yaml {
        gap: 8px;
      }
      .ex-yaml svg {
        width: 20px;
        height: 20px;
      }
    `,
  ];

  static override properties = {
    ...PagePart.properties,
    source: { attribute: false },
    brief: { state: true },
  };

  declare source: () => readonly YamlCard[];
  /** "View YAML" says "YAML" alone: the head could not hold its words beside what the frame is. */
  declare brief: boolean;
  /** The plate's width as its words were last tried in, and whether they wait on the web font. */
  private width: number | undefined;
  private settled = false;
  private readonly resized = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width;
    if (this.width !== undefined && width !== this.width) this.retry();
    this.width = width;
  });

  constructor() {
    super();
    this.source = () => [];
    this.brief = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.resized.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resized.disconnect();
  }

  /** The words whole again, to give way anew where they still do not fit: the plate's width or their face changed. */
  private retry(): void {
    if (this.brief) this.brief = false;
    else this.giveWay();
  }

  /** The links have gone under what the frame is: the head does not hold "View YAML" beside it, and it says "YAML". */
  private giveWay(): void {
    const name = this.renderRoot.querySelector<HTMLElement>('.ex-name');
    const links = this.renderRoot.querySelector<HTMLElement>('.ex-links');
    if (name && links && links.offsetTop > name.offsetTop) this.brief = true;
  }

  /**
   * Once the pills are fitted: other words than those that gave way (a language, a layout) are tried whole first;
   * whole, they give way where they wrap; and once more as the web font lands, after the pills are fitted in it.
   */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.brief) this.giveWay();
    else if (!changed.has('brief')) this.brief = false;
    if (this.settled) return;
    this.settled = true;
    void document.fonts.ready.then(() => this.retry());
  }

  /** What the frame is, in the head's first words. */
  protected abstract renderName(state: DemoState): TemplateResult;

  /** The links before "View YAML", where the plate has its own. */
  protected abstract renderLinks(state: DemoState): TemplateResult | typeof nothing;

  /** The layout its "View YAML" names; none unless the plate is a card's page's. */
  protected get asked(): string | undefined {
    return undefined;
  }

  private ask(event: Event): void {
    const { asked } = this;
    this.dispatchEvent(
      new CustomEvent<YamlAsk>('demo-yaml', {
        detail: {
          cards: this.source(),
          ...(asked === undefined ? {} : { layout: asked }),
          opener: event.currentTarget as HTMLElement,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    const state = this.state;
    if (!state) return nothing;
    const lang = state.language;
    return html`<div class="ex-head">
        ${this.renderName(state)}
        <span class="ex-links">
          ${this.renderLinks(state)}
          <button
            class="fv-btn fv-btn--pill fv-btn--on-page ex-yaml"
            data-target
            data-fit="32"
            aria-haspopup="dialog"
            aria-label=${t(lang, 'yaml.view')}
            @click=${this.ask}
          >
            ${glyph('code')}${t(lang, this.brief ? 'yaml.brief' : 'yaml.view')}
          </button>
        </span>
      </div>
      <slot></slot>`;
  }
}

/**
 * One example of a card on its page: the plate's head says the layout (a link to it) and links to the card's docs.
 * The layout a link points at is marked (`marked`).
 */
export class FluvyDemoExample extends Plate {
  static override styles = [
    ...Plate.styles,
    css`
      :host {
        scroll-margin-top: calc(var(--dm-bar, 64px) + 16px);
        transition: box-shadow 240ms var(--fv-ease, ease);
      }
      :host([marked]) {
        box-shadow: 0 0 0 2px var(--fluvy-accent);
      }
      .ex-name code {
        display: inline-flex;
        align-items: center;
        height: 24px;
        border-radius: var(--fluvy-radius-sm);
        background: var(--fluvy-card);
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        font-family: var(--fluvy-font-mono);
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
      }
      :host([marked]) .ex-name code {
        background: var(--fluvy-accent-fill);
        box-shadow: inset 0 0 0 1px var(--fluvy-accent-fill-border);
        color: var(--fluvy-accent-on-fill);
      }
      /* the docs' words on the column's edge where the links start a row of their own (the link's target reaches 14
         past them) */
      .ex-links {
        margin-left: -14px;
      }
      .ex-docs {
        display: inline-flex;
        align-items: center;
        margin-right: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
      }
    `,
  ];

  static override properties = {
    ...Plate.properties,
    card: { attribute: false },
    layout: { attribute: false },
    key: { attribute: false },
    docs: { attribute: false },
    marked: { type: Boolean, reflect: true },
  };

  declare card: string;
  /** The layout's value; none on the base. */
  declare layout: string | undefined;
  /** The key the layouts are chosen by (`variant`, `size`…). */
  declare key: string;
  declare docs: string;
  declare marked: boolean;

  constructor() {
    super();
    this.card = '';
    this.layout = undefined;
    this.key = 'variant';
    this.docs = '';
    this.marked = false;
  }

  protected override get asked(): string {
    return this.layout ? `${this.key}: ${this.layout}` : '';
  }

  protected override renderName(state: DemoState): TemplateResult {
    const link = this.link({
      kind: 'card',
      card: this.card,
      ...(this.layout ? { layout: this.layout } : {}),
    });
    return html`<a class="ex-name" href=${link.href} @click=${link.go}
      >${
        this.layout
          ? html`<code data-fit="16">${this.asked}</code>`
          : t(state.language, 'card.default')
      }</a
    >`;
  }

  protected override renderLinks(state: DemoState): TemplateResult {
    return html`<a
      class="fv-link ex-docs"
      data-target
      href=${this.docs}
      target="_blank"
      rel="noopener"
      >${t(state.language, 'card.docs')}</a
    >`;
  }
}

/**
 * A frame of a sheet or of the automatic dashboard: the plate's head names the card it holds, a link to that card's
 * page, and how many other cards stand with it (`+2`; every one's name is the head's title).
 */
export class FluvyDemoFrame extends Plate {
  static override styles = [
    ...Plate.styles,
    css`
      .ex-name {
        gap: 8px;
      }
      /* the card's name is a link of the row's height */
      .ex-name a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
      }
      .ex-more {
        color: var(--fluvy-text-secondary);
      }
      @media (hover: hover) {
        .ex-name a:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      }
    `,
  ];

  static override properties = { ...Plate.properties, cards: { attribute: false } };
  /** The cards the frame holds, by their short names, each once, in the frame's order. */
  declare cards: readonly string[];

  constructor() {
    super();
    this.cards = [];
  }

  protected override renderName(): TemplateResult {
    const names = this.cards.flatMap((short) => {
      const card = cardOf(short);
      return card ? [{ short, name: wordsOf(card).name }] : [];
    });
    const [first, ...rest] = names;
    if (!first) return html`<span class="ex-name"></span>`;
    const link = this.link({ kind: 'card', card: first.short });
    return html`<span class="ex-name" title=${names.map(({ name }) => name).join(' · ')}
      ><a href=${link.href} @click=${link.go}>${first.name}</a>${
        rest.length ? html`<span class="ex-more">+${rest.length}</span>` : nothing
      }</span
    >`;
  }

  protected override renderLinks(): typeof nothing {
    return nothing;
  }
}

/** Every card, in the README's groups: a tile each with its name and its line, a link to its page. */
export class FluvyDemoIndex extends PagePart {
  static override styles = [
    ...baseStyles,
    partStyles,
    tileStyles,
    css`
      :host {
        max-width: 1040px;
      }
      section + section {
        margin-top: 32px;
      }
      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 12px;
        font-size: 20px;
        font-weight: 600;
        line-height: 24px;
        letter-spacing: -0.01em;
      }
      h2 svg {
        width: 20px;
        height: 20px;
        color: var(--fluvy-text-secondary);
      }
      /* a tile 232 at the least: as many a row as the page holds */
      .ix-grid {
        --cols: 1;
      }
      @container (min-width: 476px) {
        .ix-grid {
          --cols: 2;
        }
      }
      @container (min-width: 720px) {
        .ix-grid {
          --cols: 3;
        }
      }
      @container (min-width: 964px) {
        .ix-grid {
          --cols: 4;
        }
      }
      .ix-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 88px;
        box-sizing: border-box;
        padding: 16px;
        border-radius: var(--fluvy-radius-lg);
        background: var(--fluvy-card);
        box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
      }
      @media (hover: hover) {
        .ix-card:hover {
          box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);
        }
      }
      .ix-card:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--fluvy-accent);
      }
      .ix-name {
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
      }
      .ix-line {
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      @media (max-width: 719px) {
        .ix-grid {
          --gap: 8px;
        }
      }
    `,
  ];

  override render(): TemplateResult | typeof nothing {
    const state = this.state;
    if (!state) return nothing;
    return html`${CARD_GROUPS.map(
      (group) =>
        html`<section aria-labelledby=${`ix-${group.key}`}>
          <h2 id=${`ix-${group.key}`}>${glyph(group.glyph)}${t(state.language, group.label)}</h2>
          <div class="dm-tiles ix-grid">
            ${group.cards.flatMap((short) => {
              const card = cardOf(short);
              if (!card) return [];
              const words = wordsOf(card);
              const link = this.link({ kind: 'card', card: short });
              return [
                html`<a class="ix-card" href=${link.href} @click=${link.go}>
                  <span class="ix-name">${words.name}</span>
                  ${words.description ? html`<span class="ix-line">${words.description}</span>` : nothing}
                </a>`,
              ];
            })}
          </div>
        </section>`,
    )}`;
  }
}

/** A palette as the themes page draws it: its preset's name and its two modes' colours. */
export interface ThemeSwatch {
  readonly name: PaletteName;
  readonly title: string;
}

/** A mode of a palette in small: its page, a card on it, the accent's fill and ink, the words' ink. */
const miniature = (colors: PaletteModeColors): string =>
  [
    `--sw-page:${colors.surface.page}`,
    `--sw-card:${colors.surface.card}`,
    `--sw-border:${colors.surface.border}`,
    `--sw-fill:${colors.accent.fill}`,
    `--sw-ink:${colors.accent.ink}`,
    `--sw-text:${colors.text.primary}`,
    `--sw-muted:${colors.text.secondary}`,
  ].join(';');

/**
 * The palettes, light and dark: the mode as two option tiles, then every palette as a tile with its two modes in small
 * (its page, a card with the accent's tile and dot, its words) and its name, the one worn marked; your own accent
 * opens the settings panel's Appearance tab, where it is made.
 */
export class FluvyDemoThemes extends PagePart {
  static override styles = [
    ...baseStyles,
    partStyles,
    tileStyles,
    css`
      :host {
        max-width: 1040px;
        margin-bottom: 8px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 20px;
        font-weight: 600;
        line-height: 24px;
        letter-spacing: -0.01em;
      }
      .th-mode {
        max-width: 400px;
        margin-bottom: 32px;
      }
      /* on the page's ground: the card's fill and its hairline, as a tile would stand there */
      .th-mode .fv-option:not(.is-active) {
        background: var(--fluvy-card);
        box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
      }
      /* a palette 184 at the least, two a row on a phone */
      .th-grid {
        --cols: 2;
      }
      @container (min-width: 576px) {
        .th-grid {
          --cols: 3;
        }
      }
      @container (min-width: 776px) {
        .th-grid {
          --cols: 4;
        }
      }
      @container (min-width: 976px) {
        .th-grid {
          --cols: 5;
        }
      }
      .th-tile {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 8px 12px;
        border: 0;
        border-radius: var(--fluvy-radius-lg);
        background: var(--fluvy-card);
        box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
        color: var(--fluvy-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .th-tile.is-active {
        background: var(--fluvy-accent-fill);
        box-shadow: inset 0 0 0 1px var(--fluvy-accent-fill-border);
        color: var(--fluvy-accent-on-fill);
      }
      .th-tile:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--fluvy-accent);
      }
      .th-art {
        display: grid;
        grid-template-columns: 1fr 1fr;
        height: 88px;
        overflow: hidden;
        border-radius: var(--fluvy-radius-md);
      }
      .th-mini {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px 8px;
        background: var(--sw-page);
        box-shadow: inset 0 0 0 1px var(--sw-border);
      }
      .th-mini:first-child {
        border-radius: var(--fluvy-radius-md) 0 0 var(--fluvy-radius-md);
      }
      .th-mini:last-child {
        border-radius: 0 var(--fluvy-radius-md) var(--fluvy-radius-md) 0;
      }
      .th-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        padding: 8px;
        border-radius: 8px;
        background: var(--sw-card);
        box-shadow: 0 0 0 1px var(--sw-border);
      }
      .th-tile-mini {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px;
        border-radius: 6px;
        background: var(--sw-fill);
      }
      .th-dot {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--sw-ink);
      }
      .th-bar {
        height: 4px;
        border-radius: 2px;
        background: var(--sw-text);
        opacity: 0.8;
      }
      .th-bar--muted {
        width: 60%;
        background: var(--sw-muted);
        opacity: 0.6;
      }
      .th-name {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        padding: 0 4px;
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
      }
      .th-name svg {
        width: 16px;
        height: 16px;
      }
      .th-custom .th-art {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--fluvy-inset, var(--fluvy-page));
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        color: var(--fluvy-text-secondary);
      }
      .th-custom .th-art svg {
        width: 24px;
        height: 24px;
      }
      @media (max-width: 719px) {
        .th-grid {
          --gap: 8px;
        }
      }
    `,
  ];

  static override properties = { ...PagePart.properties, swatches: { attribute: false } };
  declare swatches: readonly ThemeSwatch[];

  constructor() {
    super();
    this.swatches = [];
  }

  override render(): TemplateResult | typeof nothing {
    const state = this.state;
    if (!state) return nothing;
    const lang = state.language;
    const worn = typeof state.look.palette === 'string' ? state.look.palette : '';
    const custom = this.link({ kind: 'panel', tab: 'appearance' });
    return html`<h2>${t(lang, 'themes.mode')}</h2>
      <div class="th-mode">
        ${options(
          [
            {
              key: 'light',
              label: t(lang, 'mode.light'),
              glyph: 'sun',
              active: state.mode === 'light',
            },
            {
              key: 'dark',
              label: t(lang, 'mode.dark'),
              glyph: 'moon',
              active: state.mode === 'dark',
            },
          ],
          (key) => this.change({ mode: key === 'dark' ? 'dark' : 'light' }),
          8,
          84,
        )}
      </div>
      <h2>${t(lang, 'themes.palettes')}</h2>
      <div class="dm-tiles th-grid" role="group" aria-label=${t(lang, 'themes.palettes')}>
        ${this.swatches.map((swatch) => {
          const palette = paletteOf(swatch.name);
          const active = worn === swatch.name;
          return html`<button
            class="th-tile ${active ? 'is-active' : ''}"
            data-target
            aria-pressed=${active ? 'true' : 'false'}
            @click=${() => this.change({ look: { ...state.look, palette: swatch.name } })}
          >
            <span class="th-art" aria-hidden="true" data-measure="drawn">
              ${[palette.light, palette.dark].map(
                (colors) =>
                  html`<span class="th-mini" style=${miniature(colors)}>
                    <span class="th-card">
                      <span class="th-tile-mini"
                        ><span class="th-dot"></span><span class="th-bar"></span
                      ></span>
                      <span class="th-bar th-bar--muted"></span>
                    </span>
                  </span>`,
              )}
            </span>
            <span class="th-name">${swatch.title}${active ? glyph('check') : nothing}</span>
          </button>`;
        })}
        <a
          class="th-tile th-custom ${worn ? '' : 'is-active'}"
          href=${custom.href}
          @click=${custom.go}
        >
          <span class="th-art" aria-hidden="true">${glyph('palette')}</span>
          <span class="th-name">${t(lang, 'palette.custom')}</span>
        </a>
      </div>`;
  }
}

for (const [tag, element] of [
  ['fluvy-demo-head', FluvyDemoHead],
  ['fluvy-demo-example', FluvyDemoExample],
  ['fluvy-demo-frame', FluvyDemoFrame],
  ['fluvy-demo-index', FluvyDemoIndex],
  ['fluvy-demo-themes', FluvyDemoThemes],
] as const)
  if (!customElements.get(tag)) customElements.define(tag, element);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-demo-head': FluvyDemoHead;
    'fluvy-demo-example': FluvyDemoExample;
    'fluvy-demo-frame': FluvyDemoFrame;
    'fluvy-demo-index': FluvyDemoIndex;
    'fluvy-demo-themes': FluvyDemoThemes;
  }
}
