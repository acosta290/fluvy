/** The mode profiles: how a soft or vivid palette, and a solid fill, sets each surface, ink and fill in light and dark. Part of `build/derive.ts`. */
import { composite, contrastRatio } from '../../color/contrast.js';
import { type Oklch } from '../../color/oklch.js';
import {
  type Hex,
  type PaletteCharacter,
  type PaletteMode,
  type PaletteSeed,
  type RoleColors,
} from '../../types.js';
import { inkOn } from './identity.js';
import { GATES } from './limits.js';

export interface ModeProfile {
  /** Card lightness when the mode is derived rather than seeded. */
  readonly cardL: number;
  readonly pageL: number;
  /** Signed offset from the page. Sunken in light, lifted in dark — HA's own convention. */
  readonly pageAltDelta: number;
  readonly cardElevatedDelta: number;
  readonly borderDelta: number;
  readonly borderStrongDelta: number;
  /**
   * Border chroma, relative to the neutral peak. Mode-dependent because the chroma
   * envelope peaks at mid lightness: a dark-mode border sits near L 0.35 where the
   * envelope is ~1.0, so the same multiplier that reads as a whisper of warmth in light
   * would come out as an olive line in dark.
   */
  readonly borderChromaScale: number;
  readonly textPrimaryL: number;
  readonly textSecondaryL: number;
  /** Ink placed on the solid accent. Opposite end of the scale from the accent itself. */
  readonly onAccentL: number;
  readonly accentL: number;
  readonly accentHoverDelta: number;
  /** The "on/active" filled surface. */
  readonly fillL: number;
  readonly fillChromaScale: number;
  readonly fillBorderDelta: number;
  readonly onFillL: number;
  readonly onFillChromaScale: number;
  /** Ink for status and domain states, sitting on card/page. */
  readonly inkL: number;
  /** Base lightness of graph series 1-6. */
  readonly graphBaseL: number;
  /**
   * How far series 7-12 sit below row one. Always deeper, in both modes: going lighter in
   * dark mode would run the top of the row into white, where the chroma envelope collapses
   * and six distinct hues turn into six greys.
   */
  readonly graphToneDelta: number;
  /**
   * Status and domain-state chroma, relative to the accent's mode scale. Dark mode keeps
   * more of it than an accent does (0.88 against 0.75): a state colour is an icon or an 8px
   * dot carrying meaning, not a surface, and at pastel chroma a 20° hue gap is already the
   * whole difference between "battery" and "dehumidifying".
   */
  readonly roleChromaScale: number;
  readonly neutralChromaScale: number;
  readonly accentChromaScale: number;
  /**
   * Graph series keep more chroma than accents do in dark mode. The 25% accent
   * desaturation exists because large tinted surfaces vibrate against a dark ground;
   * a 2px chart stroke does not, and losing that chroma costs series separation.
   */
  readonly graphChromaScale: number;
}

const SOFT: Readonly<Record<PaletteMode, ModeProfile>> = {
  /**
   * Light: near-white card over a tinted page, dark ink. The card is the brightest
   * thing on screen, so everything else is placed relative to it.
   */
  light: {
    cardL: 0.99,
    pageL: 0.937,
    pageAltDelta: -0.028,
    // A light-mode card is already the brightest surface on screen, so a dialog cannot be
    // lighter without turning pure white and losing the palette tint. Elevation in light
    // mode is carried by the shadow, and this token intentionally equals the card.
    cardElevatedDelta: 0,
    borderDelta: -0.1,
    borderStrongDelta: -0.2,
    borderChromaScale: 1.3,
    textPrimaryL: 0.28,
    textSecondaryL: 0.505,
    onAccentL: 0.985,
    accentL: 0.5,
    accentHoverDelta: -0.05,
    fillL: 0.918,
    fillChromaScale: 0.8,
    fillBorderDelta: -0.075,
    onFillL: 0.335,
    onFillChromaScale: 0.8,
    inkL: 0.53,
    graphBaseL: 0.52,
    graphToneDelta: 0.165,
    roleChromaScale: 1,
    neutralChromaScale: 1,
    accentChromaScale: 1,
    graphChromaScale: 1,
  },
  /**
   * Dark: a charcoal page that is never #000, a card 5.2 lightness points above it,
   * light ink. Accents lose a quarter of their chroma and gain lightness — full-chroma
   * colour on a dark ground reads as neon and vibrates against the background.
   */
  dark: {
    cardL: 0.217,
    pageL: 0.165,
    pageAltDelta: 0.028,
    cardElevatedDelta: 0.045,
    borderDelta: 0.1,
    borderStrongDelta: 0.19,
    borderChromaScale: 0.55,
    textPrimaryL: 0.93,
    textSecondaryL: 0.755,
    onAccentL: 0.175,
    accentL: 0.8,
    accentHoverDelta: 0.05,
    fillL: 0.305,
    fillChromaScale: 0.45,
    fillBorderDelta: 0.075,
    onFillL: 0.925,
    onFillChromaScale: 1,
    inkL: 0.775,
    graphBaseL: 0.745,
    graphToneDelta: 0.16,
    roleChromaScale: 0.88,
    neutralChromaScale: 0.85,
    accentChromaScale: 0.75,
    graphChromaScale: 0.92,
  },
};

