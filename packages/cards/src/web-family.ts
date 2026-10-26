import type { LovelaceCardConfig } from '@fluvy/core';
import { cameraRatio, PLATE_FLOOR, plateHeight } from './devices-family.js';
import type { FamilyEntry } from './energy-family.js';
import { HEAD } from './shared/heights.js';

/**
 * The web page card, announced at start and defined when its chunk lands (`web-cards.ts`), as the template card is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

/**
 * The web page at a 360 column, from its config alone: its plate in the shape asked for (`aspect_ratio`, 16:9 by
 * default) across the card's 320 — or across the whole 360 with no surface (`bare`) — or at the `height` written
 * (on the 4 grid, never under a plate's floor), which wins; under the head (`plate`, the default) or on the surface
 * alone (`frame`: the 20 above and below it).
 */
export const webHeight = (config: LovelaceCardConfig): number => {
  const variant = config['variant'];
  const asked = Number(config['height']);
  const plate =
    asked > 0
      ? Math.max(PLATE_FLOOR, Math.round(asked / 4) * 4)
      : plateHeight(variant === 'bare' ? 360 : 320, cameraRatio(config['aspect_ratio']));
  return variant === 'bare' ? plate : variant === 'frame' ? 40 + plate : HEAD + plate;
};

export const WEB_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-web-card',
    'Fluvy · Web page',
    'A web page on a plate — a map, a chart, a site of your own — under a head, in a frame or bare; sandboxed as Home Assistant’s iframe card is, with a dark look and a scale.',
    webHeight,
  ],
];
