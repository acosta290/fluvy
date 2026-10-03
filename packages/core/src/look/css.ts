import {
  declarationsCss,
  derivePalette,
  lookDeclarations,
  paletteKey,
  seedOf,
  type Palette,
  type CssDeclaration,
  type PaletteChoice,
  type PaletteMode,
  type PillName,
  type ShapeName,
} from '@fluvy/tokens/runtime';

import { CHROME_DEFAULTS, TABS_DEFAULTS, type Chrome, type ViewTabs } from './tabs.js';

export { paletteKey };

/**
 * What a user picks: a palette (a preset's name or a custom one), a shape, how round the pills are, and how the
 * dashboards' view tabs and the corner of every page look (absent: the defaults). Neither is a token: `lookKey`
 * leaves them out.
 */
export interface Look {
  readonly palette: PaletteChoice;
  readonly shape: ShapeName;
  readonly pills: PillName;
  readonly tabs?: ViewTabs;
  readonly chrome?: Chrome;
}

/** A look's tabs, the defaults when it names none. */
export const tabsOf = (look: Look): ViewTabs => look.tabs ?? TABS_DEFAULTS;

/** A look's corner (the sidebar's head, the hairlines, the header's surface), the defaults when it names none. */
export const chromeOf = (look: Look): Chrome => look.chrome ?? CHROME_DEFAULTS;

const palettes = new Map<string, Palette>();

/** A palette derived once per choice (both modes, 1–2 ms). */
export function paletteOf(choice: PaletteChoice): Palette {
  const key = paletteKey(choice);
  let palette = palettes.get(key);
  if (!palette) {
    palette = derivePalette(seedOf(choice));
    palettes.set(key, palette);
  }
  return palette;
}

/** A stable key for a whole look. */
export const lookKey = (look: Look): string =>
  `${paletteKey(look.palette)}|${look.shape}|${look.pills}`;

/** One mode of a look as declarations. */
export const declarationsOf = (look: Look, mode: PaletteMode): readonly CssDeclaration[] =>
  lookDeclarations(paletteOf(look.palette), mode, look.shape, look.pills);

/** One mode of a look as a CSS rule on `selector`; `important` to win over a theme Home Assistant set inline. */
export function lookRule(
  look: Look,
  mode: PaletteMode,
  selector: string,
  important = false,
): string {
  return `${selector}{${declarationsCss(declarationsOf(look, mode), important)}}`;
}
