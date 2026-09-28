import { badge, type Tone } from '@fluvy/ui';
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
 * is the card's name and stays whole — the badge steps aside if the title needs the room; the sub is
 * context and gives up its trailing " · " segments first ("South roof · 5.4 kWp" → "South roof"); a
 * sub that cannot fit beside the badge even as its first segment sends the badge aside too, since the
 * state a badge carries is one every card of this family also shows in its body. The icon circle is
 * the last to go: a title that still does not fit in a column of 172 takes its room (a chart card's
 * icon is decoration; the chart says what the card is).
 *
 * Widths are laid out by the browser in the card's own classes (`TextRuler`), never guessed, and
 * measured again when a web font lands. One instance per card: `private readonly head = new HeadFit(this)`.
 */
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

    let sub = o.sub ? this.fitSub(o.sub, room()) : '';
    if (sub && keepBadge && this.ruler.width('fv-card__sub', sub) > room()) {
      keepBadge = false;
      trailing = 0;
      sub = this.fitSub(o.sub ?? '', room());
    }

    if (this.ruler.width('fv-card__title', o.title) > room()) {
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
}
