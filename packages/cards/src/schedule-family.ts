import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The Heating schedule card (#229), announced at start and defined when its chunk lands (`schedule-cards.ts`), as the
 * web page card is: what the card picker lists and how tall the card is at a 360 column, without the card itself.
 * Every page carries this file: it stays tiny.
 */

/** The card's padding, above and below. */
const PADDING = 40;
/** The head and the 16 under it. */
const HEAD = 60;
/** A day's line (24) and the 8 between two: the week's seven. */
const WEEK = 7 * 24 + 6 * 8;
/** Today's line on its own, taller: its blocks say their times where they hold them. */
const TODAY = 32;
/** The hours under the lines: 8 above their 16. */
const AXIS = 24;
/** The presets' legend: one line of 20, 16 under the hours. */
const LEGEND = 36;

/**
 * The card at a 360 column, by its layout and what it shows, never by the plan it draws (a day with no block keeps its
 * line; a legend of more presets than its line holds says how many more): the head (`show_head`), the week's seven
 * lines or today's one, the hours under them and the legend (`show_presets`).
 */
export function scheduleHeight(config: LovelaceCardConfig): number {
  const head = config['show_head'] === false ? 0 : HEAD;
  const lines = config['variant'] === 'today' ? TODAY : WEEK;
  const legend = config['show_presets'] === false ? 0 : LEGEND;
  return PADDING + head + lines + AXIS + legend;
}

export const SCHEDULE_FAMILY: readonly FamilyEntry[] = [['fluvy-schedule-card', scheduleHeight]];
