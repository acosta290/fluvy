import type { Tone } from '@fluvy/ui';

/** What carries a tone and a colour of its own: a card's config, or an item of one of its lists. */
export interface Coloured {
  readonly tone?: Tone | undefined;
  readonly color?: unknown;
}

/**
 * The tone a part is drawn in: the one asked for; else, where a colour of its own was given, the accent (the
 * colour redefines the accent inside the card, so that is where it shows); else what the part would be anyway.
 */
export const toneOf = (item: Coloured | undefined, fallback: Tone = 'accent'): Tone =>
  item?.tone ?? (item?.color !== undefined && item.color !== '' ? 'accent' : fallback);
