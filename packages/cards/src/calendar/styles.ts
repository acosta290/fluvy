import { css } from 'lit';

/**
 * What the card adds to the approved sheet (`packages/ui/styles/calendar.css`): the fluid geometry
 * (the sheet is drawn at 360), the selection the sheet has no frame for, the tones its five
 * calendars never needed, and the one-liners and skeleton of the states it does not show.
 */
export const calendarStyles = css`
  /* the sheet fixes 360; a dashboard column decides here */
  .cd-card {
    width: 100%;
  }

  /* ---------- seven columns, fluid ----------
     The card computes the tracks: 7 × 44 on a 46 pitch at the sheet's 320, wider gaps in a wider
     column, narrower days in a narrower one — every edge on a whole pixel. */
  .cd-card {
    --fv-tracks: var(--cd-tracks, repeat(7, 44px));
    --fv-justify: start;
  }

  .fv-dow > span {
    width: var(--cd-cell, 44px);
  }

  /* A day is always a 44 target. Where seven of them do not fit (under 320), the targets overlap by a
     few px, centred on their columns, and the plate is drawn at the column's width instead. */
  .fv-day {
    --fv-day-inset: 0 calc((44px - var(--cd-cell, 44px)) / 2);
    margin-left: calc((var(--cd-cell, 44px) - 44px) / 2);
  }

  /* ---------- event rows ---------- */
  .cd-event__time {
    flex-basis: var(--cd-time, 40px);
    width: var(--cd-time, 40px);
  }

  .cd-event,
  .cd-up {
    border-radius: var(--fluvy-radius-control);
  }

  /* ---------- timeline ---------- */
  button.cd-block {
    cursor: pointer;
    transition: opacity var(--fv-base) var(--fv-ease);
  }

  button.cd-block:active {
    opacity: 0.72;
  }

  .cd-block--abuts {
    box-shadow: inset 0 -1px 0 var(--fluvy-card);
  }

  /* the tones the sheet's five calendars never needed */
  .fv-bar--fan {
    background: var(--fluvy-state-climate-fan);
  }

  .fv-bar--dry {
    background: var(--fluvy-state-climate-dry);
  }

  .cd-block--fan {
    --tone-ink: var(--fluvy-state-climate-fan);
    --tone-fill: var(--fluvy-state-climate-fan-fill);
    --tone-on: var(--fluvy-state-climate-fan-on-fill);
  }

  .cd-block--dry {
    --tone-ink: var(--fluvy-state-climate-dry);
    --tone-fill: var(--fluvy-state-climate-dry-fill);
    --tone-on: var(--fluvy-state-climate-dry-on-fill);
  }

  .cd-block--solar {
    --tone-ink: var(--fluvy-state-energy-solar);
    --tone-fill: var(--fluvy-state-energy-solar-fill);
    --tone-on: var(--fluvy-state-energy-solar-on-fill);
  }

  /* ---------- tiles ---------- */
  .cd-tile {
    display: block;
    height: 168px;
    text-align: left;
  }

  .fv-tile--off {
    display: flex;
    height: 76px;
  }

  /* ---------- one quiet line instead of an empty box ---------- */
  .cd-note {
    height: 20px;
    margin-top: 16px;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: var(--fluvy-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cd-note--tight {
    margin-top: 8px;
  }

  .cd-note--off {
    color: var(--fluvy-unavailable);
  }

  /* ---------- loading: the event row's anatomy, without the words ---------- */
  .cd-sk {
    display: block;
  }

  .cd-sk--time {
    align-self: flex-end;
    width: 32px;
    height: 12px;
  }

  .cd-sk--bar {
    background: var(--fluvy-page);
  }

  .cd-sk--title {
    width: 120px;
    height: 16px;
  }

  .cd-sk--sub {
    width: 80px;
    height: 12px;
    margin-top: 8px;
  }

  /* in a tile each bar sits in its own 20 px line */
  .cd-tile .cd-sk {
    height: 12px;
    margin: 4px 0;
  }

  .cd-tile .cd-sk--title {
    width: 96px;
  }

  .cd-tile .cd-sk--sub {
    width: 64px;
  }
`;
