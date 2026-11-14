// Customise's words first: they are here before anything in its chunk says them
import './english.js';
import { domainOf, type HomeAssistant, localize, strings } from '@fluvy/core';
import {
  actions,
  type ActionItem,
  badge,
  button,
  emptyState,
  glyph,
  head,
  listRow,
  round,
  toggle,
} from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import type { Card as CardClass } from '../../shared/base.js';
import { loadChartEngine } from '../../shared/chart-load.js';
import { COMMON_ALIASES, normaliseConfig } from '../../shared/config.js';
import { edited, editOf, hiddenBy, pinned, withOptions } from '../../strategy/edit.js';
import { generateWith } from '../../strategy/generate.js';
import type { Card, DashboardEdit, FluvyStrategyConfig, ListEdit } from '../../strategy/types.js';
import type { DashboardInfo, PanelContext } from '../model.js';
import { choice } from '../sections.js';
import {
  leading,
  optionsOf,
  patched,
  pinsFor,
  stepped,
  withoutOwn,
  withoutPart,
  withoutView,
  written,
} from './draft.js';
import {
  automatic,
  iconOf,
  itemCard,
  listKey,
  nameOf,
  outlineOf,
  subjectOf,
  type PartOutline,
  type ViewOutline,
} from './outline.js';

const say = strings('customise');

/** What the panel is to Customise: what draws it again, and how it is left. */
export interface CustomiseHost {
  requestUpdate(): void;
  /** Opens Customise on a dashboard (its url path); none closes it. */
  customise(urlPath: string): void;
}

/**
 * A dashboard as it was read, for the options it had and the house's registries as they were: its views, none yet
 * while it is read, none ever where it could not be.
 */
interface Outline {
  readonly options: string;
  readonly house: readonly unknown[];
  views?: readonly ViewOutline[];
  failed?: boolean;
}

/** A card's options being edited in the sheet. */
interface Sheet {
  /** The entry of `edit.cards` its options are kept under. */
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  /** The card as the house builds it: what the options are told apart from. */
  readonly generated: Card;
  /** The keys Customise edits itself, never the form. */
  readonly omit: ReadonlySet<string>;
  /** The card's own form, once its editor has landed. */
  editor?: HTMLElement & { hass?: HomeAssistant; setConfig(config: Card): void };
  leaving: boolean;
}

/** A card of the preview: the element that draws it, kept while its config stays the same. */
interface Drawn {
  readonly key: string;
  readonly element: HTMLElement & { hass?: HomeAssistant };
}

/** How long a reset stays armed, a sheet takes to leave, and the preview waits for the edit to rest. */
const ARMED_MS = 4000;
const LEAVE_MS = 200;
const PREVIEW_MS = 160;

/** The part kinds the catalogue has a word for (`customise.kind.*`). */
const KINDS = [
  'thermostat',
  'weather',
  'clock',
  'flow',
  'curve',
  'media',
  'vacuum',
  'printer',
  'todo',
  'room',
  'floor',
  'back',
  'balance',
  'sources',
  'grid',
  'grid_gauge',
  'batteries',
  'charger',
  'day_flow',
  'sankey',
  'score',
  'day_balance',
  'gauges',
  'production',
  'tomorrow',
  'ahead',
  'history',
  'water',
  'period',
  'usage',
  'usage_water',
  'usage_gas',
  'map',
  'camera',
  'hello',
  'own',
] as const;
const isKind = (kind: string): kind is (typeof KINDS)[number] =>
  (KINDS as readonly string[]).includes(kind);

/** A card type as the card picker names it, without Fluvy's own mark ("Fluvy · Clock" → "Clock"). */
const typeName = (type: string): string => {
  const tag = type.replace(/^custom:/, '');
  const name = window.customCards?.find((card) => card.type === tag)?.name;
  return name ? name.replace(/^Fluvy\s·\s/, '') : tag;
};

/** Escape closes the sheet alone, whatever else listens for it on the window (Home Assistant's dialogs). */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};

/**
 * Customise (#170): an automatic dashboard's views and cards as rows — hidden, moved, tuned, their lists thinned out
 * and added to, cards of the person's own after them — every change an edit of the dashboard's `edit`, laid over what
 * is there and saved from the panel's bar with the rest. It keeps what it shows (the dashboard as it was read, the
 * open view, the open row, the armed reset, the options' sheet) and draws inside the panel, in its language.
 */
export class Customiser {
  private ctx: PanelContext | undefined;
  private urlPath = '';
  private readonly outlines = new Map<string, Outline>();
  private viewId = '';
  private openPart = '';
  private openItem = '';
  /** What a second tap would reset: a part's id, `view`, `all` ('' none). */
  private armed = '';
  private armTimer = 0;
  private sheet: Sheet | undefined;
  private leaveTimer = 0;
  /** The card of their own a person is writing (undefined: none). */
  private adding: unknown;
  /** Counts the entities added: the picker starts empty again after each. */
  private picked = 0;
  /** The open view's cards as the dashboard will draw them, and what they were drawn for. */
  private drawn: readonly Drawn[] | undefined;
  private drawnFor = '';
  private drawTimer = 0;
  /** The sheet's dialog while it is open: closed as a dialog is, so the focus goes back to what opened it. */
  private dialog: HTMLDialogElement | undefined;
  /** The button a move was made with (its row's id, an entity's where it is one's, and its place among the row's buttons): the focus goes back to it once the row has moved. */
  private moved: { readonly part: string; readonly item?: string; readonly at: number } | undefined;

