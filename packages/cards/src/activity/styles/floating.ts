import { css } from 'lit';

/**
 * What the Activity page adds to the shared layers (`ui/styles/page.css`, where its dates' sheet keeps its room as the
 * History's does): the room its sources' drawer wants.
 */
export const floatingStyles = css`
  /* Home Assistant's picker keeps 16 px inside for its words and none for its expanding rows: on the drawer's edge,
     its words share the title's and the buttons' 16 column and its rows run edge to edge, as lists do */
  .av-sources-drawer .fv-drawer__body {
    padding: 0 0 16px;
  }
`;
