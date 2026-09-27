import { css } from 'lit';

/** On a card (this person's preference): the column in its own box, its controls on the page's fill. */
export const cardStyles = css`
  :host([card]) .av-main {
    --av-ground: var(--fluvy-card);
    --av-hover: var(--fluvy-page);
    padding: 24px 24px var(--av-inset);
    border-radius: var(--fluvy-radius-card);
    background: var(--av-ground);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  :host([card]) {
    --av-inset: 24px;
  }
  :host([card][compact]) {
    --av-inset: 16px;
  }
  :host([card][compact]) .av-main {
    padding: 16px 16px var(--av-inset);
  }
  /* on a card the phone's filter strip runs to the card's edges, not the screen's */
  :host([card][compact]) .av-filters--strip {
    margin-inline: -16px;
    padding-inline: 16px;
  }
  :host([card]) .fv-round--on-page:not(.is-on),
  :host([card]) .fv-btn--on-page:not(.is-on),
  :host([card]) .av-filters .fv-chip:not(.is-active) .fv-chip__pill,
  :host([card]) .av-detail__inner,
  :host([card]) .fv-ico--neutral.av-circle {
    background: var(--fluvy-page);
    box-shadow: none;
  }
  /* on a card the search is the language's field in a card: the page's fill */
  :host([card]) .fv-field--on-page {
    background: var(--fluvy-page);
  }
  :host([card]) .av-detail__inner .fv-btn--quiet {
    background: var(--fluvy-card);
  }
`;