  constructor(private readonly host: CustomiseHost) {}

  /** The panel is gone: nothing armed, nothing leaving. */
  dispose(): void {
    clearTimeout(this.armTimer);
    clearTimeout(this.leaveTimer);
    clearTimeout(this.drawTimer);
    this.sheet = undefined;
    this.drawn = undefined;
    this.drawnFor = '';
  }

  /**
   * After the panel has drawn: the sheet opens over the page, in the top layer; and a row that moved (the page moves
   * its node, which drops the focus) gives the focus back to the button that moved it, for the next press.
   */
  updated(root: ParentNode): void {
    const dialog = root.querySelector<HTMLDialogElement>('dialog.cz-dialog') ?? undefined;
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    this.dialog = dialog;
    const moved = this.moved;
    if (!moved) return;
    this.moved = undefined;
    const row = [...root.querySelectorAll<HTMLElement>('.cz-part')].find(
      (candidate) => candidate.dataset['part'] === moved.part,
    );
    const within = moved.item
      ? [...(row?.querySelectorAll<HTMLElement>('.cz-item') ?? [])].find(
          (candidate) => candidate.dataset['item'] === moved.item,
        )
      : row?.querySelector<HTMLElement>(':scope > .cz-detail > .cz-actions');
    within?.querySelectorAll<HTMLElement>('.fv-action')[moved.at]?.focus();
  }

  /* ---------- the dashboard ---------- */

  private get edit(): DashboardEdit {
    return editOf(this.ctx?.strategyOf(this.urlPath)?.['edit']);
  }

  /** Keeps an edit as the dashboard's pending one: gone from its configuration once nothing is left of it. */
  private change(next: DashboardEdit): void {
    this.ctx?.editStrategy(this.urlPath, { edit: written(next) });
  }

  /**
   * The dashboard as the house draws it: read once for the options it has now, and again when they change or the
   * house gains or loses an entity, a device or a room.
   */
  private outline(ctx: PanelContext, dashboard: DashboardInfo): Outline {
    const strategy = ctx.strategyOf(dashboard.urlPath) ?? {};
    const options = JSON.stringify(automatic(strategy));
    const house = [ctx.hass.entities, ctx.hass.devices, ctx.hass.areas];
    const known = this.outlines.get(dashboard.urlPath);
    if (known?.options === options && known.house.every((registry, at) => registry === house[at]))
      return known;
    const outline: Outline = { options, house };
    this.outlines.set(dashboard.urlPath, outline);
    if (dashboard.template)
      void outlineOf(dashboard.template, strategy, ctx.hass, dashboard.urlPath)
        .then(
          (views) => (outline.views = views),
          () => (outline.failed = true),
        )
        .then(() => this.host.requestUpdate());
    return outline;
  }

  /**
   * A dashboard as Customise shows it: its tabs (as the house orders them, and as the person placed them), its
   * pages, and the open view — the one picked, else the first tab as they stand, else the first page.
   */
  private shown(ctx: PanelContext, dashboard: DashboardInfo) {
    const outline = this.outline(ctx, dashboard);
    const edit = editOf(ctx.strategyOf(dashboard.urlPath)?.['edit']);
    const tabs = (outline.views ?? []).filter((view) => view.tab);
    const pages = (outline.views ?? []).filter((view) => !view.tab);
    const placed = pinned(tabs, (view) => edit.views?.[view.id]?.order);
    const view =
      outline.views?.find((candidate) => candidate.id === this.viewId) ?? placed[0] ?? pages[0];
    return { outline, tabs, pages, placed, view };
  }

  /** A view's parts as the dashboard's `edit` names them: the house's, then the person's own cards. */
  private partsOf(view: ViewOutline, edit: DashboardEdit): PartOutline[] {
    const own = edit.views?.[view.id]?.add;
    return [
      ...view.parts,
      // each by its place in the list, as the dashboard names it; what names no type is no card
      ...(Array.isArray(own) ? own : []).flatMap((card: unknown, index): PartOutline[] =>
        isCard(card)
          ? [
              {
                id: `${view.id}/own:${index}`,
                kind: 'own',
                cards: [card],
                off: false,
                card,
                list: undefined,
              },
            ]
          : [],
      ),
    ];
  }

  /* ---------- what a tap does ---------- */

  private arm(what: string, act: () => void): void {
    clearTimeout(this.armTimer);
    if (this.armed === what) {
      this.armed = '';
      act();
    } else {
      this.armed = what;
      this.armTimer = window.setTimeout(() => {
        this.armed = '';
        this.host.requestUpdate();
      }, ARMED_MS);
    }
    this.host.requestUpdate();
  }

