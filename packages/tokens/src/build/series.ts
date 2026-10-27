/**
 * A set of six series colours of the house's own (1.11), worn on a palette: the person's six hues as chosen, each fitted
 * to the card of the mode it is worn in, as the palette's own six are built — only its lightness moves (and the chroma
 * sRGB cannot hold there), and only as far as the gates ask. What fitting cannot fix, two hues too close to tell apart,
 * is the person's to change: the settings panel names them.
 */
import { contrastRatio } from '../color/contrast.js';
import { deltaE } from '../color/delta-e.js';
import { walkLightness } from '../color/fit.js';
import { fromHex, toHex } from '../color/oklch.js';
import type { Hex, PaletteModeColors } from '../types.js';
import { GATES } from './derive/limits.js';

/** How much further from the card a colour may go to stand apart from the ones before it: a twentieth of the scale. */
const APART = 25;

/**
 * The colours on one palette × mode, in order. Each goes away from the card (deeper in light, lighter in dark) until it
 * holds the icon's contrast on it, then further only where that sets it at least `GATES.graphSeparation` (ΔE2000) from
 * every colour before it — as a status picked by the house is set apart from the others. A colour that already holds
 * both is kept as it was picked.
 */
export function fitSeries(colours: readonly Hex[], colors: PaletteModeColors): Hex[] {
  const card = colors.surface.card;
  const away = colors.mode === 'light' ? 'darker' : 'lighter';
  const fitted: Hex[] = [];
  for (const pick of colours) {
    const apart = (hex: Hex): boolean =>
      fitted.every((other) => deltaE(hex, other) >= GATES.graphSeparation);
    if (contrastRatio(pick, card) >= GATES.icon && apart(pick)) {
      fitted.push(pick);
      continue;
    }
    const read = walkLightness(
      fromHex(pick),
      away,
      (hex) => contrastRatio(hex, card) >= GATES.icon,
    );
    const further = walkLightness(read, away, apart, APART);
    fitted.push(toHex(apart(toHex(further)) ? further : read));
  }
  return fitted;
}
