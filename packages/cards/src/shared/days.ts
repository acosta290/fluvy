/**
 * The one calendar: a month of days, drawn by `monthGrid()` in the language's `.fv-month` (`fluvy/days.css`), and the
 * keys every grid of days answers (`dayStep()`), a week strip included. The owner keeps the state — the shown month,
 * the chosen day or period, the day that holds the grid's one tab stop — and says what each day is; the grid draws
 * it, turns the keys into a day, and puts the focus back on the tab stop once the owner has drawn it.
 */
import { html, nothing, type ReactiveElement, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { addDays, dayKey, isWeekend, monthWeeks, sameDay, sameMonth, shiftMonth } from './dates.js';

/** What a day of the grid is. */
export interface DayState {
  /** A chosen day, or an end of the chosen period. */
  readonly selected?: boolean;
  /** Inside the chosen period (its ends too); with the period's row ends, where its band is rounded. */
  readonly band?: { readonly first: boolean; readonly last: boolean };
  readonly today?: boolean;
  /** Cannot be chosen (a day still to come, when only the past can be). */
  readonly disabled?: boolean;
  /** Has events: a dot under the number. */
  readonly dot?: boolean;
  /** What a screen reader says for the day. */
  readonly label: string;
}

export interface MonthGridOptions {
  /** Any day of the month shown. */
  readonly month: Date;
  /** The weekday a week starts on, as `Date#getDay()` counts. */
  readonly first: number;
  /** The day that holds the tab stop (the arrows move it); outside the month, its 1st holds it. */
  readonly focus: Date;
  /** The grid's accessible name (the month and year). */
  readonly label: string;
  /** A weekday's narrow name, for the row over the days. */
  readonly weekday: (date: Date) => string;
  /** Which way the month last turned: the new one slides in from that side. */
  readonly turn: -1 | 0 | 1;
  /** `day` chooses one day (the default); `range` a period. */
  readonly mode?: 'day' | 'range';
  /**
   * The owner's geometry keeps every day a whole 44 × 44 target (the calendar card's overlapping targets): the days
   * say so (`data-target`) and the measurer holds them to it. A picker squeezed on a 320 phone (41 wide) does not.
   */
  readonly targets?: boolean;
  readonly day: (date: Date) => DayState;
  readonly onPick: (date: Date) => void;
  /** The keys asked for this day (it may be in another month: the owner turns to it). */
  readonly onMove: (date: Date) => void;
  /** The element that draws the grid: the focus follows the tab stop once it has drawn the move. */
  readonly host: ReactiveElement;
}

const STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * The day a key asks for from `day`: the arrows a day or a week, Home / End the week's ends, Page Up / Down the same
 * day a month away (kept inside that month). `undefined`: the key is not the grid's.
 */
export function dayStep(key: string, day: Date, first: number): Date | undefined {
  const step = STEPS[key];
  if (step !== undefined) return addDays(day, step);
  const column = (day.getDay() - first + 7) % 7;
  if (key === 'Home') return addDays(day, -column);
  if (key === 'End') return addDays(day, 6 - column);
  if (key === 'PageUp') return shiftMonth(day, -1);
  if (key === 'PageDown') return shiftMonth(day, 1);
  return undefined;
}

/** Puts the focus on the day holding the tab stop, once `host` has drawn it. */
export function focusStop(host: ReactiveElement, within: ParentNode | null): void {
  void host.updateComplete.then(() =>
    within?.querySelector<HTMLElement>('.fv-day[tabindex="0"]')?.focus(),
  );
}

/** A day's classes: its state, its weekend. */
export function dayClasses(date: Date, state: DayState): string {
  return [
    'fv-day',
    state.selected ? 'is-selected' : '',
    state.band ? 'is-in' : '',
    state.band?.first ? 'is-first' : '',
    state.band?.last ? 'is-last' : '',
    state.today ? 'is-today' : '',
    isWeekend(date) ? 'is-weekend' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The month: the weekday row and its weeks, the days of the months around it held but not drawn. */
export function monthGrid(o: MonthGridOptions): TemplateResult {
  const { start, rows } = monthWeeks(o.month, o.first);
  const stop = sameMonth(o.focus, o.month)
    ? o.focus
    : new Date(o.month.getFullYear(), o.month.getMonth(), 1);
  const turn = o.turn > 0 ? 'is-next' : o.turn < 0 ? 'is-previous' : '';
  const onKey = (event: KeyboardEvent): void => {
    const next = dayStep(event.key, stop, o.first);
    if (!next) return;
    event.preventDefault();
    o.onMove(next);
    // the month may turn: its grid is replaced, the element around it stays
    focusStop(
      o.host,
      (event.currentTarget as HTMLElement).closest('.fv-month')?.parentNode ?? null,
    );
  };
  const cell = (date: Date): TemplateResult => {
    if (!sameMonth(date, o.month))
      return html`<span class="fv-day is-outside" aria-hidden="true"></span>`;
    const state = o.day(date);
    return html`<button
      class=${dayClasses(date, state)}
      ?data-target=${o.targets ?? false}
      ?disabled=${state.disabled ?? false}
      tabindex=${sameDay(date, stop) ? 0 : -1}
      aria-pressed=${state.selected || state.band ? 'true' : 'false'}
      aria-current=${state.today ? 'date' : nothing}
      aria-label=${state.label}
      @click=${() => o.onPick(date)}
    >
      <span>${date.getDate()}</span>${state.dot ? html`<i class="fv-day__dot"></i>` : nothing}
    </button>`;
  };
  // keyed by month: a new month is a new grid that slides in; a choice inside the month only moves the fills
  return html`${keyed(
    dayKey(new Date(o.month.getFullYear(), o.month.getMonth(), 1)),
    html`<div class="fv-month ${turn}">
      <div class="fv-dow" aria-hidden="true">
        ${Array.from({ length: 7 }, (_, index) => html`<span>${o.weekday(addDays(start, index))}</span>`)}
      </div>
      <div
        class="fv-days ${o.mode === 'range' ? 'fv-days--range' : ''}"
        role="group"
        aria-label=${o.label}
        @keydown=${onKey}
      >
        ${Array.from({ length: rows * 7 }, (_, index) => cell(addDays(start, index)))}
      </div>
    </div>`,
  )}`;
}
