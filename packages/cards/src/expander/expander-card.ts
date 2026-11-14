import {
  actionRuns,
  haptic,
  idsOf,
  isActive,
  selfHide,
  strings,
  VISIBILITY_EVENT,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  clickHead,
  glyph,
  holdKey,
  ico,
  preventMenu,
  reducedMotion,
  startPress,
  type PressTarget,
} from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { HeadFit, NAME_FLOOR, type FittedHead } from '../energy/head.js';
import { expanderHeight } from '../expander-family.js';
import { Card, type CardEditor } from '../shared/base.js';
import { toneOf } from '../shared/colour.js';
import { counted, onOfShort } from '../shared/counted.js';
import { holds, statesOf, type ShowWhen } from '../shared/lists.js';
import { hold, type Held } from './held.js';
import { expanderKey, keep, recall, REMEMBER, type Remember } from './memory.js';

const s = strings('expander');

/** `card` (the default): one surface holds the head and the cards. `plain`: no surface, the cards keep theirs. */
export type ExpanderStyle = 'card' | 'plain';
/** Where the chevron stands in the head: at its end (the default), or at its start, before the circle. */
export type ChevronPosition = 'end' | 'start';

export interface ExpanderCardConfig extends FluvyCardConfig {
  /** The head's title ("Expander" where none is written). */
  title?: string;
  /** The line under it: words, an entity (its state) or a template; the count of `entities` follows it. */
  subtitle?: string;
  /** The cards it holds, as a stack's: any card, Fluvy's or not. */
  cards?: readonly LovelaceCardConfig[];
  /** Open as the page loads (false: folded), until the person folds it or what was remembered says otherwise. */
  expanded?: boolean;
  /** Where the way a person left it is kept: this device (the default), the person on every device, or nowhere. */
  remember?: Remember;
  style?: ExpanderStyle;
  /** Its cards side by side, 1 (the default) to 4: as many of them as the width holds. */
  columns?: number;
  /** The room between its cards, in px: 40 on its surface, a hairline in its middle (the default); 16 without one. */
  gap?: number;
  /** The head's line counts `entities` ("2 of 5 on"; true): false leaves the count out. */
  show_summary?: boolean;
  show_chevron?: boolean;
  chevron_position?: ChevronPosition;
  /**
   * Opens by itself when this starts to hold (a door open: `{ entity, state: on }`), and folds again when it no longer
   * does, unless a person touched it meanwhile.
   */
  open_when?: ShowWhen;
  /** Minutes after which an open card folds by itself; 0 (the default): never. */
  close_after?: number;
  /**
   * The circle's own colour. `color` is the card's, as on every card: its circle wears it, and so do the cards of
   * Fluvy's it holds that name none of their own.
   */
  icon_color?: string;
}

export const STYLES: readonly ExpanderStyle[] = ['card', 'plain'];
export const POSITIONS: readonly ChevronPosition[] = ['end', 'start'];

/** The fold's motion and the chevron's turn, in ms: what the cards wait for before they leave the page. */
const MOTION = 240;
/** A card's padding: what one held by the surface turns out, so its column is the head's (`--fv-held-bleed`). */
const PADDING = 20;
/**
 * The room between the cards where the config says none: on the surface a card's own 20 and 20, a hairline between;
 * without one, a section's 16.
 */
const GAP: Readonly<Record<ExpanderStyle, number>> = { card: 2 * PADDING, plain: 16 };
/** The widest gap a config may ask for. */
const GAP_MAX = 64;
/** The narrowest a card stands beside another: half a phone's section, less what a narrow phone takes off it. */
const COLUMN_MIN = 148;
/** What the chevron takes of the head beside the titles: its 44 box less what it stands out of the column by. */
const CHEVRON: Readonly<Record<ChevronPosition, number>> = { end: 36, start: 16 };
/** The same as a round of its own, where the head's tap is another thing. */
const ROUND = 44;
/** The head's geometry (fluvy.css): its circle and the 12 after it (the smaller circle's 40), the 12 before what ends it. */
const CIRCLE = 56;
const CIRCLE_SMALL = 52;
const HEAD_GAP = 12;

