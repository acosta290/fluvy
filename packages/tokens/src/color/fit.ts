import type { Hex } from '../types.js';
import { contrastRatio } from './contrast.js';
import { toHex, type Oklch } from './oklch.js';

export type FitDirection = 'darker' | 'lighter';

const STEP = 0.002;

/**
 * Walks lightness — and only lightness — from `from`, a step at a time (`most` steps at the most), until `ok` holds or
 * the scale runs out: a fit by any rule, where `ensureContrast` fits by one ratio.
 *
 * Hue and chroma are the designer's intent, so they never move; the rule reads the *rounded hex*, because that is the
 * value the theme actually ships.
 */
export function walkLightness(
  from: Oklch,
  direction: FitDirection,
  ok: (hex: Hex) => boolean,
  most = 500,
): Oklch {
  const step = direction === 'darker' ? -STEP : STEP;
  let color = from;
  for (let i = 0; i < most && !ok(toHex(color)) && color.l + step >= 0 && color.l + step <= 1; i++)
    color = { ...color, l: color.l + step };
  return color;
}

/**
 * Walks lightness until the colour clears a contrast gate on `background`, kept verbatim when it already does. If the
 * lightness axis runs out before the gate is met, the extreme is returned and the contrast report fails the build
 * rather than silently shipping a near-miss.
 */
export function ensureContrast(
  color: Oklch,
  background: Hex,
  minRatio: number,
  direction: FitDirection,
): Oklch {
  return walkLightness(color, direction, (hex) => contrastRatio(hex, background) >= minRatio);
}