  private pick(view: string): void {
    this.viewId = view;
    this.openPart = '';
    this.openItem = '';
    this.adding = undefined;
    this.host.requestUpdate();
  }

  private toggleOpen(part: string): void {
    this.openPart = this.openPart === part ? '' : part;
    this.openItem = '';
    this.host.requestUpdate();
  }

  /** Puts `ids` (the house's order) in the order asked for, with the fewest places: each entry's `order` set or gone. */
  private reorder(
    table: 'views' | 'cards',
    ids: readonly string[],
    asked: readonly string[],
  ): void {
    const pins = pinsFor(ids, asked);
    let next = this.edit;
    for (const id of ids)
      if (next[table]?.[id]?.order !== pins.get(id))
        next = patched(next, table, id, { order: pins.get(id) });
    this.change(next);
  }

  private editList(
    part: PartOutline,
    patch: Partial<Record<keyof ListEdit, readonly string[]>>,
  ): void {
    this.change(patched(this.edit, 'entities', part.id, patch));
  }

  /** Shows an entity of a list, or leaves it out: one the house gives is dropped, one the person added is taken back. */
  private toggleItem(part: PartOutline, item: string, on: boolean): void {
    const own = this.edit.entities?.[part.id];
    const without = (list: readonly string[] | undefined): string[] =>
      (list ?? []).filter((other) => other !== item);
    if (on) this.editList(part, { drop: without(own?.drop) });
    else if (part.list?.items.includes(item))
      this.editList(part, { drop: [...without(own?.drop), item], order: without(own?.order) });
    else this.editList(part, { add: without(own?.add), order: without(own?.order) });
  }

  private addItem(part: PartOutline, item: string): void {
    const own = this.edit.entities?.[part.id];
    this.picked++;
    if (own?.drop?.includes(item))
      this.editList(part, { drop: own.drop.filter((other) => other !== item) });
    else if (!part.list?.items.includes(item) && !own?.add?.includes(item))
      this.editList(part, { add: [...(own?.add ?? []), item] });
    else this.host.requestUpdate();
  }

  /* ---------- the options' sheet ---------- */

  private openSheet(
    id: string,
    title: string,
    icon: string,
    generated: Card,
    omit: string[],
  ): void {
    clearTimeout(this.leaveTimer);
    const sheet: Sheet = { id, title, icon, generated, omit: new Set(omit), leaving: false };
    this.sheet = sheet;
    this.host.requestUpdate();
    const tag = generated.type.replace(/^custom:/, '');
    // the card's own editor, fetched as Home Assistant's dialog fetches it (a card of a family may still be landing)
    void customElements
      .whenDefined(tag)
      .then(async () => {
        const element = customElements.get(tag) as unknown as typeof CardClass;
        const [{ editorDefaults, listsEditor, withoutLists }, editor] = await Promise.all([
          import('../../shared/rows-editor.js'),
          element.editor(),
          loadChartEngine(),
        ]);
        if (this.sheet !== sheet) return;
        const form = editor.getConfigForm();
        const aliases = [...(element.aliases ? [element.aliases] : []), COMMON_ALIASES];
        const made = listsEditor(
          { ...form, schema: withoutLists(form.schema, sheet.omit) },
          (editor.lists ?? []).filter((list) => !sheet.omit.has(list.key)),
          editor.defaults,
          aliases,
          editor.choices,
        ) as NonNullable<Sheet['editor']>;
        made.setConfig(withOptions(generated, this.edit.cards?.[id]?.options));
        // the card as its form reads it (an older name the house wrote, under its newer one): what a change is told from
        const read = normaliseConfig(generated, ...aliases) as Card;
        const defaults = editorDefaults(form, editor.defaults);
        made.addEventListener('config-changed', (event) => {
          event.stopPropagation();
          const { config } = (event as CustomEvent<{ config: Card }>).detail;
          // a key put back to what the card does by itself says nothing the generated card did not
          const own = defaults?.(config, this.ctx?.hass) ?? {};
          const said = Object.fromEntries(
            Object.entries(config).filter(
              ([key, value]) => key in read || JSON.stringify(value) !== JSON.stringify(own[key]),
            ),
          );
          this.change(
            patched(this.edit, 'cards', id, {
              // nothing changed, no options; else what leaves the generated card as the form holds it
              options: optionsOf(read, said, sheet.omit) && optionsOf(generated, said, sheet.omit),
            }),
          );
        });
        sheet.editor = made;
        this.host.requestUpdate();
      })
      // an editor that cannot be fetched (the page outlived an update) leaves the sheet waiting: Done closes it
      .catch(() => undefined);
  }

  private closeSheet(): void {
    const sheet = this.sheet;
    if (!sheet || sheet.leaving) return;
    sheet.leaving = true;
    this.leaveTimer = window.setTimeout(() => {
      // closed as a dialog closes: the focus goes back to the button that opened it
      if (this.dialog?.open) this.dialog.close();
      this.sheet = undefined;
      this.host.requestUpdate();
    }, LEAVE_MS);
    this.host.requestUpdate();
  }

