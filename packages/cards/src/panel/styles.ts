import { css } from 'lit';

/**
 * The panel's layout on top of the cards' language (`baseStyles`): one centred column of cards (760 at most,
 * the phone's 16 gutter). Its breakpoint is its own width, not the screen's (inside Home Assistant the sidebar
 * takes part of it): from 648 it is laid out as on a desktop (tabs as a full row, 12 between cells, bigger
 * miniatures). One rhythm for every choice inside a card: three cells of 108 on a phone, 216 on a desktop.
 */
export const panelStyles = css`
  :host {
    display: block;
    min-height: 100%;
    container: pn / inline-size;
    background: var(--fluvy-page);
    color: var(--fluvy-text);
    font-family: var(--fluvy-font-sans);
  }
  /* the safe areas are Home Assistant's variables where it sets them (the floating frame's 16 px opening), else
     the device's */
  /* Home Assistant pads a custom panel by the safe areas itself: the column only subtracts them from its height
     (and the dock sticks clear of them), it never pads by them again */
  .pn {
    --pn-inset-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
    --pn-inset-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    /* the one rhythm between the cells of a row (8 on a phone, 12 on a desktop) */
    --pn-gap: 8px;
    display: flex;
    gap: 24px;
    max-width: 760px;
    min-height: calc(100dvh - var(--pn-inset-top) - var(--pn-inset-bottom));
    margin: 0 auto;
    padding: 12px 16px 16px;
    box-sizing: border-box;
  }
  @container pn (min-width: 648px) {
    .pn {
      --pn-gap: 12px;
      padding: 24px;
    }
  }
  /* the settings' column: the title, the tabs, the open tab's cards, the dock */
  .pn-col {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  /* from 1184 the preview has a column of its own beside the settings: it starts level with the open tab's first
     card (the title and the tabs belong to the settings' column) and stays in view while they scroll */
  .pn.is-side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 400px;
    grid-template-rows: auto auto 1fr auto;
    grid-template-areas:
      'top .'
      'tabs .'
      'body aside'
      'dock aside';
    column-gap: 24px;
    row-gap: 16px;
    max-width: 1184px;
  }
  .pn.is-side > .pn-col {
    display: contents;
  }
  .pn.is-side .pn-top {
    grid-area: top;
  }
  .pn.is-side .pn-tabs {
    grid-area: tabs;
  }
  .pn.is-side .pn-body {
    grid-area: body;
  }
  .pn.is-side .pn-dock {
    grid-area: dock;
  }
  .pn-aside {
    grid-area: aside;
    position: sticky;
    top: calc(24px + var(--pn-inset-top));
    align-self: start;
    /* taller than the window (the dashboard's dial and energy flow), it scrolls within itself: always in view */
    max-height: calc(100dvh - 48px - var(--pn-inset-top) - var(--pn-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--fluvy-border-strong) transparent;
    border-radius: var(--fluvy-radius-card);
  }
  /* every row of equal cells (the gallery, options, filling chips, pairs): whole-pixel cells on the exact gap, the
     pixel or two a division leaves over as a tail at the end (0.01 px keeps an exact division from losing a pixel
     to floating point) */
  .pn-gallery,
  .pn :is(.fv-options, .fv-chips--fill):has(> :nth-child(3):last-child) {
    grid-template-columns: repeat(
      3,
      round(down, calc((100% - 2 * var(--pn-gap)) / 3 + 0.01px), 1px)
    ) !important;
    column-gap: var(--pn-gap) !important;
    justify-content: start;
  }
  .pn :is(.fv-options, .fv-chips--fill):has(> :nth-child(2):last-child) {
    grid-template-columns: repeat(
      2,
      round(down, calc((100% - var(--pn-gap)) / 2 + 0.01px), 1px)
    ) !important;
    column-gap: var(--pn-gap) !important;
    justify-content: start;
  }
  .pn-top {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  .pn-top .fv-ico {
    background: none;
    color: var(--fluvy-text);
  }
  .pn-titles {
    min-width: 0;
  }
  .pn-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: -0.01em;
  }
  .pn-sub {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    color: var(--fluvy-text-secondary);
  }

  /* the tabs: a tab row (14 px face) on the card surface, the open one in the selected ink. A phone scrolls
     content-sized pills to the page's edge, fading only on a side where the row goes on; a wide panel lays
     them out as one full row, the column's width exactly. */
  .pn-tabs {
    margin: 0 -16px;
  }
  .pn-tabs__row {
    display: flex;
    gap: 8px;
    padding: 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(
      90deg,
      var(--pn-fade-start, transparent),
      #000 24px,
      #000 calc(100% - 24px),
      var(--pn-fade-end, transparent)
    );
    mask-image: linear-gradient(
      90deg,
      var(--pn-fade-start, transparent),
      #000 24px,
      #000 calc(100% - 24px),
      var(--pn-fade-end, transparent)
    );
  }
  .pn-tabs__row.is-start {
    --pn-fade-start: #000;
  }
  .pn-tabs__row.is-end {
    --pn-fade-end: #000;
  }
  .pn-tabs__row::-webkit-scrollbar {
    display: none;
  }
  .pn-tabs .fv-chip {
    flex: 0 0 auto;
  }
  .pn-tabs .fv-chip__pill {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
    color: var(--fluvy-text-secondary);
    font-size: 14px;
  }
  .pn-tabs .fv-chip.is-active .fv-chip__pill {
    background: var(--fluvy-selected, var(--fluvy-text));
    color: var(--fluvy-on-selected, var(--fluvy-page));
    box-shadow: none;
  }
  .pn-tabs.is-wide {
    margin: 0;
  }
  .pn-tabs.is-wide .pn-tabs__row {
    display: grid;
    /* five whole-pixel tabs on the 8 gap, the tail at the end */
    grid-template-columns: repeat(5, round(down, calc((100% - 32px) / 5 + 0.01px), 1px));
    column-gap: 8px;
    justify-content: start;
    padding: 0;
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  .pn-tabs.is-wide .fv-chip__pill {
    padding: 0 8px;
  }

  /* a tab's cards; after the first entrance a new tab only fades in */
  .pn-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .pn-body.is-new {
    animation: fv-fade 160ms var(--fv-ease-out) both;
  }

  .pn-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  /* a card of rows only: its first icon circle 20 from the top, as under a head */
  .pn-card.pn-rows {
    padding-block: 12px;
  }
  .pn-line,
  .pn-label {
    margin: 4px 0 -4px;
  }
  /* what a choice does, in the sub line's voice, bound to its label (8 above what it explains) */
  .pn-hint {
    margin: -8px 0 -4px;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: var(--fluvy-text-secondary);
    text-wrap: pretty;
  }
  /* a note in a card of its own: a head, a few lines, the way out as a full-width button */
  .pn-note__text {
    font-size: 14px;
    line-height: 20px;
    color: var(--fluvy-text-secondary);
    text-wrap: pretty;
  }
  /* a chip row binds to the label above it (8 from the label's box to the pill, as in the gallery) */
  .pn-card .fv-chips {
    margin-top: -4px;
  }
  /* a dropdown under its label, the same 8 */
  .pn-label + fluvy-select {
    margin-top: -4px;
  }
  .pn-card .fv-chips--fill {
    column-gap: 8px;
  }
  @container pn (min-width: 648px) {
    .pn-card .fv-chips--fill {
      column-gap: 12px;
    }
  }
  /* prose wraps: a sub never ends in an ellipsis here, and its row grows around it */
  .pn .fv-card__head {
    height: auto;
    min-height: 44px;
  }
  .pn .fv-card__sub,
  .pn .fv-row__title,
  .pn .fv-row__sub {
    white-space: normal;
  }
  .pn .fv-row {
    height: auto;
    min-height: 60px;
    padding-block: 8px;
    box-sizing: border-box;
  }
  .pn-card.is-armed .fv-row__title {
    color: var(--fluvy-warning);
  }
  /* a choice shown to someone who may not change it */
  .pn-chips--static .fv-chip {
    pointer-events: none;
  }
  .pn-rows {
    display: flex;
    flex-direction: column;
  }
  /* equal buttons across the column (export | import): whole-pixel cells, the odd pixel to the gap */
  .pn-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    column-gap: 8px;
  }
  .pn-pair:has(> :nth-child(2)) {
    grid-template-columns: repeat(2, round(down, calc((100% - 8px) / 2), 1px));
    justify-content: space-between;
  }
  @container pn (min-width: 648px) {
    .pn-pair:has(> :nth-child(2)) {
      grid-template-columns: repeat(2, round(down, calc((100% - 12px) / 2), 1px));
    }
  }
  .pn-file {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .pn-file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* palettes: three a row at every width, each a miniature of the product */
  .pn-gallery {
    display: grid;
    row-gap: var(--pn-gap);
  }
  .pn-swatch {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 8px 12px;
    border: 0;
    border-radius: var(--fluvy-radius-control);
    background: var(--fluvy-page);
    color: var(--fluvy-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pn-swatch.is-active {
    background: var(--fluvy-accent-fill);
    color: var(--fluvy-accent-on-fill);
  }
  .pn-swatch__name {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    height: 16px;
    font-size: 13px;
    font-weight: 600;
    line-height: 16px;
  }
  .pn-swatch__label {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pn-swatch__name svg {
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
  }

  /* the miniature: the palette's page with the picture of its tiles, scaled whole */
  .pn-art {
    display: block;
    height: 72px;
    padding: 8px;
    box-sizing: border-box;
    border-radius: var(--fluvy-radius-md);
    background: var(--sw-page);
    box-shadow: inset 0 0 0 1px var(--sw-border);
  }
  @container pn (min-width: 648px) {
    .pn-gallery .pn-art {
      height: 96px;
    }
  }
  .pn-art svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .pn-art__on {
    fill: var(--sw-fill);
  }
  .pn-art__disc {
    fill: var(--sw-card);
  }
  .pn-art__glyph {
    fill: var(--sw-accent);
  }
  .pn-art__tick {
    stroke: var(--sw-tick);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .pn-art__off {
    fill: var(--sw-card);
    stroke: var(--sw-border);
  }
  .pn-art__hl {
    fill: var(--sw-hl);
  }
  .pn-art--new {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
    color: var(--fluvy-text-secondary);
  }
  .pn-art--new svg {
    width: 20px;
    height: 20px;
  }

  /* a custom palette: a builder of its own under both lines */
  .pn-custom {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px 8px 8px;
    border: 0;
    border-radius: var(--fluvy-radius-control);
    background: var(--fluvy-page);
    color: var(--fluvy-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pn-custom .pn-art {
    flex: 0 0 96px;
    height: 56px;
  }
  .pn-custom__text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }
  .pn-custom__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }
  .pn-custom__sub {
    font-size: 13px;
    font-weight: 500;
    line-height: 16px;
    color: var(--fluvy-text-secondary);
  }
  .pn-custom__tail {
    display: inline-flex;
    color: var(--fluvy-text-secondary);
  }
  .pn-custom__tail svg {
    width: 20px;
    height: 20px;
  }
  .pn-custom.is-active {
    background: var(--fluvy-accent-fill);
    color: var(--fluvy-accent-on-fill);
  }
  .pn-custom.is-active :is(.pn-custom__sub, .pn-custom__tail) {
    color: var(--fluvy-accent-on-fill);
  }
  .pn-custom.is-active .pn-custom__sub {
    opacity: 0.72;
  }

  /* colours: six dots a row on a phone, twelve on a wide panel; the chosen one carries a check */
  /* cells an even number of pixels wide (a 44 dot centres on a whole pixel) and a whole gap; what does not
     divide is a tail of a few pixels at the end */
  .pn-dots {
    --n: 6;
    --basis: 8px;
    --cell: clamp(
      44px,
      round(down, calc((100% - (var(--n) - 1) * var(--basis)) / var(--n)), 2px),
      56px
    );
    display: grid;
    grid-template-columns: repeat(var(--n), var(--cell));
    column-gap: round(down, calc((100% - var(--n) * var(--cell)) / (var(--n) - 1)), 1px);
    row-gap: 8px;
    justify-items: center;
  }
  /* twelve a row once they keep the 8 between them (a 616 content, from 704); six a row below that */
  @container pn (min-width: 704px) {
    .pn-dots {
      --n: 12;
    }
  }
  .pn-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    /* its edge is its own colour a shade deeper (a grey ring stair-stepped round a saturated dot); a pale dot
       still stands off the card by it */
    border: 1px solid color-mix(in oklab, var(--dot, var(--fluvy-page)) 86%, var(--fluvy-text));
    border-radius: 50%;
    background: var(--dot, var(--fluvy-page));
    color: var(--dot-ink, var(--fluvy-text-secondary));
    cursor: pointer;
  }
  .pn-dot svg {
    width: 20px;
    height: 20px;
  }
  /* any colour: a hex field of our own, the system's well behind its swatch */
  /* the language's field, its swatch well flush at the right end */
  .pn-hex {
    padding-right: 0;
  }
  .pn-hex__input {
    font-variant-numeric: tabular-nums;
  }
  .pn-hex__well {
    position: relative;
    display: inline-flex;
    flex: 0 0 44px;
    align-items: center;
    justify-content: center;
    height: 44px;
    cursor: pointer;
  }
  .pn-hex__well::before {
    content: '';
    width: 24px;
    height: 24px;
    border: 1px solid color-mix(in oklab, var(--dot) 86%, var(--fluvy-text));
    border-radius: 50%;
    background: var(--dot);
  }
  .pn-hex__well input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  /* the preview: the cards at their real size, laid out by the width it has (under the settings, or in the side
     column) — two phone tiles over the thermostat, or with room for them the desktop tiles (152) beside it */
  .pn-card--preview {
    container: pv / inline-size;
  }
  .pn-preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 12px;
    border-radius: var(--fluvy-radius-card);
    background: var(--fluvy-page);
    color: var(--fluvy-text);
  }
  /* two whole-pixel cells, the odd pixel to the gap */
  .pn-preview__tiles {
    display: grid;
    grid-template-columns: repeat(2, round(down, calc((100% - 8px) / 2 + 0.01px), 1px));
    justify-content: space-between;
    gap: 8px;
    align-content: start;
  }
  .pn-preview__extra {
    display: none;
  }
  /* the greeting over the cards: its avatar wears the highlight */
  .pn-preview__hello {
    grid-column: 1 / -1;
    min-width: 0;
  }
  /* two tiles side by side need 132 each to keep their switches beside their circles: one a row under that */
  @container pv (max-width: 311px) {
    .pn-preview__tiles {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* the desktop sizes when they fit (a 672 preview): the tiles (152) beside the thermostat, a second pair under
     them; on the dashboard's, the energy flow under the tiles and the thermostat beside both */
  @container pv (min-width: 672px) {
    .pn-preview {
      grid-template-columns: minmax(0, 312px) minmax(0, 312px);
      justify-content: center;
      gap: 16px;
      padding: 16px;
    }
    .pn-preview__tiles {
      grid-template-columns: repeat(2, minmax(0, 152px));
    }
    .pn-preview__extra {
      display: block;
    }
    .pn-preview--dash {
      grid-template-rows: auto 1fr;
      align-items: start;
    }
    .pn-preview__side {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
  }

  /* the dock at the foot: the notice, and the bar while a look is pending (in the flow, so it never covers the
     last card; sticky, so it is at hand while the page scrolls) */
  .pn-dock {
    position: sticky;
    bottom: calc(16px + var(--pn-inset-bottom));
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }
  .pn-dock:empty {
    display: none;
  }
  @container pn (min-width: 648px) {
    .pn-dock {
      bottom: calc(24px + var(--pn-inset-bottom));
    }
  }
  .pn-foot,
  .pn-notice {
    animation: pn-rise 220ms var(--fv-ease-out) both;
  }
  .pn-foot.is-leaving {
    animation: pn-sink 160ms var(--fv-ease) both;
  }
  @keyframes pn-rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  @keyframes pn-sink {
    to {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  :host([reduced-motion]) :is(.pn-foot, .pn-notice, .pn-body) {
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    :is(.pn-foot, .pn-notice, .pn-body) {
      animation: none;
    }
  }
  .pn-notice {
    align-self: center;
    display: inline-flex;
    align-items: center;
    height: 44px;
    border-radius: var(--fluvy-radius-pill, 9999px);
    white-space: nowrap;
    background: var(--fluvy-text);
    color: var(--fluvy-page);
    font-size: 14px;
    font-weight: 600;
    box-shadow: var(--fluvy-shadow-lift);
  }
  /* the bar: what changes and Discard on the first row, the two ways to apply as an equal pair under them (one
     row on a wide panel) */
  .pn-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'text discard'
      'pair pair';
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: var(--fluvy-radius-card);
    background: var(--fluvy-card-elevated);
    box-shadow:
      var(--fluvy-shadow-lift),
      inset 0 0 0 1px var(--fluvy-border);
  }
  .pn-bar--trial {
    grid-template-areas: 'text discard';
  }
  .pn-bar__text {
    grid-area: text;
    padding-left: 8px;
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .pn-bar__discard {
    grid-area: discard;
  }
  .pn-bar__pair {
    grid-area: pair;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .pn-bar__pair:has(> :nth-child(2)) {
    grid-template-columns: repeat(2, round(down, calc((100% - 8px) / 2), 1px));
    justify-content: space-between;
  }
  @container pn (min-width: 760px) {
    .pn-bar {
      grid-template-columns: minmax(0, 1fr) auto 352px;
      grid-template-areas: 'text discard pair';
    }
    .pn-bar--single {
      grid-template-columns: minmax(0, 1fr) auto 172px;
    }
    .pn-bar--trial {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'text discard';
    }
  }
`;
