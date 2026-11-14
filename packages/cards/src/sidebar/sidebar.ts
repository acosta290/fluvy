import {
  FluvyCard,
  haptic,
  navigate,
  readStored,
  runAction,
  strings,
  VISIBILITY_EVENT,
  writeStored,
  type ActionConfig,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { baseStyles, icon, reducedMotion } from '@fluvy/ui';
import { html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';
import { hold, type Held } from '../expander/held.js';
// the sidebar's own glyph, its drawer's round's
import '../shared/side-glyph.js';
import {
  widthCss,
  type Presentation,
  type SidebarDevice,
  type SidebarPosition,
  type SidebarSpec,
} from './config.js';
import { sidebarStyles } from './styles.js';

const s = strings('sidebar');

export const TAG = 'fluvy-sidebar';

/** A page of the menu as it is drawn: where it leads or what it runs, and whether it is the one open. */
export interface MenuEntry {
  readonly title: string;
  readonly icon: string;
  readonly path?: string;
  readonly action?: ActionConfig | undefined;
  readonly current: boolean;
}

/** Folded to its icons, a sidebar is its circles between 8 a side. */
const RAIL = 60;
/** How long the drawer takes to leave. */
const LEAVE = 200;

/** Where this browser keeps the sidebars it folded to their icons: a dashboard's url path each. */
const MEMORY = 'fluvy:sidebars';

const foldedOn = (): Readonly<Record<string, unknown>> => {
  const kept = readStored<unknown>(MEMORY);
  return typeof kept === 'object' && kept !== null && !Array.isArray(kept)
    ? (kept as Record<string, unknown>)
    : {};
};

function keepFolded(key: string, folded: boolean): void {
  const rest = Object.fromEntries(Object.entries(foldedOn()).filter(([own]) => own !== key));
  const next = folded ? { ...rest, [key]: true } : rest;
  writeStored(MEMORY, Object.keys(next).length ? next : undefined);
}

/** The three lists of cards, as their configs and as built. */
type Region = 'header' | 'cards' | 'footer';
const REGIONS: readonly Region[] = ['header', 'cards', 'footer'];

/**
 * A dashboard's own sidebar (1.21, #187): one element, first in `hui-root`'s view (`index.ts` puts it there), the same
 * on every view — a head and a foot that stay, a middle that scrolls, any cards (Home Assistant's to build, as the
 * Expander's: `expander/held.ts`; its own children, as the Expander's are) and a menu of the dashboard's pages with
 * the open one marked. It stands beside the
 * views (on its own surface, as a panel from edge to edge or as one card, or with none), above them on a phone that
 * asks for it, or in a drawer a round at the side's foot opens. It wears the look as a card does, the house's
 * see-through surface with it.
 */
export class FluvySidebar extends FluvyCard {
  /** The dashboard's chrome: drawn at once, no entrance. */
  static override still = true;

  static override styles: CSSResultGroup = [...baseStyles, sidebarStyles];

  static override properties = {
    ...FluvyCard.properties,
    spec: { attribute: false },
    entries: { attribute: false },
    device: { attribute: false },
    presentation: { reflect: true },
    side: { reflect: true },
    memory: { attribute: false },
    folded_: { state: true },
    open_: { state: true },
    leaving_: { state: true },
    vacant_: { state: true },
  };

  /** What the dashboard asks for. */
  declare spec: SidebarSpec | undefined;
  /** Its menu's pages, the open one marked. */
  declare entries: readonly MenuEntry[];
  declare device: SidebarDevice;
  declare presentation: Presentation;
  declare side: SidebarPosition;
  /** The dashboard's url path: what a folded sidebar is remembered by. */
  declare memory: string;
  /** Folded to its icons (a sidebar that may be: `collapsible`). */
  declare folded_: boolean;
  /** The drawer is open, or on its way out. */
  declare open_: boolean;
  declare leaving_: boolean;
  /** The lists whose every card is hidden, by name (`vacate`). */
  declare vacant_: string;

  /** The cards built, list by list, and the configs they were built from. */
  private held: Record<Region, Held[]> = { header: [], cards: [], footer: [] };
  private built: Record<Region, string> = { header: '', cards: '', footer: '' };
  private leaving: number | undefined;
  private remembered = '';

  constructor() {
    super();
    this.entries = [];
    this.device = 'desktop';
    this.presentation = 'beside';
    this.side = 'start';
    this.memory = '';
    this.folded_ = false;
    this.open_ = false;
    this.leaving_ = false;
    this.vacant_ = '';
    this.config = { type: TAG };
  }

  /* ---------- the house ---------- */

  override get hass(): HomeAssistant | undefined {
    return super.hass;
  }

  /** The house, handed on to every card it holds: each change, not only what the sidebar itself reads. */
  override set hass(value: HomeAssistant | undefined) {
    super.hass = value;
    for (const region of REGIONS) for (const card of this.held[region]) card.hass(value);
  }

  /** Nothing it draws of its own reads a state: its cards are told the house themselves. */
  protected override watched(): readonly string[] {
    return [];
  }

  /**
   * What may be see-through: its surface beside the views. Above them it has none (`plain` neither), and its drawer
   * lies over the page, solid as a sheet is.
   */
  protected override get surface(): boolean {
    return this.presentation === 'beside' && !this.plain;
  }

  /** Whether what it draws stands on a card's fill: its surface beside the views, and its drawer's. */
  private get carded(): boolean {
    return this.presentation === 'drawer' || this.surface;
  }

  private get plain(): boolean {
    return this.spec?.style === 'plain';
  }

  /** Folded to its icons: beside the views alone, where the dashboard lets it fold. */
  private get rail(): boolean {
    return this.folded_ && this.presentation === 'beside' && this.spec?.collapsible === true;
  }

  /* ---------- its cards ---------- */

  /** The cards of a list, built anew only where the list's configs changed, each for its list's slot. */
  private build(region: Region, configs: readonly LovelaceCardConfig[]): void {
    const key = JSON.stringify(configs);
    if (key === this.built[region]) return;
    this.built[region] = key;
    this.held[region] = configs.map((config) => {
      const card = hold(config, this.rawHass, false);
      card.element.slot = region;
      return card;
    });
  }

  /** The lists drawn now: the head's above the view, none folded to its icons or behind a closed drawer, else all. */
  private drawn(): readonly Region[] {
    if (this.presentation === 'top') return ['header'];
    return this.rail || (this.presentation === 'drawer' && !this.open_) ? [] : REGIONS;
  }

  /**
   * Its cards are its own children, each in its list's slot: in its root the language's reset would reach their hosts,
   * and a card of Fluvy's could not turn its padding out. Only the lists drawn now are in the page, so a card folded
   * away, or behind a closed drawer, reads nothing of the house meanwhile.
   */
  private place(): void {
    const wanted = this.drawn().flatMap((region) => this.held[region].map((card) => card.element));
    const now = [...this.children];
    if (wanted.length !== now.length || wanted.some((element, i) => element !== now[i]))
      this.replaceChildren(...wanted);
  }

  /**
   * A hairline over each card with something above it in its list (a card that shows, or the menu the middle opens
   * with): marked on the card, as a card that hides itself moves the lines.
   */
  private rule(): void {
    const menu = this.spec?.menu;
    const led = Boolean(menu && !menu.pinned && this.entries.length);
    for (const region of REGIONS) {
      let above = region === 'cards' && led;
      for (const { element } of this.held[region]) {
        element.toggleAttribute('data-ruled', above && !element.hidden);
        above ||= !element.hidden;
      }
    }
  }

  /**
   * The lists whose every card is hidden now (by its conditions, or by itself: the alerts while all is clear): their
   * part of the column goes with them, as a stack hides with its cards, and comes back with the first that shows.
   */
  private vacate(): void {
    const vacant = REGIONS.filter(
      (region) =>
        this.held[region].length > 0 && this.held[region].every(({ element }) => element.hidden),
    ).join(' ');
    if (vacant !== this.vacant_) this.vacant_ = vacant;
  }

  /** A card hid or showed itself: the lists and the lines follow. */
  private readonly onVisibility = (): void => {
    this.vacate();
    this.rule();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(VISIBILITY_EVENT, this.onVisibility);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const spec = this.spec;
    if (changed.has('spec') && spec) {
      for (const region of REGIONS) this.build(region, spec[region]);
      const { opacity } = spec;
      this.config = {
        type: TAG,
        ...(opacity === undefined ? {} : { card_opacity: opacity }),
      } as FluvyCardConfig;
    }
    // how it was left on this device, read once a dashboard
    if (this.memory !== this.remembered) {
      this.remembered = this.memory;
      this.folded_ = foldedOn()[this.memory] === true;
    }
    // a drawer left open as the window grew has nothing to close
    if (changed.has('presentation') && this.presentation !== 'drawer') this.settle();
    this.vacate();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const spec = this.spec;
    if (spec) {
      // its width beside the views, from the checked figures alone: the page's rules read it off the element
      const width = this.rail
        ? this.plain || spec.style === 'card'
          ? `calc(${RAIL}px + var(--ha-view-sections-column-gap, 32px))`
          : `${RAIL}px`
        : widthCss(spec.width[this.device]);
      if (this.style.getPropertyValue('--fluvy-side-width') !== width)
        this.style.setProperty('--fluvy-side-width', width);
    }
    this.place();
    this.rule();
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && this.open_ && !this.leaving_ && !dialog.open) dialog.showModal?.();
    this.fade();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(VISIBILITY_EVENT, this.onVisibility);
    this.settle();
  }

  /* ---------- folded, open ---------- */

  private readonly fold = (): void => {
    this.folded_ = !this.folded_;
    if (this.memory) keepFolded(this.memory, this.folded_);
    haptic(this, 'light');
  };

  private readonly open = (): void => {
    window.clearTimeout(this.leaving);
    this.leaving_ = false;
    this.open_ = true;
    haptic(this, 'light');
  };

  /** The drawer leaves the way it came, then closes; at once where motion is reduced. */
  readonly close = (): void => {
    if (!this.open_ || this.leaving_) return;
    if (reducedMotion()) return this.settle();
    this.leaving_ = true;
    this.leaving = window.setTimeout(() => this.settle(), LEAVE);
  };

  /** The drawer closed and gone. */
  private settle(): void {
    window.clearTimeout(this.leaving);
    this.leaving = undefined;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    this.open_ = false;
    this.leaving_ = false;
  }

  /** A tap on the scrim (the dialog itself, round its drawer) closes it. */
  private readonly onScrim = (event: Event): void => {
    if (event.target === event.currentTarget) this.close();
  };

  /** Escape: the drawer leaves as it does on a tap, never cut off by the browser's own close. */
  private readonly onCancel = (event: Event): void => {
    event.preventDefault();
    this.close();
  };

  /* ---------- the menu ---------- */

  /**
   * A page chosen. A plain tap goes there inside Home Assistant (the open one scrolls back to its top, as a tab's
   * does); a tap for a new tab or a new window is the browser's.
   */
  private go(event: MouseEvent, entry: MenuEntry): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (entry.current) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else if (entry.path) navigate(entry.path);
    this.close();
  }

  private run(entry: MenuEntry): void {
    if (this.rawHass) void runAction(this, this.rawHass, entry.action);
    this.close();
  }

  private item(entry: MenuEntry, named: boolean): TemplateResult {
    const circle = html`<span
      class="fv-ico fv-ico--${entry.current ? 'accent' : 'neutral'}"
      data-icon
      >${icon(entry.icon, 'grid')}</span
    >`;
    const name = named
      ? html`<span class="sb-item__name" data-name>${entry.title}</span>`
      : nothing;
    const label = named ? nothing : entry.title;
    return entry.path
      ? html`<a
          class="sb-item ${entry.current ? 'is-current' : ''}"
          href=${entry.path}
          aria-current=${entry.current ? 'page' : nothing}
          aria-label=${label}
          title=${label}
          draggable="false"
          @click=${(event: MouseEvent) => this.go(event, entry)}
          >${circle}${name}</a
        >`
      : html`<button
          class="sb-item"
          aria-label=${label}
          title=${label}
          @click=${() => this.run(entry)}
        >
          ${circle}${name}
        </button>`;
  }

  /** The menu: a column of pages, or a row of them above the view; none where it has no page to show. */
  private menu(row = false): TemplateResult | typeof nothing {
    if (!this.spec?.menu || !this.entries.length) return nothing;
    return html`<nav
      class="sb-menu ${row ? 'sb-menu--row' : ''}"
      aria-label=${s(this.hass, 'pages')}
    >
      ${this.entries.map((entry) => this.item(entry, !this.rail))}
    </nav>`;
  }

  /* ---------- render ---------- */

  /** A list's place: the slot its cards stand in; none where it holds no card, or none that shows. */
  private cards(region: Region): TemplateResult | typeof nothing {
    return this.held[region].length && !this.vacant_.split(' ').includes(region)
      ? html`<div class="sb-cards"><slot name=${region}></slot></div>`
      : nothing;
  }

  /** The middle fades where it goes on under the head or over the foot: read off its scroll. */
  private readonly fade = (): void => {
    const body = this.renderRoot.querySelector<HTMLElement>('.sb-body');
    if (!body) return;
    body.classList.toggle('is-under', body.scrollTop > 1);
    body.classList.toggle('is-over', body.scrollTop + body.clientHeight < body.scrollHeight - 1);
  };

  /** A round of the sidebar's own at its foot, on a row of its own: the fold's, the drawer's close. */
  private round(
    glyph: string,
    label: string,
    onTap: () => void,
    expanded?: boolean,
  ): TemplateResult {
    return html`<div class="sb-fold">
      <button
        class="fv-round fv-round--${this.carded ? 'quiet' : 'on-page'}"
        data-control
        data-target
        aria-label=${label}
        aria-expanded=${expanded === undefined ? nothing : String(expanded)}
        title=${label}
        @click=${onTap}
      >
        ${icon(glyph)}
      </button>
    </div>`;
  }

  /** The head, the middle and the foot on their surface: the sidebar beside the views, and the drawer's. */
  private column(spec: SidebarSpec, foot: TemplateResult | typeof nothing): TemplateResult {
    const rail = this.rail;
    const pinned = spec.menu?.pinned === true;
    const menu = this.menu();
    const head = rail ? nothing : this.cards('header');
    const middle = rail ? nothing : this.cards('cards');
    const footer = rail ? nothing : this.cards('footer');
    const top = head !== nothing || (pinned && menu !== nothing);
    const filled = middle !== nothing || (!pinned && menu !== nothing);
    const bottom = footer !== nothing || foot !== nothing;
    return html`<div class="sb-surface ${this.carded ? 'fv-card' : ''}">
      ${
        top
          ? html`<div class="sb-head ${filled || bottom ? 'is-ruled' : ''}">
              ${head}${pinned ? menu : nothing}
            </div>`
          : nothing
      }
      <div class="sb-body ${filled ? '' : 'is-empty'}" @scroll=${this.fade}>
        ${pinned ? nothing : menu}${middle}
      </div>
      ${
        bottom
          ? html`<div class="sb-foot ${top || filled ? 'is-ruled' : ''}">${footer}${foot}</div>`
          : nothing
      }
    </div>`;
  }

  protected renderCard(): TemplateResult | typeof nothing {
    const spec = this.spec;
    if (!spec) return nothing;
    const hass = this.hass;
    const label = s(hass, 'label');
    if (this.presentation === 'top')
      return html`<aside class="sb sb--top" aria-label=${label}>
        ${this.cards('header')}${this.menu(true)}
      </aside>`;
    if (this.presentation === 'drawer') {
      const shown = this.open_;
      return html`<button
          class="fv-round fv-round--on-page sb-open"
          data-control
          data-target
          aria-label=${s(hass, 'open')}
          aria-haspopup="dialog"
          aria-expanded=${String(shown)}
          title=${s(hass, 'open')}
          @click=${this.open}
        >
          ${icon('sidePanel')}
        </button>
        ${
          shown
            ? html`<dialog
                class=${this.leaving_ ? 'is-leaving' : ''}
                aria-label=${label}
                @click=${this.onScrim}
                @cancel=${this.onCancel}
              >
                <aside class="sb sb--drawer" tabindex="-1" autofocus>
                  ${this.column(spec, this.round('close', s(hass, 'close'), this.close))}
                </aside>
              </dialog>`
            : nothing
        }`;
    }
    const rail = this.rail;
    const fold = spec.collapsible
      ? this.round(
          // towards the edge it folds to; folded, away from it
          (this.side === 'start') === rail ? 'chevron' : 'chevronLeft',
          s(hass, rail ? 'expand' : 'collapse'),
          this.fold,
          !rail,
        )
      : nothing;
    return html`<aside class="sb sb--${spec.style} ${rail ? 'is-rail' : ''}" aria-label=${label}>
      ${this.column(spec, fold)}
    </aside>`;
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, FluvySidebar);
