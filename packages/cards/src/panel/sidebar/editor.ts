// the editor's words first: they are here before anything in its chunk says them
import './english.js';
import { firstWeather, localize, strings, type LovelaceCardConfig } from '@fluvy/core';
import { button, head, listRow, options, round } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import {
  STACK_EDITOR,
  stackEditor,
  untitled,
  type StackEditor,
} from '../../expander/expander-editor.js';
import '../../shared/side-glyph.js';
import { PHONES, STYLES, type SidebarPhone, type SidebarStyle } from '../../sidebar/config.js';
import { copyText } from '../clipboard.js';
import { SIDEBAR_KEY, type DashboardInfo, type PanelContext } from '../model.js';
import { choice, gap } from '../sections.js';
import {
  hasMenu,
  kindOf,
  listOf,
  presetContent,
  rawOf,
  read,
  REGIONS,
  widthOf,
  withContent,
  withKey,
  withList,
  withMenu,
  withWidth,
  type Kind,
  type Raw,
  type Region,
} from './draft.js';
import { toYaml } from './yaml.js';

const say = strings('sidebar-editor');

/** What the panel is to the editor: what draws it again, and how it is left. */
export interface SidebarEditorHost {
  requestUpdate(): void;
  /** Opens the sidebar of a dashboard (its url path); none closes the section. */
  sidebar(urlPath: string): void;
}

/** The widths the panel offers for each device, in px: none first, the device's default among them. */
const WIDTHS = { tablet: [0, 240, 280, 320, 360], desktop: [0, 280, 320, 360, 400] } as const;
/** How long the editor waits for Home Assistant's stack editor before a list opens on the YAML field in its place. */
const GRACE = 800;
/** How long the copy button says it copied. */
const COPIED_MS = 2400;

const REGION_WORD = { header: 'head', cards: 'middle', footer: 'foot' } as const;
const STYLE_WORD = { panel: 'panel', card: 'card' } as const;
const PHONE_WORD = { top: 'top', drawer: 'drawer' } as const;

/**
 * A dashboard's sidebar in the panel (#187): the Dashboards tab's section that writes `fluvy_sidebar:` beside a
 * dashboard's `strategy:` or `views:`. Three choices — none (the key goes), *Clock and pages* (a clock, the views as a
 * menu, what needs a look) and the person's own — then where it stands (its side, its surface, its width on a tablet
 * and on a desktop, what a phone gets, whether it folds, whether the header's tabs give way) and, for their own, what
 * it holds: the menu on or off and its three lists of cards in Home Assistant's own stack editor, a list at a time.
 * Every change is an edit for the panel's bar, as its other tabs' are; a dashboard kept in a YAML file cannot be
 * saved from here, and is given the YAML to copy.
 */
export class SidebarEditor {
  private ctx: PanelContext | undefined;
  private urlPath = '';
  /** The dashboards whose person asked for their own while it still holds the ready-made. */
  private readonly own = new Set<string>();
  /** What a dashboard kept in YAML would be given (null: none), by its url path: copied, never saved. */
  private readonly drafts = new Map<string, Raw | null>();
  /** The list whose cards are being edited. */
  private region: Region = 'header';
  /** Home Assistant's stack editor, once it is defined; what it was last given, and whether it took it. */
  private stack: StackEditor | undefined;
  private given = '';
  private taken = false;
  /** The wait for the stack editor is over: a list without it opens on the YAML field. */
  private waited = typeof window.loadCardHelpers !== 'function';
  private waiting: number | undefined;
  /** The copy button said so, and when it stops; the copy failed. */
  private copied: number | undefined;
  private failed = false;

  constructor(private readonly host: SidebarEditorHost) {
    void stackEditor().then(
      () => this.seat(),
      () => undefined,
    );
    if (!this.waited)
      this.waiting = window.setTimeout(() => {
        this.waited = true;
        this.host.requestUpdate();
      }, GRACE);
  }

  dispose(): void {
    window.clearTimeout(this.waiting);
    window.clearTimeout(this.copied);
    this.stack?.removeEventListener('config-changed', this.onCards);
  }

