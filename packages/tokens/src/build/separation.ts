import { deltaE } from '../color/delta-e.js';
import { fromHex, normalizeHue } from '../color/oklch.js';
import { STATE_KEYS, type PaletteModeColors, type RoleColors, type StateKey } from '../types.js';
import { STATE_HUES } from './derive.js';

/*
 * How far apart the colours that must not be mistaken for each other sit. The release gates read these, and
 * so does a custom palette making room for its accent: one measure for both.
 */

/** A status or device colour's distance from the accent: its ink, and its fill where fills are solid (a solid tile is the colour). */
export function accentDistance(colors: PaletteModeColors, role: RoleColors): number {
  const inks = deltaE(colors.accent.ink, role.ink);
  return colors.fillStyle === 'solid'
    ? Math.min(inks, deltaE(colors.accent.fill, role.fill))
    : inks;
}

/**
 * The domain states around the wheel, in hue order (the twins, the accent itself, left out): at their own hues
 * as an electric palette draws them, at their anchors on the soft line (whose states lean towards the accent
 * on purpose).
 */
export function stateHues(
  colors: PaletteModeColors,
  twins: readonly StateKey[],
): readonly { readonly key: StateKey; readonly hue: number }[] {
  return STATE_KEYS.filter((key) => !twins.includes(key))
    .map((key) => ({
      key,
      hue: normalizeHue(
        colors.character === 'vivid' ? fromHex(colors.state[key].ink).h : STATE_HUES[key],
      ),
    }))
    .sort((a, b) => a.hue - b.hue);
}

/** Each state and the next one round the wheel, with the gap between them in degrees. */
export function hueNeighbours<T extends { readonly hue: number }>(
  sorted: readonly T[],
): readonly { readonly a: T; readonly b: T; readonly gap: number }[] {
  return sorted.flatMap((a, i) => {
    const b = sorted[(i + 1) % sorted.length];
    if (b === undefined || b === a) return [];
    return [{ a, b, gap: i === sorted.length - 1 ? b.hue + 360 - a.hue : b.hue - a.hue }];
  });
}
