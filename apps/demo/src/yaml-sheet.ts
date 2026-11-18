import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import type { LanguageCode } from '@fluvy/core';
import { copyText } from '@fluvy/cards/clipboard';
import { baseStyles, glyph, reducedMotion, toggle } from '@fluvy/ui';
import { highlightYaml } from './highlight.js';
import { t } from './strings.js';

/** A card's YAML both ways the panel shows it, under the card's name. */
export interface YamlBlock {
  readonly name: string;
  /** Every option the card's editor shows, the unset ones as comments. */
  readonly all: string;
  /** What a person has to write. */
  readonly minimal: string;
}

/**
 * What the panel shows: a title (the card's name; "Cards" over several kinds), on a card's page its layout under it
 * (`variant: month`; empty on the card's base), and the YAML of each card of the plate.
 */
export interface YamlShown {
  readonly title: string;
  readonly layout?: string;
  readonly cards: readonly YamlBlock[];
}

/** A tap must clear the scrim's own opening tap; how long the panel takes to leave; how long Copy says it copied. */
const GUARD_MS = 350;
const LEAVE_MS = 200;
const COPIED_MS = 1600;

/** Where the visit keeps that the visitor asked for the short YAML: the tab's own store, gone with the tab. */
const SHORT = 'fluvy-demo-yaml-short';

/** Whether the visitor turned "All options" off during this visit; a browser that keeps no store has not. */
function askedShort(): boolean {
  try {
    return sessionStorage.getItem(SHORT) === '1';
  } catch {
    return false;
  }
}

function keepShort(short: boolean): void {
  try {
    if (short) sessionStorage.setItem(SHORT, '1');
    else sessionStorage.removeItem(SHORT);
  } catch {
    /* a browser that keeps no store asks again on its next page */
  }
}

/**
 * "View YAML": the YAML that draws a plate's cards, as a code editor shows it — the mono face on the inset fill, its
 * lines numbered, keys, strings, numbers, booleans and null, a list's dashes and comments each in a tone of the page's
 * look. "All options", on until the visitor turns it off for the visit, shows every option the card's editor has with
 * its value, the ones that are not set as comments; off, what a person has to write. Copy copies the exact text shown
 * and says so for a moment — one Copy under a single card, one beside each card's name where the plate holds several
 * — over a line on the entities being the demo house's. A side sheet on a wide screen, the language's bottom sheet on
 * a phone, in a modal dialog: Escape, the scrim and Close close it, the focus stays inside while it is open and goes
 * back where it came from.
 */