  private sheetLayer(ctx: PanelContext): TemplateResult | typeof nothing {
    const sheet = this.sheet;
    if (!sheet) return nothing;
    if (sheet.editor) sheet.editor.hass = ctx.hass;
    const tuned = this.edit.cards?.[sheet.id]?.options !== undefined;
    return html`<dialog
      class="cz-dialog ${sheet.leaving ? 'is-leaving' : ''}"
      aria-label=${sheet.title}
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.closeSheet();
      }}
      @click=${(event: MouseEvent) => {
        if (event.target === event.currentTarget) this.closeSheet();
      }}
      @keydown=${keepEscape}
    >
      <div class="fv-sheet cz-sheet" data-card tabindex="-1" autofocus>
        <div class="fv-sheet__grabber"><span></span></div>
        ${head({
          icon: sheet.icon,
          title: sheet.title,
          sub: say(ctx.hass, 'options'),
          name: true,
          trailing: round('close', 'bare', localize(ctx.hass, 'page.done'), () =>
            this.closeSheet(),
          ),
        })}
        <div class="cz-sheet__body">
          <p class="pn-hint cz-sheet__hint">${say(ctx.hass, 'options_hint')}</p>
          ${sheet.editor ?? html`<div class="cz-wait" aria-busy="true"></div>`}
        </div>
        <div class="cz-pair" data-fill-row>
          ${button(
            ctx.t('about.reset_btn'),
            'quiet',
            () => {
              this.change(patched(this.edit, 'cards', sheet.id, { options: undefined }));
              sheet.editor?.setConfig(sheet.generated);
            },
            true,
            !tuned,
          )}
          ${button(localize(ctx.hass, 'page.done'), 'accent', () => this.closeSheet(), true)}
        </div>
      </div>
    </dialog>`;
  }

  /* ---------- the view as it will be drawn ---------- */

  /**
   * The open view's cards as the dashboard will draw them with what is pending, stacked as a phone stacks them: the
   * real cards on the real house, looked at and never touched (`inert`: a tap here switches nothing at home). Built
   * again a moment after the edit rests, each card kept while its config stays the same. Undefined until there is one.
   */
  preview(ctx: PanelContext, urlPath: string): TemplateResult | undefined {
    const dashboard = ctx.dashboards.find((candidate) => candidate.urlPath === urlPath);
    const strategy = ctx.strategyOf(urlPath);
    const view = dashboard && this.shown(ctx, dashboard).view?.id;
    if (!dashboard?.template || !strategy || !view) return undefined;
    const key = `${urlPath}|${view}|${JSON.stringify(strategy)}`;
    if (key !== this.drawnFor) {
      this.drawnFor = key;
      const { template } = dashboard;
      clearTimeout(this.drawTimer);
      this.drawTimer = window.setTimeout(
        () =>
          void generateWith(
            template,
            strategy as unknown as FluvyStrategyConfig,
            ctx.hass,
            `/${urlPath}`,
          ).then(
            ({ views }) => {
              if (this.drawnFor !== key) return;
              const cards =
                views
                  .find((candidate) => candidate.path === view)
                  ?.sections.flatMap((section) => section.cards) ?? [];
              const spare = [...(this.drawn ?? [])];
              this.drawn = cards.map((card) => this.draw(card, spare));
              this.host.requestUpdate();
            },
            // a dashboard that cannot be built keeps the view as it was last drawn
            () => undefined,
          ),
        this.drawn ? PREVIEW_MS : 0,
      );
    }
    if (!this.drawn) return undefined;
    for (const { element } of this.drawn) element.hass = ctx.hass;
    // the cards are the dashboard's own, measured on their sheets: the panel answers for the column they stand in
    return html`<div class="cz-preview" inert data-measure="skip">
      ${
        this.drawn.length
          ? repeat(
              this.drawn,
              (card) => card.element,
              (card) => card.element,
            )
          : emptyState('eye', say(ctx.hass, 'hidden'))
      }
    </div>`;
  }

  /**
   * A card's element: one of `spare` (the cards drawn before) that already draws this very config, taken out of
   * them, else a new one, configured once its tag is defined.
   */
  private draw(card: Card, spare: Drawn[]): Drawn {
    const key = JSON.stringify(card);
    const kept = spare.findIndex((drawn) => drawn.key === key);
    if (kept >= 0) return spare.splice(kept, 1)[0] as Drawn;
    const tag = card.type.startsWith('custom:') ? card.type.slice(7) : '';
    const element: Drawn['element'] = document.createElement(tag || 'div');
    // half a section wide (`grid_options.columns: 6`): two stand side by side
    element.toggleAttribute('data-half', card.grid_options?.columns === 6);
    if (tag)
      void customElements.whenDefined(tag).then(() => {
        try {
          (element as unknown as { setConfig(config: Card): void }).setConfig(card);
        } catch {
          // a config its card refuses draws nothing here: the dashboard says what is wrong with it
        }
      });
    else {
      // a card of Home Assistant's own is drawn by Home Assistant: here, its name where it will stand
      element.className = 'cz-preview__own';
      element.textContent = card.type;
    }
    return { key, element };
  }

