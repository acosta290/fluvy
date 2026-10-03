import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The media family, announced at start and defined when its chunk lands (`media-cards.ts`), as the energy family
 * is: what the card picker lists, how tall each card is at a 360 column and the rounds a compact row names, without
 * the cards themselves — so the pages that show no player (Settings, the Activity page) never carry them.
 */

/** The rounds a compact row can carry (`controls`), in the order they are named. */
export const MEDIA_CONTROLS = ['power', 'previous', 'play', 'next', 'volume'] as const;
export type MediaControl = (typeof MEDIA_CONTROLS)[number];

/** The now-playing strip's rounds when `controls` is left out: today's strip. */
export const NOW_PLAYING_CONTROLS: readonly MediaControl[] = ['previous', 'play', 'next', 'volume'];

const isControl = (value: unknown): value is MediaControl =>
  typeof value === 'string' && (MEDIA_CONTROLS as readonly string[]).includes(value);

/**
 * The `controls` a card was given, as it draws them: in the order written, each once, only names it knows;
 * `fallback` when the key is left out (or is not a list). An empty list is an empty list.
 */
export function mediaControls(
  raw: unknown,
  fallback: readonly MediaControl[],
): readonly MediaControl[] {
  if (!Array.isArray(raw)) return fallback;
  return [...new Set(raw.filter(isControl))];
}

/** The player: artwork, title and controls (264), the volume under them (88); a hero and a row their own. */
export function mediaHeight(config: LovelaceCardConfig): number {
  if (config['variant'] === 'hero') return 600;
  if (config['variant'] === 'mini') return 76;
  return config['show_volume'] === false ? 264 : 352;
}

/** The strip: its rounds' row under the artwork, none when `controls` is empty. */
export const nowPlayingHeight = (config: LovelaceCardConfig): number =>
  mediaControls(config['controls'], NOW_PLAYING_CONTROLS).length ? 212 : 148;

export const MEDIA_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-media-card',
    'Fluvy · Media',
    'A media player: artwork, seek bar, transport and volume — full, compact row or hero.',
    mediaHeight,
  ],
  [
    'fluvy-now-playing-card',
    'Fluvy · Now playing',
    'The compact player of the home screen: artwork, thin progress, transport and volume.',
    nowPlayingHeight,
  ],
];
