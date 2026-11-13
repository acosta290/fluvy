import type { PaletteMode } from './types.js';

/**
 * Single source of truth for the brand prefix.
 *
 * `px` is a placeholder. Renaming the product means editing `prefix` (and `npmScope`
 * in the package manifests) — every emitted custom property is built through
 * `cssVar()`, so nothing else has to change.
 */
export const BRAND = {
  prefix: 'fluvy',
  npmScope: '@fluvy',
} as const;

/** Registry of the palettes this release ships, in presentation order: the soft line, then the electric one. */
export const PALETTE_NAMES = [
  'sand',
  'sage',
  'mist',
  'clay',
  'slate',
  'harbour',
  'dusk',
  'linen',
  'ember',
  // the electric line: the tint trio warm to cool, the solid pair, the dark-first one
  'blaze',
  'flamingo',
  'iris',
  'volt',
  'mint',
  'noir',
] as const;

export type PaletteName = (typeof PALETTE_NAMES)[number];

export const PALETTE_MODES: readonly PaletteMode[] = ['light', 'dark'];

/** What `:root` falls back to when no `data-palette`/`data-mode` is set. Linen is the launch palette. */
export const DEFAULT_PALETTE: PaletteName = 'linen';
export const DEFAULT_MODE: PaletteMode = 'light';

/** Builds a brand-scoped custom property name: `cssVar('accent-fill')` → `--fluvy-accent-fill`. */
export function cssVar(path: string): string {
  return `--${BRAND.prefix}-${path}`;
}

/** The theme fluvy installs, as Home Assistant lists it (profile, `frontend.set_theme`), in Home Assistant's mode. */
export const THEME_NAME = 'Fluvy';

/**
 * The same theme held to one mode, installed beside it (Home Assistant holds a theme that has one mode to it): what an
 * automation switches between with `frontend.set_theme`, as Home Assistant sets a theme but never a mode.
 */
export const MODE_THEMES: Readonly<Record<PaletteMode, string>> = {
  light: `${THEME_NAME} Light`,
  dark: `${THEME_NAME} Dark`,
};

/**
 * The mode a theme of fluvy's holds to: `light` or `dark` for Fluvy Light and Fluvy Dark, `''` for Fluvy, which
 * follows Home Assistant's; undefined for any other theme.
 */
export const themeMode = (name: string | null | undefined): PaletteMode | '' | undefined =>
  name === THEME_NAME ? '' : PALETTE_MODES.find((mode) => MODE_THEMES[mode] === name);

/** Whether Home Assistant's theme is one of fluvy's: Fluvy, Fluvy Light or Fluvy Dark. */
export const isFluvyTheme = (name: string | null | undefined): boolean =>
  themeMode(name) !== undefined;

/**
 * The theme's sentinel: written by every fluvy theme, so it exists exactly where one is applied. The
 * cards read it to fall back to their own tokens, the shell to switch itself on and off.
 */
export const THEME_SENTINEL = cssVar('theme');

/**
 * Which palette a look wears, written with its colours (`--fluvy-palette: linen`, or a custom palette's key): a
 * card reads it to derive its own colour's family from the very palette it sits on.
 */
export const PALETTE_TOKEN = cssVar('palette');

/**
 * Which mode the look is in under an element Home Assistant themed with a theme of fluvy's (`--fluvy-mode: dark` in a
 * view in Fluvy Dark, on a light page too): a card reads it to draw in that mode.
 */
export const MODE_TOKEN = cssVar('mode');
