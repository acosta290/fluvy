/**
 * The cards' pictures in `docs/images/cards/`: each card's example from the gallery in light and in dark, its base
 * and each of its other layouts, the base once more as the index's thumbnail, and the manifest beside them that says
 * what each was taken of and how large it is. `tools/render/cards.mjs` takes them (Node reads this file as it is, its
 * types stripped), `checks.ts` holds them to the gallery and `pages.ts` shows them.
 */
import { createHash } from 'node:crypto';

/** The folder of the pictures, from the repository's root. */
export const FOLDER = 'docs/images/cards';
/** The manifest's file in it. */
export const MANIFEST = 'pictures.json';
export const MODES = ['light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

/**
 * What a picture is named by, and the manifest's key for it: the card's short name, then the layout's value after a
 * dot where it is not the base's (`gauge`, `gauge.bar`).
 */
export const pictureStem = (short: string, layout?: string): string =>
  layout ? `${short}.${layout}` : short;

/**
 * The stem of a card's thumbnail, in a folder of its own among the pictures: its base picture fitted in THUMB on the
 * page's colour, so the index draws every card in a frame of one size and its grid stands even.
 */
export const thumbStem = (short: string): string => `thumbs/${short}`;

/** A thumbnail's size in pixels, twice what the index shows it at. */
export const THUMB = { width: 560, height: 420 } as const;

/** A picture in a mode, by its stem: the file's name in the folder. */
export const pictureName = (stem: string, mode: Mode): string => `${stem}-${mode}.webp`;

/** What the manifest keeps of a picture: the digest of the example it is of, its size in pixels. */
export interface PictureEntry {
  readonly example: string;
  readonly width: number;
  readonly height: number;
}
/** Every picture's entry, by its stem. */
export type Manifest = Readonly<Record<string, PictureEntry | undefined>>;

/** The digest of an example as the playground mounts it (`mounted()`): what a picture is known to be of. */
export const digest = (mounted: unknown): string =>
  createHash('sha256').update(JSON.stringify(mounted)).digest('hex').slice(0, 12);
