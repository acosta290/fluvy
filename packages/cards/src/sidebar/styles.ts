import { css } from 'lit';

/** On `hui-root`: its dashboard draws a sidebar of its own, and how (`start` or `end`; `beside`, `top` or `drawer`; `no-tabs`). */
export const SIDE_ATTRIBUTE = 'fluvy-side';

const MARK = `:host([${SIDE_ATTRIBUTE}])`;
const has = (word: string): string => `:host([${SIDE_ATTRIBUTE}~="${word}"])`;
const SIDE = '#view > fluvy-sidebar';

/**
 * What the dashboard's root wears for its sidebar: the place of the one element in Home Assistant's view row. Every
 * rule hangs on the root's mark, so a dashboard without a sidebar reads none of it. Beside the views it keeps its
 * width (`--fluvy-side-width`, written on the element from checked figures) and stays in the window while the page
 * scrolls, from under the header to the view's foot (the view's own paddings, read off it: `--fluvy-side-top` and
 * `-bottom`), at this device's size with the view (a length inside it is a view's pixel, so the window's are divided
 * by the size); at the end it is drawn after the view it stands before; on a phone it stands above the view, or takes
 * no room at all (its drawer and its round are over the page). `no-tabs`: the header's tabs give way to its menu, the
 * actions keeping the bar's end.
 */
export const rootCss = `${MARK} ${SIDE} { display: block; box-sizing: border-box; min-width: 0; max-width: none; zoom: var(--fluvy-zoom, 1); }
${has('beside')} ${SIDE} { flex: 0 0 var(--fluvy-side-width, 280px); position: sticky; top: calc(var(--fluvy-side-top, 0px) / var(--fluvy-zoom, 1)); align-self: flex-start; height: calc((100vh - var(--fluvy-side-top, 0px) - var(--fluvy-side-bottom, 0px)) / var(--fluvy-zoom, 1)); height: calc((100dvh - var(--fluvy-side-top, 0px) - var(--fluvy-side-bottom, 0px)) / var(--fluvy-zoom, 1)); }
${has('beside')} #view > :not(fluvy-sidebar, hui-view-background) { min-width: 0; }
${has('end')} ${SIDE} { order: 1; }
${has('top')} #view { flex-direction: column; }
${has('top')} ${SIDE} { flex: none; }
${has('top')} #view > :not(fluvy-sidebar, hui-view-background) { flex: 1 1 auto; }
${has('drawer')} ${SIDE} { flex: none; width: 0; height: 0; }
${has('no-tabs')} .toolbar > ha-tab-group { display: none; }
${has('no-tabs')} .toolbar > .action-items { margin-inline-start: auto; }`;

/**
 * The sidebar's own rules, on the language's card, circle and round. Its surface is the card's (`panel`: from edge to
 * edge, square, a hairline at its inner edge alone; `card`: one card, the view's gaps round it; `plain`: none), its
 * head and its foot stay and its middle scrolls between them. On a surface the cards it holds wear none and stand in
 * its column, 40 apart with a hairline between, as the Expander's do; with none they keep their own, a section's 16
 * apart. Tokens only.
 */
