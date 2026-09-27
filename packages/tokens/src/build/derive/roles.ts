/** How each colour role is tuned: its hue anchor and its tone against its neighbours (status, domain states, graph series). Part of `build/derive.ts`. */
import { type SemanticRole, type StateKey } from '../../types.js';

/** A colour role: a fixed hue anchor plus optional tone tuning against its neighbours. */
export interface RoleTuning {
  readonly hue: number;
  /** Multiplies the role chroma peak. */
  readonly chroma?: number;
  /** Pushes the ink towards more contrast (darker in light, lighter in dark). */
  readonly inkDepth?: number;
}

/**
 * Status roles. Kept pastel by the chroma caps — a warning is an ochre, not a highlighter,
 * and danger is a brick, not a siren. Each sits deliberately between two domain-state hues
 * so the status band never doubles a device colour.
 */
export const SEMANTIC_TUNING: Readonly<Record<SemanticRole, RoleTuning>> = {
  danger: { hue: 18 },
  warning: { hue: 58, chroma: 1.15 },
  success: { hue: 150 },
  info: { hue: 225 },
};

/**
 * Alternating tone step for domain states.
 *
 * At pastel chroma an 18-22° hue gap is worth only ~4 ΔE, which is why greens (battery,
 * home, dehumidify) read as one colour. Walking the wheel and flipping the tone at every
 * step means adjacent states always differ in lightness as well as hue, and the fix is a
 * rule rather than a list of hand-nudged exceptions.
 */
const STATE_TONE_STEP = 0.04;

/**
 * Domain states, in wheel order.
 *
 * Each keeps the association a user already has — heat warm, cool blue, solar gold, battery
 * green — and no two land closer than 18°, because a dashboard shows them side by side.
 * The tone alternates around the wheel; the phase is chosen so that "light on" is the
 * brightest amber and heat sits a clear step lighter than danger, so a warm room never
 * reads as an alarm. Armed keeps less chroma: a red border is a state, not a siren.
 * Media sits at 314° (rose-violet) rather than the saturated indigo that has become
 * shorthand for "AI".
 */
export const STATE_TUNING: Readonly<Record<StateKey, RoleTuning>> = {
  'security-armed': { hue: 352, chroma: 0.85, inkDepth: STATE_TONE_STEP },
  'climate-heat': { hue: 28, inkDepth: -STATE_TONE_STEP },
  'energy-gas': { hue: 48, inkDepth: STATE_TONE_STEP },
  'light-active': { hue: 70, inkDepth: -STATE_TONE_STEP },
  'energy-solar': { hue: 90, inkDepth: STATE_TONE_STEP },
  'climate-dry': { hue: 110, inkDepth: -STATE_TONE_STEP },
  'energy-battery': { hue: 130, inkDepth: STATE_TONE_STEP },
  'presence-home': { hue: 170, inkDepth: -STATE_TONE_STEP },
  'climate-fan': { hue: 188, inkDepth: STATE_TONE_STEP },
  'energy-water': { hue: 208, inkDepth: -STATE_TONE_STEP },
  'climate-cool': { hue: 242, inkDepth: STATE_TONE_STEP },
  'energy-grid': { hue: 266, inkDepth: -STATE_TONE_STEP },
  'energy-home': { hue: 288, inkDepth: STATE_TONE_STEP },
  'media-playing': { hue: 314, inkDepth: -STATE_TONE_STEP },
};

/**
 * Graph series as an accent-anchored harmony, not a walk around the wheel.
 *
 * Twelve evenly spread hues read as a muted rainbow and fight the calm of the product.
 * Instead: series 1 is the accent, 2-4 are its analogous neighbours at slightly lower
 * chroma, and 5-6 are the complementary and split-complementary, muted further still — so
 * the brand hue stays dominant and everything else defers to it. Series 7-12 repeat those
 * six hues one tone step away rather than inventing new ones.
 */
export const GRAPH_HARMONY: readonly {
  readonly hueOffset: number;
  readonly chromaScale: number;
  /** Small tone stagger. 30° of hue at pastel chroma is not enough separation on its own. */
  readonly lightnessOffset: number;
}[] = [
  { hueOffset: 0, chromaScale: 1, lightnessOffset: 0 },
  { hueOffset: 30, chromaScale: 0.9, lightnessOffset: 0.06 },
  { hueOffset: -30, chromaScale: 0.9, lightnessOffset: -0.075 },
  { hueOffset: 60, chromaScale: 0.72, lightnessOffset: 0.12 },
  { hueOffset: 180, chromaScale: 0.7, lightnessOffset: -0.045 },
  { hueOffset: 150, chromaScale: 0.6, lightnessOffset: 0.055 },
];
