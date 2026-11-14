import { css } from 'lit';

/**
 * The sidebar's editor on top of the panel's language: a picture of the dashboard with its sidebar as chosen (where
 * it stands, its surface, what it holds), Home Assistant's stack editor for a list's cards, and the YAML of a
 * dashboard kept in a file. Tokens only.
 */
export const sidebarEditorStyles = css`
  /* what the section is for, under its head: prose on the card's own rhythm */
  .se-intro {
    margin: 0;
  }

  /* ---------- the picture: a header over the sidebar and the view ---------- */
  .se-mock {
    display: grid;
    grid-template-rows: 16px minmax(0, 1fr);
    height: 148px;
    margin: 16px 0 12px;
    overflow: hidden;
    border-radius: var(--fluvy-radius-control);
    background: var(--fluvy-page);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .se-mock__bar {
    position: relative;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .se-mock__row {
    display: flex;
    min-height: 0;
  }
  .se-mock__row.is-end {
    flex-direction: row-reverse;
  }
  .se-mock__side {
    display: flex;
    flex: 0 0 30%;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    min-width: 0;
    max-width: 132px;
    padding: 10px;
  }
  /* a panel: the card's fill to the picture's edges, a hairline at its inner edge alone */
  .se-mock__side--panel {
    background: var(--fluvy-card);
    box-shadow: 1px 0 0 var(--fluvy-border);
  }
  .is-end > .se-mock__side--panel {
    box-shadow: -1px 0 0 var(--fluvy-border);
  }
  /* a card: one surface, the view's gap round it */
  .se-mock__side--card {
    margin: 8px 0 8px 8px;
    border-radius: 8px;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .is-end > .se-mock__side--card {
    margin: 8px 8px 8px 0;
  }
  /* a card it holds: a well on its surface, a card of its own with none */
  .se-mock__block {
    flex: none;
    height: 14px;
    border-radius: 4px;
    background: var(--fluvy-inset, var(--fluvy-page));
  }
  .se-mock__side--plain .se-mock__block {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .se-mock__block--foot {
    margin-top: auto;
  }
  /* a page of the menu: its circle and its name, the open one in the accent */
  .se-mock__page {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    height: 10px;
  }
  .se-mock__page::before {
    content: '';
    flex: 0 0 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--fluvy-inset, var(--fluvy-page));
  }
  .se-mock__side--plain .se-mock__page::before {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .se-mock__page::after {
    content: '';
    flex: 0 1 44px;
    height: 4px;
    border-radius: 2px;
    background: var(--fluvy-border-strong);
  }
  .se-mock__page.is-open::before {
    background: var(--fluvy-accent-fill);
    box-shadow: inset 0 0 0 1px var(--fluvy-accent-fill-border);
  }
  .se-mock__page.is-open::after {
    background: var(--fluvy-text-secondary);
  }
  .se-mock__view {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 30px;
    align-content: start;
    gap: 8px;
    min-width: 0;
    padding: 10px;
  }
  .se-mock__tile {
    border-radius: 6px;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .se-mock__tile:nth-child(4) {
    grid-column: span 2;
  }

  /* the three choices: what each gives said in full, on two lines where a tile is narrow, its name on the tile's
     last line in every one */
  .se-kinds .fv-option__label {
    height: auto;
    min-height: 16px;
    white-space: normal;
    text-wrap: balance;
  }
  .se-kinds .fv-option__value {
    margin-top: auto;
  }

  /* ---------- a list's cards ---------- */
  /* Home Assistant's stack editor (a tab a card, its picker), 12 under the hint; its own fields are Home Assistant's */
  .se-stack,
  .se-yaml {
    display: block;
    margin-top: 12px;
  }

  /* ---------- a dashboard kept in YAML ---------- */
  .se-code {
    margin: 12px 0;
    padding: 12px 16px;
    overflow: auto hidden;
    border-radius: var(--fluvy-radius-control);
    background: var(--fluvy-inset, var(--fluvy-page));
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
    font-family: var(--fluvy-font-mono);
    font-size: 13px;
    line-height: 20px;
    white-space: pre;
    user-select: all;
    -webkit-user-select: all;
  }
`;
