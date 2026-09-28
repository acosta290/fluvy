import { parseCustomPalette, type CustomPalette } from './custom.js';

/** The format's version: a file says which one it speaks. */
export const PALETTE_FILE_VERSION = 1;

/** A palette as it is shared: one JSON file, `<name>.fluvy-palette.json`. */
export interface PaletteFile {
  readonly fluvy_palette: typeof PALETTE_FILE_VERSION;
  /** Its id: lowercase letters, digits and hyphens, 2–40 long; the file is named after it. */
  readonly name: string;
  /** What it is called (up to 32 characters). */
  readonly title: string;
  /** Who made it (up to 40). */
  readonly author?: string;
  /** One line about it (up to 140). */
  readonly description?: string;
  /** The author's own version of it (up to 16). */
  readonly version?: string;
  readonly palette: CustomPalette;
}

export const PALETTE_NAME = /^[a-z0-9][a-z0-9-]{1,39}$/;
const LIMITS = { title: 32, author: 40, description: 140, version: 16 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
    ? value.trim()
    : undefined;

/** A palette file out of anything (a parsed JSON, a stored value); anything malformed is undefined. */
export function parsePaletteFile(value: unknown): PaletteFile | undefined {
  if (!isRecord(value) || value['fluvy_palette'] !== PALETTE_FILE_VERSION) return undefined;
  const name =
    typeof value['name'] === 'string' && PALETTE_NAME.test(value['name'])
      ? value['name']
      : undefined;
  const title = text(value['title'], LIMITS.title);
  const palette = parseCustomPalette(value['palette']);
  if (!name || !title || !palette) return undefined;
  const author = text(value['author'], LIMITS.author);
  const description = text(value['description'], LIMITS.description);
  const version = text(value['version'], LIMITS.version);
  return {
    fluvy_palette: PALETTE_FILE_VERSION,
    name,
    title,
    ...(author ? { author } : {}),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
    palette,
  };
}

/** The file a palette is shared as. */
export const paletteFileName = (file: Pick<PaletteFile, 'name'>): string =>
  `${file.name}.fluvy-palette.json`;
