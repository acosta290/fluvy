import { PALETTE_NAMES, type PaletteName } from '../config.js';
import type { CustomPalette } from './custom.js';
import type { FillStyle, PaletteCharacter, SurfaceStyle } from '../types.js';

/** A preset by name, or a custom palette. */
export type PaletteChoice = PaletteName | CustomPalette;

export function isPaletteName(value: unknown): value is PaletteName {
  return typeof value === 'string' && (PALETTE_NAMES as readonly string[]).includes(value);
}

/**
 * A stable key for a palette choice: a preset's name, or a custom palette's fields in a fixed order
 * (`custom:vivid:cool:#ff4a1a:solid:#e2ff3d`), then its surface where cards are not set off by their fill
 * (`custom:soft:neutral:#1f1f1f:::line`). The look writes it where a card can read it (`--fluvy-palette`), and
 * `parsePaletteKey` reads the choice back — the round trip is exact.
 */
export function paletteKey(choice: PaletteChoice): string {
  if (typeof choice === 'string') return choice;
  const { character, base, accent, fill = '', highlight = '', surface } = choice;
  return `custom:${character}:${base}:${accent.toLowerCase()}:${fill}:${highlight.toLowerCase()}${surface ? `:${surface}` : ''}`;
}

const CHARACTERS: readonly PaletteCharacter[] = ['soft', 'vivid'];
const BASES = ['warm', 'neutral', 'cool'] as const;
const FILLS: readonly FillStyle[] = ['tint', 'solid'];
const SURFACES: readonly SurfaceStyle[] = ['line', 'ink'];
const HEX = /^#[0-9a-f]{6}$/;

/** The choice a key stands for, or undefined for anything that is not one of ours. */
export function parsePaletteKey(key: string): PaletteChoice | undefined {
  if (isPaletteName(key)) return key;
  const parts = key.split(':');
  if ((parts.length !== 6 && parts.length !== 7) || parts[0] !== 'custom') return undefined;
  const [, character, base, accent, fill, highlight, surface] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
    string | undefined,
  ];
  if (!CHARACTERS.includes(character as PaletteCharacter)) return undefined;
  if (!(BASES as readonly string[]).includes(base)) return undefined;
  if (!HEX.test(accent)) return undefined;
  if (fill && !FILLS.includes(fill as FillStyle)) return undefined;
  if (highlight && !HEX.test(highlight)) return undefined;
  if (surface !== undefined && !SURFACES.includes(surface as SurfaceStyle)) return undefined;
  return {
    character: character as PaletteCharacter,
    base: base as (typeof BASES)[number],
    accent,
    ...(fill ? { fill: fill as FillStyle } : {}),
    ...(highlight ? { highlight } : {}),
    ...(surface ? { surface: surface as 'line' | 'ink' } : {}),
  };
}