export const sidebarStyles = css`
  :host {
    --sb-pad: 20px;
    --sb-gap: 40px;
    --sb-fold: 20px;
    --sb-out-x: var(--ha-view-sections-column-gap, 32px);
    --sb-out-y: var(--ha-view-sections-row-gap, 24px);
    /* the page's inks as it found them, for what stands on the page (as onPageStyles keeps them) */
    --fv-page-text: var(--fluvy-text);
    --fv-page-text-secondary: var(--fluvy-text-secondary);
    -webkit-tap-highlight-color: transparent;
  }
  .sb {
    display: block;
    box-sizing: border-box;
    height: 100%;
  }
  .sb--card,
  .sb--plain {
    padding-block: var(--sb-out-y);
    padding-inline: var(--sb-out-x) 0;
  }
  :host([side='end']) :is(.sb--card, .sb--plain) {
    padding-inline: 0 var(--sb-out-x);
  }
  .sb-surface {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
  }
  .sb-surface.fv-card {
    padding: 0;
  }
  /* the panel: the card's fill from edge to edge, closed at its inner edge alone by a hairline laid over that edge
     (it takes none of the column's room) */
  .sb--panel > .sb-surface {
    position: relative;
    border-radius: 0;
    box-shadow: none;
  }
  .sb--panel > .sb-surface::after {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    width: 1px;
    background: var(--fluvy-edge, var(--fluvy-border));
    pointer-events: none;
  }
  :host([side='end']) .sb--panel > .sb-surface::after {
    inset-inline: 0 auto;
  }
  :host([borderless]) .sb--panel > .sb-surface::after {
    content: none;
  }

  /* ---------- the head, the middle, the foot ---------- */
  .sb-head,
  .sb-foot {
    position: relative;
    flex: none;
    padding: var(--sb-pad);
  }
  .sb-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--sb-pad);
    overflow: hidden auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    --sb-under: 0px;
    --sb-over: 0px;
    -webkit-mask-image: linear-gradient(
      #0000,
      #000 var(--sb-under),
      #000 calc(100% - var(--sb-over)),
      #0000
    );
    mask-image: linear-gradient(
      #0000,
      #000 var(--sb-under),
      #000 calc(100% - var(--sb-over)),
      #0000
    );
  }
  .sb-body::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  /* it fades only where it goes on: under the head once scrolled, over the foot while there is more */
  .sb-body.is-under {
    --sb-under: 24px;
  }
  .sb-body.is-over {
    --sb-over: 24px;
  }
  .sb-body.is-empty {
    padding-block: 0;
  }
  .sb-head > * + *,
  .sb-body > * + *,
  .sb-foot > * + * {
    margin-top: var(--sb-gap);
  }
  /* the fold's round keeps to the foot's cards: the surface's own padding under them */
  .sb-foot > * + .sb-fold {
    margin-top: var(--sb-fold);
  }
  /* the hairline that parts what stays from what scrolls, in the column */
  .sb-head.is-ruled::after,
  .sb-foot.is-ruled::before {
    content: '';
    position: absolute;
    inset-inline: var(--sb-pad);
    height: 1px;
    background: var(--fluvy-border);
  }
  .sb-head.is-ruled::after {
    bottom: 0;
  }
  .sb-foot.is-ruled::before {
    top: 0;
  }

  /* ---------- its cards ---------- */
  .sb-cards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sb-gap);
  }
  /* on the surface a card of Fluvy's draws none of its own and turns its padding out, one of Home Assistant's wears
     none: the Expander's way (expander-card.ts), with a hairline over each card that has something above it in its
     list (data-ruled, written by the sidebar) */
  .fv-card .sb-cards {
    --fv-held: none;
    --fv-held-bleed: -1;
    --ha-card-background: transparent;
    --ha-card-border-width: 0px;
    --ha-card-box-shadow: none;
    --ha-card-backdrop-filter: none;
    --ha-card-border-radius: var(--fluvy-radius-control);
    --fluvy-page-ink: initial;
    --fluvy-page-ink-2: initial;
  }
  .fv-card .sb-cards ::slotted(*),
  .fv-card .sb-cards + .sb-menu {
    position: relative;
  }
  .fv-card .sb-cards ::slotted([data-ruled])::before,
  .fv-card .sb-cards + .sb-menu::before {
    content: '';
    position: absolute;
    top: calc(var(--sb-gap) / -2);
    left: 0;
    right: 0;
    height: 1px;
    background: var(--fluvy-border);
  }
  /* a card that is not Fluvy's keeps its own padding (Home Assistant's 16): turned out as far as that, less above
     and below, where a picture has none to give */
  .fv-card .sb-cards ::slotted(.ex-other) {
    margin: -12px -16px;
  }
  .fv-card .sb-cards ::slotted(.ex-other[data-ruled])::before {
    top: calc(12px - var(--sb-gap) / 2);
    left: 16px;
    right: 16px;
  }
  /* without a surface: each card on its own, a section's 16 apart, the head and the foot with them */
  .sb--plain,
  .sb--top {
    --sb-pad: 0px;
    --sb-gap: 16px;
    --sb-fold: 16px;
  }
  .sb--plain .sb-head {
    padding-bottom: var(--sb-gap);
  }
  .sb--plain .sb-foot {
    padding-top: var(--sb-gap);
  }
  .sb--plain :is(.sb-head, .sb-foot)::before,
  .sb--plain :is(.sb-head, .sb-foot)::after {
    content: none;
  }

  /* ---------- the menu ---------- */
  .sb-menu {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .sb-item {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 44px;
    border-radius: 22px;
    color: var(--fluvy-text-secondary);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    text-decoration: none;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    transition: color var(--fv-base) var(--fv-ease);
  }
  .sb-item.is-current {
    color: var(--fluvy-text);
  }
  .sb-item .fv-ico {
    transition:
      transform var(--fv-fast) var(--fv-ease),
      background-color var(--fv-base) var(--fv-ease),
      color var(--fv-base) var(--fv-ease);
  }
  .sb-item:active {
    transform: none;
  }
  .sb-item:active .fv-ico {
    transform: scale(0.94);
  }
  .sb-item:focus-visible {
    outline: 2px solid var(--fluvy-accent);
    outline-offset: 2px;
  }
  .sb-item__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  @media (hover: hover) {
    .sb-item:hover {
      color: var(--fluvy-text);
    }
  }
  /* on the page (no surface): the page's inks, a resting circle as a round stands there */
  :is(.sb--plain, .sb--top) .sb-menu {
    --fluvy-text: var(--fluvy-page-ink, var(--fv-page-text));
    --fluvy-text-secondary: var(--fluvy-page-ink-2, var(--fv-page-text-secondary));
  }
  :is(.sb--plain, .sb--top) .sb-item .fv-ico--neutral {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
  }

  /* ---------- folded to its icons ---------- */
  .is-rail {
    --sb-pad: 8px;
    --sb-fold: 8px;
  }
  .sb-fold {
    display: flex;
    justify-content: flex-end;
  }
  :host([side='end']) .sb-fold {
    justify-content: flex-start;
  }
  .is-rail .sb-fold {
    justify-content: center;
  }
  :host(:dir(rtl)) .sb-fold svg {
    transform: scaleX(-1);
  }

  /* ---------- above the view (a phone) ---------- */
  .sb--top {
    height: auto;
    padding: 16px 16px 0;
  }
  .sb--top > * + * {
    margin-top: var(--sb-gap);
  }
  .sb-menu--row {
    display: flex;
    margin-inline: -16px;
    padding: 2px 16px;
    overflow: auto hidden;
    scrollbar-width: none;
  }
  .sb-menu--row::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  .sb-menu--row > .sb-item {
    flex: none;
    width: auto;
    padding-inline-end: 16px;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
  }
  /* a resting page's glyph stands on its pill: a circle of the page's colour would read as a bite out of it */
  .sb-menu--row .sb-item .fv-ico--neutral {
    background: none;
    box-shadow: none;
  }

  /* ---------- the drawer (a phone) ---------- */
  .sb-open {
    position: fixed;
    z-index: 6;
    inset-block-end: calc(16px + env(safe-area-inset-bottom, 0px));
    inset-inline-start: calc(16px + env(safe-area-inset-left, 0px));
    background: color-mix(in srgb, var(--fluvy-card) 88%, transparent);
    /* it floats over whatever the dashboard has at its foot: the knob's drop says so, as the wall's corner */
    box-shadow:
      inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border)),
      var(--fluvy-shadow-knob);
    color: var(--fluvy-text-secondary);
  }
  :host([side='end']) .sb-open {
    inset-inline: auto calc(16px + env(safe-area-inset-right, 0px));
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
    background: color-mix(in srgb, var(--fluvy-neutral-05) 48%, transparent);
    color: inherit;
    overscroll-behavior: contain;
    animation: sb-fade 240ms var(--fv-ease) both;
  }
  dialog[open] {
    display: flex;
  }
  :host([side='end']) dialog {
    justify-content: flex-end;
  }
  dialog::backdrop {
    background: none;
  }
  /* the drawer takes the focus as it opens (the keyboard's next stop is its first page), and shows no ring for it */
  .sb--drawer {
    --sb-from: -100%;
    width: min(320px, 100% - 56px);
    outline: none;
    animation: sb-in 320ms var(--fv-ease-out) both;
  }
  :host([side='end']) .sb--drawer,
  :host(:dir(rtl)) .sb--drawer {
    --sb-from: 100%;
  }
  :host([side='end']:dir(rtl)) .sb--drawer {
    --sb-from: -100%;
  }
  .sb--drawer > .sb-surface {
    border-radius: 0;
    border-start-end-radius: var(--fluvy-radius-xl);
    border-end-end-radius: var(--fluvy-radius-xl);
    box-shadow:
      0 0 0 1px var(--fluvy-edge, var(--fluvy-border)),
      var(--fluvy-shadow-lift);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-inline-start: env(safe-area-inset-left, 0px);
  }
  :host([side='end']) .sb--drawer > .sb-surface {
    border-radius: 0;
    border-start-start-radius: var(--fluvy-radius-xl);
    border-end-start-radius: var(--fluvy-radius-xl);
    padding-inline: 0 env(safe-area-inset-right, 0px);
  }
  /* its close round stands where the round that opened it was (16 from the window's edges, the column being 20):
     the same finger closes it */
  .sb--drawer .sb-fold {
    justify-content: flex-start;
    margin-inline: -4px;
    margin-bottom: -4px;
  }
  :host([side='end']) .sb--drawer .sb-fold {
    justify-content: flex-end;
  }
  dialog.is-leaving {
    animation: sb-out 200ms var(--fv-ease) both;
  }
  dialog.is-leaving .sb--drawer {
    animation: sb-away 200ms var(--fv-ease) both;
  }
  @keyframes sb-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes sb-out {
    to {
      opacity: 0;
    }
  }
  @keyframes sb-in {
    from {
      transform: translateX(var(--sb-from));
    }
  }
  @keyframes sb-away {
    to {
      transform: translateX(var(--sb-from));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog,
    .sb--drawer {
      animation: none !important;
    }
  }
  :host([reduced-motion]) dialog,
  :host([reduced-motion]) .sb--drawer {
    animation: none !important;
  }
`;
