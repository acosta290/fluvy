import { PALETTE_NAMES, type PaletteName } from '../config.js';
import type { CustomPalette } from './custom.js';
import type { FillStyle, PaletteCharacter } from '../types.js';

/** A preset by name, or a custom palette. */
export type PaletteChoice = PaletteName | CustomPalette;

export function isPaletteName(value: unknown): value is PaletteName {
  return typeof value === 'string' && (PALETTE_NAMES as readonly string[]).includes(value);
}

/**
 * A stable key for a palette choice: a preset's name, or a custom palette's fields in a fixed order
 * (`custom:vivid:cool:#ff4a1a:solid:#e2ff3d`). The look writes it where a card can read it (`--fluvy-palette`), and
 * `parsePaletteKey` reads the choice back — the round trip is exact.
 */
export function paletteKey(choice: PaletteChoice): string {
  if (typeof choice === 'string') return choice;
  const { character, base, accent, fill = '', highlight = '' } = choice;
  return `custom:${character}:${base}:${accent.toLowerCase()}:${fill}:${highlight.toLowerCase()}`;
}

const CHARACTERS: readonly PaletteCharacter[] = ['soft', 'vivid'];
const BASES = ['warm', 'neutral', 'cool'] as const;
const FILLS: readonly FillStyle[] = ['tint', 'solid'];
const HEX = /^#[0-9a-f]{6}$/;

/** The choice a key stands for, or undefined for anything that is not one of ours. */
export function parsePaletteKey(key: string): PaletteChoice | undefined {
  if (isPaletteName(key)) return key;
  const parts = key.split(':');
  if (parts.length !== 6 || parts[0] !== 'custom') return undefined;
  const [, character, base, accent, fill, highlight] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (!CHARACTERS.includes(character as PaletteCharacter)) return undefined;
  if (!(BASES as readonly string[]).includes(base)) return undefined;
  if (!HEX.test(accent)) return undefined;
  if (fill && !FILLS.includes(fill as FillStyle)) return undefined;
  if (highlight && !HEX.test(highlight)) return undefined;
  return {
    character: character as PaletteCharacter,
    base: base as (typeof BASES)[number],
    accent,
    ...(fill ? { fill: fill as FillStyle } : {}),
    ...(highlight ? { highlight } : {}),
  };
}