  /* ---------- a part's row ---------- */

  /**
   * What a part's row says: its own name, and under it what it is where the name alone would not say. `name`: the
   * title is the house's own (an entity's, a room's, a floor's: a part with a key, or one named by what its card
   * draws), which may end in an ellipsis as names do; Fluvy's own words never do.
   */
  private wordsOf(
    part: PartOutline,
    ctx: PanelContext,
  ): { title: string; kind: string; name: boolean } {
    const { card, kind } = part;
    const word = isKind(kind) ? say(ctx.hass, `kind.${kind}`) : '';
    const text = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value : undefined;
    const subject = subjectOf(card);
    const own = part.list?.title ?? text(card?.['title']) ?? text(card?.['name']);
    const named = own ?? (subject ? nameOf(ctx.hass, subject) : undefined);
    if (kind === 'own') return { title: typeName(card?.type ?? ''), kind: word, name: true };
    return named
      ? { title: named, kind: word === named ? '' : word, name: !own || part.id.includes(':') }
      : { title: word || typeName(card?.type ?? ''), kind: '', name: false };
  }

  /** A row of glyph buttons under an open row: equal whole-pixel cells, as many as it has buttons. */
  private buttons(items: readonly ActionItem[], run: (key: string) => void): TemplateResult {
    return html`<div class="cz-actions" style="--cz-cells:${items.length}">
      ${actions(items, run)}
    </div>`;
  }

  private partRow(
    ctx: PanelContext,
    view: ViewOutline,
    part: PartOutline,
    order: readonly PartOutline[],
    ids: readonly string[],
  ): TemplateResult {
    const edit = this.edit;
    const own = part.kind === 'own';
    const hidden = hiddenBy(edit.cards?.[part.id], part.off);
    const changed =
      !own &&
      (Object.keys(edit.cards ?? {}).some((id) => id === part.id || id.startsWith(`${part.id}:`)) ||
        edit.entities?.[part.id] !== undefined);
    const { title, kind, name } = this.wordsOf(part, ctx);
    const list = part.list;
    const shown = list ? this.itemsOf(ctx, part) : [];
    // what it is, or how much of its list shows; before it, that it is hidden or that a person changed it
    const sub = [
      hidden ? say(ctx.hass, 'hidden') : changed ? say(ctx.hass, 'edited') : '',
      !list
        ? kind
        : hidden
          ? ''
          : say(ctx.hass, 'shown', {
              shown: shown.length,
              // of the house's and what the person added
              count: new Set([...list.items, ...shown]).size,
            }),
    ]
      .filter(Boolean)
      .join(' · ');
    const open = this.openPart === part.id;
    const seen = order.map((other) => other.id);
    const at = seen.indexOf(part.id);
    const move = (by: 1 | -1): void =>
      this.reorder(
        'cards',
        ids,
        stepped(
          pinned(ids, (id) => edit.cards?.[id]?.order),
          part.id,
          by,
          (id) => seen.includes(id),
        ),
      );
    const tunes = !own && part.card && (!list || listKey(part.card, list) !== undefined);
    const armed = this.armed === part.id;
    const items: ActionItem[] = [
      { key: 'up', glyph: 'up', label: say(ctx.hass, 'up'), disabled: at <= 0 },
      { key: 'down', glyph: 'down', label: say(ctx.hass, 'down'), disabled: at >= seen.length - 1 },
      ...(tunes ? [{ key: 'options', glyph: 'sliders', label: say(ctx.hass, 'options') }] : []),
      ...(own
        ? [{ key: 'remove', glyph: 'trash', label: say(ctx.hass, 'remove') }]
        : [
            {
              key: 'reset',
              glyph: 'undo',
              label: ctx.t('about.reset_btn'),
              disabled: !changed,
              primary: armed,
            },
          ]),
    ];
    const run = (key: string): void => {
      if (key === 'up' || key === 'down') {
        this.moved = { part: part.id, at: key === 'up' ? 0 : 1 };
        move(key === 'up' ? -1 : 1);
      } else if (key === 'options' && part.card) {
        const key = listKey(part.card, list);
        this.openSheet(part.id, title, iconOf(part, ctx.hass), part.card, key ? [key] : []);
      } else if (key === 'remove') {
        this.openPart = '';
        this.change(withoutOwn(edit, view.id, Number(part.id.split(':').pop())));
      } else if (key === 'reset')
        this.arm(part.id, () => this.change(withoutPart(this.edit, part.id)));
    };
    return html`<div
      class="cz-part ${hidden ? 'is-off' : ''} ${changed && !hidden ? 'is-edited' : ''} ${open ? 'is-open' : ''}"
      data-part=${part.id}
    >
      ${listRow({
        icon: iconOf(part, ctx.hass),
        tone: hidden ? 'neutral' : 'accent',
        title,
        name,
        ...(sub ? { sub } : {}),
        trailing: own
          ? 'chevron'
          : html`<span class="cz-caret" aria-hidden="true">${glyph('chevron')}</span>${toggle(
                !hidden,
                'accent',
                (on) =>
                  this.change(
                    // a part that starts hidden keeps its being shown; any other its being hidden
                    patched(this.edit, 'cards', part.id, {
                      hidden: on === part.off ? !on : undefined,
                    }),
                  ),
                title,
              )}`,
        open,
        onTap: () => this.toggleOpen(part.id),
      })}
      ${
        open
          ? html`<div class="cz-detail">
              ${this.buttons(items, run)}
              ${
                armed
                  ? html`<p class="pn-hint cz-armed">
                      ${say(ctx.hass, 'reset_card')} · ${ctx.t('about.reset_cancels')}
                    </p>`
                  : nothing
              }
              ${own ? this.ownEditor(ctx, view, part) : nothing}
              ${list && !hidden ? this.listBlock(ctx, part, shown) : nothing}
            </div>`
          : nothing
      }
    </div>`;
  }

