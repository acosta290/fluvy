import { strings } from '@fluvy/core';
import { ico, isoWeek } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { FACE, fitText, textWidth } from '../fit.js';
import type { ViewContext } from './context.js';
import { onActivate, titleOf } from './shared.js';
import { idsOf } from '../config.js';

const s = strings('calendar');

/** How far ahead the next-event tile looks — the window the card reads for it. */
export const NEXT_DAYS = 8;

function tile(
  ctx: ViewContext,
  label: string,
  entityId: string | undefined,
  body: TemplateResult,
): TemplateResult {
  const open = (): void => ctx.open(entityId);
  return html`<article
    class="fv-tile cd-tile fv-tile--tap"
    data-card
    role="button"
    tabindex="0"
    aria-label=${label}
    @click=${open}
    @keydown=${onActivate(open)}
  >
    ${body}
  </article>`;
}

/** Unavailable, the way every fluvy tile says it: the short dashed tile, the ban glyph, the word. */
function offTile(ctx: ViewContext, name: string): TemplateResult {
  const open = (): void => ctx.open();
  const off = s(ctx.hass, 'off');
  // in a narrow column the word needs the glyph's place: the dashed tile already says what the glyph would — and
  // the dash says it where not even the word fits, as every tile's does
  const glyph = textWidth(off, FACE.tile) <= ctx.width - 56;
  const word = glyph || textWidth(off, FACE.tile) <= ctx.width ? off : '—';
  return html`<article
    class="fv-tile fv-tile--off fv-tile--tap"
    data-card
    role="button"
    tabindex="0"
    aria-label=${`${name} · ${off}`}
    @click=${open}
    @keydown=${onActivate(open)}
  >
    ${glyph ? ico('ban', 'off') : nothing}
    <div class="fv-row__text">
      <h3 class="fv-tile__name">${name}</h3>
      <p class="fv-tile__state">${word}</p>
    </div>
  </article>`;
}

const loadingLines = html`<p class="fv-tile__name">
    <span class="fv-skeleton cd-sk cd-sk--title"></span>
  </p>
  <p class="fv-tile__state"><span class="fv-skeleton cd-sk cd-sk--sub"></span></p>`;

/** "17 Sep" · Thursday · 4 events · 1 left · Week 38 */
function dateTile(ctx: ViewContext): TemplateResult {
  const { agenda, words } = ctx;
  const today = agenda.today;
  const ready = ctx.status === 'ok' && agenda.covers(today);
  const name = ctx.config.title ?? words.weekday(today, 'long');
  const count = ready ? agenda.count(today) : 0;
  const left = ready ? agenda.left(today) : 0;
  const counted = words.events(count);
  // the tile is 140 wide at best: "4 events · 1 left" gives way to "4 events" before anything is clipped
  const state =
    left > 0
      ? fitText(
          [
            `${counted} · ${s(ctx.hass, left === 1 ? 'left_one' : 'left', { count: left })}`,
            counted,
          ],
          ctx.width - 1,
          FACE.tile,
        )
      : counted;
  const day = String(today.getDate());
  const month = words.monthShort(today);
  const tight =
    textWidth(day, { size: 40, weight: 600, tracking: -0.02 }) +
      8 +
      textWidth(month, { size: 16, weight: 600 }) >
    ctx.width;
  return tile(
    ctx,
    `${name} · ${ready ? state : ''}`,
    undefined,
    html` <div class="fv-tile__head">
        <span class="cd-tile__date ${tight ? 'cd-tile__date--tight' : ''}"
          ><span class="cd-tile__day" data-baseline="td">${day}</span
          ><span class="cd-tile__month" data-baseline="td">${month}</span></span
        >
      </div>
      ${
        ready
          ? html`<p class="fv-tile__name">${name}</p>
              <p class="fv-tile__state">${state}</p>`
          : loadingLines
      }
      <p class="fv-tile__state cd-tile__meta">
        ${words.t('clock.week', { week: isoWeek(today) })}
      </p>`,
  );
}

/** The next event to start: its time, its title, its place, and how long until it does. */
function nextTile(ctx: ViewContext): TemplateResult {
  const { agenda, words } = ctx;
  const ready = ctx.status === 'ok' && agenda.covers(agenda.today);
  const next = ready ? agenda.next(NEXT_DAYS) : null;
  if (!next) {
    const name = ctx.config.title ?? words.events(0);
    return tile(
      ctx,
      name,
      undefined,
      html` <div class="fv-tile__head">
          ${ico('calendar', 'neutral')}<span class="fv-tile__value">${ready ? '—' : nothing}</span>
        </div>
        ${
          ready
            ? html`<p class="fv-tile__name">${name}</p>
                <p class="fv-tile__state">
                  ${words.t('calendar.next_days', { count: NEXT_DAYS - 1 })}
                </p>`
            : loadingLines
        }`,
    );
  }
  const { item } = next;
  const when = item.whole ? words.t('common.all_day') : words.time(item.from);
  const until = words.until(item.from, agenda.now, agenda.today);
  // where, shortened segment by segment ("Ona · Clínica Sants" → "Ona"), or else whose: a 140 px tile clips nothing
  const parts = item.event.location.split(' · ');
  const place = fitText(
    [
      ...parts.map((_part, index) => parts.slice(0, parts.length - index).join(' · ')),
      ctx.nameOf(item.event.calendar),
    ],
    ctx.width - 1,
    FACE.tile,
  );
  return tile(
    ctx,
    `${titleOf(ctx, item)} · ${when} · ${place}`,
    item.event.calendar,
    html` <div class="fv-tile__head">
        ${ico('calendar', 'accent')}<span class="fv-tile__value">${when}</span>
      </div>
      <p class="fv-tile__name">${titleOf(ctx, item)}</p>
      <p class="fv-tile__state">${place}</p>
      <p class="fv-tile__state cd-tile__meta">${until}</p>`,
  );
}

export function tileView(ctx: ViewContext): TemplateResult {
  if (ctx.status === 'unavailable' || ctx.status === 'failed')
    return offTile(ctx, ctx.config.title ?? ctx.nameOf(idsOf(ctx.config)[0] ?? ''));
  return ctx.config.tile === 'next' ? nextTile(ctx) : dateTile(ctx);
}
