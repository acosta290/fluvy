import { RAMP_STEPS, type Ramp, type RampStep } from '../types.js';
import { toHex } from './oklch.js';

/**
 * Lightness curve for the 11-step ramps.
 *
 * The step number reads as "roughly how light this is", matching how HA uses
 * `--ha-color-*-05…95` (higher = lighter: `--ha-color-text-secondary` is
 * `neutral-40` in light and `neutral-80` in dark).
 *
 * Two deliberate departures from a straight line:
 *  - the dark end stops at 0.145 instead of 0, so `05` is a deep ink and never #000;
 *  - the light end stops at 0.958, so `95` is a tint and never pure white.
 *
 * Step 40 sits at 0.475 on purpose: `--primary-color` maps to `--ha-color-primary-40`
 * and HA hardcodes `a { color: var(--primary-color) }`, so that single step has to
 * clear 4.5:1 on a near-white card.
 */
export const RAMP_LIGHTNESS: Readonly<Record<RampStep, number>> = {
  '05': 0.145,
  '10': 0.205,
  '20': 0.3,
  '30': 0.39,
  '40': 0.475,
  '50': 0.56,
  '60': 0.645,
  '70': 0.735,
  '80': 0.825,
  '90': 0.915,
  '95': 0.958,
};

/**
 * Chroma envelope across the ramp: full at mid lightness, tapering to both ends.
 *
 * `(4·l·(1−l))^0.75` peaks at l = 0.5 and falls to ~0.25 at l = 0.958, which is what
 * keeps the top of the ramp a pale tint rather than a saturated pastel. The exponent
 * below 1 keeps the dark end tinted enough to still read as a colour.
 */
export function chromaEnvelope(lightness: number): number {
  const t = Math.min(1, Math.max(0, lightness));
  return (4 * t * (1 - t)) ** 0.75;
}

export interface RampOptions {
  readonly hue: number;
  /** Peak chroma, reached near the middle of the ramp. Caps the palette's saturation. */
  readonly peakChroma: number;
}

export function buildRamp({ hue, peakChroma }: RampOptions): Ramp {
  const entries = RAMP_STEPS.map((step) => {
    const l = RAMP_LIGHTNESS[step];
    return [step, toHex({ l, c: peakChroma * chromaEnvelope(l), h: hue })] as const;
  });
  return Object.fromEntries(entries) as Ramp;
}

/**
 * Recovers the peak chroma a seed colour implies, by dividing out the envelope.
 * Lets a hand-picked accent set the saturation of its whole ramp.
 */
export function peakChromaFrom(lightness: number, chroma: number): number {
  const envelope = chromaEnvelope(lightness);
  return envelope <= 0.001 ? chroma : chroma / envelope;
}
