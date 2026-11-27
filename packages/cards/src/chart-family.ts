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

/** Whether the full card can lay a readout a series in its value row (#264): with its head, over two of numbers. */
export const readable = (config: LovelaceCardConfig): boolean =>
  config['show_head'] !== false && seriesCount(config) - stripCount(config) >= 2;

/** Whether it does: asked (`readouts`) where it can. */
export const readsEach = (config: LovelaceCardConfig): boolean =>
  config['readouts'] === true && readable(config);

/** The chart's room: 120, or the `plot_height` written (on the 4 grid, 80 to 480); the tile's spark keeps its own. */
export function chartPlot(config: LovelaceCardConfig): number {
  const asked = Number(config['plot_height']);
  return config['variant'] !== 'tile' && asked > 0
    ? Math.min(480, Math.max(80, Math.round(asked / 4) * 4))
    : 120;
}

/**
 * The Chart card at a 360 column, by its variant and its series alone: the full card 320 — the head, the value row,
 * the chart and its axis — and 44 more where four series or more take two lines: a legend's under the axis, or their
 * readouts' (a line more, where a narrower card lays it one a row, is the plot's); the compact card 240 (the head, the
 * chart, the axis); each 16 more a series drawn as its states (its 12 strip and the 4 over it), and what a
 * `plot_height` adds to the chart's 120; the tile 168. At every width, empty, loading or out of reach, it keeps them.
 */
export function chartHeight(config: LovelaceCardConfig): number {
  if (config['variant'] === 'tile') return 168;
  const more = 16 * stripCount(config) + chartPlot(config) - 120;
  if (config['variant'] === 'compact') return 240 + more;
  const lines = config['show_legend'] !== false || readsEach(config);
  return (seriesCount(config) >= 4 && lines ? 364 : 320) + more;
}

export const CHART_FAMILY: readonly FamilyEntry[] = [['fluvy-chart-card', chartHeight]];
