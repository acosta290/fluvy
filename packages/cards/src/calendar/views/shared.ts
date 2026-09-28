import { strings } from '@fluvy/core';
import { listRow, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { sameDay } from '../../shared/dates.js';
import { FACE, textWidth } from '../fit.js';
import type { DayEvent } from '../model.js';
import type { ViewContext } from './context.js';

const s = strings('calendar');

/** Rows a day lists before the rest folds into "+N more": nine events must leave a usable card. */
export const MAX_ROWS = 6;

/* ---------- surface and head ---------- */

export const headTone = (ctx: ViewContext): Tone =>
  ctx.status === 'unavailable' ? 'off' : 'accent';

/** The card surface. `extra` carries a view's own classes and custom properties (the grid's columns). */
export function surface(
  ctx: ViewContext,
  body: unknown,
  extra: { readonly classes?: string; readonly style?: string } = {},
): TemplateResult {
  const off = ctx.status === 'unavailable' ? 'is-unavailable is-off' : '';
  const time = timeColumn(ctx);
  const style = `${time === 40 ? '' : `--cd-time:${time}px;`}${extra.style ?? ''}`;
  return html`<article
    class="fv-card cd-card ${off} ${extra.classes ?? ''}"
    data-card
    style=${style || nothing}
  >
    ${body}
  </article>`;
}

/** Room for the head's title and sub: the column minus the icon and whatever sits in the trailing slot. */
export const headRoom = (ctx: ViewContext, trailing: number): number =>
  ctx.width - 56 - (trailing > 0 ? trailing + 12 : 0) - 1;

/** The time column is the sheet's 40 on a 24-hour clock; "12:30 PM" needs more, on the grid. */
function timeColumn(ctx: ViewContext): number {
  if (!ctx.words.hour12) return 40;
  const widest = Math.max(
    ...[new Date(2000, 0, 1, 12, 30), new Date(2000, 0, 1, 22, 30)].map((date) =>
      textWidth(ctx.words.time(date), FACE.time),
    ),
  );
  return Math.max(40, Math.ceil(widest / 4) * 4);
}

/* ---------- one-liners ---------- */

/** One quiet line where a list would be: never an empty box. `off` is the ink of things that cannot be read. */
export const note = (
  text: string,
  kind: 'quiet' | 'off' = 'quiet',
  tight = false,
): TemplateResult =>
  html`<p class="cd-note ${kind === 'off' ? 'cd-note--off' : ''} ${tight ? 'cd-note--tight' : ''}">
    ${text}
  </p>`;

/** What stands in for the content while nothing can be shown; `null` when the view should draw itself. */
export function outage(ctx: ViewContext): TemplateResult | null {
  if (ctx.status === 'unavailable') return note(s(ctx.hass, 'unavailable'), 'off');
  if (ctx.status === 'failed') return note(s(ctx.hass, 'failed'), 'off');
  return null;
}

/** The line about calendars that could not be read while the others could. */
export const notice = (ctx: ViewContext): TemplateResult | typeof nothing =>
  ctx.notice ? note(ctx.notice, 'off') : nothing;

/** Loading: the event row's anatomy without its words. */
export function skeleton(count: number, afterLabel = false): TemplateResult {
  return html`<div
    class="cd-events ${afterLabel ? 'cd-events--after-label' : ''}"
    aria-hidden="true"
  >
    ${Array.from(
      { length: count },
      () =>
        html`<div class="cd-event">
          <span class="cd-event__time"><span class="fv-skeleton cd-sk cd-sk--time"></span></span>
          <span class="cd-event__bar cd-sk--bar"></span>
          <span class="fv-row__text"
            ><span class="fv-skeleton cd-sk cd-sk--title"></span
            ><span class="fv-skeleton cd-sk cd-sk--sub"></span
          ></span>
        </div>`,
    )}
  </div>`;
}

/* ---------- event rows ---------- */

export const titleOf = (ctx: ViewContext, item: DayEvent): string =>
  item.event.summary || s(ctx.hass, 'untitled');

/** Where, or else whose: a row always has its second line. */
export const placeOf = (ctx: ViewContext, item: DayEvent): string =>
  item.event.location || ctx.nameOf(item.event.calendar);

/** "09:30" · "All day" — the one-line form used in subs. */
export const whenOf = (ctx: ViewContext, item: DayEvent): string =>
  item.whole ? ctx.words.t('common.all_day') : ctx.words.time(item.from);

/** What a screen reader hears for an event: "Dentist · 09:30 – 10:15 · Ona · Clínica Sants". */
export function eventAria(ctx: ViewContext, item: DayEvent): string {
  const span =
    item.whole || item.instant
      ? whenOf(ctx, item)
      : `${ctx.words.time(item.from)} – ${ctx.words.time(item.to)}`;
  return `${titleOf(ctx, item)} · ${span} · ${placeOf(ctx, item)}`;
}

/** Enter and Space activate an element that plays a button (`role="button"`). */
export const onActivate =
  (run: () => void) =>
  (event: KeyboardEvent): void => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault();
      run();
    }
  };

