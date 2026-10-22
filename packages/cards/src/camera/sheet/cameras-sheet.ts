import { localize, plural, strings, type HomeAssistant } from '@fluvy/core';
import { baseStyles, emptyState, glyph, listRow, pressCover, sheetStyles, toggle } from '@fluvy/ui';
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
import {
  cameraRowStyles,
  fitLines,
  renderStatus,
  STATUS_GLYPH,
  type StatusLine,
} from '../status.js';

const s = strings('cameras');

/** A camera as the card draws it, for its row in the sheet. */
export interface SheetCamera {
  readonly entity: string;
  readonly name: string;
  readonly line: StatusLine | null;
  readonly usable: boolean;
  /** Its picture streams now. */
  readonly live: boolean;
  /** The picture its tile shows (or a still of it): its row's thumbnail; '' for none. */
  readonly frame: string;
}

/** What the sheet asks of the card that opened it. */
export interface CamerasSheetHost {
  /** The sheet's title (the card's). */
  title(): string;
  cameras(): readonly SheetCamera[];
  /** Whether some picture streams now: the switch's state. */
  live(): boolean;
  /** Whether any picture may stream (`max_live` is not 0): the switch is shown only then. */
  liveable(): boolean;
  /** Every camera live, or none, for the session (never written to the card's config). */
  setLive(on: boolean): void;
  /** A camera's details, as the card opens them. */
  open(entity: string): void;
  /** The card's colours, adopted into the sheet's own root. */
  adopt(root: ShadowRoot): void;
}

/** A tap must clear the scrim's own opening tap; how long the sheet takes to leave. */
const GUARD_MS = 350;
const LEAVE_MS = 200;
/** A row's thumbnail (80) and its gap; its chevron (44) and the gap before it; a name's least beside them. */
const THUMB = 92;
const CHEVRON = 56;
const NAME_MIN = 96;
/** The switch's hit (56) and the gap before it, and the 12 between the switch's word and the switch. */
const SWITCH = 68;

/**
 * What the dialog keeps to itself, sitting in a popup (Bubble Card's) that closes on a window's Escape and slides closed
 * from a touch on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * The cameras' sheet, a modal bottom sheet fetched the first time the Cameras card's round is tapped: every camera of
 * the card as a row — its picture, its name, its line, a chevron to its details — and, in its head, a switch that shows
 * every camera live, or none, for the session (the card's `max_live` still holds). Escape, the scrim and Close close it,
 * the focus going back where it came from. `docked` draws it in the flow (the playground).
 */
