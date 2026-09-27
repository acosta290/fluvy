import { css } from 'lit';

/** The page: its host (the geometry every part shares), the bar, the scroll, the column and the rail. */
export const pageStyles = css`
  :host {
    --av-bar: calc(var(--header-height, 56px) + var(--safe-area-inset-top, 0px));
    --fv-page-bar: var(--av-bar);
    --av-view: calc(100vh - var(--safe-area-inset-bottom, 0px) - var(--av-bar));
    --av-pad: 24px;
    --av-time: 52px;
    --av-ground: var(--primary-background-color, var(--fluvy-page));
    /* the spine's x in a row (2 px wide, through the middle of the 40 node column), and where the text starts */
    --av-spine: calc(8px + var(--av-time) + 12px + 19px);
    --av-body: calc(8px + var(--av-time) + 12px + 40px + 12px);
    --rail-ground: var(--av-ground);
    /* what hover lays on a row, and the room a card keeps under its last line */
    --av-hover: var(--fluvy-card);
    --av-inset: 0px;
    position: relative;
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--safe-area-inset-bottom, 0px));
    background: var(--av-ground);
    color: var(--fluvy-text);
  }
  :host([compact]) {
    --av-pad: 16px;
    --av-spine: calc(8px + 19px);
    --av-body: calc(8px + 40px + 12px);
  }

  /* ---------- the bar (the shared .fv-page-bar) ---------- */
  .av-swap {
    position: absolute;
    inset: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 200ms var(--fv-ease, ease),
      transform 260ms var(--fv-ease-out, ease-out);
  }
  .av-swap.is-shown {
    opacity: 1;
    transform: none;
  }

  /* ---------- the scroll, the column and the rail ---------- */
  .av-scroll {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden auto;
    overscroll-behavior: contain;
    padding-right: var(--safe-area-inset-right, 0px);
    scrollbar-width: none;
  }
  .av-scroll::-webkit-scrollbar {
    display: none;
  }
  :host([narrow]) .av-scroll {
    padding-left: var(--safe-area-inset-left, 0px);
  }
  /* the page's foot matches the rail's top, so the sticky rail never rides up at the end */
  .av-page {
    display: grid;
    grid-template-columns: minmax(0, 720px) 88px;
    justify-content: center;
    column-gap: 24px;
    padding: var(--av-pad) 24px;
  }
  :host([compact]) .av-page {
    grid-template-columns: minmax(0, 1fr) 44px;
    column-gap: 4px;
    padding: var(--av-pad) 4px var(--av-pad) 16px;
  }
  .av-main {
    min-width: 0;
  }
  /* above the pinned hour headers: the bubble reaches over the column */
  .av-rail {
    position: sticky;
    z-index: 3;
    grid-row: 1 / span 2;
    grid-column: 2;
    top: var(--av-pad);
    align-self: start;
    height: round(down, calc(var(--av-view) - 2 * var(--av-pad)), 4px);
  }
  .av-rail fluvy-time-rail {
    height: 100%;
    min-height: 0;
  }
`;