  /* ---------- a list's entities ---------- */

  /** A list's entities as the person left them, in their order: what its cards are made of. */
  private itemsOf(ctx: PanelContext, part: PartOutline, order = true): readonly string[] {
    const list = part.list;
    if (!list) return [];
    return edited(
      list.items,
      this.edit.entities?.[part.id],
      list.takes,
      (id) => ctx.hass.states[id] !== undefined,
      order,
    );
  }

  private listBlock(
    ctx: PanelContext,
    part: PartOutline,
    shown: readonly string[],
  ): TemplateResult {
    const list = part.list as NonNullable<PartOutline['list']>;
    // a list of devices (the appliances' bands) is thinned out and ordered; only entities are added
    const devices = list.items.some((item) => !item.includes('.'));
    const dropped = list.items.filter((item) => !shown.includes(item));
    const move = (item: string, by: 1 | -1): void => {
      const asked = [...shown];
      const from = asked.indexOf(item);
      asked.splice(from, 1);
      asked.splice(from + by, 0, item);
      this.editList(part, { order: leading(this.itemsOf(ctx, part, false), asked) });
    };
    const row = (item: string, on: boolean): TemplateResult => {
      const name = nameOf(ctx.hass, item);
      const state = ctx.hass.states[item];
      const card = on ? itemCard(part, item) : undefined;
      const open = on && this.openItem === item;
      const at = shown.indexOf(item);
      return html`<div
        class="cz-item ${on ? '' : 'is-off'} ${open ? 'is-open' : ''}"
        data-item=${item}
      >
        ${listRow({
          compact: true,
          // the entity's own icon as Home Assistant draws it, in the row's circle
          icon: state
            ? html`<span class="fv-ico fv-ico--neutral" data-icon
                ><ha-state-icon
                  class="fv-haicon"
                  .hass=${ctx.hass}
                  .stateObj=${state}
                ></ha-state-icon
              ></span>`
            : (list.icon ?? 'plug'),
          title: name,
          name: true,
          trailing: toggle(on, 'accent', (next) => this.toggleItem(part, item, next), name),
          ...(on
            ? {
                open,
                onTap: () => {
                  this.openItem = open ? '' : item;
                  this.host.requestUpdate();
                },
              }
            : {}),
        })}
        ${
          open
            ? this.buttons(
                [
                  { key: 'up', glyph: 'up', label: say(ctx.hass, 'up'), disabled: at <= 0 },
                  {
                    key: 'down',
                    glyph: 'down',
                    label: say(ctx.hass, 'down'),
                    disabled: at >= shown.length - 1,
                  },
                  ...(card
                    ? [{ key: 'options', glyph: 'sliders', label: say(ctx.hass, 'options') }]
                    : []),
                ],
                (key) => {
                  if (key === 'options' && card)
                    this.openSheet(`${part.id}:${item}`, name, iconOf(part, ctx.hass), card, [
                      'entity',
                      'area',
                      'device',
                    ]);
                  else {
                    this.moved = { part: part.id, item, at: key === 'up' ? 0 : 1 };
                    move(item, key === 'up' ? -1 : 1);
                  }
                },
              )
            : nothing
        }
      </div>`;
    };
    const taken = [...shown, ...dropped];
    return html`<p class="fv-label cz-label">${say(ctx.hass, devices ? 'devices' : 'entities')}</p>
      <div class="cz-items">
        ${repeat(
          taken,
          (item) => item,
          (item) => row(item, shown.includes(item)),
        )}
      </div>
      ${
        devices
          ? nothing
          : keyed(
              this.picked,
              html`<ha-selector
                class="cz-add"
                .hass=${ctx.hass}
                .label=${say(ctx.hass, 'add_entity')}
                .selector=${{
                  entity: {
                    exclude_entities: taken,
                    ...(list.takes.includes('*') ? {} : { filter: { domain: [...list.takes] } }),
                  },
                }}
                .value=${''}
                @value-changed=${(event: CustomEvent<{ value?: unknown }>) => {
                  event.stopPropagation();
                  const { value } = event.detail;
                  if (
                    typeof value === 'string' &&
                    value &&
                    (list.takes.includes('*') || list.takes.includes(domainOf(value)))
                  )
                    this.addItem(part, value);
                }}
              ></ha-selector>`,
            )
      }`;
  }