export class FluvyCamerasSheet extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    sheetStyles.devices,
    cameraRowStyles,
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
      @keyframes cs-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: none;
        }
      }
      @keyframes cs-down {
        to {
          transform: translateY(100%);
        }
      }
      @keyframes cs-out {
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
        animation: cs-up 320ms var(--fv-ease-out) both;
      }
      dialog.is-leaving {
        animation: cs-out 200ms var(--fv-ease) both;
      }
      dialog.is-leaving .fv-sheet {
        animation: cs-down 200ms var(--fv-ease) both;
      }
      .fv-sheet {
        position: relative;
        width: 100%;
      }
      .fv-sheet__head > .fv-card__titles {
        flex: 1 1 auto;
        min-width: 0;
      }
      .fv-sheet__title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      /* the switch and its word, at the head's end */
      .cs-live {
        display: inline-flex;
        flex: none;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      .cs-switch,
      .cs-rows,
      .cs-empty {
        margin-top: 16px;
      }
      .cs-thumb {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cm-row > .fv-tile__tap {
        z-index: 3;
      }
      .cm-row .fv-row__chevron {
        position: relative;
        pointer-events: none;
      }
      .cs-actions {
        display: grid;
        margin-top: 24px;
      }
      .cs-actions .fv-btn {
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
  };

  declare hass?: HomeAssistant;
  declare card: CamerasSheetHost | undefined;
  /** Draws the sheet in the flow instead of in a modal dialog (the playground). */
  declare docked: boolean;
  declare open_: boolean;
  declare leaving_: boolean;

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
        this.renderRoot.querySelector<HTMLElement>('.fv-sheet [role="switch"]')?.focus(),
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

  /** A camera's details: the sheet steps aside first, Home Assistant's dialog opening in its place. */
  private details(entity: string): void {
    this.close();
    this.card?.open(entity);
  }

  /* ---------- render ---------- */

  /**
   * The head: the card's title over how many cameras, and the switch at its end with its word; where the title would
   * not hold whole beside them, the switch steps to a row of its own under the head, its word its title. A card that
   * streams none (`max_live: 0`) has no switch: it would do nothing.
   */
  private renderHead(count: number): TemplateResult {
    const hass = this.hass;
    const word = localize(hass, 'camera.live');
    const title = this.card?.title() ?? s(hass, 'title');
    const switchable = this.card?.liveable() ?? false;
    const inHead =
      this.ruler.width('fv-sheet__title', title) + 12 + this.ruler.width('cs-live', word) <=
      this.room - SWITCH;
    const on = this.card?.live() ?? false;
    // the card draws its tiles anew; the sheet, its switch
    const flip = (next: boolean): void => {
      this.card?.setLive(next);
      this.requestUpdate();
    };
    return html`<div class="fv-sheet__head">
        <div class="fv-card__titles">
          <h2 class="fv-sheet__title" id="cs-title">${title}</h2>
          <p class="fv-card__sub">${plural(hass, 'cameras.count', count)}</p>
        </div>
        ${
          switchable && inHead
            ? html`<span class="cs-live"
                ><span aria-hidden="true">${word}</span>${toggle(
                  on,
                  'accent',
                  flip,
                  s(hass, 'live_all'),
                  count === 0,
                )}</span
              >`
            : nothing
        }
      </div>
      ${
        !switchable || inHead
          ? nothing
          : html`<div class="cs-switch">
              ${listRow({
                icon: null,
                tone: 'neutral',
                title: word,
                trailing: 'switch',
                on,
                switchTone: 'accent',
                readonly: count === 0,
                onToggle: flip,
              })}
            </div>`
      }`;
  }

  /**
   * A row a camera: its thumbnail with the live dot, its name over its line, a chevron to its details. Where a name
   * would get less than its least, or a line would not hold beside its glyph, the chevron gives way, then the
   * thumbnail — every row's together; then the lines' glyphs, a line still too long saying its glyph alone.
   */
  private renderRows(cameras: readonly SheetCamera[]): TemplateResult {
    const fits = (room: number): boolean =>
      cameras.every(
        ({ name, line }) =>
          room >= Math.min(NAME_MIN, this.ruler.width('fv-row__title', name)) &&
          (!line ||
            room >= this.ruler.width('fv-row__sub', line.short ?? line.text) + STATUS_GLYPH),
      );
    const chevron = fits(this.room - THUMB - CHEVRON);
    const thumb = chevron || fits(this.room - THUMB);
    const fit = fitLines(
      cameras.map(({ line }) => (line ? [line.short ?? line.text] : [])),
      this.room - (thumb ? THUMB : 0) - (chevron ? CHEVRON : 0),
      (text) => this.ruler.width('fv-row__sub', text),
    );
    return html`<div class="cs-rows">
      ${cameras.map(
        (camera) =>
          html`<div class="fv-row fv-row--tap cm-row ${thumb ? '' : 'fv-row--bare'}">
            ${
              thumb
                ? html`<span class="cm-thumb ${camera.usable && camera.frame ? '' : 'is-off'}"
                    >${
                      camera.usable && camera.frame
                        ? html`<img class="cs-thumb" alt="" src=${camera.frame} />${
                              camera.live ? html`<i class="cm-thumb__live"></i>` : nothing
                            }`
                        : glyph('camera')
                    }</span
                  >`
                : nothing
            }
            <span class="fv-row__text"
              ><span class="fv-row__title" data-name>${camera.name}</span>${
                camera.line ? renderStatus(camera.line, fit(camera.line)) : nothing
              }</span
            >
            ${chevron ? html`<span class="fv-row__chevron">${glyph('chevron')}</span>` : nothing}
            ${pressCover(
              [camera.name, camera.line?.text].filter(Boolean).join(' · '),
              () => this.details(camera.entity),
              undefined,
            )}
          </div>`,
      )}
    </div>`;
  }

  private renderSheet(): TemplateResult {
    const cameras = this.card?.cameras() ?? [];
    const hass = this.hass;
    return html`<div class="fv-sheet cs-sheet" data-card>
      <div class="fv-sheet__grabber"><span></span></div>
      ${this.renderHead(cameras.length)}
      ${
        cameras.length
          ? this.renderRows(cameras)
          : html`<div class="cs-empty">${emptyState('camera', s(hass, 'empty'))}</div>`
      }
      <div class="cs-actions">
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
      aria-labelledby="cs-title"
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

if (!customElements.get('fluvy-cameras-sheet'))
  customElements.define('fluvy-cameras-sheet', FluvyCamerasSheet);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-cameras-sheet': FluvyCamerasSheet;
  }
}
