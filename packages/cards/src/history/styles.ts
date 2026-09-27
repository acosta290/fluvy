import { css } from 'lit';

/**
 * The History page. One scroll: the period's head, then a card per measure — its curve on the shared scale, its axis
 * and its readings — and the state lines under them. One cursor crosses every card at the same instant; the colour a
 * series takes is the palette's graph colour, carried down to its line, its band, its dot and its legend.
 */
export const historyStyles = css`
  :host {
    --hs-bar: calc(var(--header-height, 56px) + var(--safe-area-inset-top, 0px));
    --fv-page-bar: var(--hs-bar);
    --hs-pad: 24px;
    position: relative;
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--safe-area-inset-bottom, 0px));
    background: var(--primary-background-color, var(--fluvy-page));
    color: var(--fluvy-text);
  }

  :host([compact]) {
    --hs-pad: 16px;
  }

  .hs-scroll {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .hs-page {
    display: flex;
    justify-content: center;
    padding: var(--hs-pad);
  }

  .hs-main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 960px;
    min-width: 0;
  }

  /* ---------- the period ---------- */
  .hs-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'titles controls'
      'tools tools';
    align-items: start;
    column-gap: 16px;
    row-gap: 16px;
  }

  :host([compact]) .hs-head {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'titles'
      'controls'
      'tools';
  }

  .hs-head__titles {
    grid-area: titles;
    min-width: 0;
  }

  .hs-head__eyebrow {
    margin: 0;
    font-size: 13px;
    line-height: 20px;
    font-weight: 600;
    color: var(--fluvy-accent-text, var(--fluvy-accent));
  }

  .hs-head__title {
    margin: 0;
    font-size: 28px;
    line-height: 32px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  :host([compact]) .hs-head__title {
    font-size: 24px;
    line-height: 28px;
  }

  .hs-head__sub {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: var(--fluvy-text-secondary);
  }

  .hs-head__controls {
    position: relative;
    grid-area: controls;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* on its own row the controls are the row: on a phone the pill takes what the round buttons leave; wider than
     that, the four of them sit together in the middle rather than inflate one of them */
  :host([compact]) .hs-head__controls {
    justify-content: flex-end;
  }

  :host([phone]) .hs-head__controls {
    justify-content: flex-start;
  }

  :host([phone]) .hs-head__controls > .fv-btn--pill {
    flex: 1 1 auto;
    width: auto !important;
  }

  .hs-tools {
    grid-area: tools;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hs-search {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* the number of sources in use rides the button's corner */
  .hs-sources {
    position: relative;
  }

  .hs-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    box-sizing: border-box;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--fluvy-primary, var(--fluvy-accent));
    color: var(--fluvy-on-primary, var(--fluvy-text-on-accent));
    font-size: 12px;
    line-height: 20px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* ---------- a measure's card ---------- */
  .hs-card {
    width: 100%;
    box-sizing: border-box;
  }

  /* a card's reading and, while it is read by hand, the instant it was read at */
  .hs-card__read {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .hs-card__value {
    display: inline-flex;
    align-items: baseline;
    font-size: 20px;
    line-height: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  /* what the readings in the legend are read at: the cursor's time, or now */
  .hs-card__when {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    color: var(--fluvy-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .hs-card__count {
    font-size: 15px;
    line-height: 20px;
    font-weight: 600;
    color: var(--fluvy-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .hs-plot {
    position: relative;
    margin-top: 8px;
    /* a finger on a chart reads it; a swipe down the page still scrolls */
    touch-action: pan-y;
  }

  .hs-lines:focus-visible,
  .hs-plot:focus-visible {
    outline: 2px solid var(--fluvy-accent);
    outline-offset: 2px;
    border-radius: var(--fluvy-radius-control);
  }

  .hs-plot svg {
    display: block;
    width: 100%;
    overflow: visible;
  }

  /* every part of a series takes its colour from the one variable the group sets */
  .hs-series {
    color: var(--series, var(--fluvy-accent));
  }

  .hs-line {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: hs-draw 700ms var(--fv-ease-out, ease-out) both;
  }

  .hs-line--alone {
    stroke-width: 2.5;
  }

  .hs-area {
    stroke: none;
    animation: hs-fade 500ms var(--fv-ease, ease) both;
  }

  /* the fill fades away downwards, in the series' own colour */
  .hs-fill-a {
    stop-color: currentColor;
    stop-opacity: 0.26;
  }

  .hs-fill-b {
    stop-color: currentColor;
    stop-opacity: 0;
  }

  /* what a summarised reading actually moved between, behind its mean */
  .hs-band {
    fill: currentColor;
    opacity: 0.14;
    stroke: none;
  }

  .hs-dot {
    fill: currentColor;
    stroke: var(--fluvy-card);
    stroke-width: 3;
  }

  /* past the end of the record: the room a window keeps for what has not happened, marked as exactly that */
  .hs-future {
    fill: var(--fluvy-page);
    opacity: 0.55;
  }

  .hs-edge {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  /* what a height means: the scale's ends, as two hairlines with their figures over them */
  .hs-rule {
    stroke: var(--fluvy-border);
    stroke-width: 1;
  }

  .hs-rule__value {
    fill: var(--fluvy-text-disabled);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .hs-cursor {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }

  .hs-readouts {
    margin-top: 12px;
  }

  /* three readings of a four-figure measure need their columns back on a 320 phone */
  :host([phone]) .hs-readouts {
    gap: 8px;
  }

  /* ---------- the legend: a row per series, with its reading under the cursor ---------- */
  .hs-legend {
    display: flex;
    flex-direction: column;
    margin: 8px 0 0;
    padding: 0;
  }

  .hs-legend__row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
  }

  .hs-legend__dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--series, var(--fluvy-accent));
  }

  .hs-legend__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }

  .hs-legend__value {
    flex: 0 0 auto;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* what did not fit is one tap away, and reads the same wherever it is offered */
  .hs-more,
  .hs-legend__more {
    align-self: flex-start;
    margin-left: -14px;
  }

  /* ---------- the state lines: a name, the stretches, and what it is under the cursor ---------- */
  .hs-lines {
    position: relative;
    margin-top: 8px;
    /* a finger on the lines reads them; a swipe down the page still scrolls */
    touch-action: pan-y;
  }

  /* the stretches are the row: the name and the state sit over them, and they take the card's whole column —
     the same column a chart is drawn into, so one cursor crosses every card at the same x */
  .hs-line-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'name state'
      'bar bar';
    align-items: center;
    column-gap: 12px;
    row-gap: 8px;
    padding: 8px 0;
  }

  .hs-line__name {
    grid-area: name;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }

  .hs-line__bar {
    grid-area: bar;
    position: relative;
    min-width: 0;
    height: 20px;
  }

  /* the stretches are clipped to the bar's corners; the cursor over them is not */
  .hs-line__track {
    display: flex;
    height: 100%;
    border-radius: var(--fluvy-radius-md, 8px);
    background: var(--fluvy-page);
    overflow: hidden;
  }

  .hs-span {
    display: block;
    height: 100%;
    background: transparent;
    animation: hs-grow 420ms var(--fv-ease-out, ease-out) both;
    transform-origin: left center;
  }

  /* a stretch spent switched on: the accent itself, so a glance reads the day without looking twice */
  .hs-span.is-on {
    background: var(--fluvy-accent);
  }

  /* doing something that is not "on" (paused, idle, returning, docked): the neutral ink, clearly not the accent */
  .hs-span.is-quiet {
    background: var(--fluvy-neutral-50);
  }

  /* nothing was known: the same neutral, striped — a state that is missing, not a state that is quiet */
  .hs-span.is-away {
    background: repeating-linear-gradient(
      -45deg,
      var(--fluvy-neutral-50) 0 2px,
      transparent 2px 5px
    );
  }

  .hs-line__state {
    grid-area: state;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    line-height: 20px;
    font-weight: 600;
    color: var(--fluvy-text-secondary);
    text-align: right;
  }

  /* a line down the whole row would cross the names: each bar carries the cursor, at the charts' own x */
  /* past the end of the record: the same room a chart keeps, on a stretch's own bar */
  .hs-line__future {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    border-left: 1px dashed var(--fluvy-border-strong);
    background: var(--fluvy-page);
    opacity: 0.55;
  }

  .hs-line__cursor {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 0;
    transform: translateX(-0.75px);
    border-left: 1.5px dashed var(--fluvy-border-strong);
  }

  /* ---------- nothing to draw ---------- */
  .hs-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 0;
  }

  /* the empty panel sits on the page, not inside a card: it takes the page's other fill, or it cannot be seen */
  .hs-empty .fv-empty-state {
    align-self: stretch;
    background: var(--fluvy-page-alt);
  }

  .hs-card--loading {
    min-height: 240px;
  }

  .hs-skeleton {
    height: 200px;
    border-radius: var(--fluvy-radius-control);
  }

  /* ---------- motion ---------- */
  @keyframes hs-draw {
    from {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
    }
    to {
      stroke-dasharray: 1;
      stroke-dashoffset: 0;
    }
  }

  @keyframes hs-fade {
    from {
      opacity: 0;
    }
  }

  @keyframes hs-grow {
    from {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  :host([reduced-motion]) *,
  :host([reduced-motion]) *::before,
  :host([reduced-motion]) *::after {
    animation: none !important;
    transition: none !important;
  }
`;
