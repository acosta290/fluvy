import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The Slider card (#77), announced at start and defined when its chunk lands (`slider-cards.ts`), as the web page card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

/**
 * The light card's heights, from the config alone: the full card (the head, the value with its stepper, the ruler
 * and its words) 268, the compact one (the head and the ruler) 188, the house's large tile 168.
 */
export const sliderHeight = (config: LovelaceCardConfig): number =>
  config['variant'] === 'tile' ? 168 : config['variant'] === 'compact' ? 188 : 268;

export const SLIDER_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-slider-card',
    'Fluvy · Slider',
    'Any value on the precision ruler: a player’s volume with its mute, a number or a helper, a fan’s speed, another entity’s switch in its head.',
    sliderHeight,
  ],
];