/** A tappable 60 px row (`role="button"`): the markup the event row and the upcoming row share. */
export function tapRow(
  classes: string,
  label: string,
  run: () => void,
  body: TemplateResult,
): TemplateResult {
  return html`<div
    class="${classes} fv-row--tap"
    data-target
    role="button"
    tabindex="0"
    aria-label=${label}
    @click=${run}
    @keydown=${onActivate(run)}
  >
    ${body}
  </div>`;
}

/** Time column right-aligned, the 4 px bar in the calendar's tone, title / sub; a past event goes quiet. */
export function eventRow(ctx: ViewContext, item: DayEvent): TemplateResult {
  const { words } = ctx;
  const time = item.whole
    ? html`<span>${s(ctx.hass, 'all_day_top')}</span
        ><span class="cd-event__end">${s(ctx.hass, 'all_day_bottom')}</span>`
    : html`<span>${words.time(item.from)}</span
        >${item.instant ? nothing : html`<span class="cd-event__end">${words.time(item.to)}</span>`}`;
  return tapRow(
    `cd-event ${item.past ? 'is-past' : ''}`,
    eventAria(ctx, item),
    () => ctx.open(item.event.calendar),
    html`<span class="cd-event__time">${time}</span>
      <span class="cd-event__bar fv-bar--${ctx.toneOf(item.event.calendar)}"></span>
      <span class="fv-row__text"
        ><span class="fv-row__title">${titleOf(ctx, item)}</span
        ><span class="fv-row__sub">${placeOf(ctx, item)}</span></span
      >`,
  );
}

/** The row a long list folds into. It opens the calendar, where the whole day is. */
export const moreRow = (ctx: ViewContext, text: string): TemplateResult =>
  listRow({
    icon: 'dots',
    tone: 'neutral',
    title: text,
    trailing: 'chevron',
    onTap: () => ctx.open(),
  });

export interface DayList {
  /** The rows — or the skeleton while the day is not read yet, or the "No events" line. */
  readonly body: TemplateResult;
  /** The "+N more" row when the day was capped, for the view to place among its own rows. */
  readonly more: TemplateResult | typeof nothing;
}

/**
 * A day's event rows, capped at `max`. Today keeps what is still to come in sight: past events leave
 * the list first ("3 earlier"); any other day is read from its morning ("+3 more").
 */
export function dayList(
  ctx: ViewContext,
  day: Date,
  options: {
    readonly afterLabel?: boolean;
    readonly max?: number;
    readonly items?: readonly DayEvent[];
  } = {},
): DayList {
  const afterLabel = options.afterLabel ?? false;
  if (ctx.status === 'loading' || !ctx.agenda.covers(day))
    return { body: skeleton(3, afterLabel), more: nothing };
  const items = options.items ?? ctx.agenda.on(day);
  if (!items.length) return { body: note(ctx.words.events(0), 'quiet', afterLabel), more: nothing };

  const max = options.max ?? MAX_ROWS;
  const hidden = Math.max(0, items.length - max);
  const upcoming = items.findIndex((item) => !item.past);
  const start =
    hidden > 0 && sameDay(day, ctx.agenda.today)
      ? Math.min(upcoming < 0 ? items.length : upcoming, hidden)
      : 0;
  const shown = items.slice(start, start + max);
  return {
    body: html`<div class="cd-events ${afterLabel ? 'cd-events--after-label' : ''}">
      ${shown.map((item) => eventRow(ctx, item))}
    </div>`,
    more:
      hidden > 0
        ? moreRow(ctx, s(ctx.hass, start === hidden ? 'earlier' : 'more', { count: hidden }))
        : nothing,
  };
}

/* ---------- seven columns ---------- */

export interface Columns {
  /** Drawn width of a day: the sheet's 44, less only when seven of them do not fit the column. */
  readonly cell: number;
  /** `grid-template-columns`: every column edge on a whole pixel, the first on the left edge, the last on the right one. */
  readonly tracks: string;
}

/** Seven day columns across `width`, the sheet's geometry made fluid: 7 × 44 on a 46 pitch at 320. */
export function sevenColumns(width: number): Columns {
  const cell = Math.min(44, Math.max(24, Math.floor((width - 12) / 28) * 4));
  const rest = Math.max(0, width - 7 * cell);
  const edge = (index: number): number => Math.round((index * rest) / 6);
  const tracks = Array.from(
    { length: 7 },
    (_, index) => `${cell + (index < 6 ? edge(index + 1) - edge(index) : 0)}px`,
  ).join(' ');
  return { cell, tracks };
}

export const columnStyle = (columns: Columns): string =>
  `--cd-cell:${columns.cell}px;--cd-tracks:${columns.tracks};`;
