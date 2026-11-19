import { layoutHeightOf, type LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { expanderColumns, onSurface } from './expander-family.js';

/**
 * The Swipe card (#206), announced at start and defined when its chunk lands (`swipe-cards.ts`), as the Expander is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself — and the figures of
 * its layout that height is counted with, which the card lays its pages out by too. Every page carries this file: it
 * stays tiny.
 */

const plain = (config: LovelaceCardConfig): boolean => config['style'] === 'plain';

/**
 * The room between its cards, side by side and from one page to the next, in px: the config's on the 4 grid (40 at
 * most: half of it stands on each side of a card), else its style's — on the surface a card's own 20 and 20, without
 * one a section's 16.
 */
export function swipeGap(config: LovelaceCardConfig): number {
  const asked = Number(config['gap']);
  return config['gap'] !== undefined && Number.isFinite(asked)
    ? Math.min(40, Math.max(0, Math.round(asked / 4) * 4))
    : plain(config)
      ? 16
      : 40;
}

/**
 * Its cards in view at once, side by side in a width: as many as asked for (`columns`, 1 to 4; `slides_per_view`, as
 * other swipe cards call it) while each keeps the Expander's least width.
 */
export const swipeColumns = (config: LovelaceCardConfig, width: number): number =>
  expanderColumns(
    { ...config, columns: config['columns'] ?? config['slides_per_view'] },
    width,
    swipeGap(config),
  );

/** The cards its config lists: one a page. */
export const swipeCards = (config: LovelaceCardConfig): LovelaceCardConfig[] =>
  Array.isArray(config['cards'])
    ? (config['cards'] as unknown[]).filter(
        (card): card is LovelaceCardConfig =>
          typeof (card as LovelaceCardConfig | null)?.type === 'string',
      )
    : [];

/**
 * Where its row can stand, one card further each time: every card with `loop` (once there are more than it shows
 * at once), else from the first to the one that shows the last.
 */
export const swipeStops = (config: LovelaceCardConfig, cards: number, columns: number): number =>
  config['loop'] === true ? (cards > columns ? cards : 1) : Math.max(1, cards - columns + 1);

/**
 * The page marks' row: on the surface 44 that take the 20 under its cards (24 more), on the page 44 under them; none
 * where it has one stop, or where `show_indicators: false`.
 */
export const swipeMarks = (config: LovelaceCardConfig, stops: number): number =>
  config['show_indicators'] === false || stops < 2 ? 0 : plain(config) ? 44 : 24;

/** A card of another maker, which declares no height: counted as a head (the 44 in a card's 20 and 20). */
const OTHER = 84;
/** No card yet: one quiet line, in a card's 20 and 20 on the surface. */
const EMPTY = 20;

/**
 * Its height at a 360 column, from its config alone: its tallest card as that card declares itself — held on the
 * surface, a card of Fluvy's keeps its height, its padding the surface's, and what stands on the page or a row has the
 * surface's padding round it past its own (`onSurface`) — and the marks under them where its row has more than one
 * stop. With no card, its quiet line. `heightOf` is what counts a card: its declaration, or the automatic dashboard's
 * reading of it with the house (`house-heights.ts`).
 */
export function swipeHeight(
  config: LovelaceCardConfig,
  heightOf: (card: LovelaceCardConfig, fallback: number) => number = layoutHeightOf,
): number {
  const cards = swipeCards(config);
  if (!cards.length) return plain(config) ? EMPTY : EMPTY + 40;
  const held = plain(config) ? () => 0 : onSurface;
  return (
    Math.max(...cards.map((card) => heightOf(card, OTHER) + held(card))) +
    swipeMarks(config, swipeStops(config, cards.length, swipeColumns(config, 360)))
  );
}

export const SWIPE_FAMILY: readonly FamilyEntry[] = [['fluvy-swipe-card', swipeHeight]];
