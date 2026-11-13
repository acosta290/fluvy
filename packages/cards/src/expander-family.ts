import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The Expander card, announced at start and defined when its chunk lands (`expander-cards.ts`), as the template card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page
 * carries this file: it stays tiny.
 */

/**
 * The card folded, which is how the dashboard plans it — its head alone: 84 on its surface (the head's 44 in the
 * card's 20 above and below), 44 with none (`style: plain`). What it holds is the person's to open.
 */
export const expanderHeight = (config: LovelaceCardConfig): number =>
  config['style'] === 'plain' ? 44 : 84;

export const EXPANDER_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-expander-card',
    'Fluvy · Expander',
    'Any cards folded away under a head: a tap opens them, on one surface or each on its own.',
    expanderHeight,
  ],
];
