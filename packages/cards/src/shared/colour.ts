import type { Tone } from '@fluvy/ui';
import type { LightWhites } from './light.js';

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

/**
 * The tone of a part that may be saying a status: a tone asked for by name is the house's choice; otherwise a warning
 * (an open window, a jammed lock) stays the warning's whatever colour the part was given — a colour stands in for the
 * accent, never for a status; anything else as `toneOf`.
 */
export const statusToneOf = (item: Coloured | undefined, status: Tone): Tone =>
  item?.tone ?? (status === 'warning' ? 'warning' : toneOf(item, status));

/** When an item's colour shows on its surface: while it is on (the default), or always — a quiet wash and its hairline at rest. */
export type Tint = 'on' | 'always';

/**
 * Whether a tone shows at rest (`tint: always`) as its wash: a domain's or the accent's does; the neutral has none,
 * and a status (a warning, a danger) says something is wrong only while it is.
 */
export const washesAtRest = (tone: Tone): boolean =>
  tone !== 'neutral' && tone !== 'warning' && tone !== 'danger';

/** What a card with lights says of their colours (1.9). */
export interface LightColours {
  /** A lit light wears its bulb's colour (the house's default, in fluvy's settings, where the card says none). */
  light_colors?: boolean;
  /** A lit white in its bulb's colour: by its temperature (the default, 1.10), or as the palette's light (`palette`). */
  light_whites?: LightWhites;
}
