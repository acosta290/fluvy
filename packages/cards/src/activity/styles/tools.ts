import { css } from 'lit';

/** The tools: search, sources and the filters (the language's chips on the page), and the text links. */
export const toolStyles = css`
  .av-tools {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }
  /* the language's field on the page's ground (.fv-field--on-page), taking the row beside Sources */
  .av-search {
    flex: 1 1 auto;
    min-width: 0;
  }
  /* the count of sources in use rides the button's corner */
  .av-sources {
    position: relative;
  }
  .av-badge {
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
    box-shadow: 0 0 0 2px var(--av-ground);
    font-size: 11px;
    line-height: 20px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  /* the filters are the language's chips (a 36 pill in a 44 target), on the page: the card's fill and hairline */
  .av-filters {
    margin-top: 8px;
  }
  .av-filters .fv-chip__pill {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .av-filters .fv-chip.is-active .fv-chip__pill {
    background: var(--fluvy-accent-fill);
    box-shadow: inset 0 0 0 1px var(--fluvy-accent-fill-border);
  }
  .av-filters b {
    font-weight: 600;
    color: var(--fluvy-text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .av-filters .fv-chip.is-active b {
    color: inherit;
    opacity: 0.72;
  }
  .av-filters--rows {
    display: flex;
    flex-direction: column;
  }
  .av-filters__row {
    display: grid;
    grid-template-columns: repeat(
      var(--n),
      round(down, calc((100% - (var(--n) - 1) * 8px) / var(--n) + 0.01px), 1px)
    );
    column-gap: 8px;
  }
  .av-filters__row .fv-chip {
    width: auto;
    min-width: 0;
  }
  .av-filters--strip {
    display: flex;
    gap: 8px;
    margin: 8px -4px 0 -16px;
    padding: 0 4px 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
    /* chips scrolling past the edges fade out instead of being cut; while more lies to the right, the fade is long
       enough to always run into a chip (a strip that ends in a gap would not say it goes on) */
    --fade-end: 16px;
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 16px,
      #000 calc(100% - var(--fade-end)),
      transparent
    );
  }
  .av-filters--strip[data-more] {
    --fade-end: 40px;
  }
  .av-filters--strip::-webkit-scrollbar {
    display: none;
  }
  .av-filters--loading {
    display: flex;
    gap: 8px;
    overflow: hidden;
  }
  /* a filter's place while the day loads: its pill, grey, in its 44 row */
  .av-ghost {
    flex: 0 0 auto;
    height: 36px;
    margin: 4px 0;
    border-radius: var(--fluvy-radius-pill, 9999px);
    background: var(--fluvy-border);
    animation: av-shimmer 900ms ease-in-out infinite alternate;
  }
  .av-narrowed {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 0;
  }
  .av-narrowed__text {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13px;
    line-height: 20px;
    font-weight: 500;
    color: var(--fluvy-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