  /** After the panel has drawn: the stack editor's own Title field is left out (a list has no title). */
  updated(): void {
    const root = this.stack?.shadowRoot;
    const sheet = (this.untitled ??= untitled());
    if (root && sheet && !root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
  private untitled: CSSStyleSheet | undefined;

  /* ---------- the table ---------- */

  /** The dashboards a sidebar can be written beside: those with a configuration of their own. */
  private dashboards(): readonly DashboardInfo[] {
    return (this.ctx?.dashboards ?? []).filter((candidate) => candidate.stored);
  }

  private dashboard(): DashboardInfo | undefined {
    return this.dashboards().find((candidate) => candidate.urlPath === this.urlPath);
  }

  /** The dashboard's sidebar as it would be saved: what is pending over what it has. */
  private raw(): Raw | undefined {
    const dashboard = this.dashboard();
    const draft = this.drafts.get(this.urlPath);
    return dashboard?.yaml && draft !== undefined
      ? (draft ?? undefined)
      : rawOf(this.ctx?.sidebarOf(this.urlPath));
  }

  /** The table changed: an edit for the bar, or, for a dashboard kept in YAML, what its YAML shows. */
  private set(value: Raw | undefined): void {
    if (this.dashboard()?.yaml) {
      this.drafts.set(this.urlPath, value ?? null);
      this.host.requestUpdate();
    } else this.ctx?.editSidebar(this.urlPath, value);
  }

  private change(next: (raw: Raw) => Raw): void {
    const raw = this.raw();
    if (raw) this.set(next(raw));
  }

  /** None, the ready-made, or the person's own: which starts from the ready-made where there was none. */
  private choose(kind: Kind): void {
    const preset = presetContent(firstWeather(this.ctx?.hass));
    const raw = this.raw();
    if (kind === 'own') {
      this.own.add(this.urlPath);
      if (!raw) this.set(withContent(undefined, preset));
      else this.host.requestUpdate();
      return;
    }
    this.own.delete(this.urlPath);
    this.set(kind === 'none' ? undefined : withContent(raw, preset));
  }

  /* ---------- a list's cards ---------- */

  /** The stack editor made, once: its changes are the open list's cards. */
  private seat(): void {
    if (this.stack) return;
    this.stack = document.createElement(STACK_EDITOR) as StackEditor;
    this.stack.addEventListener('config-changed', this.onCards);
    this.host.requestUpdate();
  }

  private readonly listKey = (cards: readonly unknown[]): string =>
    `${this.urlPath}|${this.region}|${JSON.stringify(cards)}`;

  private readonly onCards = (event: Event): void => {
    event.stopPropagation();
    const cards = (event as CustomEvent<{ config?: LovelaceCardConfig }>).detail?.config?.['cards'];
    if (!Array.isArray(cards)) return;
    // what it says is what it holds: it is not handed back to it
    this.given = this.listKey(cards);
    this.change((raw) => withList(raw, this.region, cards));
  };

  /**
   * The open list handed to the stack editor, each time it is another: whether it took it (cards it cannot hold are
   * the YAML field's, until they are mended).
   */
  private give(ctx: PanelContext, cards: readonly LovelaceCardConfig[]): boolean {
    const stack = this.stack;
    if (!stack) return false;
    stack.hass = ctx.hass;
    // the card picker reads the dashboard for the entities it already shows: none of this list's is on a view
    stack.lovelace = { views: [] };
    const key = this.listKey(cards);
    if (key !== this.given) {
      this.given = key;
      try {
        stack.setConfig({ type: 'vertical-stack', cards: [...cards] });
        this.taken = true;
      } catch {
        this.taken = false;
      }
    }
    return this.taken;
  }

  private list(ctx: PanelContext, raw: Raw): TemplateResult | typeof nothing {
    const cards = listOf(raw, this.region);
    if (this.give(ctx, cards)) return html`<div class="se-stack">${this.stack}</div>`;
    if (!this.waited) return nothing;
    return html`${keyed(
      this.region,
      html`<ha-selector
        class="se-yaml"
        .hass=${ctx.hass}
        .selector=${{ object: {} }}
        .value=${cards}
        @value-changed=${(event: CustomEvent<{ value?: unknown }>) => {
          event.stopPropagation();
          const { value } = event.detail;
          if (Array.isArray(value)) this.change((table) => withList(table, this.region, value));
        }}
      ></ha-selector>`,
    )}`;
  }

  /* ---------- the section's cards ---------- */

  /** The dashboard with its sidebar as chosen, in small: where it stands, its surface, what it holds. */
  private mock(raw: Raw | undefined): TemplateResult {
    const spec = raw ? read(raw) : undefined;
    const blocks = (count: number, foot = false): TemplateResult[] =>
      Array.from(
        { length: Math.min(count, 2) },
        (_, index) =>
          html`<span
            class="se-mock__block ${foot && index === 0 ? 'se-mock__block--foot' : ''}"
          ></span>`,
      );
    const pages = spec?.menu
      ? [0, 1, 2].map(
          (index) => html`<span class="se-mock__page ${index === 0 ? 'is-open' : ''}"></span>`,
        )
      : nothing;
    return html`<div class="se-mock" aria-hidden="true">
      <div class="se-mock__bar"></div>
      <div class="se-mock__row ${spec?.position === 'end' ? 'is-end' : ''}">
        ${
          spec
            ? html`<div class="se-mock__side se-mock__side--${spec.style}">
                ${blocks(spec.header.length)}${pages}${blocks(spec.cards.length)}${blocks(spec.footer.length, true)}
              </div>`
            : nothing
        }
        <div class="se-mock__view">
          ${[0, 1, 2, 3, 4].map(() => html`<span class="se-mock__tile"></span>`)}
        </div>
      </div>
    </div>`;
  }

  /** Where it stands: its side, its surface, its width by device, a phone's, its fold and the header's tabs. */
  private place(ctx: PanelContext, raw: Raw): TemplateResult {
    const { hass } = ctx;
    const spec = read(raw);
    const none = localize(hass, 'option.none');
    const width = (device: 'tablet' | 'desktop'): TemplateResult =>
      html`<p class="fv-label pn-label">${say(hass, `width_${device}`)}</p>
        ${choice(
          ctx,
          WIDTHS[device].map((px) => ({
            key: String(px),
            label: px ? String(px) : none,
            active: widthOf(raw, device) === px,
          })),
          (key) => this.change((table) => withWidth(table, device, Number(key))),
        )}`;
    return html`<section class="fv-card pn-card">
      ${head({ icon: 'sliders', title: say(hass, 'layout') })}
      <p class="fv-label pn-label">${say(hass, 'side')}</p>
      ${choice(
        ctx,
        [
          { key: 'start', label: say(hass, 'start'), active: spec.position === 'start' },
          { key: 'end', label: localize(hass, 'option.end'), active: spec.position === 'end' },
        ],
        (key) => this.change((table) => withKey(table, 'position', key, 'start')),
      )}
      <p class="fv-label pn-label">${say(hass, 'style')}</p>
      ${choice(
        ctx,
        STYLES.map((style: SidebarStyle) => ({
          key: style,
          label: style === 'plain' ? localize(hass, 'option.plain') : say(hass, STYLE_WORD[style]),
          active: spec.style === style,
        })),
        (key) => this.change((table) => withKey(table, 'style', key, 'panel')),
      )}
      ${width('tablet')}${width('desktop')}
      <p class="fv-label pn-label">${say(hass, 'phone')}</p>
      ${choice(
        ctx,
        PHONES.map((phone: SidebarPhone) => ({
          key: phone,
          label: phone === 'none' ? none : say(hass, PHONE_WORD[phone]),
          active: spec.phone === phone,
        })),
        (key) => this.change((table) => withKey(table, 'phone', key, 'none')),
      )}
      <div class="pn-rows">
        ${listRow({
          icon: 'chevronLeft',
          title: say(hass, 'collapsible'),
          sub: say(hass, 'collapsible_sub'),
          trailing: 'switch',
          on: spec.collapsible,
          onToggle: (on) => this.change((table) => withKey(table, 'collapsible', on, false)),
        })}
        ${
          // the tabs give way to a menu of the views: without one there is nothing to give way to
          spec.menu?.items === 'views'
            ? listRow({
                icon: 'tabsNone',
                title: say(hass, 'hide_tabs'),
                trailing: 'switch',
                on: spec.hideTabs,
                onToggle: (on) => this.change((table) => withKey(table, 'hide_tabs', on, false)),
              })
            : nothing
        }
      </div>
    </section>`;
  }

  /** What it holds: the menu of pages on or off, and its three lists of cards, a list at a time. */
  private contents(ctx: PanelContext, raw: Raw): TemplateResult {
    const { hass } = ctx;
    return html`<section class="fv-card pn-card">
      ${head({ icon: 'grid', title: ctx.t('dashboard.cards') })}
      <div class="pn-rows">
        ${listRow({
          icon: 'list',
          title: say(hass, 'menu'),
          sub: say(hass, 'menu_sub'),
          trailing: 'switch',
          on: hasMenu(raw),
          onToggle: (on) => this.change((table) => withMenu(table, on)),
        })}
      </div>
      ${choice(
        ctx,
        REGIONS.map((region) => {
          const count = listOf(raw, region).length;
          const word = say(hass, REGION_WORD[region]);
          return {
            key: region,
            label: count ? `${word} · ${count}` : word,
            active: region === this.region,
          };
        }),
        (key) => {
          this.region = key as Region;
          this.host.requestUpdate();
        },
        3,
      )}
      <p class="pn-hint">${say(hass, 'lists_hint')}</p>
      ${this.list(ctx, raw)}
    </section>`;
  }

  /** A dashboard kept in a file: what to write there, to copy. */
  private yaml(ctx: PanelContext, raw: Raw): TemplateResult {
    const { hass } = ctx;
    const text = toYaml(SIDEBAR_KEY, raw);
    const copy = (): void => {
      void copyText(text).then((done) => {
        window.clearTimeout(this.copied);
        this.failed = !done;
        this.copied = done
          ? window.setTimeout(() => {
              this.copied = undefined;
              this.host.requestUpdate();
            }, COPIED_MS)
          : undefined;
        this.host.requestUpdate();
      });
    };
    return html`<section class="fv-card pn-card">
      ${head({ icon: 'fileCode', title: 'YAML' })}
      <p class="pn-hint se-intro">${say(hass, this.failed ? 'copy_failed' : 'yaml')}</p>
      <pre class="se-code" tabindex="0">${text}</pre>
      ${button(say(hass, this.copied === undefined ? 'copy' : 'copied'), 'quiet', copy, true)}
    </section>`;
  }

  /* ---------- the section ---------- */

  /** A dashboard's sidebar, by its url path: the dashboards to pick from, the three choices, then what was chosen. */
  render(ctx: PanelContext, urlPath: string): TemplateResult {
    this.ctx = ctx;
    if (urlPath !== this.urlPath) {
      this.urlPath = urlPath;
      this.region = 'header';
      this.given = '';
      this.failed = false;
    }
    const { hass } = ctx;
    const title = ctx.t('dashboard.side');
    const close = round('close', 'bare', localize(hass, 'page.close'), () => this.host.sidebar(''));
    const dashboard = this.dashboard();
    // a link that names no dashboard (or one Home Assistant draws by itself, with no configuration to write beside),
    // or one opened before they are listed: the head alone, and the way back
    if (!dashboard)
      return html`<section class="fv-card pn-card">
        ${head({ icon: 'sidePanel', title, trailing: close })}
      </section>`;
    const raw = this.raw();
    const kind = kindOf(raw, presetContent(firstWeather(hass)), this.own.has(urlPath));
    const all = this.dashboards();
    return html`<section class="fv-card pn-card">
        ${head({ icon: 'sidePanel', title, sub: dashboard.title, trailing: close })}
        <p class="pn-hint se-intro">${say(hass, 'intro')}</p>
        ${
          all.length > 1
            ? html`<p class="fv-label pn-label">${ctx.t('dashboard.title')}</p>
                ${choice(
                  ctx,
                  all.map((candidate) => ({
                    key: candidate.urlPath,
                    label: candidate.title,
                    active: candidate === dashboard,
                    name: true,
                  })),
                  (key) => this.host.sidebar(key),
                )}`
            : nothing
        }
        ${this.mock(raw)}
        <div class="se-kinds">
          ${options(
            [
              {
                key: 'none',
                glyph: 'ban',
                label: say(hass, 'none_sub'),
                value: localize(hass, 'option.none'),
                active: kind === 'none',
              },
              {
                key: 'preset',
                glyph: 'clock',
                label: say(hass, 'preset_sub'),
                value: say(hass, 'preset'),
                active: kind === 'preset',
              },
              {
                key: 'own',
                glyph: 'sliders',
                label: say(hass, 'own_sub'),
                value: say(hass, 'own'),
                active: kind === 'own',
              },
            ],
            (key) => this.choose(key as Kind),
            gap(ctx),
            84,
            ctx.wide ? 3 : 1,
          )}
        </div>
      </section>
      ${raw ? this.place(ctx, raw) : nothing}
      ${raw && kind === 'own' ? this.contents(ctx, raw) : nothing}
      ${dashboard.yaml && raw ? this.yaml(ctx, raw) : nothing}`;
  }
}
