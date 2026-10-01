import { badge, emptyState, type Tone } from '@fluvy/ui';
import { nothing, type LitElement, type ReactiveController, type TemplateResult } from 'lit';
import { fitLine, TextRuler, type Segment } from '../shared/fit.js';
import { FontsSettled } from '../shared/fonts.js';

/* the head's geometry (fluvy.css): a 44 icon and a 12 gap before the titles, a 12 gap before what trails them */
const ICON = 44 + 12;
const GAP = 12;
const BADGE_SIDES = 28;

export interface HeadFitOptions {
  /** Content width of the card. */
  readonly width: number;
  readonly title: string;
  readonly sub?: string | undefined;
  /** The badge that trails the titles, if any. */
  readonly badge?: { readonly text: string; readonly tone: Tone } | null | undefined;
  /** Width of a fixed trailing element instead (a 44 round, a 96 nav pair). */
  readonly trailing?: number;
}

export interface FittedHead {
  /** Empty when there is no sub (what `head()` reads as none). */
  readonly sub: string;
  /** The badge to put in the trailing slot — `nothing` when it had to step aside. */
  readonly badge: TemplateResult | typeof nothing;
  /** False when the title needed the icon circle's room too: `head({ icon: null })` draws none. */
  readonly icon: boolean;
}

/**
 * Fits a card head to its column before it is rendered, so nothing in it is ever clipped: the title
 * is the card's name and stays whole; what gives way has an order — the badge first (the state a badge
 * carries is one every card of this family also shows in its body), then the sub's trailing " · "
 * segments ("South roof · 5.4 kWp" → "South roof"), then the icon circle: a title — or a sub's first
 * segment — that still does not fit in a column of 172 takes its room (a chart card's icon is
 * decoration; the chart says what the card is).
 *
 * Widths are laid out by the browser in the card's own classes (`TextRuler`), never guessed, and
 * measured again when a web font lands. One instance per card: `private readonly head = new HeadFit(this)`.
 */
/** A switch at the head's end: its 56 × 44 hit (`.fv-hit`), not the 48 track — the room a head fit must keep for it. */
export const SWITCH_SLOT = 56;

export class HeadFit implements ReactiveController {
  /** The card's text ruler (measured again when a font lands): what else the card fits may share it. */
  readonly ruler: TextRuler;

  constructor(private readonly host: LitElement) {
    this.ruler = new TextRuler(() => host.renderRoot as ParentNode | undefined);
    host.addController(this);
    // a face that arrives after the first render changes every width: measure afresh and lay the head out again
    new FontsSettled(host, () => {
      this.ruler.clear();
      this.host.requestUpdate();
    });
  }

  hostConnected(): void {}

  fit(o: HeadFitOptions): FittedHead {
    const pill = o.badge ? this.ruler.pill('fv-badge', o.badge.text, BADGE_SIDES) : 0;
    let trailing = o.badge ? pill : (o.trailing ?? 0);
    let keepIcon = true;
    const room = (): number =>
      o.width - (keepIcon ? ICON : 0) - (trailing > 0 ? trailing + GAP : 0);
    let keepBadge = Boolean(o.badge);

    if (keepBadge && this.ruler.width('fv-card__title', o.title) > room()) {
      keepBadge = false;
      trailing = 0;
    }

    // what gives way has an order (design/language.md § Header pattern): the badge first — its state is in the body
    // too — then the sub's trailing segments, then the icon circle
    if (o.sub && keepBadge && this.ruler.width('fv-card__sub', o.sub) > room()) {
      keepBadge = false;
      trailing = 0;
    }
    let sub = o.sub ? this.fitSub(o.sub, room()) : '';

    // the title, or the sub's first segment (a period's "Desde medianoche"), needs the circle's room too
    if (
      this.ruler.width('fv-card__title', o.title) > room() ||
      (sub !== '' && this.ruler.width('fv-card__sub', sub) > room())
    ) {
      keepIcon = false;
      sub = o.sub ? this.fitSub(o.sub, room()) : '';
    }

    return {
      sub,
      badge: keepBadge && o.badge ? badge(o.badge.text, o.badge.tone) : nothing,
      icon: keepIcon,
    };
  }

  /** "A · B · C" keeps A, then as many of the rest as the room holds. */
  private fitSub(sub: string, room: number): string {
    const segments: Segment[] = sub
      .split(' · ')
      .map((text, index) => ({ text, optional: index > 0 }));
    return fitLine(segments, room, (text) => this.ruler.width('fv-card__sub', text));
  }

  /** Room for a row's second line beside its value (`fv-row`: a 44 circle and two 12 gaps). */
  rowRoom(width: number, value: string): number {
    return width - ICON - GAP - (value ? this.ruler.width('fv-row__value', value) : 0);
  }

  /** A row's second line fitted to `room`: segments after the first go, from the end, before anything is clipped. */
  fitRowSub(sub: string, room: number): string {
    return this.fitRowSegments(
      sub.split(' · ').map((text, index) => ({ text, optional: index > 0 })),
      room,
    );
  }

  /** The same with the caller's own priorities: optional segments leave from the end, required ones stay. */
  fitRowSegments(segments: readonly Segment[], room: number): string {
    return fitLine(segments, room, (text) => this.ruler.width('fv-row__sub', text));
  }

  /**
   * An empty card's panel: what is missing in one line, and how to fix it as the hint under it — left out where it
   * would run past two lines (half a column), as the panel stays a panel and not a page of words.
   */
  empty(glyph: string, text: string, hint: string, width: number): TemplateResult {
    const room = Math.min(EMPTY_HINT_MAX, width - EMPTY_SIDES);
    const fits = this.ruler.width('fv-empty-state__hint', hint) <= room * EMPTY_TWO_LINES;
    return emptyState(glyph, text, fits ? hint : '');
  }
}

/** The hint's measure (`.fv-empty-state__hint` max-width), the panel's padding both sides, and two lines of it less
 * what wrapping by words loses. */
const EMPTY_HINT_MAX = 380;
const EMPTY_SIDES = 32;
const EMPTY_TWO_LINES = 1.8;
