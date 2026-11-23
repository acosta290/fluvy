/**
 * A colour worn as it is named (`exact_colors`, 1.25, #250), where every other card wears the palette's tone of it: one
 * of Home Assistant's names is Home Assistant's own value (`HA_STANDARD_COLORS`), a hex is itself. Its family on a
 * palette × mode is drawn in it exactly — the glyph, the line, the bar, the fill — and stays legible where words meet
 * it: words on its fill are the palette's black or white, whichever reads, and a word written in it moves in lightness
 * only, as far as 4.5 asks. Fetched by the first card that asks (`@fluvy/core`'s `exactColors`), never by a house that
 * wears the palette's tones.
 */
import { composite, contrastRatio } from '../color/contrast.js';
import { ensureContrast } from '../color/fit.js';
import { fromHex, toHex } from '../color/oklch.js';
import { buildRamp, peakChromaFrom } from '../color/ramp.js';
import { isHaColorName, resolveAccent } from '../ha/named.js';
import { HA_STANDARD_COLORS } from '../ha/standard.js';
import type { Hex, PaletteModeColors, PaletteSeed } from '../types.js';
import { accentContext } from './accent-family.js';
import {
  awayFrom,
  fillBorderOf,
  hoverOf,
  seriesAround,
  type AccentFamily,
} from './derive/accent.js';
import { GATES } from './derive/limits.js';
import { solidHover } from './derive/profiles.js';

/** How much of the colour a tint palette's fill is over the card: Home Assistant's tile draws its icon's plate so. */
export const EXACT_TINT = 0.2;

/** A card's `color` as named: one of Home Assistant's names its own value, anything else as `resolveAccent` reads it. */
export function exactHex(choice: unknown, colors: PaletteModeColors): Hex | undefined {
  const name = typeof choice === 'string' ? choice.trim().toLowerCase() : '';
  return isHaColorName(name) ? HA_STANDARD_COLORS[name] : resolveAccent(choice, colors);
}

/** The palette's black or white on `fill`, whichever reads better, taken towards #000 or #fff as far as 4.5 asks. */
function wordsOn(fill: Hex, colors: PaletteModeColors): Hex {
  const black = colors.neutralRamp['05'];
  const white = colors.neutralRamp['95'];
  const dark = contrastRatio(black, fill) >= contrastRatio(white, fill);
  return toHex(
    ensureContrast(fromHex(dark ? black : white), fill, GATES.text, dark ? 'darker' : 'lighter'),
  );
}

/**
 * A colour's family worn exactly on one palette × mode. The ink (a glyph, a line, a bar, a ring) is the colour; the
 * fill is the colour on a solid palette and a fifth of it over the card on a tint one (`EXACT_TINT`), with its hairline
 * fitted off it; the words on either are the palette's black or white, whichever reads at 4.5; the text form (a value,
 * a link written in the colour) is the colour taken deeper in light, lighter in dark, only as far as it reads at 4.5
 * on the card and the page. What follows from a hue — the hover, the primary action, the ramp, the graph series after
 * the first, which is the colour — follows from the colour's own hue and chroma, never the palette's band.
 */
export function exactFamily(seed: PaletteSeed, colors: PaletteModeColors, pick: Hex): AccentFamily {
  const ctx = accentContext(seed, colors);
  const p = ctx.profile;
  const color = fromHex(pick);
  const peak = peakChromaFrom(color.l, color.c);
  const { card, page } = colors.surface;
  const solid = colors.fillStyle === 'solid';
  const fill = solid ? pick : composite(pick, card, EXACT_TINT);
  const fillOklch = fromHex(fill);
  const onFill = wordsOn(fill, colors);
  const onAccent = wordsOn(pick, colors);
  const away = colors.mode === 'light' ? 'darker' : 'lighter';
  const grounds = [page, card];
  return {
    ink: pick,
    hover: hoverOf(color, p),
    // the colour as typed where it reads already (sRGB's corners do not come back from OKLCH to the digit)
    text: grounds.every((ground) => contrastRatio(pick, ground) >= GATES.text)
      ? pick
      : toHex(
          grounds.reduce((ink, ground) => ensureContrast(ink, ground, GATES.text, away), color),
        ),
    fill,
    fillBorder: fillBorderOf(fillOklch, p),
    onFill,
    onAccent,
    primary: solid
      ? { fill, hover: toHex(solidHover(fillOklch)), on: onFill }
      : { fill: pick, hover: toHex(awayFrom(color, onAccent, p)), on: onAccent },
    ramp: buildRamp({ hue: color.h, peakChroma: peak }),
    graph: [pick, ...seriesAround(ctx, color.h, peak * p.graphChromaScale).slice(1)],
  };
}
