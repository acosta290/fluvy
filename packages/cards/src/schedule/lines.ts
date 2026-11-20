import { clock12, dateFormat, dayPeriods, type HomeAssistant } from '@fluvy/core';
import { axis } from '@fluvy/ui';
import { css, html, nothing, svg, type TemplateResult } from 'lit';
import { clockText } from '../automations/format.js';
import { shortWeekday, WEEKDAYS, type Weekday } from '../shared/dates.js';
import { DAY_END, sortDay, type Block } from './plan.js';
import type { PresetLook } from './presets.js';

/**
 * A day's line as the Heating schedule card and its sheet draw it (#229): the day's 24 hours as the ruler's ticks (one
 * an hour, 6, 12 and 18 taller; fewer where the line is narrow), which are the gaps and so the base preset, and each
 * block a solid tile of its preset's tone where it falls in them, its start and its end in it where they hold; on
 * today's line the house's knob at the time it is now, the week's needle running through it down to the hours, where
 * the time it is now stands in its bubble.
 */

export const lineStyles = css`
  .sc-track {
    position: relative;
    height: 24px;
  }
  .sc-track--tall {
    height: 32px;
  }
  .sc-ticks {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .sc-ticks line {
    stroke: var(--fluvy-border-strong);
    stroke-width: 2;
    stroke-linecap: round;
  }
  /* the blocks, over the needle: they draw themselves in from the day's start as a chart's strips do, each line a
     beat after the one above it */
  .sc-blocks {
    position: absolute;
    inset: 0;
    z-index: 1;
    animation: sc-reveal 700ms var(--fv-ease-out, ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms + var(--sc-row, 0) * 40ms);
  }
  /* a block: its preset's ink as a solid tile, lit a little from above and set on its own soft shadow of the tone */
  .sc-block {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
    border-radius: 6px;
    background: linear-gradient(
      to bottom,
      color-mix(in oklab, var(--tone-ink) 90%, var(--fluvy-neutral-95, var(--fluvy-card))),
      var(--tone-ink) 60%,
      color-mix(in oklab, var(--tone-ink) 92%, var(--fluvy-neutral-10, var(--fluvy-text)))
    );
    box-shadow:
      0 1px 2px -1px rgb(0 0 0 / calc(0.24 * var(--fluvy-shade, 1))),
      0 3px 8px -4px
        color-mix(in srgb, var(--tone-ink) calc(70% * var(--fluvy-shade, 1)), transparent);
    color: var(--fluvy-text-on-accent);
    overflow: hidden;
  }
  /* its sides only where it says its times: a short block is as wide as its minutes */
  .sc-block.is-said {
    padding: 0 6px;
  }
  .sc-track--tall .sc-block {
    border-radius: 8px;
  }
  .sc-track--tall .sc-block.is-said {
    padding: 0 8px;
  }
  .sc-time {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sc-time--tall {
    font-size: 12px;
  }
  /* now, on today's line: the house's knob (20, its ring 24: the line's height), its halo whatever it stands on */
  .sc-knob {
    top: 2px;
    z-index: 2;
    width: 20px;
    height: 20px;
    box-shadow:
      0 0 0 2px var(--tone-ink),
      0 2px 6px -1px rgb(0 0 0 / calc(0.25 * var(--fluvy-shade, 1))),
      0 0 0 5px var(--knob-halo);
  }
  .sc-knob::after {
    inset: 7px;
  }
  .sc-track--tall .sc-knob {
    width: 28px;
    height: 28px;
  }
  .sc-track--tall .sc-knob::after {
    inset: 10px;
  }
  /* the needle: the time it is now through every day, dotted, under the blocks, from the top line to its bubble */
  .sc-needle {
    position: absolute;
    top: 0;
    bottom: -6px;
    width: 2px;
    background: radial-gradient(circle, var(--fluvy-accent) 0.9px, transparent 1.2px) center top /
      2px 6px repeat-y;
  }
  .sc-hours {
    position: relative;
  }
  .sc-hours .fv-axis {
    color: var(--fluvy-text-secondary);
  }
  /* the time it is now, the needle's foot: the accent's pill, the hours it would cover gone whole */
  .sc-clock {
    position: absolute;
    top: -2px;
    z-index: 1;
    box-sizing: border-box;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--fluvy-accent);
    color: var(--fluvy-text-on-accent);
    font-size: 11px;
    font-weight: 600;
    line-height: 20px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* the time it is now arrives as the blocks have drawn in */
  .sc-knob,
  .sc-needle,
  .sc-clock {
    animation: sc-arrive 320ms var(--fv-ease-out, ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 560ms);
  }
  /* a preset's swatch: its block in small; the base's, the gaps' ticks */
  .sc-swatch {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border-radius: 4px;
  }
  .sc-swatch:not(.is-base) {
    background: var(--tone-ink);
    box-shadow: 0 1px 3px -1px
      color-mix(in srgb, var(--tone-ink) calc(70% * var(--fluvy-shade, 1)), transparent);
  }
  .sc-swatch.is-base {
    stroke: var(--fluvy-border-strong);
    stroke-width: 2;
    stroke-linecap: round;
  }
  @keyframes sc-reveal {
    from {
      clip-path: inset(-8px 100% -8px -8px);
    }
    to {
      clip-path: inset(-8px -8px -8px -8px);
    }
  }
  @keyframes sc-arrive {
    from {
      opacity: 0;
    }
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

/** The room a block's words leave on each side, on a line and on a tall one; the room between its start and its end. */
const BLOCK_SIDES = 6;
const TALL_SIDES = 8;
const WORDS_GAP = 8;
/** The narrowest a block is drawn: a quarter of an hour on a narrow line is still a tile, never a sliver. */
const BLOCK_MIN = 4;
/** Two blocks that meet are parted by this much of the line. */
const SEAM = 2;
/** The ticks: an hour's and 6, 12 and 18's, on a line and a tall one; no closer than 8 apart. */
const MINOR = [6, 8] as const;
const MAJOR = [12, 16] as const;
const TICK_PITCH = 8;
/** What a tick keeps clear of: a block's edge, the needle, the knob's ring and halo (from its centre). */
const TICK_CLEAR = 3;
const NEEDLE_CLEAR = 4;
const KNOB = [20, 28] as const;
const KNOB_REACH = 2 + 5 + 1;
/** The bubble's sides, and what it keeps clear of the hours it stands among. */
const CLOCK_SIDES = 6;
const CLOCK_CLEAR = 6;

/** A minute of the day in the house's clock ("06:30", "6:30 AM"); the day's end "24:00" on a 24-hour clock. */
export function clockOf(hass: HomeAssistant | undefined, minutes: number): string {
  if (minutes === DAY_END && !clock12(hass)) return '24:00';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return clockText(hass, `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`);
}

/** A block's times in words: "06:30–08:30". */
export const spanOf = (hass: HomeAssistant | undefined, block: Block): string =>
  `${clockOf(hass, block.from)}–${clockOf(hass, block.to)}`;

/**
 * The words a block says inside its `room` px (its width less its sides): its start and its end at its two ends where
 * both hold, else its start, else none — a time is never cut, and a block too short for one is still its tile.
 */
function blockWords(
  hass: HomeAssistant | undefined,
  block: Block,
  room: number,
  measure: (text: string) => number,
): readonly string[] {
  const from = clockOf(hass, block.from);
  const to = clockOf(hass, block.to);
  const start = measure(from);
  if (start + WORDS_GAP + measure(to) <= room) return [from, to];
  return start <= room ? [from] : [];
}

/** A minute's place on a line of `width` px, on whole pixels. */
const xOf = (minute: number, width: number): number => Math.round((minute / DAY_END) * width);

/**
 * Where the time it is now is drawn on a line of `width` px: its minute's place, the knob kept whole on the line but
 * for the 4 px a circle overhangs to look flush at either end (the ruler's), the needle and the bubble with it.
 */
export function nowAt(minute: number, width: number, tall = false): number {
  const half = KNOB[tall ? 1 : 0] / 2;
  return Math.min(Math.max(xOf(minute, width), half - 4), Math.max(half - 4, width - half + 4));
}

export interface TrackOptions {
  readonly hass: HomeAssistant | undefined;
  readonly blocks: readonly Block[];
  /** Each preset's look by its key; a block whose preset the plan has not is drawn in the base's. */
  readonly looks: ReadonlyMap<string, PresetLook>;
  readonly base: PresetLook | undefined;
  /** The line's width in px: where its ticks and blocks stand, and what a block's words have to hold. */
  readonly width: number;
  /** Today's line on its own, taller (32). */
  readonly tall?: boolean;
  /** The time it is now (its place, `nowAt`): the needle that crosses every line of the week clears its ticks. */
  readonly needle?: number | undefined;
  /** It is drawn on this line: the knob there. */
  readonly knob?: boolean;
  /** How wide a time is set in a block of this line (`sc-time`, a tall line's `sc-time--tall`). */
  readonly measure: (text: string) => number;
  /** A preset's own colour as the card's accent sheet writes it (`data-accent`). */
  readonly accent: (color: string) => string | undefined;
}

/** A tone's class for a preset's look: its colour's accent where it has one. */
export const toneClass = (look: PresetLook | undefined): string =>
  `fv-tone--${look ? (look.color ? 'accent' : look.tone) : 'neutral'}`;

/** A day's line. */
export function track(o: TrackOptions): TemplateResult {
  const width = Math.max(0, Math.round(o.width));
  const tall = o.tall ? 1 : 0;
  const height = tall ? 32 : 24;
  const sides = tall ? TALL_SIDES : BLOCK_SIDES;
  const blocks = sortDay(o.blocks);
  // each block's place on whole pixels, parted from a block it meets by the seam, never narrower than a tile
  const placed = blocks.map((block, index) => {
    const meetsBefore = blocks[index - 1]?.to === block.from;
    const meetsAfter = blocks[index + 1]?.from === block.to;
    let left = xOf(block.from, width) + (meetsBefore ? SEAM / 2 : 0);
    let right = xOf(block.to, width) - (meetsAfter ? SEAM / 2 : 0);
    if (right - left < BLOCK_MIN) {
      const middle = (left + right) / 2;
      left = Math.round(Math.min(Math.max(0, middle - BLOCK_MIN / 2), width - BLOCK_MIN));
      right = left + BLOCK_MIN;
    }
    const look = (block.preset !== undefined ? o.looks.get(block.preset) : undefined) ?? o.base;
    return { block, look, left, right };
  });
  const knob = o.knob && o.needle !== undefined ? o.needle : undefined;
  const knobReach = KNOB[tall] / 2 + KNOB_REACH;
  const clearOfKnob = (from: number, to: number): boolean =>
    knob === undefined || to <= knob - knobReach || from >= knob + knobReach;
  /** A block's words where they hold (`blockWords`), whole or absent beside the knob: its end goes, then its start. */
  const wordsOf = (block: Block, left: number, right: number): readonly string[] => {
    const [from, to] = blockWords(o.hass, block, right - left - 2 * sides, o.measure);
    if (from === undefined || !clearOfKnob(left + sides, left + sides + o.measure(from))) return [];
    return to !== undefined && clearOfKnob(right - sides - o.measure(to), right - sides)
      ? [from, to]
      : [from];
  };
  // the ticks: whole or absent, never bitten by a block, the needle or the knob
  const step = [1, 2, 3, 6].find((hours) => (width / 24) * hours >= TICK_PITCH) ?? 12;
  const ticks: TemplateResult[] = [];
  for (let hour = 0; hour <= 24; hour += step) {
    const x = Math.min(Math.max(xOf(hour * 60, width), 1), width - 1);
    if (placed.some(({ left, right }) => x > left - TICK_CLEAR && x < right + TICK_CLEAR)) continue;
    if (
      knob !== undefined
        ? Math.abs(x - knob) < knobReach
        : o.needle !== undefined && Math.abs(x - o.needle) < NEEDLE_CLEAR
    )
      continue;
    const length = (hour % 6 === 0 ? MAJOR : MINOR)[tall];
    const y = (height - length) / 2;
    ticks.push(svg`<line x1=${x} x2=${x} y1=${y} y2=${y + length} />`);
  }
  // a drawing: its blocks' places are the plan's minutes, never the 4 grid's
  return html`<div class="sc-track ${tall ? 'sc-track--tall' : ''}" data-measure="drawn">
    <svg class="sc-ticks" width=${width} height=${height} aria-hidden="true">${ticks}</svg>
    <div class="sc-blocks">
      ${placed.map(({ block, look, left, right }) => {
        const words = wordsOf(block, left, right);
        // a block too short for its times says them as a tooltip, as every block does
        const title = [look?.name ?? block.preset, spanOf(o.hass, block)]
          .filter(Boolean)
          .join(' · ');
        return html`<span
          class="sc-block ${toneClass(look)} ${words.length ? 'is-said' : ''}"
          data-accent=${(look?.color && o.accent(look.color)) || nothing}
          style="left:${left}px;width:${right - left}px"
          title=${title}
          >${words.map(
            (word) => html`<span class="sc-time ${tall ? 'sc-time--tall' : ''}">${word}</span>`,
          )}</span
        >`;
      })}
    </div>
    ${
      knob === undefined
        ? nothing
        : html`<span
            class="fv-knob fv-knob--accent sc-knob"
            style="left:${knob - KNOB[tall] / 2}px"
          ></span>`
    }
  </div>`;
}

/**
 * The needle at the time it is now (`x`, from the lines' edge): through the week, under the blocks, or from today's
 * knob (`top`, its middle) down to its bubble.
 */
export const needle = (x: number, top = 0): TemplateResult =>
  html`<span
    class="sc-needle"
    style="left:${x - 1}px${top ? `;top:${top}px` : ''}"
    data-measure="drawn"
    aria-hidden="true"
  ></span>`;

/** A preset's swatch: its block in small, the base's the gaps' ticks. */
export function swatch(
  look: PresetLook | undefined,
  base: boolean,
  accent: (color: string) => string | undefined,
): TemplateResult {
  return base
    ? html`<svg class="sc-swatch is-base" viewBox="0 0 12 12" aria-hidden="true">
        <line x1="2" x2="2" y1="4" y2="8" />
        <line x1="6" x2="6" y1="2" y2="10" />
        <line x1="10" x2="10" y1="4" y2="8" />
      </svg>`
    : html`<span
        class="sc-swatch ${toneClass(look)}"
        data-accent=${(look?.color && accent(look.color)) || nothing}
      ></span>`;
}

/** The hours under the lines: midnight, six, noon, eighteen and midnight where they hold, else fewer. */
const HOURS = [0, 6, 12, 18, 24];

/** The time it is now under the lines: its place on them (`nowAt`) and its words, with how wide words are set. */
export interface ClockMark {
  readonly x: number;
  readonly text: string;
  readonly measure: (text: string) => number;
}

/**
 * The hours under a line of `width` px, `inset` from the card's edge (the days' words beside the week's lines): all
 * five where they hold, else midnight, noon and midnight, else the ends; on a 12-hour clock "6 AM", else "6". With the
 * time it is now (`clock`), its bubble at the needle's foot, the hours it would stand on gone whole.
 */
export function hours(
  hass: HomeAssistant | undefined,
  width: number,
  inset: number,
  clock?: ClockMark,
): TemplateResult {
  const twelve = clock12(hass);
  const [am, pm] = dayPeriods(hass);
  const word = (hour: number): string =>
    twelve ? `${hour % 12 === 0 ? 12 : hour % 12} ${hour % 24 < 12 ? am : pm}` : String(hour);
  const shown = width >= 240 ? HOURS : width >= 120 ? [0, 12, 24] : [0, 24];
  let bubble: TemplateResult | typeof nothing = nothing;
  let marks = shown.map((hour) => [hour / 24, word(hour)] as const);
  if (clock) {
    const size = Math.ceil(clock.measure(clock.text)) + 2 * CLOCK_SIDES;
    const left = Math.round(Math.min(Math.max(clock.x - size / 2, 0), Math.max(0, width - size)));
    // an hour's words where the axis sets them: the ends at the line's ends, the rest centred on their place
    marks = marks.filter(([fraction, text]) => {
      const wide = clock.measure(text);
      const from = fraction <= 0 ? 0 : fraction >= 1 ? width - wide : fraction * width - wide / 2;
      return from + wide <= left - CLOCK_CLEAR || from >= left + size + CLOCK_CLEAR;
    });
    // placed by the time it is, as a ruler's bubble is by its value
    bubble = html`<span class="sc-clock" style="left:${left}px" data-measure="value"
      >${clock.text}</span
    >`;
  }
  return html`<div class="sc-hours" style=${inset ? `margin-left:${inset}px` : nothing}>
    ${axis(marks)}${bubble}
  </div>`;
}