  /* ---------- the person's own cards ---------- */

  /** A card of the person's own as YAML, in Home Assistant's own editor. */
  private yaml(
    ctx: PanelContext,
    value: unknown,
    changed: (value: unknown) => void,
  ): TemplateResult {
    return html`<ha-selector
      class="cz-yaml"
      .hass=${ctx.hass}
      .selector=${{ object: {} }}
      .value=${value}
      @value-changed=${(event: CustomEvent<{ value?: unknown }>) => {
        event.stopPropagation();
        changed(event.detail.value);
      }}
    ></ha-selector>`;
  }

  private ownEditor(ctx: PanelContext, view: ViewOutline, part: PartOutline): TemplateResult {
    const index = Number(part.id.split(':').pop());
    return this.yaml(ctx, part.card, (value) => {
      if (!isCard(value)) return;
      const cards = [...(this.edit.views?.[view.id]?.add ?? [])];
      cards[index] = value;
      this.change(patched(this.edit, 'views', view.id, { add: cards }));
    });
  }

  private ownBlock(ctx: PanelContext, view: ViewOutline): TemplateResult {
    const adding = this.adding;
    return html`<p class="fv-label pn-label">${say(ctx.hass, 'own')}</p>
      <p class="pn-hint">${say(ctx.hass, 'own_hint')}</p>
      ${
        adding === undefined
          ? html`<div class="pn-rows">
              ${listRow({
                icon: 'plus',
                title: say(ctx.hass, 'add_card'),
                sub: say(ctx.hass, 'add_card_hint'),
                trailing: 'button',
                button: say(ctx.hass, 'add'),
                onTap: () => {
                  this.adding = { type: '' };
                  this.host.requestUpdate();
                },
              })}
            </div>`
          : html`${this.yaml(ctx, adding, (value) => {
                this.adding = value ?? { type: '' };
                this.host.requestUpdate();
              })}
              <div class="cz-pair" data-fill-row>
                ${button(
                  ctx.t('charts.cancel'),
                  'quiet',
                  () => {
                    this.adding = undefined;
                    this.host.requestUpdate();
                  },
                  true,
                )}
                ${button(
                  say(ctx.hass, 'add'),
                  'accent',
                  () => {
                    if (!isCard(adding)) return;
                    const cards = [...(this.edit.views?.[view.id]?.add ?? []), adding];
                    this.adding = undefined;
                    this.change(patched(this.edit, 'views', view.id, { add: cards }));
                  },
                  true,
                  !isCard(adding),
                )}
              </div>`
      }`;
  }

  /* ---------- a view ---------- */

  private viewCard(
    ctx: PanelContext,
    view: ViewOutline,
    tabs: readonly ViewOutline[],
    first: ViewOutline | undefined,
  ): TemplateResult {
    const edit = this.edit;
    const all = this.partsOf(view, edit);
    const ids = all.map((part) => part.id);
    const order = pinned(all, (part) => edit.cards?.[part.id]?.order).filter(
      (part) => part.cards.length,
    );
    const hidden = order.filter((part) => hiddenBy(edit.cards?.[part.id], part.off)).length;
    const own = edit.views?.[view.id];
    const changed =
      own !== undefined ||
      [...Object.keys(edit.cards ?? {}), ...Object.keys(edit.entities ?? {})].some((id) =>
        id.startsWith(`${view.id}/`),
      );
    const tabIds = tabs.map((tab) => tab.id);
    const placed = pinned(tabIds, (id) => edit.views?.[id]?.order);
    const place = placed.indexOf(view.id);
    const moveTab = (by: 1 | -1): void =>
      this.reorder(
        'views',
        tabIds,
        stepped(placed, view.id, by, () => true),
      );
    const armed = this.armed === 'view';
    return html`<section class="fv-card pn-card cz-view">
      ${head({
        icon: view.icon,
        title: view.title,
        sub: say(ctx.hass, 'shown', { shown: order.length - hidden, count: order.length }),
        name: true,
        trailing: changed ? badge(say(ctx.hass, 'edited')) : nothing,
      })}
      ${
        view.tab
          ? html`<div class="pn-rows">
              ${
                view === first
                  ? listRow({
                      icon: 'eye',
                      title: say(ctx.hass, 'show_view'),
                      trailing: 'value',
                      value: ctx.t('dashboard.always'),
                      quiet: true,
                    })
                  : listRow({
                      icon: 'eye',
                      title: say(ctx.hass, 'show_view'),
                      trailing: 'switch',
                      on: own?.hidden !== true,
                      onToggle: (on) =>
                        this.change(
                          patched(this.edit, 'views', view.id, { hidden: on ? undefined : true }),
                        ),
                    })
              }
              ${listRow({
                icon: 'updown',
                title: say(ctx.hass, 'place'),
                sub: say(ctx.hass, 'place_of', { place: place + 1, count: placed.length }),
                trailing: html`<span class="cz-steps"
                  >${round(
                    'chevronLeft',
                    'quiet',
                    say(ctx.hass, 'earlier'),
                    () => moveTab(-1),
                    place <= 0,
                  )}${round(
                    'chevron',
                    'quiet',
                    say(ctx.hass, 'later'),
                    () => moveTab(1),
                    place >= placed.length - 1,
                  )}</span
                >`,
              })}
            </div>`
          : nothing
      }
      <p class="fv-label pn-label">${ctx.t('dashboard.cards')}</p>
      <div class="cz-parts">
        ${
          // each row moves with its part: a button pressed again after a move still has the focus
          repeat(
            order,
            (part) => part.id,
            (part) => this.partRow(ctx, view, part, order, ids),
          )
        }
      </div>
      ${this.ownBlock(ctx, view)}
      ${
        changed
          ? html`<div class="pn-rows pn-reset ${armed ? 'is-armed' : ''}">
              ${listRow({
                icon: 'undo',
                tone: armed ? 'warning' : 'neutral',
                title: armed ? ctx.t('dashboard.recreate_armed') : say(ctx.hass, 'reset_view'),
                sub: armed ? ctx.t('about.reset_cancels') : say(ctx.hass, 'reset_view_sub'),
                trailing: 'button',
                button: ctx.t('about.reset_btn'),
                onTap: () => this.arm('view', () => this.change(withoutView(this.edit, view.id))),
              })}
            </div>`
          : nothing
      }
    </section>`;
  }

