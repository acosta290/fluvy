import { strings } from '@fluvy/core';
import { head, label, round } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { dayKey, sameDay } from '../../shared/dates.js';
import { monthGrid } from '../../shared/days.js';
import { FACE, fitText } from '../fit.js';
import type { ViewContext } from './context.js';
import {
  columnStyle,
  dayList,
  headRoom,
  headTone,
  notice,
  outage,
  sevenColumns,
  surface,
} from './shared.js';

const s = strings('calendar');

const NAV = 96; // the ‹ › pair: 44 + 8 + 44

/** The language's month (`monthGrid`): the selected day filled, weekends quiet, one dot per day with events. */
function monthDays(ctx: ViewContext): TemplateResult {
  const { agenda, words } = ctx;
  return monthGrid({
    month: ctx.month,
    first: ctx.first,
    focus: ctx.focus,
    label: words.month(ctx.month),
    weekday: (date) => words.weekday(date, 'narrow'),
    turn: ctx.turn,
    targets: true,
    day: (date) => {
      const count = agenda.covers(date) ? agenda.count(date) : null;
      return {
        selected: sameDay(date, ctx.day),
        today: sameDay(date, agenda.today),
        dot: !!count,
        label: words.dayAria(date, count),
      };
    },
    onPick: (date) => ctx.select(date),
    onMove: (date) => ctx.moveFocus(date),
    host: ctx.host,
  });
}

/** The month on its own (`withDay` false), or with the selected day's label and events underneath. */
export function monthView(ctx: ViewContext, withDay: boolean): TemplateResult {
  const { agenda, words } = ctx;
  const broken = outage(ctx);
  const columns = sevenColumns(ctx.width);
  const day = ctx.day;
  const ready = ctx.status === 'ok' && agenda.covers(day);
  const list = withDay && !broken ? dayList(ctx, day, { afterLabel: true }) : null;
  const count = ready ? agenda.count(day) : null;

  return surface(
    ctx,
    html`
      ${head({
        icon: 'calendar',
        tone: headTone(ctx),
        title: ctx.config.title ?? words.month(ctx.month),
        sub: fitText(
          words.weeks(day, ctx.month.getFullYear()),
          headRoom(ctx, broken ? 0 : NAV),
          FACE.sub,
        ),
        trailing: broken
          ? nothing
          : html`<div class="cd-nav">
              ${round('chevronLeft', 'quiet', s(ctx.hass, 'previous_month'), () => ctx.stepMonth(-1))}
              ${round('chevron', 'quiet', s(ctx.hass, 'next_month'), () => ctx.stepMonth(1))}
            </div>`,
      })}
      ${
        broken ??
        html` ${monthDays(ctx)}
        ${
          list
            ? html` ${keyed(dayKey(day), html`<div class="fv-swap">${label(words.dayLabel(day, count))}${count === 0 ? nothing : list.body}</div>`)}
              ${list.more === nothing ? nothing : html`<div class="cd-rows">${list.more}</div>`}`
            : nothing
        }
        ${notice(ctx)}`
      }
    `,
    { style: columnStyle(columns) },
  );
}
