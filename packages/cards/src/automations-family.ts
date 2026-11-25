import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { headlessOf, noLine } from './shared/head-lines.js';
import { HEAD, ROW, ROW_COMPACT, rowsOf } from './shared/heights.js';

/**
 * The automations family (the automations card and its schedule sheet), announced at start and defined when its
 * chunk lands (`automations-cards.ts`), as the devices family is: what the card picker lists and how tall the card
 * is at a 360 column, without the card itself. Every page carries this file: it stays tiny.
 */

/** Rows before the "{count} more" row takes over, when the config says nothing. */
export const AUTOMATIONS_MAX_ROWS = 6;

/** Rows before the "{count} more" row takes over: the config's `max_rows` as a whole number from 1, as many as it asks. */
export const automationsMaxRows = (max_rows: unknown): number => {
  const asked = Math.round(Number(max_rows));
  return Number.isFinite(asked) ? Math.max(1, asked) : AUTOMATIONS_MAX_ROWS;
};

/** The filter chips (44) and the 16 under them. */
const FILTERS = 60;
/** The empty panel under the head's 16: its ring, its line and the administrator's hint (132; a guest's is the 120 minimum). */
const EMPTY = 132;

/** What leaves the head with nothing in it besides its circle and its name (#259): its line and its "+" asked away. */
export const automationsQuiet = (config: LovelaceCardConfig | undefined): boolean =>
  noLine(config) && config?.['show_add'] === false;

/**
 * The automations card at a 360 column: the head, the filter chips when shown, then the rows (60, 48 compact) or
 * the tiles (two a row of 84, 8 apart) with the fold row counted as the openings card counts it (one extra
 * automation is a row, not a "1 more" row). Listing the whole house, the card is as tall as its fold allows. A head
 * left with nothing in it goes, with the 16 under it (#259).
 */
export const automationsHeight = (config: LovelaceCardConfig): number => {
  const entities = config['entities'];
  const max = automationsMaxRows(config['max_rows']);
  const n = Array.isArray(entities) ? entities.length : max;
  const top = HEAD - headlessOf(config, automationsQuiet(config), 16);
  const filters = config['show_filters'] === true ? FILTERS : 0;
  if (n === 0) return top + filters + EMPTY;
  const more = n > max + 1 ? 1 : 0;
  const shown = more ? max : n;
  if (config['variant'] === 'tiles') {
    const rows = rowsOf(shown, 2);
    return top + filters + rows * 84 + (rows - 1) * 8 + more * (16 + ROW_COMPACT);
  }
  return top + filters + (config['variant'] === 'compact' ? ROW_COMPACT : ROW) * (shown + more);
};

export const AUTOMATIONS_FAMILY: readonly FamilyEntry[] = [
  ['fluvy-automations-card', automationsHeight],
];
