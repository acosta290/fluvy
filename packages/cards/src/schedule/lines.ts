import { clock12, dateFormat, dayPeriods, type HomeAssistant } from '@fluvy/core';
import { axis } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';
import { clockText } from '../automations/format.js';
import { shortWeekday, WEEKDAYS, type Weekday } from '../shared/dates.js';
import { DAY_END, type Block } from './plan.js';
import type { PresetLook } from './presets.js';

/**
 * A day's line as the Heating schedule card and its sheet draw it (#229): the day's 24 hours as a well, each block a
 * pill of its preset's tone where it falls in them (the gaps are the well: the base preset's), its times in it where
 * they hold it, a marker at the time it is now; and the hours under the lines.
 */

export const lineStyles = css`
  .sc-track {
    position: relative;
    height: 24px;
    border-radius: 12px;
    background: var(--fluvy-inset, var(--fluvy-page));
    overflow: hidden;
  }
  .sc-track--tall {
    height: 32px;
    border-radius: 16px;
  }
  .sc-block {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: inherit;
    background: var(--tone-fill);
    box-shadow: inset 0 0 0 1px var(--tone-border);
    overflow: hidden;
  }
  .sc-time {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    color: var(--tone-on);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sc-time--tall {
    font-size: 12px;
  }
  /* now: a line of the text's ink across today's line, over its blocks */
  .sc-now {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--fluvy-text);
  }
  .sc-hours .fv-axis {
    color: var(--fluvy-text-secondary);
  }
`;

/** A Sunday (7 January 2024, at noon in UTC): the week's days are named from it, so no zone moves a day. */
const SUNDAY = Date.UTC(2024, 0, 7, 12);
const DAY_MS = 86_400_000;

/** A day's word in the house's language: its short one beside its line and on its chip, its long one for a reader. */
export function dayWord(
  hass: HomeAssistant | undefined,
  day: Weekday,
  style: 'short' | 'long' = 'short',
): string {
  const date = new Date(SUNDAY + WEEKDAYS.indexOf(day) * DAY_MS);
  const language = hass?.language ?? 'en';
  return style === 'short'
    ? shortWeekday(language, date, 'UTC')
    : dateFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(date);
}

/** The room a block's words leave on their sides. */
const BLOCK_SIDES = 12;

/** A minute of the day in the house's clock ("06:30", "6:30 AM"); the day's end "24:00" on a 24-hour clock. */
export function clockOf(hass: HomeAssistant | undefined, minutes: number): string {
  if (minutes === DAY_END && !clock12(hass)) return '24:00';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return clockText(hass, `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`);
}

/** A block's times in words: "06:30–08:30". */
export const spanOf = (hass: HomeAssistant | undefined, block: Block): string =>
  `${clockOf(hass, block.from)}–${clockOf(hass, block.to)}`;

/** The words a block says where they hold `room` px: its times, else its start, else none (a time is never cut). */
export function blockWords(
  hass: HomeAssistant | undefined,
  block: Block,
  room: number,
  measure: (text: string) => number,
): string {
  const forms = [spanOf(hass, block), clockOf(hass, block.from)];
  return forms.find((text) => measure(text) + BLOCK_SIDES <= room) ?? '';
}

export interface TrackOptions {
  readonly blocks: readonly Block[];
  /** Each preset's look by its key; a block whose preset the plan has not is drawn in the base's. */
  readonly looks: ReadonlyMap<string, PresetLook>;
  readonly base: PresetLook | undefined;
  /** The line's width in px: what a block's words have to hold. */
  readonly width: number;
  /** The minute it is now, on today's line. */
  readonly now?: number | undefined;
  /** Today's line on its own, taller (32). */
  readonly tall?: boolean;
  readonly words: (block: Block, room: number) => string;
  /** A preset's own colour as the card's accent sheet writes it (`data-accent`). */
  readonly accent: (color: string) => string | undefined;
}

/** A tone's class for a preset's look: its colour's accent where it has one. */
export const toneClass = (look: PresetLook | undefined): string =>
  `fv-tone--${look ? (look.color ? 'accent' : look.tone) : 'neutral'}`;

/** A day's line. */
export function track(o: TrackOptions): TemplateResult {
  // a drawing: its blocks' places are the plan's minutes, never the 4 grid's
  return html`<div class="sc-track ${o.tall ? 'sc-track--tall' : ''}" data-measure="drawn">
    ${o.blocks.map((block) => {
      const look = (block.preset !== undefined ? o.looks.get(block.preset) : undefined) ?? o.base;
      const left = (block.from / DAY_END) * 100;
      const span = ((block.to - block.from) / DAY_END) * 100;
      const words = o.words(block, (o.width * span) / 100);
      return html`<span
        class="sc-block ${toneClass(look)}"
        data-accent=${(look?.color && o.accent(look.color)) || nothing}
        style="left:${left.toFixed(3)}%;width:${span.toFixed(3)}%"
        >${words ? html`<span class="sc-time ${o.tall ? 'sc-time--tall' : ''}">${words}</span>` : nothing}</span
      >`;
    })}
    ${
      o.now === undefined
        ? nothing
        : html`<span class="sc-now" style="left:${((o.now / DAY_END) * 100).toFixed(3)}%"></span>`
    }
  </div>`;
}

/** The hours under the lines: midnight, six, noon, eighteen and midnight where they hold, else fewer. */
const HOURS = [0, 6, 12, 18, 24];

/**
 * The hours under a line of `width` px, `inset` from the card's edge (the days' words beside the week's lines): all
 * five where they hold, else midnight, noon and midnight, else the ends; on a 12-hour clock "6 AM", else "6".
 */
export function hours(
  hass: HomeAssistant | undefined,
  width: number,
  inset: number,
): TemplateResult {
  const twelve = clock12(hass);
  const [am, pm] = dayPeriods(hass);
  const word = (hour: number): string =>
    twelve ? `${hour % 12 === 0 ? 12 : hour % 12} ${hour % 24 < 12 ? am : pm}` : String(hour);
  const shown = width >= 240 ? HOURS : width >= 120 ? [0, 12, 24] : [0, 24];
  return html`<div class="sc-hours" style=${inset ? `margin-left:${inset}px` : nothing}>
    ${axis(shown.map((hour) => [hour / 24, word(hour)] as const))}
  </div>`;
}
