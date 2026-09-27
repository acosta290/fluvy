/** The derivation's limits: the gates it enforces and the chroma band each character allows. Part of `build/derive.ts`. */
import { type PaletteCharacter, type StateKey } from '../../types.js';
import { type RoleTuning } from './roles.js';

/**
 * Every threshold the build enforces. Nothing here is advisory: `emit/contrast.ts`
 * turns each one into a row of the report and a non-zero exit code.
 */
export const GATES = {
  /** Body text and any ink a user reads as a value. */
  text: 4.5,
  /** Icons, 1px-plus glyphs and large type. Also the floor for state inks. */
  icon: 3,
  /** Light mode: the card has to lift off the page on its own. */
  cardVsPage: 1.18,
  /** The hairline that closes a card edge, measured against the card it sits on. */
  borderVsCard: 1.35,
  /** Ink on a filled "on/active" surface. */
  onFill: 4.5,
  /** Smallest acceptable CIEDE2000 distance between any two graph series. */
  graphSeparation: 8,
  /**
   * Smallest acceptable CIEDE2000 distance between any two status or domain-state inks.
   * Lower than the graph gate on purpose: chart series sit adjacent in a legend, while
   * state colours are read one at a time on a tile. 6 is "obviously a different colour
   * side by side" at icon size, which is the job these have to do.
   */
  roleSeparation: 6,
  /** Smallest hue gap between two domain states, in degrees. */
  stateHueGap: 16,
  /** Dark mode: how much lighter the card is than the page, in lightness points. */
  darkCardLift: { min: 0.04, max: 0.06 },
  /**
   * An electric accent stays electric in both modes: at least this share of the chroma sRGB can hold at its
   * hue and lightness (a green holds far less than an orange, so the bar is relative).
   */
  vividAccentGamut: 0.8,
  /** The accent is never mistaken for a status or a device colour (CIEDE2000; a declared twin is exempt). */
  accentSeparation: 8,
  /**
   * A solid palette's fills are the colours themselves, all at one lightness: any two status or device fills stay
   * this far apart (CIEDE2000), so a filled tile or badge still says which it is.
   */
  fillSeparation: 5.5,
  /** A plate that answers the pointer, or stands off its surface, moves at least this far (CIEDE2000). */
  feedback: 3,
} as const;

/** "Unavailable" ink and border are the neutral ones at this alpha, pre-composited. */
export const UNAVAILABLE_ALPHA = 0.7;

/**
 * Status is louder than a domain state. Both draw from the same chroma band, so what
 * separates "warning" from "a light that is on" — or "danger" from "the heating is on" —
 * is tone, not hue: status inks carry more chroma and sit one step deeper.
 */
export const STATUS_INK_DEPTH = 0.115;

/** The saturation band a character allows (OKLCH chroma), read off the seed and clamped into it. */
export interface CharacterLimits {
  readonly neutralChroma: readonly [min: number, max: number];
  readonly accentChroma: readonly [min: number, max: number];
  readonly roleChroma: readonly [min: number, max: number];
  readonly graphChroma: readonly [min: number, max: number];
  /** How much louder a status is than a domain state. */
  readonly statusChromaBoost: number;
  /** Ceiling on a boosted status chroma. */
  readonly maxRoleChroma: number;
  /** The gate the accent ink is fitted to: text for a soft ink (it doubles as text), icon for a vivid one. */
  readonly accentInkGate: number;
  /**
   * How far each state's hue is pulled towards the accent, to bind the set together. A soft palette's
   * states lean a little towards it; an electric one's keep their own hues, so a radiator is the same red
   * in every electric palette.
   */
  readonly accentHuePull: number;
  /** State anchors the character moves (the electric grid is a slate utility colour, not a second accent). */
  readonly stateTuning?: Readonly<Partial<Record<StateKey, Partial<RoleTuning>>>>;
}

export const LIMITS: Readonly<Record<PaletteCharacter, CharacterLimits>> = {
  /**
   * A peak of 0.105 is roughly a third of what sRGB can hold, so no soft palette can turn fluorescent; the
   * status ceiling keeps "louder" from becoming "vivid".
   */
  soft: {
    neutralChroma: [0.01, 0.034],
    accentChroma: [0.038, 0.105],
    roleChroma: [0.072, 0.095],
    graphChroma: [0.084, 0.098],
    statusChromaBoost: 1.45,
    maxRoleChroma: 0.11,
    accentInkGate: GATES.text,
    accentHuePull: 0.12,
  },
  /**
   * Electric: the accent keeps whatever chroma the designer gave it (the gamut is the limit), greys are nearly
   * neutral, and states and series sit in a band well above the soft one — still below the accent, so the
   * brand colour stays the loudest thing on screen.
   */
  vivid: {
    neutralChroma: [0, 0.012],
    accentChroma: [0.1, 0.37],
    roleChroma: [0.12, 0.17],
    graphChroma: [0.13, 0.18],
    statusChromaBoost: 1.2,
    maxRoleChroma: 0.2,
    accentInkGate: GATES.icon,
    accentHuePull: 0,
    stateTuning: { 'energy-grid': { chroma: 0.3 } },
  },
};
