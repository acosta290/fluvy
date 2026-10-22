import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The template card, announced at start and defined when its chunk lands (`template-cards.ts`), as the weather card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page
 * carries this file: it stays tiny.
 */

/**
 * A tile as the tile card draws it: compact (76, the default), mini (108; Mushroom's `layout: vertical` or
 * `vertical: true`) or large (168).
 */
export const templateHeight = (config: LovelaceCardConfig): number => {
  const variant =
    config['variant'] ?? config['layout'] ?? (config['vertical'] === true ? 'mini' : undefined);
  return variant === 'mini' || variant === 'vertical' ? 108 : variant === 'large' ? 168 : 76;
};

export const TEMPLATE_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-template-card',
    'Fluvy · Template',
    'A tile whose name, line, icon, colour and fill are templates, with or without an entity; a Mushroom template card pastes in.',
    templateHeight,
  ],
];