/** Whether a condition asks anything of the entity it names: one that asks nothing opens nothing. */
const asks = (when: ShowWhen | undefined): when is ShowWhen =>
  typeof when === 'object' &&
  when !== null &&
  typeof when.entity === 'string' &&
  when.entity !== '' &&
  (when.above !== undefined ||
    when.below !== undefined ||
    statesOf(when.state).length > 0 ||
    statesOf(when.state_not).length > 0);

/**
 * The Expander card (#180): any cards under a head that folds. The head is one button — its circle, its title, the
 * line under it (words of the person's own, a template, and the count of `entities`: "2 of 5 on") and a chevron that
 * turns — and a tap opens what it holds, drawn on the card's own surface with the head (`style: card`, the default:
 * the cards draw no surface of their own, so one card reads as one) or each on its own under a head that stands on
 * the page (`plain`). The cards are Home Assistant's to build (`held.ts`: its card wrapper, so any card works, with
 * its `visibility` conditions), the first time the card opens; folded, they leave the page once the fold has closed
 * over them, and are told nothing of the house until it opens again. How a person left it is remembered (`remember`:
 * this device, the person, or not at all); a condition may open it (`open_when`) and a clock fold it (`close_after`).
 * Every card hidden, it hides itself, as a stack does. In the editor's preview it is always open.
 */
