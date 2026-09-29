import { MAX_SAVED_PALETTES } from '@fluvy/core';
import { COMMUNITY_PALETTES } from '@fluvy/tokens/community';
import {
  paletteKey,
  parseCustomPalette,
  parsePaletteFile,
  type CustomPalette,
  type PaletteChoice,
  type PaletteFile,
} from '@fluvy/tokens/runtime';

/*
 * Palettes that travel: the house's saved ones ("Yours") and the community's, each a palette file — a custom
 * palette with a name, a title and an author. The gallery shows them as swatches, the Share card writes and reads
 * them, and a draft that equals one of them is that one (not "Custom").
 */

/** How many community palettes the gallery shows before "Show all". */
export const COMMUNITY_SHOWN = 6;

export interface PaletteEntry {
  readonly file: PaletteFile;
  readonly key: string;
}

/** A custom palette's key with what is implicit made explicit: a vivid palette's fill is `tint` unless said. */
export function customKey(palette: CustomPalette): string {
  const whole =
    palette.character === 'vivid' && !palette.fill
      ? { ...palette, fill: 'tint' as const }
      : palette;
  return paletteKey(parseCustomPalette(whole) ?? whole);
}

/** A choice's key: a preset's name, a custom palette's key. */
export const choiceKey = (choice: PaletteChoice): string =>
  typeof choice === 'string' ? choice : customKey(choice);

export const entriesOf = (files: readonly PaletteFile[]): PaletteEntry[] =>
  files.map((file) => ({ file, key: customKey(file.palette) }));

/** The palette file a choice equals, among the given (the house's first, then the community's). */
export function matchOf(
  choice: PaletteChoice,
  files: readonly PaletteFile[],
): PaletteFile | undefined {
  if (typeof choice === 'string') return undefined;
  const key = customKey(choice);
  return files.find((file) => customKey(file.palette) === key);
}

/** The house's palettes and the community's, in that order (a saved one wins a name it shares). */
export const knownPalettes = (saved: readonly PaletteFile[]): readonly PaletteFile[] => [
  ...saved,
  ...COMMUNITY_PALETTES.filter((file) => !saved.some((own) => own.name === file.name)),
];

/** A file name from a title: lower case, no accents, dashes between the words (`Warm Sand` → `warm-sand`). */
export function slugOf(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length >= 2 ? slug : 'palette';
}

/** A palette as a file, when its words are well formed (a title is needed). */
export function paletteFileOf(
  palette: CustomPalette,
  title: string,
  author: string,
): PaletteFile | undefined {
  const name = slugOf(title);
  return parsePaletteFile({
    fluvy_palette: 1,
    name,
    title: title.trim(),
    ...(author.trim() ? { author: author.trim() } : {}),
    palette,
  });
}

/** Whether the house can keep one more palette (a saved one under the same name is replaced, not added). */
export const roomFor = (saved: readonly PaletteFile[], name: string): boolean =>
  saved.some((file) => file.name === name) || saved.length < MAX_SAVED_PALETTES;

/** The house's palettes with this one saved (replacing the one of its name). */
export const withPalette = (
  saved: readonly PaletteFile[],
  file: PaletteFile,
): readonly PaletteFile[] => [...saved.filter((own) => own.name !== file.name), file];

export const withoutPalette = (
  saved: readonly PaletteFile[],
  name: string,
): readonly PaletteFile[] => saved.filter((own) => own.name !== name);
