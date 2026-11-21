import {
  selfHide,
  strings,
  VISIBILITY_EVENT,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { glyph, reducedMotion } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { hold, type Held } from '../expander/held.js';
import { Card, type CardEditor } from '../shared/base.js';
import type { AliasSpec } from '../shared/config.js';
import {
  swipeCards,
  swipeColumns,
  swipeGap,
  swipeHeight,
  swipeMarks,
  swipeStops,
} from '../swipe-family.js';
import { keep, recall, REMEMBER, swipeKey, type Remember } from './memory.js';
import { theirs } from './theirs.js';

const s = strings('swipe');

/** `card` (the default): one surface holds the pages and their marks. `plain`: no surface, each card keeps its own. */
export type SwipeStyle = 'card' | 'plain';

export interface SwipeCardConfig extends FluvyCardConfig {
  /** The cards, one a page, as a stack's: any card, Fluvy's or not. */
  cards?: readonly LovelaceCardConfig[];
  style?: SwipeStyle;
  /** Its cards in view at once, side by side, 1 (the default) to 4: as many of them as the width holds. */
  columns?: number;
  /** The room between its cards, in px: 40 on its surface (the default), 16 without one; 40 at most. */
  gap?: number;
  /** The page marks under the cards (true), each a button to its page; false draws none. */
  show_indicators?: boolean;
  /** From the last page on to the first, and back: the row goes round. */
  loop?: boolean;
  /** The page it opens on, from 1 (the default): never written by a swipe, which is remembered instead. */
  start?: number;
  /** Where the page a person left it on is kept: this tab, while it is open (the default), or nowhere. */
  remember?: Remember;
  /**
   * Seconds between the turns it makes by itself (3 at least; none, the default: it waits for a person), held while a
   * finger, the pointer or the focus is on it and while it is out of sight; never with reduced motion.
   */
  autoplay?: number;
}

export const STYLES: readonly SwipeStyle[] = ['card', 'plain'];

/** A card's padding, which one held by the surface turns out: its pages reach the surface's edges by it. */
const PADDING = 20;
/** A mark's target, square: what each page mark, and each turn of the counter, takes of the row. */
const TARGET = 44;
/**
 * How far the marks' row reaches into the surface's padding on each side: a target at its end keeps its glyph (20 in
 * the target's 44) on the column's edge, so half a section holds a mark more, and the counter with its two turns.
 */
const REACH = (TARGET - 20) / 2;
/** How much of a page the row must show for it to be the one it is on, and for the row to have come to rest there. */
const SHOWN = 0.5;
const AT_REST = 0.99;
/** A turn further than the next page: the row fades out, stands at the page, and fades in (ms each way). */
const FADE_OUT = 120;
const FADE_IN = 180;
/** Longer than any glide the browser draws to the next page: a turn it never ends lets the row say where it is. */
const GLIDE = 1000;
/** The fewest seconds a page stands before the card turns it by itself: time to read it. */
const AUTOPLAY_FLOOR = 3;

type Turn = 'back' | 'on' | 'first' | 'last';
/** What a key asks of the row: one page back or on (the arrows), the first or the last (Home, End: on its marks). */
const KEYS: Readonly<Record<string, Turn>> = {
  ArrowLeft: 'back',
  ArrowRight: 'on',
  Home: 'first',
  End: 'last',
};

/** What a person holds its clock by (`autoplay`): the pointer over it, the focus in it. */
const HOLDS = ['pointerenter', 'pointerleave', 'focusin', 'focusout'] as const;

/** What keeps the arrow keys for itself inside a page: a field, a slider, a set of choices. */
const KEEPS_KEYS =
  'input, textarea, select, [contenteditable], [role="slider"], [role="listbox"], [role="radiogroup"], [role="tablist"], [role="menu"]';

/**
 * The Swipe card (#206): any cards, one a page, side by side in a row that a finger or a trackpad turns. The row is
 * the browser's own scroll, snapped page by page (CSS scroll snap: no frame of it is drawn by script), and the page it
 * is on is read where one crosses half the row and where it comes to rest (an intersection observer, never a scroll
 * listener). Only the cards in view and the next one on each side are in the page: the others are built the first
 * time they come near and leave again as the row goes on, told nothing of the house meanwhile. A drag that sets off on
 * a ruler, a dial, a slider, a map or a row that scrolls sideways is theirs (`theirs.ts`).
 *
 * Under the cards its page marks (`show_indicators`): a bar each, the page it is on lit, each a target of 44 that
 * turns to its page — or, where the width holds fewer marks than it has pages, the counter ("3 / 12") between a turn
 * back and a turn on. The keys turn it too (the arrows, and Home and End on the marks), and a reader hears each page as
 * a group, "Page 2 of 4", and where a turn came to. `loop` goes round from the last page to the first: the pages are
 * laid out round the one it is on (CSS `order`), so the next one is always beside it, never a rewind. It opens on
 * `start`, and where a person left it is remembered in this tab (`remember`), never written into the config. On one
 * surface (`style: card`, the default) the cards draw none of their own, held as the Expander holds them (`held.ts`);
 * `plain` leaves each its own. It declares its tallest card's height, and stands as tall as the tallest of its pages
 * has stood at its width, so turning to a shorter one never moves what is under it.
 */
export class FluvySwipeCard extends Card<SwipeCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns: its tallest card and its marks. */
  static override layoutHeight(config: LovelaceCardConfig): number {
    return swipeHeight(config);
  }

  static override aliases: AliasSpec = { keys: [{ from: 'slides_per_view', to: 'columns' }] };

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    css`
      /* the page's inks as the card found them, for marks that stand on the page */
      :host {
        --fv-page-text: var(--fluvy-text);
        --fv-page-text-secondary: var(--fluvy-text-secondary);
      }
      .sw-plain {
        position: relative;
        animation: fv-enter 420ms var(--fv-ease-out) both;
        animation-delay: var(--fv-enter-delay, 0ms);
      }
      /* the row: the browser's scroll, a page at a time, never past its ends into the page or the browser's history;
         half the room between its cards stands outside each of them, so the first and the last reach its edges; as
         tall as its tallest page has stood at this width (--sw-tallest), so a shorter one never moves the page */
      .sw-track {
        position: relative;
        display: flex;
        box-sizing: border-box;
        min-height: var(--sw-tallest, 0);
        margin-inline: calc(var(--sw-gap) / -2);
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
      }
      .sw-track::-webkit-scrollbar {
        display: none;
      }
      /* a finger on what is theirs: the row holds still under it until the finger lifts */
      .sw-track.is-held {
        overflow-x: hidden;
      }
      .sw-page {
        flex: 0 0 calc(100% / var(--sw-columns));
        box-sizing: border-box;
        min-width: 0;
        padding-inline: calc(var(--sw-gap) / 2);
        scroll-snap-align: start;
        scroll-snap-stop: always;
      }
      /* the keys brought the focus with the page: its ring inside the row, which would cut one outside it */
      .sw-page:focus-visible {
        outline-offset: -2px;
        border-radius: var(--fluvy-radius-card);
      }
      /* on the page, a card's focus ring and its edge are not cut by the row */
      .sw-plain > .sw-track {
        margin-block: -4px;
        padding-block: 4px;
      }
      /* on the surface the row reaches its edges, its top and, without marks, its foot: a card held there turns its
         padding out into the surface's, so its column is the card's; the 20 under it is the marks' where they are */
      .sw-card:not(.is-empty) {
        padding-bottom: 0;
      }
      .sw-card > .sw-track {
        margin-top: -${PADDING}px;
        padding-block: ${PADDING}px;
      }
      /* the cards on the surface draw none of their own, as the Expander's do (expander-card.ts): a card of Fluvy's
         is held (--fv-held) and turns its padding out (--fv-held-bleed), one of Home Assistant's wears none
         (--ha-card-*); what stood on the page stands on the card, in the card's inks */
      .sw-card .sw-page {
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
      /* a card that is not Fluvy's keeps its own padding: turned out as far as that, Home Assistant's 16 as most have
         it, less above and below; what one of its own cards pads its content by instead, where held.ts knows it */
      .sw-card ::slotted(.ex-other) {
        --ex-x: 16px;
        --ex-y: 12px;
        margin: calc(-1 * var(--ex-y)) calc(-1 * var(--ex-x));
      }
      /* what Home Assistant draws as a tile keeps its surface, a tile of Fluvy's */
      .sw-card ::slotted(.ex-tile) {
        --ha-card-background: var(--fluvy-card);
        --ha-card-border-width: 1px;
        --ha-card-border-color: var(--fluvy-edge, var(--fluvy-border));
        --ha-card-border-radius: var(--fluvy-radius-lg);
      }
      .sw-empty {
        line-height: 20px;
      }
      /* the marks: a row of targets of 44, centred under the cards; on the surface its 44 take the 20 under the
         cards', so a mark stands 20 under them and 20 over the surface's edge, and the row reaches 12 into the
         surface's padding at each side (REACH); on the page, 44 under them */
      .sw-marks {
        display: flex;
        justify-content: center;
        align-items: center;
        height: ${TARGET}px;
        pointer-events: none;
      }
      .sw-card > .sw-marks {
        position: relative;
        margin: -${PADDING}px -${REACH}px 0;
      }
      .sw-mark,
      .sw-turn {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: ${TARGET}px;
        height: ${TARGET}px;
        border-radius: var(--fluvy-radius-control);
        color: var(--fluvy-text-secondary);
        pointer-events: auto;
      }
      /* a mark is a bar: 16 by 4 at rest in the strong hairline's ink, the page it is on 28 and lit in the card's
         colour (the palette's accent by default), the bar growing in its place */
      .sw-mark::before {
        content: '';
        width: 16px;
        height: 4px;
        border-radius: 2px;
        background: var(--fluvy-border-strong);
        transition:
          width var(--fv-base) var(--fv-ease),
          background-color var(--fv-base) var(--fv-ease);
      }
      .sw-mark.is-on::before {
        width: 28px;
        background: var(--fluvy-accent);
      }
      /* on the page, in the ink its background asks for */
      .sw-plain .sw-mark::before {
        background: color-mix(
          in oklab,
          var(--fluvy-page-ink-2, var(--fv-page-text-secondary)) 45%,
          transparent
        );
      }
      .sw-plain .sw-mark.is-on::before {
        background: var(--fluvy-page-ink, var(--fluvy-accent));
      }
      @media (hover: hover) {
        .sw-mark:not(.is-on):hover::before {
          background: var(--fluvy-text-secondary);
        }
        .sw-turn:not(:disabled):hover {
          color: var(--fluvy-text);
        }
      }
      /* more pages than the width holds marks for: the counter between a turn back and a turn on, chevrons in the
         secondary ink with no round of their own, so they stand in the marks' room */
      .sw-turn svg {
        width: 20px;
        height: 20px;
      }
      .sw-turn:disabled {
        opacity: 0.4;
      }
      :host(:dir(rtl)) .sw-turn svg {
        transform: scaleX(-1);
      }
      .sw-count {
        color: var(--fluvy-text-secondary);
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        line-height: 20px;
        text-align: center;
      }
      .sw-plain :is(.sw-turn, .sw-count) {
        color: var(--fluvy-page-ink-2, var(--fv-page-text-secondary));
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    at_: { state: true },
    anchor_: { state: true },
    hidden_: { state: true },
    said_: { state: true },
  };
  /** The page it is on: its card's place in `cards`, the first of those in view. */
  declare at_: number;
  /** With `loop`, the page the row is laid out round, in its middle: the page it is on, once it has come to rest. */
  declare anchor_: number;
  /** The pages whose card hides itself (its `visibility`, or by itself): left out of the row and its marks. */
  declare hidden_: ReadonlySet<number>;
  /** What a reader hears where a turn came to rest: "Page 2 of 4". */
  declare said_: string;

  static override editor(): Promise<CardEditor> {
    return import('./swipe-editor.js');
  }

  /** The base's editor with its cards in Home Assistant's own stack editor, as the Expander's (`swipe-editor.ts`). */
  static override async getConfigElement(): Promise<HTMLElement> {
    const [element, { withPages }] = await Promise.all([
      super.getConfigElement(),
      import('./swipe-editor.js'),
    ]);
    return withPages(element);
  }

  static getStubConfig(
    _hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): SwipeCardConfig {
    const picked = entities.filter((id) => /^(light|switch|fan|cover)\./.test(id)).slice(0, 3);
    return {
      type: 'custom:fluvy-swipe-card',
      cards: picked.map((entity) => ({ type: 'custom:fluvy-tile-card', entity })),
    };
  }

  /** The cards as its config lists them, one a page; and those built, by their place (none until it first comes near). */
  private cards: readonly LovelaceCardConfig[] = [];
  private held: (Held | undefined)[] = [];
  /** What it is remembered by, and how its config last said it starts (its page, and whether that is kept). */
  private key = '';
  private stated = '';
  /** The row has been brought to the page it opens on: what it reads of where it is counts from then. */
  private placed = false;
  /** The page it last came to rest on (none since it was placed): a turn is said, and kept, where it comes to another. */
  private rested: number | undefined;
  /** How much of each page the row shows, as the observer last said (`SHOWN`, `AT_REST`). */
  private readonly ratios = new Map<number, number>();
  private observer: IntersectionObserver | undefined;
  /** A finger is on the row: it is not laid out again under it. */
  private touching = false;
  /** A turn further than the next page is fading: what the row passes on the way says nothing. */
  private jumping = false;
  /**
   * The page a turn glides to, already the one it is on: what the row passes on the way says nothing until it shows
   * whole, a finger takes the row, or the glide's time is over (`GLIDE`).
   */
  private heading: number | undefined;
  private gliding: number | undefined;
  /** Laid out round another page with `loop`: how far the row stood from the page it is on, to stand so again. */
  private offset: number | undefined;
  /** How tall the row has stood at this width: it stays so as its cards leave the page (`--sw-tallest`). */
  private tallest = 0;
  /**
   * Turning by itself (`autoplay`): its clock, what holds it (the pointer over it, the focus in it, out of sight), and
   * whether the last turn was the clock's, which is neither said nor remembered.
   */
  private clock: number | undefined;
  private over = false;
  private within = false;
  private inSight = true;
  private sightline: IntersectionObserver | undefined;
  private ticked = false;

  constructor() {
    super();
    this.at_ = 0;
    this.anchor_ = 0;
    this.hidden_ = new Set();
    this.said_ = '';
  }

  /* ---------- the house ---------- */

  override get hass(): HomeAssistant | undefined {
    return super.hass;
  }

  /** The house, handed on to the cards in the page: every change, not only what the card itself watches. */
  override set hass(value: HomeAssistant | undefined) {
    super.hass = value;
    for (const card of this.held) if (card?.element.parentElement === this) card.hass(value);
  }

  /* ---------- the config ---------- */

  protected override prepare(config: SwipeCardConfig): SwipeCardConfig {
    if (config.cards !== undefined && !Array.isArray(config.cards))
      throw new Error('fluvy-swipe-card: "cards" must be a list of cards');
    const cards = swipeCards(config);
    // other cards: those built leave, and the row builds the new ones as they come near
    if (JSON.stringify(cards) !== JSON.stringify(this.cards)) {
      for (const card of this.held) card?.element.remove();
      this.held = [];
      this.cards = cards;
      this.hidden_ = new Set();
      this.placed = false;
    }
    this.key = swipeKey(cards, location.pathname);
    // where it starts: said anew by a config that starts it elsewhere; any other change leaves it where it stands
    const stated = JSON.stringify([config.start, this.scope(config), cards.length]);
    if (stated !== this.stated) {
      this.stated = stated;
      const kept = this.scope(config) === 'session' ? recall(this.key) : undefined;
      this.at_ = Math.max(0, Math.min(cards.length - 1, kept ?? this.startOf(config)));
      this.anchor_ = this.at_;
      this.placed = false;
    }
    // a wash is a surface's: with none, the cards it holds would wear it on theirs
    return config.style === 'plain'
      ? (Object.fromEntries(
          Object.entries(config).filter(([key]) => key !== 'card_color'),
        ) as SwipeCardConfig)
      : config;
  }

  private scope(config: SwipeCardConfig | undefined = this.config): Remember {
    const scope = config?.remember;
    return scope && REMEMBER.includes(scope) ? scope : 'session';
  }

  /** The page its config opens it on: `start`, counted from 1, as a card's place in `cards`. */
  private startOf(config: SwipeCardConfig | undefined = this.config): number {
    const start = Math.round(Number(config?.start));
    return Math.max(0, Math.min(this.cards.length - 1, Number.isFinite(start) ? start - 1 : 0));
  }

  private get plain(): boolean {
    return this.config?.style === 'plain';
  }

  /** Without a surface there is nothing to see through. */
  protected override get surface(): boolean {
    return !this.plain;
  }

  /* ---------- the row ---------- */

  /** The pages that show, in their order: a card hidden by its conditions, or by itself, is no page. */
  private get ring(): number[] {
    return this.cards.flatMap((_, page) => (this.hidden_.has(page) ? [] : [page]));
  }

  /** Its cards in view at once: as many as asked for while each keeps its width, and no more than it has pages. */
  private get columns(): number {
    const config = this.config;
    return config ? Math.max(1, Math.min(this.ring.length, swipeColumns(config, this.width))) : 1;
  }

  /** It goes round: asked to, with more pages than it shows at once. */
  private get loops(): boolean {
    return this.config?.loop === true && this.ring.length > this.columns;
  }

  /** Where its row can stand (`swipeStops`): what its marks count. */
  private get stops(): number {
    return this.config ? swipeStops(this.config, this.ring.length, this.columns) : 1;
  }

  /** The stop it is on: the place of its page among those that show, never past the last stop. */
  private get stop(): number {
    return Math.max(0, Math.min(this.stops - 1, this.ring.indexOf(this.at_)));
  }

  /**
   * Where a page stands in the row, from its start: in order; with `loop`, round the page it is laid out round
   * (`anchor_`), which stands in the row's middle, so there are pages on both sides of it.
   */
  private placeOf(page: number): number {
    const ring = this.ring;
    const at = ring.indexOf(page);
    if (!this.loops) return at;
    const middle = Math.floor((ring.length - this.columns) / 2);
    return (at - Math.max(0, ring.indexOf(this.anchor_)) + middle + ring.length) % ring.length;
  }

  /** The pages `from` steps from the one it is on `to` steps from it (round the row with `loop`; none past an end). */
  private around(from: number, to: number): number[] {
    const ring = this.ring;
    const at = ring.indexOf(this.at_);
    const pages: number[] = [];
    for (let step = from; step <= to; step++) {
      const page = ring[this.loops ? (at + step + ring.length) % ring.length : at + step];
      if (page !== undefined && !pages.includes(page)) pages.push(page);
    }
    return pages;
  }

  private get track(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.sw-track');
  }

  private pageOf(page: number): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`.sw-page[data-page="${page}"]`);
  }

  /** Where the row stands with `page` first in view: the page's start on the row's (its end, right to left). */
  private leftOf(page: number): number | undefined {
    const track = this.track;
    const box = this.pageOf(page);
    if (!track || !box) return undefined;
    return getComputedStyle(track).direction === 'rtl'
      ? box.offsetLeft + box.offsetWidth - track.clientWidth
      : box.offsetLeft;
  }

  /** The row brought to `page`: gliding, or at once. */
  private toPage(page: number, behavior: ScrollBehavior): void {
    const left = this.leftOf(page);
    if (left !== undefined) this.track?.scrollTo({ left, behavior });
  }

  /**
   * A person turns it to `page`, which is the page it is on from then (its mark lit, its neighbours built, the focus
   * free to go to it): the next page glides in (at once with reduced motion) once the cards round it stand in the
   * row, since WebKit drops a glide begun in the frame its pages change and the row stayed where it was, its marks on
   * the next page, the page it left emptied a turn later (#235); one further fades the row out, stands it there with
   * that page and its neighbours in the page, and fades it in — never a long slide past pages that are not there.
   */
  private go(page: number): void {
    if (page === this.at_ || !this.track || this.jumping) return;
    if (Math.abs(this.placeOf(page) - this.placeOf(this.at_)) !== 1) {
      void this.jump(page);
      return;
    }
    this.at_ = page;
    this.head(page);
    void this.updateComplete.then(() => this.toPage(page, reducedMotion() ? 'instant' : 'smooth'));
  }

  /** The row glides to `page` (none: it is the person's again), and says nothing on the way. */
  private head(page: number | undefined): void {
    window.clearTimeout(this.gliding);
    this.heading = page;
    this.gliding =
      page === undefined ? undefined : window.setTimeout(() => this.head(undefined), GLIDE);
  }

  private async jump(page: number): Promise<void> {
    const track = this.track;
    if (!track) return;
    const fades = !reducedMotion() && typeof track.animate === 'function';
    this.jumping = true;
    if (fades)
      await track
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT, easing: 'ease-in' })
        .finished.catch(() => undefined);
    this.at_ = page;
    if (this.loops) this.anchor_ = page;
    await this.updateComplete;
    this.toPage(page, 'instant');
    this.jumping = false;
    if (fades)
      track.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN, easing: 'ease-out' });
  }

  /** One stop on or back (round with `loop`, else no further than an end), or the first or the last: the stop. */
  private turn(to: Turn): number {
    const stops = this.stops;
    const next =
      to === 'first' ? 0 : to === 'last' ? stops - 1 : this.stop + (to === 'on' ? 1 : -1);
    const stop = this.loops ? (next + stops) % stops : Math.max(0, Math.min(stops - 1, next));
    const page = this.ring[stop];
    if (page !== undefined) this.go(page);
    return stop;
  }

  /* ---------- where it is ---------- */

  /**
   * What the observer says of each page: the first in the row that shows half of itself is the page it is on; where
   * that one shows whole, the row has come to rest.
   */
  private readonly onSight = (entries: IntersectionObserverEntry[]): void => {
    for (const { target, intersectionRatio } of entries)
      this.ratios.set(Number((target as HTMLElement).dataset['page']), intersectionRatio);
    if (this.jumping) return;
    if (this.heading !== undefined) {
      if ((this.ratios.get(this.heading) ?? 0) < AT_REST) return;
      this.head(undefined);
    }
    const first = this.ring
      .filter((page) => (this.ratios.get(page) ?? 0) >= SHOWN)
      .sort((a, b) => this.placeOf(a) - this.placeOf(b))[0];
    if (first !== undefined && first !== this.at_) this.at_ = first;
    this.rest();
  };

  /**
   * Come to rest on a page, no finger on the row: with `loop` it is laid out round that page again (the row standing
   * where it stood against it, so nothing moves); on another page than the last it rested on, the page is said, and
   * remembered (forgotten where it is the one it starts on). Where it was placed says nothing.
   */
  private rest(): void {
    if (this.touching || (this.ratios.get(this.at_) ?? 0) < AT_REST) return;
    if (this.loops && this.anchor_ !== this.at_) {
      const track = this.track;
      const left = this.leftOf(this.at_);
      if (track && left !== undefined) this.offset = track.scrollLeft - left;
      this.anchor_ = this.at_;
    }
    if (this.at_ === this.rested) return;
    const placed = this.rested === undefined;
    const ticked = this.ticked;
    this.rested = this.at_;
    this.ticked = false;
    this.wind();
    if (placed || ticked) return;
    this.said_ = s(this.hass, 'page', { n: this.stop + 1, count: this.stops });
    if (this.scope() === 'session' && !this.preview)
      keep(this.key, this.at_ === this.startOf() ? undefined : this.at_);
  }

  /**
   * Its clock (`autoplay`), wound anew where the row comes to rest, so a page a person turned to stands its time too:
   * none in the editor's preview, with reduced motion, or with one stop.
   */
  private wind(): void {
    window.clearTimeout(this.clock);
    this.clock = undefined;
    const seconds = Number(this.config?.autoplay);
    if (!(seconds > 0) || !this.isConnected || this.preview || reducedMotion() || this.stops < 2)
      return;
    if (!this.sightline && typeof IntersectionObserver === 'function') {
      this.sightline = new IntersectionObserver(([entry]) => {
        this.inSight = entry?.isIntersecting ?? true;
      });
      this.sightline.observe(this);
    }
    this.clock = window.setTimeout(this.tick, Math.max(AUTOPLAY_FLOOR, seconds) * 1000);
  }

  /** The clock's turn: on (from the last back to the first), unless a person or the page holds it; then it waits on. */
  private readonly tick = (): void => {
    const held =
      this.touching ||
      this.over ||
      this.within ||
      !this.inSight ||
      document.hidden ||
      this.jumping ||
      this.heading !== undefined;
    if (!held) {
      this.ticked = true;
      this.turn(!this.loops && this.stop === this.stops - 1 ? 'first' : 'on');
    }
    this.wind();
  };

  /** What holds its clock: the pointer over it (a mouse's: a finger is `touching`), the focus in it. */
  private readonly onHold = (event: Event): void => {
    if (event.type === 'focusin' || event.type === 'focusout')
      this.within = event.type === 'focusin';
    else if ((event as PointerEvent).pointerType === 'mouse')
      this.over = event.type === 'pointerenter';
  };

  /** The row's pages watched, from where it stands: anew as other pages are drawn. */
  private watch(): void {
    this.observer?.disconnect();
    this.ratios.clear();
    const track = this.track;
    if (!track || typeof IntersectionObserver !== 'function') return;
    this.observer = new IntersectionObserver(this.onSight, {
      root: track,
      threshold: [SHOWN, AT_REST],
    });
    for (const page of track.querySelectorAll('.sw-page')) this.observer.observe(page);
  }

  /** A finger or a pen on the row: on what is theirs, the row holds still until it lifts (`theirs.ts`). */
  private readonly onPress = (event: PointerEvent): void => {
    const track = event.currentTarget as HTMLElement;
    if (event.pointerType === 'mouse' || !theirs(event.composedPath(), track)) return;
    track.classList.add('is-held');
    const free = (): void => {
      track.classList.remove('is-held');
      window.removeEventListener('pointerup', free);
      window.removeEventListener('pointercancel', free);
    };
    window.addEventListener('pointerup', free);
    window.addEventListener('pointercancel', free);
  };

  /**
   * Whether a finger is on the row, heard without holding up its scroll: it takes the row from a turn's glide, and
   * lifted, the row may have come to rest.
   */
  private readonly touches = {
    handleEvent: (event: TouchEvent): void => {
      this.touching = event.touches.length > 0;
      if (this.touching) this.head(undefined);
      else this.rest();
    },
    passive: true,
  };

  /**
   * A key on its marks, or from a page whose control keeps no arrows: the row turns, and the focus goes with it — to
   * the mark of the page it came to, or to that page itself, where it would stay behind in one leaving view.
   */
  private readonly onKey = (event: KeyboardEvent): void => {
    const asked = KEYS[event.key];
    if (!asked || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const marks = (event.currentTarget as HTMLElement).classList.contains('sw-marks');
    if (!marks) {
      const path = event.composedPath();
      const own = path.slice(0, path.indexOf(event.currentTarget as EventTarget));
      if (asked === 'first' || asked === 'last') return;
      if (own.some((target) => target instanceof Element && target.matches(KEEPS_KEYS))) return;
    }
    event.preventDefault();
    const rtl = getComputedStyle(this).direction === 'rtl';
    const stop = this.turn(rtl && asked === 'back' ? 'on' : rtl && asked === 'on' ? 'back' : asked);
    void this.updateComplete.then(() =>
      (marks
        ? this.renderRoot.querySelectorAll<HTMLElement>('.sw-mark')[stop]
        : this.pageOf(this.at_)
      )?.focus({ preventScroll: true }),
    );
  };

  /* ---------- its cards ---------- */

  /**
   * Its cards into the page: those in view and the next one on each side (round the row with `loop`), each built the
   * first time it comes near and told the house as it is now; the rest leave it, the row keeping the height it stood
   * at with them. A card with conditions of its own (`visibility`) is in the page from the first frame, so the row
   * knows whether it is one of its pages; one that hides itself stays, in its page that is no page, to show itself
   * again.
   */
  private stand(): void {
    const near = new Set([
      ...this.around(-1, this.columns),
      ...this.cards.flatMap((card, page) => (card['visibility'] ? [page] : [])),
    ]);
    const leaving = this.held.filter(
      (card, page) =>
        card?.element.parentElement === this && !near.has(page) && !card.element.hidden,
    );
    if (leaving.length) this.standTall();
    for (const card of leaving) card?.element.remove();
    this.cards.forEach((config, page) => {
      if (!near.has(page) && !this.held[page]?.element.hidden) return;
      const built = (this.held[page] ??= this.build(config, page));
      if (built.element.parentElement !== this) {
        built.hass(this.rawHass);
        this.append(built.element);
      }
    });
  }

  /** The row keeps the height it stands at now, its tallest at this width: its pages to come stand in it. */
  private standTall(): void {
    const height = Math.ceil(this.track?.getBoundingClientRect().height ?? 0);
    if (height <= this.tallest) return;
    this.tallest = height;
    this.style.setProperty('--sw-tallest', `${height}px`);
  }

  private build(config: LovelaceCardConfig, page: number): Held {
    const card = hold(config, this.rawHass, this.preview);
    card.element.slot = `p${page}`;
    return card;
  }

  /**
   * A card it holds hid or showed itself: heard here and said no further (the card says its own). Its page leaves the
   * row or comes back, the row going on to the next page where its own left; every card hidden, it hides too, as a
   * stack does.
   */
  private readonly onVisibility = (event: Event): void => {
    if (event.target === this) return;
    event.stopPropagation();
    this.sight();
  };

  /**
   * Which of its cards are hidden, as they say of themselves (as they were built, too: Home Assistant's wrapper reads
   * its conditions before it is in the page, and says nothing of them then): true where that changed.
   */
  private sight(): boolean {
    const hidden = this.cards.flatMap((_, page) => (this.held[page]?.element.hidden ? [page] : []));
    if (hidden.join() === [...this.hidden_].join()) return false;
    this.hidden_ = new Set(hidden);
    selfHide(this, this.cards.length > 0 && hidden.length === this.cards.length);
    const ring = this.ring;
    if (this.hidden_.has(this.at_))
      this.at_ = ring.find((page) => page > this.at_) ?? ring.at(-1) ?? this.at_;
    return true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(VISIBILITY_EVENT, this.onVisibility);
    for (const type of HOLDS) this.addEventListener(type, this.onHold);
    // back in the page: placed again where it was, and watched from there
    this.placed = false;
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(VISIBILITY_EVENT, this.onVisibility);
    for (const type of HOLDS) this.removeEventListener(type, this.onHold);
    this.observer?.disconnect();
    this.observer = undefined;
    this.sightline?.disconnect();
    this.sightline = undefined;
    window.clearTimeout(this.clock);
    this.clock = undefined;
    this.touching = false;
    this.jumping = false;
    this.head(undefined);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // another width lays its cards out anew: the row's height is theirs again
    if (changed.has('width') || changed.has('config')) {
      this.tallest = 0;
      this.style.removeProperty('--sw-tallest');
    }
    // its cards into the page, and again where those just built hide themselves: another page is then the next
    this.stand();
    if (this.sight()) this.stand();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('preview')) for (const card of this.held) card?.preview(this.preview);
    if (changed.has('config') || changed.has('preview')) this.wind();
    const track = this.track;
    // brought to the page it opens on once the row has a width, and watched from there
    if (!this.placed && track && track.clientWidth > 0) {
      this.placed = true;
      this.rested = undefined;
      this.toPage(this.at_, 'instant');
      this.watch();
    } else if (changed.has('config') || changed.has('hidden_')) this.watch();
    // laid out round another page: the row stands where it stood against the page it is on
    if (this.offset !== undefined && track) {
      const left = this.leftOf(this.at_);
      if (left !== undefined) track.scrollTo({ left: left + this.offset, behavior: 'instant' });
      this.offset = undefined;
    }
  }

  /* ---------- sizes ---------- */

  /** A masonry view's rows: its height, in rows of 50. */
  override getCardSize(): number {
    return this.config ? Math.max(1, Math.ceil(swipeHeight(this.config) / 50)) : 1;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- render ---------- */

  /** The marks' row: the column's width, and on the surface what it reaches into its padding (`REACH`). */
  private get marksWidth(): number {
    return this.plain ? this.width : this.contentWidth + 2 * REACH;
  }

  /** The page marks, or the counter where the width holds fewer marks than the row has stops. */
  private renderMarks(): TemplateResult | typeof nothing {
    const config = this.config as SwipeCardConfig;
    const stops = this.stops;
    if (!swipeMarks(config, stops)) return nothing;
    const hass = this.hass;
    const stop = this.stop;
    const label = s(hass, 'pages');
    if (stops * TARGET <= this.marksWidth)
      return html`<div class="sw-marks" role="group" aria-label=${label} @keydown=${this.onKey}>
        ${Array.from({ length: stops }, (_, place) => {
          const on = place === stop;
          return html`<button
            class="sw-mark ${on ? 'is-on' : ''}"
            data-control
            tabindex=${on ? 0 : -1}
            aria-label=${s(hass, 'page', { n: place + 1, count: stops })}
            aria-current=${on ? 'true' : nothing}
            @click=${() => this.go(this.ring[place] ?? this.at_)}
          ></button>`;
        })}
      </div>`;
    const loops = this.loops;
    return html`<div class="sw-marks" role="group" aria-label=${label} @keydown=${this.onKey}>
      <button
        class="sw-turn"
        data-control
        aria-label=${s(hass, 'previous')}
        ?disabled=${!loops && stop === 0}
        @click=${() => this.turn('back')}
      >
        ${glyph('chevronLeft')}
      </button>
      <span class="sw-count" aria-hidden="true"
        >${s(hass, 'counter', { n: stop + 1, count: stops })}</span
      >
      <button
        class="sw-turn"
        data-control
        aria-label=${s(hass, 'next')}
        ?disabled=${!loops && stop === stops - 1}
        @click=${() => this.turn('on')}
      >
        ${glyph('chevron')}
      </button>
    </div>`;
  }

  /**
   * The row of pages, each a group a reader hears ("Page 2 of 4"), in its place (`placeOf`), those out of view inert;
   * the marks under it, and what a reader hears where a turn came to.
   */
  private renderRow(config: SwipeCardConfig): TemplateResult {
    const hass = this.hass;
    const ring = this.ring;
    const inView = new Set(this.around(0, this.columns - 1));
    return html`<div
        class="sw-track"
        data-scroll-row
        style="--sw-columns:${this.columns};--sw-gap:${swipeGap(config)}px"
        @pointerdown=${this.onPress}
        @touchstart=${this.touches}
        @touchend=${this.touches}
        @touchcancel=${this.touches}
        @keydown=${this.onKey}
      >
        ${this.cards.map((_, page) => {
          const place = ring.indexOf(page);
          return html`<div
            class="sw-page"
            data-page=${page}
            role="group"
            tabindex="-1"
            aria-label=${s(hass, 'page', { n: place + 1, count: ring.length })}
            style="order:${place < 0 ? 0 : this.placeOf(page)}"
            ?hidden=${place < 0}
            ?inert=${!inView.has(page)}
          >
            <slot name="p${page}"></slot>
          </div>`;
        })}
      </div>
      ${this.renderMarks()}
      <p class="fv-sr" aria-live="polite">${this.said_}</p>`;
  }

  protected renderCard(): TemplateResult | typeof nothing {
    const config = this.config;
    if (!config) return nothing;
    const empty = !this.cards.length;
    const body = empty
      ? html`<p class="fv-empty sw-empty">${s(this.hass, 'empty')}</p>`
      : this.renderRow(config);
    return this.plain
      ? html`<div class="sw-plain" data-card>${body}</div>`
      : html`<article class="fv-card sw-card ${empty ? 'is-empty' : ''}" data-card>
          ${body}
        </article>`;
  }
}
