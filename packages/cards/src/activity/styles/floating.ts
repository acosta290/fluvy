import { css } from 'lit';

/** What the Activity page adds to the shared layers (`ui/styles/page.css`): the room its two drawers want. */
export const floatingStyles = css`
  /* the dates sit on the sheet's own 24 bottom, clear of the phone's home bar */
  .av-dates .fv-drawer__body {
    padding-bottom: calc(24px + var(--safe-area-inset-bottom, 0px));
  }
  /* Home Assistant's picker keeps 16 px inside for its words and none for its expanding rows: on the drawer's edge,
     its words share the title's and the buttons' 16 column and its rows run edge to edge, as lists do */
  .av-sources-drawer .fv-drawer__body {
    padding: 0 0 16px;
  }
`;
