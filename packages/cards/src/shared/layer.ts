/**
 * The layers a page of ours floats over its content (`ui/styles/page.css`): a drawer out of the floating frame —
 * a bottom sheet on a phone — and a popover, each over a scrim that dismisses it. The page keeps the state (which
 * layer is open, which is leaving) and gives the layer what to draw; the layer knows nothing about the page.
 */
import { glyph } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';

/** A scrim under a layer: a tap on it dismisses the layer; `clear` catches taps without dimming the page. */
export const scrim = (o: {
  readonly leaving: boolean;
  readonly clear?: boolean;
  readonly onDismiss: () => void;
}): TemplateResult =>
  html`<div
    class="fv-scrim ${o.clear ? 'fv-scrim--clear' : ''} ${o.leaving ? 'is-leaving' : ''}"
    @click=${o.onDismiss}
  ></div>`;

export interface DrawerOptions {
  readonly title: string;
  /** What the close button says (a screen reader reads it). */
  readonly close: string;
  readonly leaving: boolean;
  /** A phone's grabber over the head. */
  readonly grabber: boolean;
  /** Fills a phone's sheet (a list that scrolls) instead of being sized by its content. */
  readonly tall?: boolean;
  /** A second class for the drawer (the page's own rules for this one). */
  readonly variant?: string;
  /** What the page's focus trap marks as its first focus. */
  readonly autofocus?: string;
  readonly body: TemplateResult;
  readonly foot?: TemplateResult;
  readonly onDismiss: () => void;
  readonly onLeft: (event: AnimationEvent) => void;
}

/** A drawer with its scrim: its grabber on a phone, its title and close, its body, and its foot when it has one. */
export function drawer(o: DrawerOptions): TemplateResult {
  const leaving = o.leaving ? 'is-leaving' : '';
  return html`${scrim({ leaving: o.leaving, onDismiss: o.onDismiss })}
    <div
      class="fv-drawer ${o.tall ? 'fv-drawer--tall' : ''} ${o.variant ?? ''} ${leaving}"
      role="dialog"
      aria-modal="true"
      aria-label=${o.title}
      @animationend=${o.onLeft}
    >
      ${o.grabber ? html`<span class="fv-grabber" aria-hidden="true"></span>` : nothing}
      <header class="fv-drawer__head">
        <h2 class="fv-drawer__title">${o.title}</h2>
        <button
          class="fv-round fv-round--bare"
          aria-label=${o.close}
          data-autofocus=${o.autofocus ?? nothing}
          @click=${o.onDismiss}
        >
          ${glyph('close')}
        </button>
      </header>
      <div class="fv-drawer__body">${o.body}</div>
      ${o.foot ?? nothing}
    </div>`;
}

export interface PopoverOptions {
  /** What the layer is (a screen reader reads it). */
  readonly label: string;
  readonly leaving: boolean;
  readonly autofocus?: string;
  readonly body: TemplateResult;
  readonly onDismiss: () => void;
  readonly onLeft: (event: AnimationEvent) => void;
}

/** A popover under what opened it, over a clear scrim that closes it. */
export function popover(o: PopoverOptions): TemplateResult {
  return html`${scrim({ leaving: o.leaving, clear: true, onDismiss: o.onDismiss })}
    <div
      class="fv-popover ${o.leaving ? 'is-leaving' : ''}"
      role="dialog"
      aria-label=${o.label}
      tabindex="-1"
      data-autofocus=${o.autofocus ?? nothing}
      @animationend=${o.onLeft}
    >
      ${o.body}
    </div>`;
}
