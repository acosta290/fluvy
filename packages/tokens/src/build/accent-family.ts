import { fromHex } from '../color/oklch.js';
import { peakChromaFrom } from '../color/ramp.js';
import { accentAnchors } from '../palettes/custom.js';
import type { Hex, PaletteModeColors, PaletteSeed } from '../types.js';
import { deriveAccent, type AccentFamily } from './derive/accent.js';
import { readIdentity } from './derive/identity.js';
import { profileOf } from './derive/profiles.js';

export type { AccentFamily } from './derive/accent.js';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * A card's own colour on the palette it sits on: the family the accent would have had, had the palette been
 * seeded with `pick` — its hue and chroma read as `readIdentity` reads a seed's accent (clamped into the
 * character's band, a grey a monochrome), fitted against this palette's own surfaces, in this mode, with the
 * mode's profile. The palette's states, statuses and surfaces are not touched: only what the accent owns.
 */
export function accentFamily(
  seed: PaletteSeed,
  colors: PaletteModeColors,
  pick: Hex,
): AccentFamily {
  const identity = readIdentity(seed);
  const { limits, character } = identity;
  const p = profileOf(seed, colors.mode);
  const base = profileOf(seed, seed.baseMode);
  const color = fromHex(pick);
  const monochrome = color.c < 0.012;
  const peak = monochrome
    ? 0
    : clamp(peakChromaFrom(color.l, color.c / base.accentChromaScale), ...limits.accentChroma);
  const neutralPeak = identity.neutralPeakChroma * p.neutralChromaScale;
  return deriveAccent(
    {
      mode: colors.mode,
      profile: p,
      character,
      limits,
      fillStyle: colors.fillStyle,
      inkBackground: colors.mode === 'light' ? colors.surface.page : colors.surface.card,
      card: colors.surface.card,
      textPrimary: colors.text.primary,
      neutralHue: identity.neutralHue,
      neutralPeakChroma: neutralPeak,
    },
    {
      hue: monochrome ? identity.neutralHue : color.h,
      peakChroma: peak * p.accentChromaScale,
      graphPeakChroma: clamp(peak, ...limits.graphChroma) * p.graphChromaScale,
      lightAccent: character === 'vivid' && color.l > 0.85,
      fill: accentAnchors(color, character, colors.fillStyle).fill,
    },
  );
}
