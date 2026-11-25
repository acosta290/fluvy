import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { headlessOf, noBadge, noLine } from './shared/head-lines.js';
import { EMPTY, HEAD, ROW, ROW_COMPACT, rowsOf } from './shared/heights.js';

/**
 * The alerts family (the alerts card and its sheet), announced at start and defined when its chunk lands
 * (`alerts-cards.ts`), as the devices family is: what the card picker lists and how tall the card is at a 360 column,
 * without the card itself. Every page carries this file: it stays tiny.
 */

export const ALERTS_VARIANTS = ['tiles', 'mini', 'chips', 'rows', 'banner'] as const;
export type AlertsVariant = (typeof ALERTS_VARIANTS)[number];

/** A compact tile (76) and a mini one (108), 8 between their rows; a chip's row (44); the banner, one compact tile. */
const TILE = 76;
const MINI = 108;
const CHIP = 44;
const GAP = 8;

/** The columns of the tiles when the config names none: two compact tiles a row, three minis. */
export const alertsColumns = (config: LovelaceCardConfig): number => {
  const asked = Number(config['columns']);
  return Number.isInteger(asked) && asked >= 1 && asked <= 4
    ? asked
    : config['variant'] === 'mini'
      ? 3
      : 2;
};

/** What leaves the rows' head with nothing in it besides its circle and its name (#259): a line of its own, the count. */
export const alertsQuiet = (config: LovelaceCardConfig | undefined): boolean =>
  noLine(config, true) && noBadge(config, config?.['show_count'] === false);

/**
 * The alerts card at a 360 column with every alert it lists showing (one tile, chip or row each — a split alert as
 * one — and the fold past `max_alerts`): tiles two a row (minis three), chips three a row, the rows under the head
 * (60, 48 compact; a head left with nothing in it gone, with the gap under it, #259), the banner one tile. With
 * nothing listed, what it draws while all is clear: the "All clear" tile, chip or panel.
 */
export const alertsHeight = (config: LovelaceCardConfig): number => {
  const listed = config['alerts'];
  const max = Math.round(Number(config['max_alerts']));
  const all = Array.isArray(listed) ? listed.length : 4;
  const n = Number.isFinite(max) && max >= 1 && all > max ? max + 1 : all;
  const variant = config['variant'];
  if (variant === 'rows') {
    const quiet = alertsQuiet(config);
    if (!n) return HEAD + EMPTY - headlessOf(config, quiet, 16);
    // the rows start 4 under the head, not a list's 16
    return (
      HEAD -
      12 -
      headlessOf(config, quiet, 4) +
      n * (config['compact'] === true ? ROW_COMPACT : ROW)
    );
  }
  if (variant === 'banner' || !n) return variant === 'chips' ? CHIP : TILE;
  if (variant === 'chips') return rowsOf(n, 3) * CHIP;
  const rows = rowsOf(n, alertsColumns(config));
  return rows * ((variant === 'mini' ? MINI : TILE) + GAP) - GAP;
};

export const ALERTS_FAMILY: readonly FamilyEntry[] = [['fluvy-alerts-card', alertsHeight]];
