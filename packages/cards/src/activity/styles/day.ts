import { css } from 'lit';

/** The day: its title, eyebrow and summary, the controls on the date's line, and the ways between days. */
export const dayStyles = css`
  .av-day {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(4, auto);
    grid-template-areas: 'titles prev today next pick';
    align-items: center;
    column-gap: 8px;
  }
  .av-day__titles {
    grid-area: titles;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    margin: 0 16px 0 -8px;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--fluvy-radius-control);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color 160ms var(--fv-ease, ease);
  }
  /* the day's controls sit on the date's line, whatever the summary under it takes */
  .av-day__prev,
  .av-day__today,
  .av-day__next,
  .av-day__pick {
    align-self: start;
    margin-top: 24px;
  }
  :host([compact]) .av-day__prev,
  :host([compact]) .av-day__next {
    margin-top: 16px;
  }
  .av-day__prev {
    grid-area: prev;
  }
  .av-day__today {
    grid-area: today;
  }
  .av-day__next {
    grid-area: next;
  }
  .av-day__pick {
    grid-area: pick;
  }
  :host([compact]) .av-day {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    grid-template-areas:
      'prev titles next'
      'back back back';
    column-gap: 4px;
  }
  :host([compact]) .av-day__titles {
    align-items: center;
    margin: 0;
    text-align: center;
  }
  :host([compact]) .av-day__today,
  :host([compact]) .av-day__pick {
    display: none;
  }
  .av-day__back {
    grid-area: back;
    display: flex;
    justify-content: center;
    margin-top: 8px;
  }
  .av-day__eyebrow {
    max-width: 100%;
    font-size: 13px;
    line-height: 20px;
    font-weight: 600;
    color: var(--fluvy-accent-text, var(--fluvy-accent));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .av-day__date {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    font-size: 32px;
    line-height: 40px;
    font-weight: 600;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .av-day__date > span:not(.av-day__caret) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* a period's two ends each stay whole; the line breaks between them */
  .av-day__date.is-range {
    white-space: normal;
  }
  .av-day__date.is-range > span:not(.av-day__caret) {
    text-wrap: balance;
  }
  .av-end-part {
    white-space: nowrap;
  }
  :host([compact]) .av-day__date {
    font-size: 24px;
    line-height: 32px;
    justify-content: center;
  }
  /* a title that would not fit its room steps down, never cut: 32 → 24 on a desktop, 24 → 20 on a phone */
  .av-day__date.is-smaller {
    font-size: 24px;
    line-height: 36px;
  }
  :host([compact]) .av-day__date.is-smallest {
    font-size: 20px;
    line-height: 32px;
  }
  /* still too wide at the last step: two lines (its two ends, or its words), the box as wide as the wider line, the
     caret after the last */
  .av-day__date.is-wrap > span:not(.av-day__caret) {
    flex-direction: column;
    align-items: inherit;
    overflow: visible;
  }
  .av-day__date.is-wrap > .av-long {
    display: inline-flex;
  }
  :host([compact]) .av-day__date.is-wrap > .av-long {
    display: none;
  }
  :host([compact]) .av-day__date.is-wrap > .av-short {
    display: inline-flex;
    align-items: center;
  }
  .av-line-part {
    white-space: nowrap;
  }
  .av-day__date.is-wrap > .av-day__caret {
    align-self: flex-end;
    align-items: center;
    height: 32px;
  }

  .av-day:has(.av-day__date.is-smaller)
    > :is(.av-day__prev, .av-day__today, .av-day__next, .av-day__pick) {
    margin-top: 20px;
  }
  .av-short,
  :host([compact]) .av-long {
    display: none;
  }
  :host([compact]) .av-short {
    display: inline;
  }
  /* the phone's title opens the dates: it says so */
  .av-day__caret {
    display: none;
    flex: 0 0 auto;
    color: var(--fluvy-text-secondary);
  }
  :host([compact]) .av-day__caret {
    display: inline-flex;
  }
  .av-day__caret svg {
    width: 16px;
    height: 16px;
  }
  .av-day__summary {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    margin-top: 4px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: var(--fluvy-text-secondary);
    font-variant-numeric: tabular-nums;
  }
  :host([compact]) .av-day__summary {
    justify-content: center;
    text-align: center;
  }
  /* a part alone on its line and still wider than it (a card on a 320 phone) breaks between its words */
  .av-day__summary > .av-part {
    white-space: normal;
  }
  /* parts on a line, a "·" in the gap before each; a part that starts a line has none (marked once laid out) */
  .av-parts {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    min-width: 0;
  }
  .av-part {
    position: relative;
    white-space: nowrap;
  }
  /* a detail's part alone on its line and still wider than it (a long date at 360) breaks between its words */
  .av-parts > .av-part {
    white-space: normal;
    text-wrap: pretty;
  }
  .av-part + .av-part:not(.is-start)::before {
    content: '·';
    position: absolute;
    left: -12px;
    width: 12px;
    text-align: center;
  }
  .av-num {
    display: inline-block;
    animation: av-roll 240ms var(--fv-ease-out, ease-out) both;
  }
`;
