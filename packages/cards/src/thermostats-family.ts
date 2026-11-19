import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import {
  chipRows,
  CHIP_GLYPH,
  COLUMN,
  EMPTY,
  entryCount,
  ROW,
  ROW_COMPACT,
  rowsOf,
} from './shared/heights.js';

/*
 * The Thermostats card (1.23, #230, #219), announced at start and defined when its chunk lands
 * (`thermostats-cards.ts`), as the Rounds card is: what the card picker lists and how tall the card is at a 360 column,
 * without the card itself. Every page carries this file: it stays tiny.
 */

/** What the house says of the card where it is there to say (`house-heights.ts`): its thermostats and their presets. */
export interface ThermostatsHouse {
  /** The thermostats the card lists where its config lists none: the area's, else the house's. */
  readonly count: number;
  /** The words of the preset chips (`house_actions: [presets]`), as the card says them ("Eco 3/5"). */
  readonly presets: readonly string[];
}

/** The thermostats a card lists where neither its config nor the house says how many: three, as the room lights' do. */
const STAND_IN = 3;
/** All off as English says it, what a row of chips is counted with (the house's words are measured as they draw). */
const ALL_OFF = 'All off';
/** An inner tile: 84 tall, 8 apart, two a row in a 320 column. */
export const TILE = 84;
export const TILE_GAP = 8;

/** Whether the card draws its head: it has a title of its own, or says how many heat or the average. */
export const hasHead = (config: LovelaceCardConfig): boolean =>
  Boolean(config['title'] || config['show_count'] === true || config['show_average'] === true);

/** What the card does for every thermostat at once, where asked: All off, and the presets they offer. */
export type HouseAction = 'all_off' | 'presets';

/** The house's actions a config asks for, in its order: All off, the presets. */
export const houseActions = (config: LovelaceCardConfig): HouseAction[] => {
  const asked = config['house_actions'];
  return Array.isArray(asked)
    ? [...new Set(asked.filter((one) => one === 'all_off' || one === 'presets'))]
    : [];
};

/**
 * The card at a 360 column, from its config and what the house says of it: 20 above and below; its head (44) where it
 * has one; the house's actions (`house_actions`), its chips' rows of 44 — All off with its glyph, a preset chip each
 * (one where the house is not there to say) — 16 under the head (12 and the chip's own 4); then its thermostats — the
 * config's, else the house's (three where it is not there to say) — as rows of 60 (`compact`: 48), their circles (a
 * compact row's rounds) 16 under what is above them and 20 over the card's foot, or as tiles of 84 two a row, 8 apart;
 * none, the panel and its hint.
 */
export function thermostatsHeight(config: LovelaceCardConfig, house?: ThermostatsHouse): number {
  const head = hasHead(config) ? 44 : 0;
  const listed = entryCount(config, ['thermostats', 'entities']);
  const count = listed || (house ? house.count : STAND_IN);
  if (!count) return 40 + (head ? head + 16 : 0) + EMPTY + 12;
  // All off with its glyph, the presets in their words ("Eco 3/5"); where the house is not there to say, one of them
  const chipsOf = (one: HouseAction): readonly string[] =>
    one === 'all_off' ? [ALL_OFF] : (house?.presets ?? ['Comfort 3/3']);
  const labels = houseActions(config).flatMap(chipsOf);
  const glyphs = labels.map((label) => (label === ALL_OFF ? CHIP_GLYPH : 0));
  const chips = labels.length
    ? (head ? 12 : -4) + chipRows(labels, 'full', COLUMN, undefined, glyphs) * 44
    : 0;
  const above = head || chips;
  const variant = config['variant'];
  // a row's circle stands 8 inside it (a compact row's 44 rounds 2): its rows start that much nearer what is above them
  const [list, inside] =
    variant === 'tiles'
      ? [rowsOf(count, 2) * (TILE + TILE_GAP) - TILE_GAP, 0]
      : variant === 'compact'
        ? [count * ROW_COMPACT, 2]
        : [count * ROW, 8];
  const gap = (above ? (chips ? 12 : 16) : 0) - inside;
  return 20 + head + chips + gap + list - inside + 20;
}

export const THERMOSTATS_FAMILY: readonly FamilyEntry[] = [
  ['fluvy-thermostats-card', (config) => thermostatsHeight(config)],
];
