import { strings, type HomeAssistant } from '@fluvy/core';
import { baseStyles, MotionMark } from '@fluvy/ui';
import {
  LitElement,
  css,
  html,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { sheetInsets } from '../../shared/sheet-insets.js';
import type { DriveProfile } from '../drive.js';
import { DRIVE_END, type DriveEndDetail } from './drive-pad.js';

const s = strings('drive');

/** What the sheet asks of the card that opened it. */
export interface DriveSheetHost {
  /** The sheet's title: the robot's name. */
  title(): string;
  /** How the robot is driven; none: the pad is drawn and does nothing (the playground). */
  profile(): DriveProfile | undefined;
  /** The card's colours, adopted into the sheet's own root. */
  adopt(root: ShadowRoot): void;
}

/** A tap must clear the scrim's own opening tap; how long the sheet takes to leave. */
const GUARD_MS = 350;
const LEAVE_MS = 200;

/**
 * What the dialog keeps to itself, sitting in a popup (Bubble Card's) that closes on a window's Escape and slides closed
 * from a touch on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * The drive pad's sheet (#178), a modal bottom sheet for a card with no room for the ring (the compact robot, a
 * narrow column) or asked for it (`drive_style: sheet`): the robot's name, the pad over how it is held, and
 * Done. It is on the page only while the robot is driven: it opens as it is attached, and Done, Escape, the scrim,
 * ten seconds without a press and a refused call all close it, each saying `fluvy-drive-end` once it has left.
 * `docked` draws it in the flow (the playground).
 */
export class FluvyDriveSheet extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
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
      @keyframes ds-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: none;
        }
      }
      @keyframes ds-down {
        to {
          transform: translateY(100%);
        }
      }
      @keyframes ds-out {
        to {
          opacity: 0;
        }
      }
      dialog .fv-sheet {
        max-width: 392px;
        overflow-y: auto;
        touch-action: pan-y;
        overscroll-behavior: contain;
        animation: ds-up 320ms var(--fv-ease-out) both;
      }
      dialog.is-leaving {
        animation: ds-out 200ms var(--fv-ease) both;
      }
      dialog.is-leaving .fv-sheet {
        animation: ds-down 200ms var(--fv-ease) both;
      }
      .fv-sheet {
        position: relative;
        width: 100%;
      }
      .fv-sheet__title {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      fluvy-drive-pad {
        margin-top: 16px;
      }
      /* how the pad is held: a line of prose under the ring, on two where a narrow sheet needs them */
      .ds-hint {
        margin: 16px 0 0;
        text-align: center;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
        text-wrap: balance;
      }
      .ds-actions {
        display: grid;
        margin-top: 24px;
      }
      .ds-actions .fv-btn {
        width: 100%;
      }
    `,
    sheetInsets,
  ];

  static override properties = {
    hass: { attribute: false },
    card: { attribute: false },
    docked: { type: Boolean, reflect: true },
    leaving_: { state: true },
  };

  declare hass?: HomeAssistant;
  declare card: DriveSheetHost | undefined;
  /** Draws the sheet in the flow instead of in a modal dialog (the playground). */
  declare docked: boolean;
  declare leaving_: boolean;

  private openedAt = 0;
  private leaveTimer = 0;
  /** A call was refused: said with the sheet's end. */
  private failed = false;
  /** The sheet has left: it opens no more. */
  private over = false;

  constructor() {
    super();
    this.docked = false;
    this.leaving_ = false;
    new MotionMark(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.renderRoot instanceof ShadowRoot) this.card?.adopt(this.renderRoot);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.leaveTimer);
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('card') && this.renderRoot instanceof ShadowRoot)
      this.card?.adopt(this.renderRoot);
  }

  protected override updated(): void {
    const dialog = this.renderRoot.querySelector('dialog');
    if (!dialog || dialog.open || this.over) return;
    dialog.showModal();
    this.openedAt = performance.now();
  }

  /** Ends remote control at once and leaves, then says so; safe to call at any time. */
  close(): void {
    if (this.leaving_ || this.docked) return;
    this.leaving_ = true;
    this.renderRoot.querySelector('fluvy-drive-pad')?.end();
    this.leaveTimer = window.setTimeout(() => this.left(), LEAVE_MS);
  }

  private left(): void {
    this.over = true;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    this.dispatchEvent(
      new CustomEvent<DriveEndDetail>(DRIVE_END, {
        detail: { failed: this.failed },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** The pad is over by itself: the sheet leaves first, and says so after. */
  private readonly onPadEnd = (event: Event): void => {
    event.stopPropagation();
    this.failed = (event as CustomEvent<DriveEndDetail>).detail.failed;
    this.close();
  };

  private onDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return; // only the scrim closes
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  private renderSheet(): TemplateResult {
    const hass = this.hass;
    return html`<div class="fv-sheet" data-card>
      <div class="fv-sheet__grabber"><span></span></div>
      <div class="fv-sheet__head">
        <h2 class="fv-sheet__title" id="ds-title" data-name>${this.card?.title() ?? ''}</h2>
      </div>
      <fluvy-drive-pad
        .hass=${hass}
        .profile=${this.card?.profile()}
        @fluvy-drive-end=${this.onPadEnd}
      ></fluvy-drive-pad>
      <p class="ds-hint">${s(hass, 'hint')}</p>
      <div class="ds-actions">
        <button class="fv-btn fv-btn--quiet" data-control data-target @click=${() => this.close()}>
          ${s(hass, 'done')}
        </button>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult {
    if (this.docked) return this.renderSheet();
    return html`<dialog
      class=${this.leaving_ ? 'is-leaving' : ''}
      aria-labelledby="ds-title"
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.close();
      }}
      @click=${(event: MouseEvent) => this.onDialogClick(event)}
      @keydown=${keepEscape}
      @touchstart=${keepTouch}
    >
      ${this.renderSheet()}
    </dialog>`;
  }
}

if (!customElements.get('fluvy-drive-sheet'))
  customElements.define('fluvy-drive-sheet', FluvyDriveSheet);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-drive-sheet': FluvyDriveSheet;
  }
}
