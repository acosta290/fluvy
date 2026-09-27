import {
  declarationsCss,
  derivePalette,
  lookDeclarations,
  seedOf,
  type Palette,
  type CssDeclaration,
  type PaletteChoice,
  type PaletteMode,
  type PillName,
  type ShapeName,
} from '@fluvy/tokens/runtime';

/** What a user picks: a palette (a preset's name or a custom one), a shape, and how round the pills are. */
export interface Look {
  readonly palette: PaletteChoice;
  readonly shape: ShapeName;
  readonly pills: PillName;
}

/** A stable key for a palette choice: a preset's name, or a custom palette's fields in a fixed order. */
export function paletteKey(choice: PaletteChoice): string {
  if (typeof choice === 'string') return choice;
  const { character, base, accent, fill = '', highlight = '' } = choice;
  return `custom:${character}:${base}:${accent.toLowerCase()}:${fill}:${highlight.toLowerCase()}`;
}

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
