import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { chipBlock, chipRows, COMPACT } from './shared/heights.js';

/**
 * The Cover card, announced at start and defined when its chunk lands (`cover-cards.ts`), as the Vacuum card is: what
 * the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries this
 * file: it stays tiny.
 */

/* cover / valve supported_features */
export const OPEN = 1;
export const CLOSE = 2;
export const SET_POSITION = 4;
export const STOP = 8;
export const OPEN_TILT = 16;
export const CLOSE_TILT = 32;
export const SET_TILT_POSITION = 128;
/** What a cover draws where the house is not there to say (`layoutHeight`; one never read): position, commands. */
export const USUAL = OPEN | CLOSE | SET_POSITION | STOP;

/**
 * A cover's presets (`position_presets`, `tilt_presets`, #203): whole percents of the card's own figure, in the
 * config's order, each once; what is no number (the editor writes them as words) is left out.
 */
export function presetsOf(list: unknown): number[] {
  const presets: number[] = [];
  for (const item of Array.isArray(list) ? (list as unknown[]) : []) {
    const value = typeof item === 'string' && item.trim() ? Number(item) : item;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const percent = Math.min(100, Math.max(0, Math.round(value)));
    if (!presets.includes(percent)) presets.push(percent);
  }
  return presets;
}

/** A favourite as a config writes it, as far as a height reads it: none that is not an object. */
const favoritesOf = (
  config: LovelaceCardConfig,
): { name?: unknown; position?: unknown; tilt?: unknown }[] =>
  Array.isArray(config['favorites'])
    ? (config['favorites'] as unknown[]).filter(
        (favorite): favorite is Record<string, unknown> =>
          favorite !== null && typeof favorite === 'object',
      )
    : [];

/**
 * What a cover the house is not there to say draws for its config: its usual parts, and its tilt where the config
 * asks for the tilt's slats or presets (#203), or a favourite sets it, so a card asked for them keeps their room
 * before its cover is read.
 */
export const usualFor = (config: LovelaceCardConfig): number =>
  config['tilt_style'] === 'slats' ||
  presetsOf(config['tilt_presets']).length ||
  favoritesOf(config).some((favorite) => typeof favorite.tilt === 'number')
    ? USUAL | SET_TILT_POSITION
    : USUAL;

/**
 * A row of presets (#203): 12 under what it follows, then its chips' rows of 44, every chip counted as long as the
 * longer of the ends' words; under its label where it stands away from its control (the tilt's beside the position:
 * 16, the 20 label, 8, its rows).
 */
const presetsBlock = (list: unknown, labelled = false): number => {
  const count = presetsOf(list).length;
  const rows = count ? chipRows(Array<string>(count).fill('Closed')) : 0;
  return !rows ? 0 : labelled ? chipBlock(rows) : 12 + 44 * rows;
};

/**
 * The favourites under their label (`show_favorites`), those the cover can go to: a position where it takes one, its
 * slats' angle where it sets them (the tilt shown or not). Their chips' rows are counted by what each says in English,
 * every chip as long as its longest words: its name, then where it goes ("closed", or "tilt 100 %").
 */
function favoritesBlock(config: LovelaceCardConfig, positioned: boolean, tilts: boolean): number {
  if (config['show_favorites'] === false) return 0;
  const labels = favoritesOf(config).flatMap(({ name, position, tilt }) => {
    const goes =
      positioned && typeof position === 'number'
        ? 'closed'
        : tilts && typeof tilt === 'number'
          ? 'tilt 100 %'
          : '';
    return !goes ? [] : [typeof name === 'string' && name ? `${name} · ${goes}` : goes];
  });
  const style = config['favorites_style'] === 'chips' ? 'chips' : 'full';
  return chipBlock(chipRows(labels, style), style);
}

/**
 * The card's height at a 360 column, for the automatic dashboard's columns, for what the cover does (`features`, as
 * the house describes it: `house-heights.ts`): the ruler with its side column where it takes a position (the whole
 * card where the house is not there to say), 16 taller where the tilt is drawn as its slats, then each row of presets
 * the cover can go to; else the tilt's readout and stepper over the commands, or its slats and their ruler, and its
 * presets; else the head and the commands. Under them, the favourites the cover can go to.
 *
 * The horizontal card (#244) takes a position on one row, 228 in all: the head, 24, the row (the label's 16 line over
 * the ruler's 44), 16 and the commands; then the tilt under them (16 and its 64 row, or 16 and its slats' 120), each
 * control's presets under it and the favourites. A cover with no position draws as the full card does.
 */
export function coverHeight(config: LovelaceCardConfig, features = usualFor(config)): number {
  if (config['variant'] === 'compact') return COMPACT;
  const shown = config['show_tilt'] !== false;
  const tilt = shown && (features & (SET_TILT_POSITION | OPEN_TILT | CLOSE_TILT)) !== 0;
  const sets = shown && (features & SET_TILT_POSITION) !== 0;
  const slats = sets && config['tilt_style'] === 'slats';
  const positioned = (features & SET_POSITION) !== 0;
  if (config['variant'] === 'horizontal' && positioned)
    return (
      228 +
      (slats ? 136 : tilt ? 80 : 0) +
      presetsBlock(config['position_presets']) +
      (sets ? presetsBlock(config['tilt_presets']) : 0) +
      favoritesBlock(config, positioned, (features & SET_TILT_POSITION) !== 0)
    );
  const presets =
    (positioned ? presetsBlock(config['position_presets']) : 0) +
    (sets ? presetsBlock(config['tilt_presets'], positioned) : 0);
  const favorites = favoritesBlock(config, positioned, (features & SET_TILT_POSITION) !== 0);
  if (positioned) return 328 + (slats ? 16 : 0) + presets + favorites;
  return (slats ? 280 + presets : tilt ? 224 + presets : COMPACT) + favorites;
}

export const COVER_FAMILY: readonly FamilyEntry[] = [['fluvy-cover-card', coverHeight]];