  /* ---------- the section ---------- */

  /** Customise for a dashboard, by its url path: the dashboards and their views to pick from, then the open view. */
  render(ctx: PanelContext, urlPath: string): TemplateResult {
    this.ctx = ctx;
    if (urlPath !== this.urlPath) {
      this.urlPath = urlPath;
      this.viewId = '';
      this.openPart = '';
      this.openItem = '';
      this.adding = undefined;
      this.drawn = undefined;
    }
    const dashboard = ctx.dashboards.find(
      (candidate) => candidate.urlPath === urlPath && candidate.template,
    );
    const close = round('close', 'bare', say(ctx.hass, 'close'), () => this.host.customise(''));
    // a link that names no dashboard of ours says so; one opened before the dashboards are listed waits for them
    if (!dashboard)
      return html`<section class="fv-card pn-card">
        ${head({ icon: 'sliders', title: say(ctx.hass, 'title'), trailing: close })}
        ${emptyState('grid', say(ctx.hass, ctx.dashboards.length ? 'failed' : 'loading'))}
      </section>`;
    const { outline, tabs, pages, placed, view } = this.shown(ctx, dashboard);
    const edit = this.edit;
    const chip = (candidate: ViewOutline) => ({
      key: candidate.id,
      label: candidate.title,
      active: candidate === view,
      name: true,
    });
    const armed = this.armed === 'all';
    return html`<section class="fv-card pn-card cz-top">
        ${head({
          icon: 'sliders',
          title: say(ctx.hass, 'title'),
          sub: dashboard.title,
          trailing: close,
        })}
        <p class="pn-hint cz-intro">${say(ctx.hass, 'intro')}</p>
        ${
          tabs.length
            ? html`<p class="fv-label pn-label">${ctx.t('dashboard.views')}</p>
                ${choice(ctx, placed.map(chip), (key) => this.pick(key))}`
            : nothing
        }
        ${
          pages.length
            ? html`<p class="fv-label pn-label">${say(ctx.hass, 'pages')}</p>
                ${choice(ctx, pages.map(chip), (key) => this.pick(key))}`
            : nothing
        }
      </section>
      ${
        view
          ? this.viewCard(ctx, view, tabs, tabs[0])
          : html`<section class="fv-card pn-card">
              ${emptyState('grid', say(ctx.hass, outline.failed ? 'failed' : 'loading'))}
            </section>`
      }
      ${
        Object.keys(edit).length
          ? html`<section class="fv-card pn-card pn-rows pn-reset ${armed ? 'is-armed' : ''}">
              ${listRow({
                icon: 'auto',
                tone: armed ? 'warning' : 'neutral',
                title: armed ? ctx.t('dashboard.recreate_armed') : say(ctx.hass, 'reset_all'),
                sub: armed ? ctx.t('about.reset_cancels') : say(ctx.hass, 'reset_all_sub'),
                trailing: 'button',
                button: ctx.t('about.reset_btn'),
                onTap: () => this.arm('all', () => this.change({})),
              })}
            </section>`
          : nothing
      }
      ${this.sheetLayer(ctx)}`;
  }
}

/** A card a dashboard can draw: a table that names its type. */
const isCard = (value: unknown): value is Card =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { type?: unknown }).type === 'string' &&
  (value as { type: string }).type.trim() !== '';
