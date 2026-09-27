/** A seed's identity (hue and chroma character) and the ink fitting the derivation uses. Part of `build/derive.ts`. */
import { composite, contrastRatio } from '../../color/contrast.js';
import { type FitDirection } from '../../color/fit.js';
import { fromHex, type Oklch, toHex } from '../../color/oklch.js';
import { peakChromaFrom } from '../../color/ramp.js';
import {
  type Hex,
  type PaletteCharacter,
  type PaletteMode,
  type PaletteSeed,
  SEMANTIC_ROLES,
  type SemanticRole,
  STATE_KEYS,
  type StateKey,
} from '../../types.js';
import { type CharacterLimits, LIMITS } from './limits.js';
import { profileOf } from './profiles.js';
import { type RoleTuning, SEMANTIC_TUNING, STATE_TUNING } from './roles.js';

/** The hue/chroma character a seed carries, independent of mode. */
export interface PaletteIdentity {
  readonly limits: CharacterLimits;
  readonly baseMode: PaletteMode;
  readonly character: PaletteCharacter;
  /** The seed's accent is too light to be a line on white (Noir's lime): the other mode draws its lines in ink. */
  readonly lightAccent: boolean;
  /** The seed's accent fill, kept as the brand colour where the accent's lines go neutral. */
  readonly accentFill: Oklch;
  /** The states drawn in the accent's colours (see `Palette.twins`). */
  readonly twins: readonly StateKey[];
  /** Every state's tuning for this palette: the anchors, the character's moves, the seed's own. */
  readonly stateTuning: Readonly<Record<StateKey, RoleTuning>>;
  readonly statusTuning: Readonly<Record<SemanticRole, RoleTuning>>;
  /** The second brand colour: its hue and peak chroma, and its fill as the seed gives it (in `baseMode`). */
  readonly highlight:
    { readonly hue: number; readonly peakChroma: number; readonly fill: Oklch } | undefined;
  readonly neutralHue: number;
  readonly neutralPeakChroma: number;
  readonly accentHue: number;
  readonly accentPeakChroma: number;
  readonly rolePeakChroma: number;
  readonly graphPeakChroma: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Reads the seed's hue and saturation character, normalised out of whichever mode it was drawn in and
 * clamped into its character's band (`LIMITS`).
 */
export function readIdentity(seed: PaletteSeed): PaletteIdentity {
  const limits = LIMITS[seed.character ?? 'soft'];
  const base = profileOf(seed, seed.baseMode);
  const page = fromHex(seed.page);
  const accent = fromHex(seed.accentInk);

  const neutralPeakChroma = clamp(
    peakChromaFrom(page.l, page.c / base.neutralChromaScale),
    ...limits.neutralChroma,
  );
  // A grey or black accent is a monochrome palette: it keeps no chroma in either mode (a clamp would tint
  // it with hue 0, a pink nobody chose), and takes the greys' hue.
  const monochrome = accent.c < 0.012;
  const accentPeakChroma = monochrome
    ? 0
    : clamp(peakChromaFrom(accent.l, accent.c / base.accentChromaScale), ...limits.accentChroma);

  const highlight = seed.highlight === undefined ? undefined : fromHex(seed.highlight);

  const character = seed.character ?? 'soft';
  return {
    limits,
    baseMode: seed.baseMode,
    character,
    lightAccent: character === 'vivid' && accent.l > 0.85,
    accentFill: fromHex(seed.accentFill),
    twins: [
      ...new Set<StateKey>([
        ...(seed.twin ? [seed.twin] : []),
        // a light that is on is the palette's own colour (a Blaze light is orange, a Harbour one teal)
        'light-active' as const,
      ]),
    ],
    stateTuning: Object.fromEntries(
      STATE_KEYS.map((key) => [
        key,
        { ...STATE_TUNING[key], ...limits.stateTuning?.[key], ...seed.states?.[key] },
      ]),
    ) as Record<StateKey, RoleTuning>,
    statusTuning: Object.fromEntries(
      SEMANTIC_ROLES.map((role) => [role, { ...SEMANTIC_TUNING[role], ...seed.statuses?.[role] }]),
    ) as Record<SemanticRole, RoleTuning>,
    highlight: highlight && {
      hue: highlight.h,
      peakChroma: clamp(peakChromaFrom(highlight.l, highlight.c), ...limits.accentChroma),
      fill: highlight,
    },
    // A fully achromatic page would leave the hue undefined; fall back to the accent.
    neutralHue: page.c > 0.002 ? page.h : accent.h,
    neutralPeakChroma,
    accentHue: monochrome ? page.h : accent.h,
    accentPeakChroma,
    // Status and series colours track the palette but stay inside their own band, so a
    // very desaturated palette still gets identifiable states and a saturated one calm ones.
    rolePeakChroma: clamp(accentPeakChroma, ...limits.roleChroma),
    graphPeakChroma: clamp(accentPeakChroma, ...limits.graphChroma),
  };
}

/** Which way an ink on a filled surface has to move: down on a light fill, up on a dark one. */
export function inkOn(fill: Oklch): FitDirection {
  return fill.l > 0.6 ? 'darker' : 'lighter';
}

/** Walks lightness until the 70%-composited result clears a gate against its background. */
export function fitComposited(
  color: Oklch,
  background: Hex,
  alpha: number,
  minRatio: number,
  direction: FitDirection,
): Hex {
  const step = direction === 'darker' ? -0.002 : 0.002;
  let candidate = color;
  for (let i = 0; i <= 500; i += 1) {
    const flattened = composite(toHex(candidate), background, alpha);
    if (contrastRatio(flattened, background) >= minRatio) return flattened;
    const next = candidate.l + step;
    if (next < 0 || next > 1) break;
    candidate = { ...candidate, l: next };
  }
  return composite(toHex(candidate), background, alpha);
}