export class FluvyDemoYaml extends LitElement {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: contents;
        font-family: Inter, system-ui, sans-serif;
      }
      dialog {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        overflow: hidden;
        background: color-mix(in srgb, var(--fluvy-neutral-05, #000) 40%, transparent);
        color: var(--fluvy-text);
        overscroll-behavior: contain;
        animation: fv-fade 240ms var(--fv-ease, ease) both;
      }
      dialog::backdrop {
        background: none;
      }
      dialog.is-leaving {
        animation: ym-fade-out ${LEAVE_MS}ms var(--fv-ease, ease) both;
      }
      @keyframes ym-fade-out {
        to {
          opacity: 0;
        }
      }

      /* a wide screen: a sheet at the window's side, 16 from its edges, every corner round, as tall as its YAML (the
         YAML scrolls under its head where the window is shorter) */
      .ym-sheet {
        position: absolute;
        top: 16px;
        right: 16px;
        max-height: calc(100% - 32px);
        display: flex;
        flex-direction: column;
        width: min(520px, calc(100% - 32px));
        box-sizing: border-box;
        padding: 0;
        border-radius: var(--fluvy-radius-xl);
        box-shadow:
          0 0 0 1px var(--fluvy-edge, var(--fluvy-border)),
          0 24px 64px -24px rgb(0 0 0 / calc(0.4 * var(--fluvy-shade, 1)));
        animation: ym-side-in 280ms var(--fv-ease-out, ease-out) both;
      }
      dialog.is-leaving .ym-sheet {
        animation: ym-side-out ${LEAVE_MS}ms var(--fv-ease, ease) both;
      }
      @keyframes ym-side-in {
        from {
          opacity: 0;
          transform: translateX(24px);
        }
      }
      @keyframes ym-side-out {
        to {
          opacity: 0;
          transform: translateX(24px);
        }
      }
      .fv-sheet__grabber {
        display: none;
      }
      .ym-head {
        flex: 0 0 auto;
        height: auto;
        padding: 16px 16px 12px 20px;
      }
      .ym-titles {
        flex: 1 1 auto;
        min-width: 0;
      }
      .ym-titles h2 {
        margin: 0;
      }
      .ym-sub {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
        overflow-wrap: anywhere;
      }
      .ym-sub code {
        font-family: var(--fluvy-font-mono);
      }
      /* "All options": its words on the title's column, its switch ending on the code's edge; the row is its target */
      .ym-all {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
        margin-bottom: 8px;
        padding: 0 16px 0 20px;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        cursor: pointer;
      }
      .ym-body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 0 16px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      /* a card of several: its name and where it stands among them, its own Copy at the row's end */
      .ym-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
        margin: 0 0 8px;
        padding-left: 4px;
      }
      .ym-code + .ym-card {
        margin-top: 16px;
      }
      .ym-name {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
      }
      .ym-at {
        font-size: 13px;
        font-weight: 500;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
      }
      .ym-card .ym-copy {
        width: auto;
        padding-inline: 16px;
      }
      .ym-code {
        margin: 0;
        padding: 12px 16px 12px 12px;
        border-radius: var(--fluvy-radius-control);
        background: var(--fluvy-inset, var(--fluvy-page));
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        font-family: var(--fluvy-font-mono);
        font-size: 13px;
        line-height: 20px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        tab-size: 2;
        color: var(--fluvy-text);
      }
      .ym-code:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--fluvy-accent);
      }
      /* a line: its number in the gutter (not text: never selected, copied or read), the line beside it; a line too
         long for the sheet wraps under its own words, its number on its first row */
      .ym-row {
        display: grid;
        grid-template-columns: var(--ym-gutter) minmax(0, 1fr);
        column-gap: 16px;
      }
      .ym-row::before {
        content: attr(data-line);
        text-align: right;
        color: var(--fluvy-text-disabled);
        user-select: none;
        -webkit-user-select: none;
      }
      .ym-text {
        padding-left: calc(var(--ym-indent) * 1ch);
        text-indent: calc(var(--ym-indent) * -1ch);
      }
      .yl-key {
        color: var(--fluvy-accent-text, var(--fluvy-accent));
      }
      .yl-string {
        color: var(--fluvy-text);
      }
      .yl-number {
        color: var(--fluvy-info);
      }
      .yl-bool,
      .yl-null {
        color: var(--fluvy-warning);
      }
      .yl-dash {
        color: var(--fluvy-text-secondary);
        font-weight: 700;
      }
      .yl-punct {
        color: var(--fluvy-text-secondary);
      }
      .yl-comment {
        color: var(--fluvy-text-secondary);
        font-style: italic;
      }
      .ym-foot {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }
      .ym-copy {
        gap: 8px;
        width: 100%;
      }
      .ym-copy svg {
        width: 20px;
        height: 20px;
      }
      .ym-note {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        text-align: center;
        color: var(--fluvy-text-secondary);
      }

      /* a phone: the language's bottom sheet, its grabber, the whole width, under the status bar's room */
      @media (max-width: 719px) {
        dialog .ym-sheet {
          top: auto;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          max-height: calc(
            100% - max(24px, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))
          );
          border-radius: var(--fluvy-radius-xl) var(--fluvy-radius-xl) 0 0;
          animation: ym-up 320ms var(--fv-ease-out, ease-out) both;
        }
        dialog.is-leaving .ym-sheet {
          animation: ym-down ${LEAVE_MS}ms var(--fv-ease, ease) both;
        }
        .fv-sheet__grabber {
          display: block;
          flex: 0 0 auto;
        }
        .ym-head {
          padding: 0 16px 12px;
        }
        .ym-all {
          padding-left: 16px;
        }
        .ym-card {
          padding-left: 0;
        }
        .ym-foot {
          padding-bottom: max(
            16px,
            var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))
          );
        }
      }
      @keyframes ym-up {
        from {
          transform: translateY(100%);
        }
      }
      @keyframes ym-down {
        to {
          transform: translateY(100%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        dialog,
        dialog .ym-sheet {
          animation: none !important;
        }
      }
    `,
  ];

  static override properties = {
    language: { attribute: false },
    shown: { state: true },
    leaving: { state: true },
    all: { state: true },
    copied: { state: true },
  };

  declare language: LanguageCode;
  declare shown: YamlShown | undefined;
  declare leaving: boolean;
  /** "All options": every option of each card, or what a person has to write. */
  declare all: boolean;
  /** The card whose Copy says it copied, for a moment. */
  declare copied: number | undefined;
  private opener: HTMLElement | undefined;
  private openedAt = 0;
  private leaveTimer = 0;
  private copiedTimer = 0;

  constructor() {
    super();
    this.language = 'en';
    this.shown = undefined;
    this.leaving = false;
    this.all = true;
    this.copied = undefined;
  }

  /** Shows `shown`, every option unless the visitor asked for the short YAML; `opener` gets the focus back. */
  open(shown: YamlShown, opener?: HTMLElement): void {
    clearTimeout(this.leaveTimer);
    this.opener = opener;
    this.openedAt = performance.now();
    this.leaving = false;
    this.copied = undefined;
    this.all = !askedShort();
    this.shown = shown;
  }

  /** Leaves, gliding out; safe to call at any time. */
  close(): void {
    if (!this.shown || this.leaving) return;
    if (reducedMotion()) {
      this.finish();
      return;
    }
    this.leaving = true;
    this.leaveTimer = window.setTimeout(() => this.finish(), LEAVE_MS);
  }

  private finish(): void {
    clearTimeout(this.leaveTimer);
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    this.leaving = false;
    this.shown = undefined;
    const opener = this.opener;
    this.opener = undefined;
    if (opener?.isConnected) opener.focus();
  }

  protected override updated(): void {
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && this.shown && !dialog.open) {
      dialog.showModal();
      this.renderRoot.querySelector<HTMLElement>('.ym-close')?.focus();
    }
  }

  /** The YAML of a card as the panel shows it now. */
  private text(card: YamlBlock): string {
    return this.all ? card.all : card.minimal;
  }

  private setAll(all: boolean): void {
    this.all = all;
    this.copied = undefined;
    keepShort(!all);
  }

  /** Copies a card's YAML as it is shown; where the browser refuses, its code is selected for the person's own copy. */
  private async copy(index: number): Promise<void> {
    const card = this.shown?.cards[index];
    if (!card) return;
    if (!(await copyText(this.text(card)))) {
      const code = this.renderRoot.querySelectorAll('.ym-code')[index];
      if (code) getSelection()?.selectAllChildren(code);
      return;
    }
    this.copied = index;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = window.setTimeout(() => (this.copied = undefined), COPIED_MS);
  }

  private onClick(event: MouseEvent): void {
    // only the scrim closes, and not the tap that opened the panel
    if (event.target !== event.currentTarget) return;
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  private renderCode(yaml: string): TemplateResult {
    const lines = highlightYaml(yaml);
    const gutter = String(lines.length).length;
    return html`<pre class="ym-code" tabindex="0" aria-label="YAML" style="--ym-gutter:${gutter}ch">
${lines.map((pieces, index) => {
        // a wrapped line goes on under its own words, two in from where the line starts
        const indent = (pieces[0]?.kind === 'space' ? pieces[0].text.length : 0) + 2;
        return html`<span class="ym-row" data-line=${index + 1}
          ><span class="ym-text" style="--ym-indent:${indent}"
            >${pieces.map((piece) =>
              piece.kind === 'space'
                ? piece.text
                : html`<span class="yl-${piece.kind}">${piece.text}</span>`,
            )}${index < lines.length - 1 ? '\n' : ''}</span
          ></span
        >`;
      })}</pre>`;
  }

  /** A card's Copy: the accent under a single card, a quiet pill beside the name of one of several. */
  private renderCopy(index: number, kind: string): TemplateResult {
    const copied = this.copied === index;
    return html`<button
      class="fv-btn ${kind} ym-copy"
      data-target
      aria-live="polite"
      @click=${() => void this.copy(index)}
    >
      ${glyph(copied ? 'check' : 'copy')}${t(this.language, copied ? 'yaml.copied' : 'yaml.copy')}
    </button>`;
  }

  override render(): TemplateResult | typeof nothing {
    const shown = this.shown;
    if (!shown) return nothing;
    const lang = this.language;
    const { cards } = shown;
    const several = cards.length > 1;
    return html`<dialog
      class=${this.leaving ? 'is-leaving' : ''}
      aria-labelledby="ym-title"
      aria-describedby="ym-note"
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.close();
      }}
      @close=${() => {
        if (this.shown && !this.leaving) this.finish();
      }}
      @click=${this.onClick}
    >
      <div class="fv-sheet ym-sheet">
        <div class="fv-sheet__grabber"><span></span></div>
        <div class="fv-sheet__head ym-head">
          <div class="ym-titles">
            <h2 class="fv-sheet__title" id="ym-title">${shown.title}</h2>
            ${
              shown.layout === undefined
                ? nothing
                : html`<p class="ym-sub">
                    ${shown.layout ? html`<code>${shown.layout}</code>` : t(lang, 'card.default')}
                  </p>`
            }
          </div>
          <button
            class="fv-round fv-round--quiet ym-close"
            data-target
            aria-label=${t(lang, 'yaml.close')}
            title=${t(lang, 'yaml.close')}
            @click=${() => this.close()}
          >
            ${glyph('close')}
          </button>
        </div>
        <div class="ym-all" @click=${() => this.setAll(!this.all)}>
          <span aria-hidden="true">${t(lang, 'yaml.all')}</span>
          ${toggle(this.all, 'accent', (next) => this.setAll(next), t(lang, 'yaml.all'))}
        </div>
        <div class="ym-body">
          ${cards.map(
            (card, index) =>
              html`${
                several
                  ? html`<div class="ym-card">
                      <h3 class="ym-name">
                        ${card.name}<span class="ym-at">${index + 1}/${cards.length}</span>
                      </h3>
                      ${this.renderCopy(index, 'fv-btn--pill fv-btn--quiet')}
                    </div>`
                  : nothing
              }${this.renderCode(this.text(card))}`,
          )}
        </div>
        <div class="ym-foot">
          ${several ? nothing : this.renderCopy(0, 'fv-btn--accent')}
          <p class="ym-note" id="ym-note">
            ${t(lang, 'yaml.note')}${this.all ? ` ${t(lang, 'yaml.all_note')}` : nothing}
          </p>
        </div>
      </div>
    </dialog>`;
  }
}

if (!customElements.get('fluvy-demo-yaml')) customElements.define('fluvy-demo-yaml', FluvyDemoYaml);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-demo-yaml': FluvyDemoYaml;
  }
}
