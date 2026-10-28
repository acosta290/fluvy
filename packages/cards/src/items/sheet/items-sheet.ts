import { localize, strings, type HomeAssistant } from '@fluvy/core';
import { baseStyles, ico, round, sheetStyles, type IconRef, type Tone } from '@fluvy/ui';
import {
  LitElement,
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { TextRuler } from '../../shared/fit.js';
import { FontsSettled } from '../../shared/fonts.js';
import { LaidWidth } from '../../shared/laid.js';
import { fitSegments } from '../fields.js';
import type { SheetRow } from '../presets.js';

const s = strings('items');

/** An item as the card hands it to its sheet. */
export interface SheetItem {
  readonly name: string;
  readonly secondary: string;
  /** The picture's URL; '' for none (the glyph then). */
  readonly picture: string;
  readonly icon: IconRef;
  readonly tone: Tone;
  /** Its fields in order, each a label and a line. */
  readonly rows: readonly SheetRow[];
  /**
   * Where the item links to, what the round says, and a shorter word for the button that stands for the round where
   * the head cannot hold it and the full one would not fit the button ("Open on Flightradar24" → "Open the link").
   */
  readonly link?: { readonly url: string; readonly label: string; readonly short?: string };
}

/** What the sheet asks of the card that opened it. */
export interface ItemsSheetHost {
  /** The card's title: what a reader hears the sheet is of. */
  title(): string;
  /** The item open, as it stands now; none once it has left the list. */
  item(): SheetItem | undefined;
  /** The card's colours, adopted into the sheet's own root. */
  adopt(root: ShadowRoot): void;
}

/** A tap must clear the scrim's own opening tap; how long the sheet takes to leave. */
const GUARD_MS = 350;
const LEAVE_MS = 200;
/** The head's circle (44) and its gap; the link's round (44) and the gap before it; a button's two sides. */
const CIRCLE = 56;
const ROUND = 56;
const BUTTON_SIDES = 32;

/**
 * What the dialog keeps to itself, sitting in a popup (Bubble Card's) that closes on a window's Escape and slides closed
 * from a touch on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * An item's sheet, a modal bottom sheet fetched the first time an Items card's row is tapped: the item's picture (or
 * its glyph), its name over its line, a round to its link where it has one, then its fields in order — the flight's
 * airline, route, altitude and times; a plain item's every field. Escape, the scrim and Close close it, the focus
 * going back where it came from. `docked` draws it in the flow (the playground).
 */
export class FluvyItemsSheet extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    sheetStyles.devices,
    css`
      :host(:not([docked])) {
        display: contents;
      }
      dialog {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        overflow: hidden;
        padding: 0;
        border: 0;
        background: color-mix(in srgb, var(--fluvy-neutral-05) 48%, transparent);
        color: inherit;
        touch-action: none;
        overscroll-behavior: contain;
        animation: fv-fade 240ms var(--fv-ease) both;
      }
      dialog[open] {
        display: flex;
      }
      dialog::backdrop {
        background: none;
      }
      @keyframes is-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: none;
        }
      }
      @keyframes is-down {
        to {
          transform: translateY(100%);
        }
      }
      @keyframes is-out {
        to {
          opacity: 0;
        }
      }
      dialog .fv-sheet {
        max-width: 392px;
        max-height: 100%;
        overflow-y: auto;
        touch-action: pan-y;
        overscroll-behavior: contain;
        padding-bottom: max(16px, env(safe-area-inset-bottom));
        animation: is-up 320ms var(--fv-ease-out) both;
      }
      dialog.is-leaving {
        animation: is-out 200ms var(--fv-ease) both;
      }
      dialog.is-leaving .fv-sheet {
        animation: is-down 200ms var(--fv-ease) both;
      }
      .fv-sheet {
        position: relative;
        width: 100%;
      }
      .fv-sheet__head {
        gap: 12px;
      }
      .fv-sheet__head > .fv-card__titles {
        flex: 1 1 auto;
        min-width: 0;
      }
      .fv-sheet__title,
      .fv-sheet__head .fv-card__sub {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .is-pic {
        position: relative;
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
        overflow: hidden;
        border-radius: 50%;
        background: var(--fluvy-inset, var(--fluvy-page));
      }
      .is-pic img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* the fields: a label over its line (64, a line more for each that wraps), hairlines between them; a line wraps
         at its words, never cut */
      .is-fields {
        margin-top: 8px;
      }
      .is-field {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 0;
      }
      .is-field + .is-field::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        height: 1px;
        background: var(--fluvy-border);
      }
      .is-field__label {
        font-size: 13px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
      }
      .is-field__value {
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        font-variant-numeric: tabular-nums;
        overflow-wrap: break-word;
      }
      .is-actions {
        display: grid;
        gap: 8px;
        margin-top: 24px;
      }
      .is-actions .fv-btn {
        width: 100%;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    card: { attribute: false },
    docked: { type: Boolean, reflect: true },
    open_: { state: true },
    leaving_: { state: true },
    broken_: { state: true },
  };

  declare hass?: HomeAssistant;
  declare card: ItemsSheetHost | undefined;
  /** Draws the sheet in the flow instead of in a modal dialog (the playground). */
  declare docked: boolean;
  declare open_: boolean;
  declare leaving_: boolean;
  /** A picture that failed to load here: the glyph in its place. */
  declare broken_: string;

  /** Widths laid out by the browser in the sheet's own classes. */
  private readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);
  private openedBy: HTMLElement | undefined;
  private openedAt = 0;
  private leaveTimer = 0;

  constructor() {
    super();
    this.docked = false;
    this.open_ = false;
    this.leaving_ = false;
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

  /** Opens the sheet; `openedBy` gets the focus back. */
  open(openedBy?: HTMLElement): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    this.openedBy = openedBy;
    this.leaving_ = false;
    this.open_ = true;
    this.openedAt = performance.now();
  }

  /** Leaves; safe to call at any time. */
  close(): void {
    if (!this.open_ || this.leaving_ || this.docked) return;
    this.leaving_ = true;
    this.leaveTimer = window.setTimeout(() => this.finishClose(), LEAVE_MS);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.renderRoot instanceof ShadowRoot) this.card?.adopt(this.renderRoot);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.finishClose();
  }

  /** The end of every way out: no dialog, the focus back where it came from. */
  private finishClose(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    const wasOpen = this.open_;
    const opener = this.openedBy;
    this.openedBy = undefined;
    this.leaving_ = false;
    this.open_ = false;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    if (wasOpen && opener?.isConnected) opener.focus();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('card') && this.renderRoot instanceof ShadowRoot)
      this.card?.adopt(this.renderRoot);
  }

  protected override updated(changed: PropertyValues): void {
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && !dialog.open && this.open_ && !this.leaving_) dialog.showModal();
    if (changed.has('open_') && this.open_ && !this.docked)
      requestAnimationFrame(() =>
        this.renderRoot.querySelector<HTMLElement>('.is-actions .fv-btn:last-child')?.focus(),
      );
  }

  private onDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return; // only the scrim closes
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  /** The sheet's content width (its 16 sides off), the design's 360 before it is laid out. */
  private get room(): number {
    const sheet = this.renderRoot.querySelector<HTMLElement>('.fv-sheet');
    const laid = sheet?.clientWidth ?? 0;
    return laid > 0 ? laid - 32 : 360;
  }

  /** The item's link, in a tab of its own. */
  private follow(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  /** The link's button's word: the round's, where it fits the button; else its shorter one. */
  private buttonWord({ label, short }: NonNullable<SheetItem['link']>): string {
    return short && this.ruler.width('fv-btn', label) + BUTTON_SIDES > this.room ? short : label;
  }

  /* ---------- render ---------- */

  /**
   * Whether the link's round stands in the head: where the name and the line's first segment hold whole beside it;
   * else the link is a button above Close, so neither is ever cut.
   */
  private linkInHead(item: SheetItem): boolean {
    if (!item.link) return false;
    const first = item.secondary.split(' · ')[0] ?? '';
    return (
      Math.max(
        this.ruler.width('fv-sheet__title', item.name),
        this.ruler.width('fv-card__sub', first),
      ) <=
      this.room - CIRCLE - ROUND
    );
  }

  /**
   * The head: the item's picture or its glyph, its name over its line, and the round to its link where it holds. The
   * line's " · " segments give way from the end to the room beside them, so it is never cut.
   */
  private renderHead(item: SheetItem, linked: boolean): TemplateResult {
    const picture = item.picture && item.picture !== this.broken_ ? item.picture : '';
    const room = this.room - CIRCLE - (linked ? ROUND : 0);
    const line = fitSegments(this.ruler, 'fv-card__sub', item.secondary, room);
    return html`<div class="fv-sheet__head">
      ${
        picture
          ? html`<span class="is-pic" data-icon
              ><img
                src=${picture}
                alt=""
                draggable="false"
                @error=${() => {
                  this.broken_ = picture;
                }}
            /></span>`
          : ico(item.icon, item.tone)
      }
      <div class="fv-card__titles">
        <h2 class="fv-sheet__title" id="is-title" data-name>${item.name}</h2>
        ${line ? html`<p class="fv-card__sub">${line}</p>` : nothing}
      </div>
      ${
        linked && item.link
          ? round('globe', 'quiet', item.link.label, () => this.follow(item.link?.url ?? ''))
          : nothing
      }
    </div>`;
  }

  /** The item's fields, each its label over its line. */
  private renderFields(rows: readonly SheetRow[]): TemplateResult {
    return html`<div class="is-fields">
      ${rows.map(
        ({ label, value }) =>
          html`<div class="is-field">
            <span class="is-field__label">${label}</span
            ><span class="is-field__value">${value}</span>
          </div>`,
      )}
    </div>`;
  }

  private renderSheet(): TemplateResult {
    const hass = this.hass;
    const item = this.card?.item();
    const linked = item ? this.linkInHead(item) : false;
    return html`<div class="fv-sheet is-sheet" data-card>
      <div class="fv-sheet__grabber"><span></span></div>
      ${
        item
          ? html`${this.renderHead(item, linked)}${
              item.rows.length ? this.renderFields(item.rows) : nothing
            }`
          : html`<div class="fv-sheet__head">
              <div class="fv-card__titles">
                <h2 class="fv-sheet__title" id="is-title">
                  ${this.card?.title() ?? s(hass, 'title')}
                </h2>
                <p class="fv-card__sub">${s(hass, 'gone')}</p>
              </div>
            </div>`
      }
      <div class="is-actions">
        ${
          item?.link && !linked
            ? html`<button
                class="fv-btn fv-btn--quiet"
                data-control
                data-target
                @click=${() => this.follow(item.link?.url ?? '')}
              >
                ${this.buttonWord(item.link)}
              </button>`
            : nothing
        }
        <button class="fv-btn fv-btn--quiet" data-control data-target @click=${() => this.close()}>
          ${localize(hass, 'keypad.close')}
        </button>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open_) return nothing;
    if (this.docked) return this.renderSheet();
    return html`<dialog
      class=${this.leaving_ ? 'is-leaving' : ''}
      aria-labelledby="is-title"
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

if (!customElements.get('fluvy-items-sheet'))
  customElements.define('fluvy-items-sheet', FluvyItemsSheet);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-items-sheet': FluvyItemsSheet;
  }
}
