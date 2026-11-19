import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The Chart card, announced at start and defined when its chunk lands (`chart-cards.ts`), as the template card is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

/** How many series a config draws (its `series`, six at most: the palette's series colours). */
export const seriesCount = (config: LovelaceCardConfig): number =>
  Array.isArray(config['series']) ? Math.min(6, config['series'].length) : 0;

/** How many of them are drawn as their states (`kind: states`, #228): a strip each under the plot. */
const stripCount = (config: LovelaceCardConfig): number =>
  Array.isArray(config['series'])
    ? config['series']
        .slice(0, 6)
        .filter((item: unknown) => (item as { kind?: unknown } | null)?.kind === 'states').length
    : 0;

/**
 * The Chart card at a 360 column, by its variant and its series alone: the full card 320 — the head, the value row,
 * the chart and its axis — and 44 more where a legend of four series or more takes two lines under the axis (a line
 * more, where a narrower card lays it one a row, is the plot's); the compact card 240 (the head, the chart, the axis);
 * each 16 more a series drawn as its states (its 12 strip and the 4 over it); the tile 168. At every width, empty,
 * loading or out of reach, it keeps them.
 */
export function chartHeight(config: LovelaceCardConfig): number {
  if (config['variant'] === 'tile') return 168;
  const strips = 16 * stripCount(config);
  if (config['variant'] === 'compact') return 240 + strips;
  return (seriesCount(config) >= 4 && config['show_legend'] !== false ? 364 : 320) + strips;
}

export const CHART_FAMILY: readonly FamilyEntry[] = [['fluvy-chart-card', chartHeight]];
