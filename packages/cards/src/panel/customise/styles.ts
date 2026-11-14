import { css } from 'lit';
import { sheetInsets } from '../../shared/sheet-insets.js';

/**
 * Customise on top of the panel's language: a view's parts as rows that unfold (the open one a panel on the page's
 * ground, the 16 of an inner tile, its buttons on the card's fill as buttons on the page are), a list's entities as
 * compact rows inside it, and the options' sheet — the house's bottom sheet, over the page in the top layer.
 */
export const customiseStyles = css`
  /* what the section is for, under its head: prose on the card's own rhythm */
  .cz-intro {
    margin: 0;
  }

  /* ---------- a view's parts ---------- */
  .cz-parts {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .cz-part,
  .cz-item {
    position: relative;
  }
  /* the rows' hairline, from their words on: each part is a box of its own, so the rows' own rule cannot draw it */
  .cz-part + .cz-part::before,
  .cz-item + .cz-item::before {
    content: '';
    position: absolute;
    left: 56px;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--fluvy-border);
  }
  .cz-item + .cz-item::before {
    left: 52px;
  }
  /* a row that unfolds says so before its switch: a caret that points down, and up while it is open */
  .cz-caret {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 44px;
    margin-inline-end: -4px;
    color: var(--fluvy-text-secondary);
  }
  .cz-caret svg {
    width: 20px;
    height: 20px;
    transform: rotate(90deg);
    transition: transform 200ms var(--fv-ease, ease);
  }
  .cz-part.is-open .cz-caret svg {
    transform: rotate(-90deg);
  }
  /* a phone's column gives the caret's room to the words: a long one ("Electrodomésticos") is never cut for it */
  @container pn (max-width: 399px) {
    .cz-caret {
      display: none;
    }
  }
  /* hidden: its words step back, its circle is already the neutral one */
  .cz-part.is-off > .fv-row .fv-row__title,
  .cz-item.is-off .fv-row__title {
    color: var(--fluvy-text-secondary);
  }
  /* edited: a dot of the accent on its circle, ringed by the card, beside the word under its name */
  .cz-part.is-edited > .fv-row > .fv-ico::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--fluvy-primary, var(--fluvy-accent));
    box-shadow: 0 0 0 2px var(--fluvy-card);
  }
  .cz-part.is-edited > .fv-row > .fv-ico {
    position: relative;
  }
  .cz-part.is-edited.is-open > .fv-row > .fv-ico::after {
    box-shadow: 0 0 0 2px var(--fluvy-inset, var(--fluvy-page));
  }
  /* open: the row and what it unfolds on the page's ground, 12 past the card's column on each side */
  .cz-part.is-open {
    margin: 4px -12px;
    padding: 0 12px 12px;
    border-radius: var(--fluvy-radius-lg);
    background: var(--fluvy-inset, var(--fluvy-page));
  }
  .cz-part.is-open::before,
  .cz-part.is-open + .cz-part::before {
    content: none;
  }
  .cz-detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  /* a row of buttons under an open row: equal whole-pixel cells on the 8 gap (what a division leaves over a tail
     at the row's end, as every row of equal cells in the panel), on the card's fill: they stand on the page's */
  .cz-actions > .fv-actions {
    grid-template-columns: repeat(
      var(--cz-cells),
      round(down, calc((100% - (var(--cz-cells) - 1) * 8px) / var(--cz-cells) + 0.01px), 1px)
    ) !important;
    gap: 8px;
    justify-content: start;
    margin-top: 0;
  }
  .cz-detail .fv-action:not(.fv-action--accent) {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
  }
  /* an armed reset says what the second tap does, in the warning's ink */
  .cz-armed {
    margin: 0;
    color: var(--fluvy-warning);
  }

  /* ---------- a list's entities ---------- */
  .cz-label {
    margin: 4px 0 -4px;
  }
  .cz-items {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  /* compact rows inside the panel: 48 at least, their names wrapping like every name of the panel */
  .pn .cz-item .fv-row {
    min-height: 48px;
    padding-block: 4px;
  }
  .cz-item.is-open > .cz-actions {
    padding: 4px 0 12px;
  }
  .cz-add,
  .cz-yaml {
    display: block;
  }

  /* the two round steps of a row that places its view among the tabs */
  .cz-steps {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 8px;
  }
  /* an equal pair of buttons: two whole-pixel cells on the card's gap */
  .cz-pair {
    display: grid;
    grid-template-columns: repeat(
      2,
      round(down, calc((100% - var(--pn-gap, 8px)) / 2 + 0.01px), 1px)
    );
    gap: var(--pn-gap, 8px);
    justify-content: start;
  }

  /* ---------- the options' sheet ---------- */
  dialog.cz-dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--fluvy-neutral-05) 48%, transparent);
    color: var(--fluvy-text);
    overscroll-behavior: contain;
    animation: fv-fade 240ms var(--fv-ease) both;
  }
  dialog.cz-dialog::backdrop {
    background: none;
  }
  @keyframes cz-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: none;
    }
  }
  @keyframes cz-down {
    to {
      transform: translateY(100%);
    }
  }
  @keyframes cz-out {
    to {
      opacity: 0;
    }
  }
  /* a surface of its own at the window's foot, clear of the screen's edges as every sheet is (the rule after it); its
     head and its buttons stay, and the card's form scrolls between them */
  .cz-sheet {
    position: fixed;
    inset: auto 0 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    margin-inline: auto;
    overflow: hidden;
    outline: none;
    animation: cz-up 320ms var(--fv-ease-out) both;
  }
  ${sheetInsets}
  .cz-sheet__body {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 12px;
    min-height: 0;
    margin: 0 -16px;
    padding: 0 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  dialog.cz-dialog.is-leaving {
    animation: cz-out 200ms var(--fv-ease) both;
  }
  dialog.cz-dialog.is-leaving .cz-sheet {
    animation: cz-down 200ms var(--fv-ease) both;
  }
  .cz-sheet > .fv-sheet__grabber {
    margin-bottom: -12px;
  }
  .cz-sheet__hint {
    margin: 0;
  }
  /* the card's form while its editor lands */
  .cz-wait {
    height: 168px;
    border-radius: var(--fluvy-radius-lg);
    background: var(--fluvy-inset, var(--fluvy-page));
  }

  /* ---------- the view as it will be drawn ---------- */
  /* a section's twelve columns on a dashboard's own 16 gap: a tile is half of them */
  .cz-preview {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 16px;
  }
  .cz-preview > * {
    grid-column: span 12;
    min-width: 0;
  }
  .cz-preview > [data-half] {
    grid-column: span 6;
  }
  /* a card of Home Assistant's own, which Home Assistant draws: its name where it will stand */
  .cz-preview__own {
    display: grid;
    place-items: center;
    min-height: 60px;
    border-radius: var(--fluvy-radius-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);
    color: var(--fluvy-text-secondary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
`;
