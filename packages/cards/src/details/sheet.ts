// the sheets' words first: they are here before anything in their chunk says them
import './english.js';
import {
  appHass,
  isUsable,
  moreInfo,
  navigate,
  stateText,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
} from '@fluvy/core';
import { ico, round, type Tone } from '@fluvy/ui';
import { html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';
import { chartStyles } from '../chart/engine/index.js';
import { Card } from '../shared/base.js';
import { iconOf } from '../shared/domain.js';
import { fitLine, TextRuler } from '../shared/fit.js';
import { FontsSettled } from '../shared/fonts.js';
import { LaidWidth } from '../shared/laid.js';
import { rowEndStyles } from '../shared/row-end.js';
import { DayStrip, type DaySpec } from './history.js';
import { detailsStyles } from './styles.js';

export interface DetailsConfig extends FluvyCardConfig {
  /**
   * Test hook: the sheet drawn in the flow instead of in a modal dialog (the playground), as a phone's sheet or, `wide`,
   * as a wide screen's dialog. Undocumented.
   */
  _docked?: boolean | 'wide';
}

/** Who has Home Assistant's `hass` while a sheet is open: the card that opened it. */
export type LiveHass = EventTarget & {
  readonly rawHass: HomeAssistant | undefined;
  readonly isConnected: boolean;
};

/** A tap must clear the scrim's own opening tap; how long the sheet takes to leave. */
const GUARD_MS = 350;
const LEAVE_MS = 200;
/** The head's circle and its gap; its two rounds, 8 apart, and the gap before them; a name's least beside them. */
const CIRCLE = 56;
const ROUNDS = 108;
const NAME_MIN = 96;
/** A screen this wide and this tall holds the sheet as a dialog in its middle. */
const WIDE = '(min-width: 600px) and (min-height: 600px)';
/** The dial's ring at a phone's column, and at its least; from this ring up it is the large dial (a 48 figure). */
const RING = 96;
const RING_MIN = 56;
const RING_LARGE = 80;

/** What an entity says of itself on the head's line. */
export interface Status {
  /** Its state first ("On", "Heating"), then what it adds ("72 %", "46 % RH"): what gives way where the line is short. */
  readonly parts: readonly string[];
  /** The line is a name (what a player plays): it may end in an ellipsis, as names do. */
  readonly name?: boolean;
}

/**
 * What the dialog keeps to itself, opened from a popup (Bubble Card's) that closes on a window's Escape and slides closed
 * from a touch on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * A details sheet (1.20, #162): what a Fluvy card opens for an entity Fluvy has a sheet for, in Home Assistant's
 * dialog's place — a bottom sheet on a phone, a dialog in the middle of a wide screen. One family, each of a kind: the
 * entity's circle in its tone, its name over its area and its state, a round to Home Assistant's own details (its
 * settings, its history, what it relates to) and one to close; then the kind's one control, a dial, the keys and the
 * rows under it (`renderBody`); and at the foot its last 24 hours, a tap from Fluvy's History page. It is a card in
 * all but where it stands: it reads the look, speaks the person's language, shows a change at once and calls Home
 * Assistant as a card does. Opened on the page's body, it follows Home Assistant through the card that opened it.
 * Escape, the scrim and Close close it, the focus going back where it came from; so does leaving the page. `_docked`
 * draws it in the flow (the playground).
 */
export abstract class DetailsSheet extends Card<DetailsConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    rowEndStyles,
    chartStyles,
    detailsStyles,
  ];

  static override properties = {
    ...Card.properties,
    open_: { state: true },
    leaving_: { state: true },
    wide_: { state: true },
    broken_: { state: true },
  };

  declare open_: boolean;
  declare leaving_: boolean;
  /** Drawn as a wide screen's dialog. */
  declare wide_: boolean;
  /** A picture that failed to load here: the circle in its place. */
  declare broken_: string;

  /** Widths laid out by the browser in the sheet's own classes. */
  protected readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);
  private readonly day = new DayStrip(this);
  private readonly screen = typeof matchMedia === 'function' ? matchMedia(WIDE) : undefined;
  private source: LiveHass | undefined;
  private openedBy: HTMLElement | undefined;
  private openedAt = 0;
  private leaveTimer = 0;
  private frame = 0;

  constructor() {
    super();
    this.open_ = false;
    this.leaving_ = false;
    this.wide_ = false;
    this.broken_ = '';
    new FontsSettled(this, () => {
      this.ruler.clear();
      this.requestUpdate();
    });
    // drawn for the design's 360 before it is laid out: drawn again for the width it was given
    new LaidWidth(
      this,
      () => this.renderRoot.querySelector('.fv-sheet'),
      () => this.room,
    );
  }

  /* ---------- what a kind says of itself ---------- */

  /** The tone the entity is drawn in while it is doing something (a lit lamp's, a heating thermostat's). */
  protected abstract tone(view: EntityView): Tone;
  /** Whether it is doing something now: its circle and its day wear its tone. */
  protected abstract active(view: EntityView): boolean;
  /** The head's line after the area: what the entity says of itself now ("On · 72 %"). */
  protected abstract status(view: EntityView): Status;
  /** The kind's one control and what stands under it. */
  protected abstract renderBody(view: EntityView, unusable: boolean): TemplateResult;
  /** What the day at the foot draws: how long the entity spent in a state, or a number it measures. */
  protected abstract daySpec(view: EntityView): DaySpec;
  /** What the entity reads now on its day's line. */
  protected abstract dayLevel(view: EntityView): number | null;
  /** A picture in the circle's place, where a kind has one (a player's artwork); none: the circle. */
  protected picture?(view: EntityView): string;
  /** The entity's own colour, where a kind has one (a lamp's), keyed by the sheet's accent sheet: what wears its tone wears it. */
  protected accent?(view: EntityView): string | undefined;

  /* ---------- the sheet's own life ---------- */

  private get docked(): boolean {
    return Boolean(this.config?._docked);
  }

  /** A sheet draws no card's surface: nothing of it is see-through, and it has no border to lose. */
  protected override get surface(): boolean {
    return false;
  }

  override setConfig(config: DetailsConfig): void {
    super.setConfig(config);
    // docked, it is open from its first frame, as the phone's sheet or the wide screen's dialog
    if (this.docked) {
      this.open_ = true;
      this.wide_ = config._docked === 'wide';
    }
    this.mark();
  }

  /** How it stands, said on the host where its sheet's rules read it: in the flow, and as a wide screen's dialog. */
  private mark(): void {
    this.toggleAttribute('docked', this.docked);
    this.toggleAttribute('wide', this.wide_);
  }

  /** Opens the sheet; `openedBy` gets the focus back, `source` has Home Assistant's `hass` while it is open. */
  open(openedBy?: HTMLElement, source?: LiveHass): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    this.openedBy = openedBy;
    this.source = source;
    this.leaving_ = false;
    this.open_ = true;
    this.openedAt = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.follow);
  }

  /** Leaves; safe to call at any time. */
  close(): void {
    if (!this.open_ || this.leaving_ || this.docked) return;
    this.leaving_ = true;
    this.leaveTimer = window.setTimeout(() => this.finishClose(), LEAVE_MS);
  }

  /**
   * While it is open the sheet follows Home Assistant frame by frame — through the card that opened it, which Home
   * Assistant hands every change, else the app itself: one comparison a frame, none once it has closed.
   */
  private readonly follow = (): void => {
    const hass = (this.source?.isConnected ? this.source.rawHass : undefined) ?? appHass();
    if (hass && hass !== this.rawHass) this.hass = hass;
    this.frame = requestAnimationFrame(this.follow);
  };

  /** The page under the sheet went elsewhere (a link, the browser's back): the sheet goes with it, at once. */
  private readonly leave = (): void => {
    if (!this.docked) this.finishClose();
  };

  private readonly onScreen = (): void => {
    if (!this.docked) this.wide_ = this.screen?.matches ?? false;
    this.mark();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.onScreen();
    this.screen?.addEventListener('change', this.onScreen);
    window.addEventListener('location-changed', this.leave);
    window.addEventListener('popstate', this.leave);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.screen?.removeEventListener('change', this.onScreen);
    window.removeEventListener('location-changed', this.leave);
    window.removeEventListener('popstate', this.leave);
    this.finishClose();
  }

  /** The end of every way out: no dialog, nothing followed, the focus back where it came from; said to whoever opened it. */
  private finishClose(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    cancelAnimationFrame(this.frame);
    const wasOpen = this.open_ && !this.docked;
    const opener = this.openedBy;
    this.openedBy = undefined;
    this.source = undefined;
    if (!wasOpen) return;
    this.leaving_ = false;
    this.open_ = false;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    if (opener?.isConnected) opener.focus();
    this.dispatchEvent(new CustomEvent('fluvy-closed'));
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.mark();
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && !dialog.open && this.open_ && !this.leaving_) dialog.showModal();
    if (changed.has('open_') && this.open_ && !this.docked)
      requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('.dt-close')?.focus());
  }

  private onDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return; // only the scrim closes
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  /** The sheet's content width (its 16 sides off), the design's 360 before it is laid out. */
  protected get room(): number {
    const sheet = this.renderRoot.querySelector<HTMLElement>('.fv-sheet');
    const laid = sheet?.clientWidth ?? 0;
    return laid > 0 ? laid - 32 : 360;
  }

  /** The dial's ring from the column: 96 where it has 248 and more, down to 56 — the box is twice the ring, its ticks and their 12. */
  protected get ring(): number {
    return Math.min(RING, Math.max(RING_MIN, Math.floor(this.room / 8) * 4 - 28));
  }

  /** Whether the dial is the large one: a narrow column's ring holds the small dial's figure and knob. */
  protected get large(): boolean {
    return this.ring >= RING_LARGE;
  }

  /** The words under the dial's figure, where its disc holds them whole (8 on each side); none where it does not. */
  protected dialWords(words: string): string {
    const disc = Math.floor((this.ring - 10) / 4) * 8;
    return this.ruler.width('fv-dial__sub', words) <= disc - 16 ? words : '';
  }

  /** Home Assistant's own details of the entity (its settings, its history, what it relates to): the sheet steps aside. */
  private more(): void {
    const entity = this.config?.entity;
    // the dialog is Home Assistant's root's to open: asked from the card that opened the sheet, else from the root
    const from = this.source?.isConnected
      ? this.source
      : (document.querySelector('home-assistant') ?? this);
    this.finishClose();
    if (entity) moreInfo(from, entity);
  }

  /** Fluvy's History page on the entity's last day, with the way back (Home Assistant's "Show more" goes there too). */
  private history(): void {
    const entity = this.config?.entity;
    if (!entity) return;
    const start = new Date(Date.now() - 86_400_000).toISOString();
    this.finishClose();
    navigate(
      `/history?entity_id=${encodeURIComponent(entity)}&start_date=${encodeURIComponent(start)}&back=1`,
    );
  }

  /* ---------- render ---------- */

  /**
   * The head: the entity's circle in its tone (a picture of its own in its place), its name over its line — its area,
   * where that says more than the name, and what it says of itself — and its two rounds. The line is fitted by
   * measure: what the state adds gives way first, then the area, never the state's own word. In a column that would
   * leave the name under its least beside the circle and the rounds, or the state's word no room, the words go under
   * them and have the whole column.
   */
  private renderHead(view: EntityView, name: string, unusable: boolean): TemplateResult {
    const tone: Tone = unusable ? 'off' : this.active(view) ? this.tone(view) : 'neutral';
    const shown = unusable ? '' : (this.picture?.(view) ?? '');
    const picture = shown && shown !== this.broken_ ? shown : '';
    const status: Status = unusable ? { parts: [stateText(this.hass, view)] } : this.status(view);
    const measure = (text: string): number => this.ruler.width('fv-card__sub', text);
    const [state = '', ...more] = status.parts.filter(Boolean);
    const beside = this.room - CIRCLE - ROUNDS;
    // a name keeps 96 (or itself, when shorter); a state's word is never cut
    const nameNeeds = Math.min(NAME_MIN, this.ruler.width('fv-sheet__title', name));
    const stateNeeds = status.name ? Math.min(NAME_MIN, measure(state)) : measure(state);
    const stacked = beside < Math.max(nameNeeds, stateNeeds);
    const line = fitLine(
      [
        { text: view.areaName === name ? '' : view.areaName, optional: true },
        { text: state },
        ...more.map((text) => ({ text, optional: true })),
      ],
      stacked ? this.room : beside,
      measure,
    );
    return html`<div class="fv-sheet__head ${stacked ? 'is-stacked' : ''}">
      ${
        picture
          ? html`<span class="dt-pic" data-icon
              ><img
                src=${picture}
                alt=""
                draggable="false"
                @error=${() => {
                  this.broken_ = picture;
                }}
            /></span>`
          : ico(iconOf(view), tone)
      }
      <div class="fv-card__titles">
        <h2 class="fv-sheet__title" id="dt-title" data-name>${name}</h2>
        <p class="fv-card__sub" data-name=${status.name ? '' : nothing}>${line}</p>
      </div>
      <div class="dt-rounds">
        ${round('dots', 'quiet', this.t('sheets.more'), () => this.more(), false, 'dt-more')}
        ${round('close', 'quiet', this.t('keypad.close'), () => this.close(), false, 'dt-close')}
      </div>
    </div>`;
  }

  /** The entity's last 24 hours. */
  private renderDay(view: EntityView, name: string, unusable: boolean): TemplateResult {
    return this.day.render({
      hass: this.hass,
      entityId: view.id,
      spec: this.daySpec(view),
      width: this.room,
      tone: unusable ? 'neutral' : this.tone(view),
      accent: unusable ? undefined : this.accent?.(view),
      live: unusable ? null : this.dayLevel(view),
      ruler: this.ruler,
      name,
      open: () => this.history(),
    });
  }

  private renderSheet(): TemplateResult {
    const view = this.entity();
    const name = this.nameFor(view, undefined);
    // out of reach, the sheet keeps its anatomy, its controls still and faded: its head and its day still answer
    const unusable = !isUsable(view);
    return html`<div
      class="fv-sheet dt-sheet"
      data-card
      data-accent=${(unusable ? undefined : this.accent?.(view)) ?? nothing}
    >
      <div class="fv-sheet__grabber"><span></span></div>
      ${this.renderHead(view, name, unusable)}
      <div class="dt-body ${unusable ? 'is-unavailable' : ''}">
        ${this.renderBody(view, unusable)}
      </div>
      ${this.renderDay(view, name, unusable)}
    </div>`;
  }

  protected renderCard(): TemplateResult | typeof nothing {
    if (!this.open_) return nothing;
    if (this.docked) return this.renderSheet();
    return html`<dialog
      class=${this.leaving_ ? 'is-leaving' : ''}
      aria-labelledby="dt-title"
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.close();
      }}
      @close=${() => this.finishClose()}
      @click=${(event: MouseEvent) => this.onDialogClick(event)}
      @keydown=${keepEscape}
      @touchstart=${keepTouch}
    >
      ${this.renderSheet()}
    </dialog>`;
  }
}