export class FluvyExpanderCard extends Card<ExpanderCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns: folded, its head. */
  static override layoutHeight(config: LovelaceCardConfig): number {
    return expanderHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    css`
      /* the page's inks as the card found them, for a head that stands on the page (as onPageStyles keeps them) */
      :host {
        --fv-page-text: var(--fluvy-text);
        --fv-page-text-secondary: var(--fluvy-text-secondary);
      }
      /* the surface ends under the head while folded (its 20), under the cards while open (theirs) */
      .ex-card {
        padding-bottom: 0;
      }
      .ex-card > .ex-head {
        margin-bottom: ${PADDING}px;
      }
      /* on its surface the head's button reaches the card's edges round the head: folded, the whole card is the tap,
         and a card a quarter of a section wide keeps its 44 */
      .ex-card > .ex-head .fv-card__tap::after {
        inset: -${PADDING}px;
        border-radius: var(--fluvy-radius-card);
      }
      /* open, it ends square on the hairline its cards start under */
      .ex-card.is-open > .ex-head .fv-card__tap::after {
        border-radius: var(--fluvy-radius-card) var(--fluvy-radius-card) 0 0;
      }
      /* no surface: the head on the page, in the ink the page's background asks for; what it holds keeps its own */
      .ex-plain {
        position: relative;
        animation: fv-enter 420ms var(--fv-ease-out) both;
        animation-delay: var(--fv-enter-delay, 0ms);
      }
      .ex-plain > .ex-head {
        --fluvy-text: var(--fluvy-page-ink, var(--fv-page-text));
        --fluvy-text-secondary: var(--fluvy-page-ink-2, var(--fv-page-text-secondary));
        color: var(--fluvy-text);
      }
      /* the chevron, a mark of the head's button: a 44 box, its ink on the column's edge (the box 8 past it, the
         glyph 4 back) */
      .ex-chevron {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: flex-end;
        width: 44px;
        height: 44px;
        margin-right: -8px;
        padding-right: 4px;
        color: var(--fluvy-text-secondary);
        transition: color var(--fv-base) var(--fv-ease);
      }
      .ex-head--start > .ex-chevron {
        justify-content: flex-start;
        margin: 0 -20px 0 -8px;
        padding: 0 0 0 4px;
      }
      .ex-chevron svg {
        width: 20px;
        height: 20px;
      }
      /* down while folded, up while open: half a turn with the fold, as a mark or as a round of its own */
      .ex-turn svg {
        transform: rotate(90deg);
        transition: transform ${MOTION}ms var(--fv-ease);
      }
      .is-open > .ex-head > .ex-turn svg {
        transform: rotate(-90deg);
      }
      @media (hover: hover) {
        .ex-head:has(.fv-card__tap:hover) > .ex-chevron {
          color: var(--fluvy-text);
        }
      }
      /* the fold: a row that grows from nothing to what it holds, clipped while it moves */
      .ex-body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows ${MOTION}ms var(--fv-ease);
      }
      .is-open > .ex-body {
        grid-template-rows: 1fr;
      }
      .ex-clip {
        min-height: 0;
        overflow: hidden;
      }
      /* at rest and open, nothing is cut: a card's focus ring and its entrance reach past its box */
      .is-open.is-rest > .ex-body > .ex-clip {
        overflow: visible;
      }
      .ex-cards {
        display: grid;
        grid-template-columns: repeat(var(--ex-columns), minmax(0, 1fr));
        gap: var(--ex-gap);
      }
      .ex-plain .ex-cards {
        padding-top: var(--ex-gap);
      }
      /* on the surface the fold reaches its edges, and what it holds stands in the head's column: a card of Fluvy's
         draws no surface (--fv-held) and turns its own padding out (--fv-held-bleed), one of Home Assistant's wears
         none (--ha-card-*); what stood on the page there stands on the card, in the card's inks */
      .ex-card > .ex-body {
        margin: 0 -${PADDING}px;
      }
      .ex-card .ex-cards {
        padding: calc(var(--ex-gap) / 2) ${PADDING}px ${PADDING}px;
        --fv-held: none;
        --fv-held-bleed: -1;
        --ha-card-background: transparent;
        --ha-card-border-width: 0px;
        --ha-card-box-shadow: none;
        --ha-card-backdrop-filter: none;
        --ha-card-border-radius: var(--fluvy-radius-control);
        --fluvy-page-ink: initial;
        --fluvy-page-ink-2: initial;
      }
      /* a hairline over each card, in the middle of the room above it: under the head, and between the cards */
      .ex-card ::slotted(*) {
        position: relative;
      }
      .ex-card ::slotted(*)::before {
        content: '';
        position: absolute;
        top: calc(var(--ex-gap) / -2);
        left: 0;
        right: 0;
        height: 1px;
        background: var(--fluvy-border);
      }
      /* a card that is not Fluvy's keeps its own padding: turned out as far as that — Home Assistant's 16, as most
         have it, less above and below, where a header has less to give; what one of its own cards pads its content
         by instead, where held.ts knows it (on the wrapper itself, over these) */
      .ex-card ::slotted(.ex-other) {
        --ex-x: 16px;
        --ex-y: 12px;
        margin: calc(-1 * var(--ex-y)) calc(-1 * var(--ex-x));
      }
      .ex-card ::slotted(.ex-other)::before {
        top: calc(var(--ex-y) - var(--ex-gap) / 2);
        left: var(--ex-x);
        right: var(--ex-x);
      }
      /* what Home Assistant draws as a tile keeps its surface, a tile of Fluvy's: its fill, its hairline, its corners */
      .ex-card ::slotted(.ex-tile) {
        --ha-card-background: var(--fluvy-card);
        --ha-card-border-width: 1px;
        --ha-card-border-color: var(--fluvy-edge, var(--fluvy-border));
        --ha-card-border-radius: var(--fluvy-radius-lg);
      }
      .ex-empty {
        grid-column: 1 / -1;
        line-height: 20px;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    open_: { state: true },
    mounted_: { state: true },
    unfolded_: { state: true },
    rest_: { state: true },
  };
  /** Open: by the person, by what was remembered, by its condition, or as its config says. */
  declare open_: boolean;
  /** Its cards are in the page: from the moment it opens until the fold has closed over them. */
  declare mounted_: boolean;
  /**
   * The fold is drawn open, its chevron up: with the card as it is first drawn, and as soon as it folds; opening
   * later, a frame after its cards are in the page — WebKit moves a row only over cards that are already there, and
   * their first frame is drawn under the fold, where nobody sees it settle.
   */
  declare unfolded_: boolean;
  /** The fold is at rest, not moving: open, nothing is clipped. */
  declare rest_: boolean;

  static override editor(): Promise<CardEditor> {
    return import('./expander-editor.js');
  }

  /** The base's editor with its cards in Home Assistant's own stack editor (`expander-editor.ts`). */
  static override async getConfigElement(): Promise<HTMLElement> {
    const [element, { withCards }] = await Promise.all([
      super.getConfigElement(),
      import('./expander-editor.js'),
    ]);
    return withCards(element);
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): ExpanderCardConfig {
    const picked = entities.filter((id) => /^(light|switch|fan|cover)\./.test(id)).slice(0, 4);
    return {
      type: 'custom:fluvy-expander-card',
      title: 'More',
      entities: picked,
      cards: picked.length
        ? [{ type: 'custom:fluvy-tiles-card', entities: picked, size: 'compact' }]
        : [],
    };
  }

  private readonly head = new HeadFit(this);
  /** The cards as its config lists them, each one a card's config. */
  private cards: readonly LovelaceCardConfig[] = [];
  /** The cards built, by the first opening; kept while it is folded, built anew when the config lists others. */
  private held: Held[] | undefined;
  /** What it is remembered by, and how its config last said it starts (open or folded, and where that is kept). */
  private key = '';
  private stated = '';
  /** A person folded or unfolded it on this page: what is remembered arriving late says nothing any more. */
  private touched = false;
  /** What was remembered has been asked for (the person's waits for the house). */
  private reminded = false;
  /** Its condition opened it, and nobody has touched it since: it folds again when the condition no longer holds. */
  private byCondition = false;
  /** Whether its condition held when last asked (undefined: not asked yet). */
  private holding: boolean | undefined;
  /** The frame its fold waits before it opens, the clock of the fold's motion, and the one that folds it by itself. */
  private unfolding: number | undefined;
  private settling: number | undefined;
  private closing: number | undefined;
  /** Its cards' rows in a masonry view, as they last said. */
  private rows = 0;

  constructor() {
    super();
    this.open_ = false;
    this.mounted_ = false;
    this.unfolded_ = false;
    this.rest_ = true;
  }

  /* ---------- the house ---------- */

  override get hass(): HomeAssistant | undefined {
    return super.hass;
  }

  /** The house, handed on to the cards while they are in the page: every change, not only what the head watches. */
  override set hass(value: HomeAssistant | undefined) {
    super.hass = value;
    if (this.mounted_) for (const card of this.held ?? []) card.hass(value);
  }

  /** The head's count, and the entity its condition reads. */
  protected override watched(): readonly string[] {
    const when = this.config?.open_when;
    return asks(when) ? [...super.watched(), when.entity as string] : super.watched();
  }

  /* ---------- the config ---------- */

  protected override prepare(config: ExpanderCardConfig): ExpanderCardConfig {
    const { cards } = config;
    if (cards !== undefined && !Array.isArray(cards))
      throw new Error('fluvy-expander-card: "cards" must be a list of cards');
    // other cards: those built leave, and the next opening (or this one, open) builds them
    if (JSON.stringify(cards ?? []) !== JSON.stringify(this.cards)) {
      this.cards = cards ?? [];
      this.leave();
      this.held = undefined;
    }
    this.key = expanderKey(config, location.pathname);
    // how it starts: said anew by a config that starts it another way; any other change leaves it as it stands
    const stated = JSON.stringify([config.expanded === true, this.scope(config)]);
    if (stated !== this.stated) {
      this.stated = stated;
      this.touched = false;
      this.reminded = false;
      this.byCondition = false;
      this.holding = undefined;
      this.open_ = config.expanded === true;
      this.remind(config);
    }
    // a wash is a surface's: with none, the cards it holds would wear it on theirs
    return config.style === 'plain'
      ? (Object.fromEntries(
          Object.entries(config).filter(([key]) => key !== 'card_color'),
        ) as ExpanderCardConfig)
      : config;
  }

  private scope(config: ExpanderCardConfig | undefined = this.config): Remember {
    const scope = config?.remember;
    return scope && REMEMBER.includes(scope) ? scope : 'device';
  }

  /**
   * What was remembered, taken as soon as it can be read: at once for this device's, so the first frame is drawn as
   * the person left it; for the person's, once the house is there to ask and Home Assistant answers.
   */
  private remind(config: ExpanderCardConfig | undefined = this.config): void {
    const scope = this.scope(config);
    if (this.reminded || (scope === 'user' && !this.rawHass)) return;
    this.reminded = true;
    const stated = this.stated;
    const take = (open: boolean | undefined): void => {
      // unless the person or another config has spoken meanwhile
      if (open !== undefined && !this.touched && stated === this.stated) this.open_ = open;
    };
    const kept = recall(this.rawHass, scope, this.key);
    if (kept instanceof Promise) void kept.then(take);
    else take(kept);
  }

  private get plain(): boolean {
    return this.config?.style === 'plain';
  }

  /** Without a surface there is nothing to see through. */
  protected override get surface(): boolean {
    return !this.plain;
  }

  /** The room between its cards: the config's, on the 4 grid, else its style's. */
  private gap(): number {
    const asked = Number(this.config?.gap);
    return Number.isFinite(asked) && this.config?.gap !== undefined
      ? Math.min(GAP_MAX, Math.max(0, Math.round(asked / 4) * 4))
      : GAP[this.plain ? 'plain' : 'card'];
  }

  /**
   * Its cards side by side: as many as asked for while each stands `COLUMN_MIN` wide at least — on the surface, its
   * column and the padding it turns out.
   */
  private columns(): number {
    const asked = Math.min(4, Math.max(1, Math.round(Number(this.config?.columns)) || 1));
    const gap = this.gap();
    const out = this.plain ? 0 : 2 * PADDING;
    const room = this.width - out;
    let columns = asked;
    while (columns > 1 && (room - (columns - 1) * gap) / columns + out < COLUMN_MIN) columns--;
    return columns;
  }

  /* ---------- open and folded ---------- */

  /** Open as drawn: in the editor's preview always, so what it holds can be seen while it is edited. */
  private get open(): boolean {
    return this.preview || this.open_;
  }

  /** Whether its condition holds now; false where it asks nothing. */
  private opens(): boolean {
    const when = this.config?.open_when;
    return asks(when) && holds(this.hass, '', when);
  }

  /**
   * Opens or folds it: by a person (remembered, unless it is then as its config says), by its condition (never
   * remembered: the condition says it again), or by its clock.
   */
  private set(open: boolean, by: 'person' | 'condition' | 'clock'): void {
    this.open_ = open;
    this.byCondition = by === 'condition' && open;
    if (by === 'condition' || this.preview) return;
    this.touched = true;
    keep(
      this.rawHass,
      this.scope(),
      this.key,
      open === (this.config?.expanded === true) ? undefined : open,
    );
  }

  private readonly toggle = (): void => {
    haptic(this, 'light');
    this.set(!this.open_, 'person');
  };

  /** Its condition, asked as the house changes: it opens the card as it starts to hold, and folds what it opened. */
  private follow(): void {
    if (!this.hass) return;
    const holding = this.opens();
    if (holding === this.holding) return;
    this.holding = holding;
    if (holding && !this.open_) this.set(true, 'condition');
    else if (!holding && this.byCondition && this.open_) this.set(false, 'condition');
  }

  /** The clock that folds it: started as it opens, stopped as it folds or leaves the page. */
  private wind(): void {
    window.clearTimeout(this.closing);
    this.closing = undefined;
    const minutes = Number(this.config?.close_after);
    if (!this.open_ || this.preview || !this.isConnected || !(minutes > 0)) return;
    this.closing = window.setTimeout(() => {
      this.closing = undefined;
      // its condition still holds: the condition keeps it, and folds it when it no longer does
      if (this.opens()) this.byCondition = true;
      else this.set(false, 'clock');
    }, minutes * 60_000);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.remind();
    if (changed.has('hass') || changed.has('config')) this.follow();
    const open = this.open;
    if (open) this.mounted_ = true;
    // the fold follows: at once as the card is first drawn and as it folds, a frame after its cards when it opens
    if (!this.hasUpdated || !open) this.unfolded_ = open;
    else if (!this.unfolded_)
      this.unfolding ??= requestAnimationFrame(() => {
        this.unfolding = undefined;
        this.unfolded_ = this.open;
      });
    // it moves from the card's second frame on: clipped until it has come to rest, when folded cards leave the page
    if (this.hasUpdated && changed.has('unfolded_')) {
      this.rest_ = false;
      window.clearTimeout(this.settling);
      this.settling = window.setTimeout(() => this.settle(), reducedMotion() ? 0 : MOTION);
    }
    // folded again before its fold had opened: there is no motion to wait out
    else if (!open && this.settling === undefined) this.mounted_ = false;
  }

  /** The fold has come to rest: nothing is clipped any more, or the cards it closed over leave the page. */
  private settle(): void {
    this.settling = undefined;
    this.rest_ = true;
    if (!this.open) this.mounted_ = false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('preview')) for (const card of this.held ?? []) card.preview(this.preview);
    if (changed.has('mounted_') || changed.has('config')) this.stand();
    if (changed.has('open_') || changed.has('config') || changed.has('preview')) this.wind();
  }

  /** Its cards into the page (built by the first opening, told the house as it is now), or out of it. */
  private stand(): void {
    if (!this.mounted_) {
      this.leave();
      return;
    }
    this.held ??= this.cards.map((config) => hold(config, this.rawHass, this.preview));
    for (const card of this.held)
      if (card.element.parentElement !== this) {
        card.hass(this.rawHass);
        this.append(card.element);
      }
    this.gauge();
  }

  private leave(): void {
    for (const { element } of this.held ?? []) element.remove();
    this.gauge();
  }

  /**
   * What follows from which cards show: every one hidden (by its conditions, or by itself), the card hides too, as a
   * stack does — folded, they are not there to say, and the head shows; and their rows, for a masonry view.
   */
  private gauge(): void {
    const held = this.mounted_ ? (this.held ?? []) : [];
    selfHide(this, held.length > 0 && held.every(({ element }) => element.hidden));
    // a card that cannot say its size is one row, as Home Assistant counts it
    const size = async (card: Held): Promise<number> => {
      try {
        return await card.size();
      } catch {
        return 1;
      }
    };
    void Promise.all(held.map(size)).then((sizes) => {
      this.rows = Math.ceil(sizes.reduce((sum, rows) => sum + rows, 0) / this.columns());
    });
  }

  /** A card it holds hid or showed itself: heard here, and said no further (the card says its own). */
  private readonly onVisibility = (event: Event): void => {
    if (event.target === this) return;
    event.stopPropagation();
    this.gauge();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(VISIBILITY_EVENT, this.onVisibility);
    if (this.hasUpdated) this.wind();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(VISIBILITY_EVENT, this.onVisibility);
    window.clearTimeout(this.closing);
    this.closing = undefined;
    // a fold caught moving comes to rest at once: nothing waits on a card that left the page
    if (this.unfolding !== undefined) cancelAnimationFrame(this.unfolding);
    this.unfolding = undefined;
    this.unfolded_ = this.open;
    if (this.settling !== undefined) {
      window.clearTimeout(this.settling);
      this.settle();
    }
  }

  /* ---------- sizes ---------- */

  /** A masonry view's rows: the head folded, the head and what it holds open. */
  override getCardSize(): number {
    return 1 + (this.open ? this.rows : 0);
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 3 };
  }

  /* ---------- render ---------- */

  /**
   * The head: the card's button. A tap folds and unfolds (the default, and a toggle with nothing of its own to
   * toggle); a tap that runs something else leaves the fold to the chevron, a button of its own then. A hold and a
   * double tap are the person's to give, the tap waiting for a second only where a double tap is set (#179).
   */
  private renderHead(open: boolean): TemplateResult {
    const config = this.config as ExpanderCardConfig;
    const hass = this.hass;
    const title = config.title ?? s(hass, 'card');
    const tap = config.tap_action;
    const runs = tap !== undefined && actionRuns(tap);
    const folds = !runs && tap?.action !== 'none';
    const onTap = this.tapper(
      config.double_tap_action,
      'head',
      folds ? this.toggle : runs ? () => this.tap(undefined) : undefined,
      this.runner(config.double_tap_action, undefined),
    );
    const onHold = actionRuns(config.hold_action) ? () => this.hold(undefined) : undefined;
    const press = Boolean(onTap ?? onHold);
    const position: ChevronPosition = config.chevron_position === 'start' ? 'start' : 'end';

    // the line: the person's own words, then the count; a column too narrow lets the count go first, then shortens it
    const ids = config.show_summary === false ? [] : idsOf(config.entities);
    const on = ids.filter((id) => isActive(this.entity(id))).length;
    const count = counted(hass, ids, (id) => this.entity(id));
    const own = this.ownText(config.subtitle);
    const words = own?.text.trim() ? own.text : '';
    const width = this.plain ? this.width : this.contentWidth;
    const fit = (trailing: number): FittedHead =>
      this.head.fit({
        width,
        title,
        sub: [words, count].filter(Boolean).join(' · ') || (own?.text ?? ''),
        shorter: words ? (own?.shorter ?? []) : on > 0 ? onOfShort(hass, on, ids.length) : [],
        trailing,
      });
    // the chevron, a mark, gives way where the name would not keep its floor beside it (a quarter of a section): the
    // name is what the head is; a round of its own is a control, and stays
    const beside = folds ? CHEVRON[position] : ROUND;
    let chevron = config.show_chevron !== false;
    let fitted = fit(chevron ? beside : 0);
    if (chevron && folds) {
      const circle = fitted.icon ? (fitted.small ? CIRCLE_SMALL : CIRCLE) : 0;
      const floor = Math.min(NAME_FLOOR, this.head.ruler.width('fv-card__title', title));
      if (width - circle - beside - HEAD_GAP < floor) {
        chevron = false;
        fitted = fit(0);
      }
    }

    const said = s(hass, open ? 'close' : 'open', { name: title });
    const mark = !chevron
      ? nothing
      : folds
        ? html`<span class="ex-chevron ex-turn" aria-hidden="true">${glyph('chevron')}</span>`
        : html`<button
            class="fv-round fv-round--${this.plain ? 'on-page' : 'quiet'} ex-turn"
            data-control
            data-target
            aria-label=${said}
            aria-expanded=${open ? 'true' : 'false'}
            aria-controls="cards"
            title=${said}
            @click=${this.toggle}
          >
            ${glyph('chevron')}
          </button>`;
    return html`<div
      class="fv-card__head ex-head ${onTap ? 'fv-card__head--tap' : ''} ${onHold ? 'fv-card__head--hold' : ''} ${position === 'start' ? 'ex-head--start' : ''}"
      data-accent=${this.accents.item(config.icon_color) ?? nothing}
      .fvHold=${onHold as PressTarget['fvHold']}
      @pointerdown=${press ? startPress : nothing}
      @contextmenu=${onHold ? preventMenu : nothing}
      @click=${press ? clickHead : nothing}
    >
      ${position === 'start' ? mark : nothing}
      ${
        fitted.icon
          ? ico(
              config.icon ?? 'grid',
              toneOf({ tone: config.tone, color: config.icon_color ?? config.color }),
              { small: fitted.small },
            )
          : nothing
      }
      <div class="fv-card__titles">
        <h3 class="fv-card__title" data-name>
          ${
            onTap
              ? html`<button
                  class="fv-card__tap"
                  data-name
                  aria-expanded=${folds ? (open ? 'true' : 'false') : nothing}
                  aria-controls=${folds ? 'cards' : nothing}
                  title=${folds ? said : fitted.cut ? title : nothing}
                  @click=${onTap}
                  @keydown=${holdKey(onHold)}
                >
                  ${title}
                </button>`
              : title
          }
        </h3>
        ${
          fitted.sub
            ? // the person's own words are a name's: they may end in an ellipsis, where the count never does
              html`<p class="fv-card__sub" data-name=${words ? '' : nothing}>${fitted.sub}</p>`
            : nothing
        }
      </div>
      ${position === 'end' ? mark : nothing}
    </div>`;
  }

  protected renderCard(): TemplateResult | typeof nothing {
    if (!this.config) return nothing;
    const open = this.open;
    const state = `${this.unfolded_ ? 'is-open' : ''} ${this.rest_ ? 'is-rest' : ''}`;
    const body = html`${this.renderHead(open)}
      <div class="ex-body">
        <div class="ex-clip" id="cards" ?inert=${!open}>
          ${
            this.mounted_
              ? html`<div
                  class="ex-cards"
                  style="--ex-columns:${this.columns()};--ex-gap:${this.gap()}px"
                >
                  <slot></slot>
                  ${
                    this.cards.length
                      ? nothing
                      : html`<p class="fv-empty ex-empty">${s(this.hass, 'empty')}</p>`
                  }
                </div>`
              : nothing
          }
        </div>
      </div>`;
    return this.plain
      ? html`<div class="ex-plain ${state}" data-card>${body}</div>`
      : html`<article class="fv-card ex-card ${state}" data-card>${body}</article>`;
  }
}
