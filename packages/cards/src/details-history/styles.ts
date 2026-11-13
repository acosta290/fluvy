import { css } from 'lit';

/**
 * The details dialog's history: a card's anatomy without the card's surface — the dialog is the surface — on Home
 * Assistant's own 24 sides, so its words start on the column the dialog's state row and logbook start on.
 */
export const detailsStyles = css`
  :host {
    display: block;
    padding-inline: var(--ha-space-6, 24px);
    color: var(--fluvy-text);
    font-family: var(--fluvy-font-sans, inherit);
  }

  .dh {
    display: flex;
    flex-direction: column;
  }

  /* what the window says beside the head (a meter's day, a measure's change): the readout's own anatomy, on the end */
  .dh-lead {
    flex: 0 0 auto;
    text-align: end;
  }
  .dh-lead .fv-readout__value {
    justify-content: flex-end;
  }

  /* in a column too narrow for it beside the head's words, it stands under them, on their start */
  .dh-lead--under {
    margin-top: 12px;
    text-align: start;
  }
  .dh-lead--under .fv-readout__value {
    justify-content: flex-start;
  }

  .dh .fv-chips {
    margin-top: 12px;
  }
  .dh .fv-chips + .fv-chips {
    margin-top: 4px;
  }

  /* the chart, read by hand: a finger on it reads it, a swipe down the dialog still scrolls */
  .dh-plot {
    position: relative;
    margin-top: 8px;
    touch-action: pan-y;
    outline: none;
  }
  .dh-plot:focus-visible {
    outline: 2px solid var(--fluvy-accent);
    outline-offset: 2px;
    border-radius: var(--fluvy-radius-control);
  }
  .dh-plot > .fv-skeleton {
    height: 100%;
  }
  .dh-plot > .fv-empty-state {
    height: 100%;
  }

  /* a thing's states: one track of stretches under the bubble's 44, its corners the controls' */
  .dh-track {
    position: absolute;
    inset: 44px 0 0;
    overflow: hidden;
    border-radius: var(--fluvy-radius-control);
    background: var(--fluvy-inset, var(--fluvy-page));
  }
  .dh-track .fv-stretch {
    position: absolute;
    top: 0;
    bottom: 0;
    animation: dh-grow 420ms var(--fv-ease-out, ease-out) both;
    transform-origin: left center;
  }
  /* a minute open in a day is a mark, never nothing: a stretch with a tone keeps two pixels */
  .dh-track .fv-stretch:is(.is-on, .is-quiet, .is-away) {
    min-width: 2px;
  }
  /* two stretches of one tone side by side (a select's options are all on) are told apart by the dialog's own fill */
  .dh-track .fv-stretch.is-after {
    box-shadow: inset 1px 0 var(--fluvy-card);
  }
  .dh-cursor {
    position: absolute;
    top: 36px;
    bottom: -4px;
    width: 0;
    transform: translateX(-0.75px);
    border-left: 1.5px dashed var(--fluvy-border-strong);
    pointer-events: none;
  }
  /* a meter's reset: a dotted hairline in the strong border's ink, from under the bubble's room to the plot's floor */
  .dh-reset {
    position: absolute;
    top: 44px;
    bottom: 8px;
    width: 0;
    border-left: 1px dotted var(--fluvy-border-strong);
    pointer-events: none;
  }
  @keyframes dh-grow {
    from {
      transform: scaleX(0);
    }
  }
  :host([reduced-motion]) .dh-track .fv-stretch {
    animation: none;
  }

  .dh-cols {
    display: grid;
    gap: 16px;
    margin-top: 16px;
  }

  /* the way on to the History page with the same window: a row of the accent's words, its 44 the whole column */
  .dh-open {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 44px;
    margin: 12px -12px 0;
    padding: 0 12px;
    border-radius: var(--fluvy-radius-control);
    color: var(--fluvy-accent-text, var(--fluvy-accent));
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    text-decoration: none;
    transition: background-color var(--fluvy-duration-instant, 120ms) ease;
  }
  .dh-open:hover {
    background: var(--fluvy-inset, var(--fluvy-page));
  }
  .dh-open:focus-visible {
    outline: 2px solid var(--fluvy-accent);
    outline-offset: -2px;
  }
  .dh-open svg {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
  }
`;
