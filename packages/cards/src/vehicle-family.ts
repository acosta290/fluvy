import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { statesUnder } from './room/room-card.js';
import { ROW_COMPACT, rowsOf } from './shared/heights.js';

/**
 * The Vehicle card (#84), announced at start and defined when its chunk lands (`vehicle-cards.ts`), as the web page
 * card is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page
 * carries this file: it stays tiny.
 */

export type VehicleVariant = 'full' | 'compact' | 'mini';
export const VEHICLE_VARIANTS: readonly VehicleVariant[] = ['full', 'compact', 'mini'];

/**
 * The controls a 360 column lays a row of: its 320 holds four cells of 80 with their words in English (five of 64 hold
 * some), and six of the compact card's rounds alone (44 and 8 each).
 */
const CONTROLS_A_ROW = 4;
const ROUNDS_A_ROW = 6;

/** The layout a config asks for: its own, else the whole card. */
export const vehicleVariant = (config: LovelaceCardConfig | undefined): VehicleVariant => {
  const v = config?.['variant'];
  return v === 'compact' || v === 'mini' ? v : 'full';
};

/** Where the car's picture goes: over the battery (the hero's), or in the head in the circle's place. */
export const pictureAt = (config: LovelaceCardConfig): 'hero' | 'head' | null =>
  typeof config['image'] === 'string' && config['image'].trim()
    ? config['image_position'] === 'head' || vehicleVariant(config) === 'compact'
      ? 'head'
      : 'hero'
    : null;

/**
 * The plate the car's picture over the battery is drawn on in a column `width` wide: 2:1 across the column; at a share
 * of it (`image_size: 50%`, 10–100: #254), 2:1 that wide, centred; or at a height (`120px`, or a figure, 32–640) across
 * the column, the whole car inside it. Its height on the 4 grid, as the card's is.
 */
export const picturePlate = (
  config: LovelaceCardConfig,
  width: number,
): { readonly width: number; readonly height: number } => {
  const [, figure, unit] =
    /^\s*(\d+(?:\.\d+)?)\s*(%|px)?\s*$/.exec(String(config['image_size'] ?? '')) ?? [];
  const n = Math.min(unit === '%' ? 100 : 640, Math.max(unit === '%' ? 10 : 32, Number(figure)));
  if (figure !== undefined && unit !== '%') return { width, height: Math.round(n / 4) * 4 };
  const across = figure === undefined ? width : Math.round((width * n) / 800) * 8;
  return { width: across, height: Math.round(across / 8) * 4 };
};

/**
 * The rows of controls a config draws at a 360 column: the ones it lists, `perRow` a row; the car's own where it lists
 * none, one row (those that do not hold it give way, in their order).
 */
const controlRows = (config: LovelaceCardConfig, perRow: number): number => {
  if (config['show_controls'] === false) return 0;
  const listed = config['controls'];
  return Array.isArray(listed) && listed.length ? rowsOf(listed.length, perRow) : 1;
};

/** The rows under the controls: the ones the config lists, else where the car is and how far it has gone. */
const rowCount = (config: LovelaceCardConfig): number => {
  if (config['show_rows'] === false) return 0;
  const listed = config['rows'];
  return Array.isArray(listed) ? listed.length : 2;
};

/** The battery on its ruler (the default): the value row (64) and the marked ruler with its labels (12 + 44 + 4 + 16). */
const RULER = 64 + 76;
/** The battery as a ring: the gauge's box at a 360 column (R 88: its ticks, its range under them). */
const RING = 208;
/** A row of controls: the 44 round, 4, its word's 16 line; 12 between rows. */
const CONTROLS = 64;
/** The tyres' panel: the car from above (72) in its 12 padding. */
const TYRES = 96;
/** The compact card's battery: its bar on its percentage's 20 line. */
const BAR = 20;

/**
 * The quick actions at the foot (#251), where the config lists any: one line of rounds, 44 tall, 64 where their states
 * stand under their glyphs (`statesUnder`, as a room's).
 */
const quickLine = (config: LovelaceCardConfig): number => {
  const listed = config['quick_actions'];
  if (!Array.isArray(listed) || !listed.length) return 0;
  return statesUnder(config as Parameters<typeof statesUnder>[0]) ? 64 : 44;
};

/**
 * The Vehicle card at a 360 column, from its config alone: the strip, 76; else its padding (20 above and below), its
 * head (44) where it shows, and each part it shows 16 under what it follows, the first at the padding where the head
 * is hidden (#254). The compact card: the battery's bar (a hybrid's tank's under it, 8 apart), its line (20, 8 under
 * the battery), rows of rounds (44 each, 12 between). The whole card: the car's picture where it is over the battery
 * (`picturePlate`), the battery (on its ruler, or a ring; a lone tank in its place; a hybrid's tank on its own ruler under
 * it, 16 apart), its line, the controls (64 a row, 12 between), the rows (48 each) and the tyres where asked. At the
 * foot of either, its quick actions' line where it lists any. What the car has never changes it: a part it cannot fill
 * keeps its place, a dash in it (1.9: a card keeps its size); `auto` draws a battery or a tank, each the same height.
 */
export const vehicleHeight = (config: LovelaceCardConfig): number => {
  const variant = vehicleVariant(config);
  if (variant === 'mini') return 76;
  const compact = variant === 'compact';
  const hybrid = config['energy'] === 'hybrid';
  const hero = config['show_hero'] !== false;
  const controls = controlRows(config, compact ? ROUNDS_A_ROW : CONTROLS_A_ROW);
  const rows = compact ? 0 : rowCount(config);
  const quick = quickLine(config);
  const gauge = compact
    ? BAR + (hybrid ? 8 + BAR : 0)
    : hybrid
      ? RULER + 16 + RULER
      : config['hero'] === 'ring'
        ? RING
        : RULER;
  // each part it shows, with the room over it
  const parts = [
    !compact && pictureAt(config) === 'hero' ? 16 + picturePlate(config, 320).height : 0,
    hero ? 16 + gauge : 0,
    config['show_status'] === false ? 0 : (hero ? 8 : 16) + 20,
    controls ? 16 + (compact ? 44 : CONTROLS) * controls + 12 * (controls - 1) : 0,
    rows ? 16 + ROW_COMPACT * rows : 0,
    !compact && config['show_tyres'] === true ? 16 + TYRES : 0,
    quick && 16 + quick,
  ].filter(Boolean);
  const headed = config['show_head'] !== false;
  return (
    40 +
    (headed ? 44 : 0) +
    parts.reduce((sum, part) => sum + part, 0) -
    (headed || !parts.length ? 0 : 16)
  );
};

export const VEHICLE_FAMILY: readonly FamilyEntry[] = [['fluvy-vehicle-card', vehicleHeight]];
