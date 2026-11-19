import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { NAME_LINE, twoLines } from './shared/heights.js';

/**
 * The template card, announced at start and defined when its chunk lands (`template-cards.ts`), as the weather card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page
 * carries this file: it stays tiny.
 */

/**
 * A tile as the tile card draws it: compact (76, the default), mini (108; Mushroom's `layout: vertical` or
 * `vertical: true`) or large (168), or the compact tile in a card's look (84, #220); a small one a line taller with
 * its name in two lines (`name_lines: 2`).
 */
export const templateHeight = (config: LovelaceCardConfig): number => {
  const variant =
    config['variant'] ?? config['layout'] ?? (config['vertical'] === true ? 'mini' : undefined);
  const lines = twoLines(config);
  return variant === 'mini' || variant === 'vertical'
    ? 108 + (lines ? NAME_LINE.mini : 0)
    : variant === 'large'
      ? 168
      : (variant === 'card' ? 84 : 76) + (lines ? NAME_LINE.compact : 0);
};

export const TEMPLATE_FAMILY: readonly FamilyEntry[] = [['fluvy-template-card', templateHeight]];