const VIVID: Readonly<Record<PaletteMode, ModeProfile>> = {
  /**
   * Light: white cards on a cool, nearly neutral grey, near-black ink. The accent is a bright graphic
   * colour; tints are pale so a vivid ink on them still reads.
   */
  light: {
    cardL: 1,
    pageL: 0.955,
    pageAltDelta: -0.03,
    cardElevatedDelta: 0,
    borderDelta: -0.085,
    borderStrongDelta: -0.2,
    borderChromaScale: 1,
    textPrimaryL: 0.2,
    textSecondaryL: 0.5,
    onAccentL: 0.99,
    accentL: 0.62,
    accentHoverDelta: -0.06,
    fillL: 0.935,
    fillChromaScale: 0.45,
    fillBorderDelta: -0.07,
    // near-black on a plate: the colour stays in the glyph and the switch
    onFillL: 0.24,
    onFillChromaScale: 0.3,
    inkL: 0.58,
    graphBaseL: 0.6,
    graphToneDelta: 0.16,
    roleChromaScale: 1,
    neutralChromaScale: 1,
    accentChromaScale: 1,
    graphChromaScale: 1,
  },
  /** Dark: a neutral charcoal, the accent kept nearly as loud as in light (it is what makes the palette). */
  dark: {
    cardL: 0.215,
    pageL: 0.16,
    pageAltDelta: 0.028,
    cardElevatedDelta: 0.045,
    borderDelta: 0.095,
    borderStrongDelta: 0.19,
    borderChromaScale: 1,
    textPrimaryL: 0.95,
    textSecondaryL: 0.74,
    onAccentL: 0.18,
    // where every hue still holds most of its chroma: a blue fades above it, a green below
    accentL: 0.7,
    accentHoverDelta: 0.05,
    // smoked glass: a dark plate barely tinted, the accent glyph glowing on it
    fillL: 0.29,
    fillChromaScale: 0.3,
    fillBorderDelta: 0.075,
    onFillL: 0.93,
    onFillChromaScale: 0.9,
    inkL: 0.76,
    graphBaseL: 0.74,
    graphToneDelta: 0.16,
    roleChromaScale: 0.95,
    neutralChromaScale: 1,
    accentChromaScale: 0.95,
    graphChromaScale: 0.95,
  },
};

/** Secondary text on a filled surface: its on-fill ink at this opacity (a tile's state line, a scene's time). */
export const SECONDARY_ON_FILL = 0.8;

/**
 * A status on a solid palette: its fill one step away from the device colours' (which all sit at the solid fill's
 * lightness), so a warning never reads as gas nor danger as heating — the step a tint palette's ink already has.
 */
export const SOLID_STATUS_STEP: Readonly<
  Record<PaletteMode, { readonly l: number; readonly chroma: number }>
> = {
  light: { l: -0.07, chroma: 1.2 },
  dark: { l: 0.03, chroma: 1 },
};

/** How much of a solid fill a resting icon circle carries over the card (the cards mix `--fluvy-wash` the same way). */
export const SOLID_WASH = 0.32;

/** A solid fill under the pointer: a step towards its ink, so a black-on-periwinkle button deepens, a lime one too. */
export function solidHover(fill: Oklch): Oklch {
  return { ...fill, l: fill.l + (inkOn(fill) === 'darker' ? -0.04 : 0.04) };
}

/** The most of `SOLID_WASH` a resting circle can take of its fill while every ink on it clears the icon gate. */
export function washShareFor(roles: readonly RoleColors[], base: Hex): number {
  const clears = (share: number): boolean =>
    roles.every((role) => contrastRatio(role.ink, composite(role.fill, base, share)) >= GATES.icon);
  let share = SOLID_WASH;
  while (share > 0 && !clears(share)) share = Math.max(0, Math.round((share - 0.02) * 100) / 100);
  return share;
}

/** Solid fills: the colour itself, light enough in both modes to carry near-black ink (a lime greeting, a periwinkle tile). */
export const SOLID_FILL: Readonly<
  Record<
    PaletteMode,
    Pick<
      ModeProfile,
      'fillL' | 'fillChromaScale' | 'fillBorderDelta' | 'onFillL' | 'onFillChromaScale'
    >
  >
> = {
  light: {
    fillL: 0.84,
    fillChromaScale: 1.15,
    fillBorderDelta: -0.08,
    onFillL: 0.2,
    onFillChromaScale: 0.35,
  },
  dark: {
    fillL: 0.78,
    fillChromaScale: 1.05,
    fillBorderDelta: -0.08,
    onFillL: 0.18,
    onFillChromaScale: 0.35,
  },
};

const PROFILES: Readonly<Record<PaletteCharacter, Readonly<Record<PaletteMode, ModeProfile>>>> = {
  soft: SOFT,
  vivid: VIVID,
};

/** The profile a seed derives a mode with: its character's, with solid fills when it asks for them. */
export function profileOf(seed: PaletteSeed, mode: PaletteMode): ModeProfile {
  const base = PROFILES[seed.character ?? 'soft'][mode];
  return seed.fill === 'solid' ? { ...base, ...SOLID_FILL[mode] } : base;
}
