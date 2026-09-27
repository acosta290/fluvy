import { css } from 'lit';

/** Quiet moments: an empty day and the skeleton while it loads. */
export const quietStyles = css`
  .av-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
  .av-empty > .fv-empty-state {
    align-self: stretch;
    background: var(--fluvy-page-alt, var(--fluvy-card));
  }
  .av-empty__action {
    padding: 0;
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-border);
  }
  .av-skeleton {
    display: grid;
    grid-template-columns: var(--av-time) 40px minmax(0, 1fr);
    column-gap: 12px;
    align-items: center;
    height: 64px;
  }
  :host([compact]) .av-skeleton {
    grid-template-columns: 0 40px minmax(0, 1fr);
    column-gap: 0 12px;
  }
  .av-skeleton span {
    height: 12px;
    border-radius: 6px;
    background: var(--fluvy-border);
    animation: av-shimmer 900ms ease-in-out infinite alternate;
  }
  .av-skeleton span:nth-child(2) {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  .av-skeleton span:nth-child(3) {
    width: round(down, 60%, 4px);
  }
  .av-skeleton:nth-child(3n + 2) span:nth-child(3) {
    width: round(down, 44%, 4px);
  }
  .av-skeleton:nth-child(3n) span:nth-child(3) {
    width: round(down, 72%, 4px);
  }
`;
