import { fromHex, isHex } from '../color/oklch.js';
import { buildRamp, peakChromaFrom } from '../color/ramp.js';
import type { Hex, PaletteModeColors, SemanticRole } from '../types.js';

/**
 * Home Assistant's named colours (`--amber-color`, `--blue-color` …; the 25 its `ui_color` selector offers less
 * `primary` and `accent`, which are the palette's own), each as the colour of ours it stands for. One table for
 * two readers: the theme writes the 21 Home Assistant declares (`ha/groups.ts`), and a card's `color` resolves a
 * name through it (`resolveAccent`), so a card asking for "teal" is the teal every Home Assistant surface shows.
 * Each name keeps the tone Home Assistant gives it: pink is the armed alarm's red-rose, cyan the water, teal the
 * presence green-blue, lime the dehumidifier's green, brown the gas — never a second accent.
 */
export const HA_COLOR_NAMES = [
  'red',
  'pink',
  'orange',
  'deep-orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'light-green',
  'teal',
  'cyan',
  'blue',
  'light-blue',
  'indigo',
  'purple',
  'deep-purple',
  'brown',
  'light-grey',
  'grey',
  'dark-grey',
  'blue-grey',
  'black',
  'white',
] as const;
export type HaColorName = (typeof HA_COLOR_NAMES)[number];

/** An 11-step ramp from the hue and chroma of one of our status inks (the accent ramp's recipe). */
export function statusRamp(
  colors: PaletteModeColors,
  role: SemanticRole,
): Readonly<Record<string, Hex>> {
  const ink = fromHex(colors.semantic[role].ink);
  return buildRamp({ hue: ink.h, peakChroma: peakChromaFrom(ink.l, ink.c) });
}

export const NAMED_COLORS: Readonly<Record<HaColorName, (colors: PaletteModeColors) => Hex>> = {
  red: (c) => statusRamp(c, 'danger')['50'] as Hex,
  pink: (c) => c.state['security-armed'].ink,
  orange: (c) => statusRamp(c, 'warning')['50'] as Hex,
  'deep-orange': (c) => c.state['climate-heat'].ink,
  amber: (c) => c.state['light-active'].ink,
  yellow: (c) => c.state['energy-solar'].ink,
  lime: (c) => c.state['climate-dry'].ink,
  green: (c) => statusRamp(c, 'success')['50'] as Hex,
  'light-green': (c) => c.state['energy-battery'].ink,
  teal: (c) => c.state['presence-home'].ink,
  cyan: (c) => c.state['energy-water'].ink,
  blue: (c) => c.state['climate-cool'].ink,
  'light-blue': (c) => c.semantic.info.ink,
  indigo: (c) => c.state['energy-grid'].ink,
  purple: (c) => c.state['media-playing'].ink,
  'deep-purple': (c) => c.state['energy-home'].ink,
  brown: (c) => c.state['energy-gas'].ink,
  'light-grey': (c) => c.neutralRamp['80'],
  grey: (c) => c.neutralRamp['60'],
  'dark-grey': (c) => c.neutralRamp['40'],
  'blue-grey': (c) => c.neutralRamp['50'],
  // the palette's own black and white: the ends of its neutral ramp, never #000 or #fff
  black: (c) => c.neutralRamp['05'],
  white: (c) => c.neutralRamp['95'],
};

/** The 21 names Home Assistant's theme declares (it has no `--black-color` or `--white-color` of a theme's). */
export const THEME_COLOR_NAMES: readonly HaColorName[] = HA_COLOR_NAMES.filter(
  (name) => name !== 'black' && name !== 'white',
);

export function isHaColorName(value: unknown): value is HaColorName {
  return typeof value === 'string' && (HA_COLOR_NAMES as readonly string[]).includes(value);
}

/**
 * A card's `color` as a colour: one of Home Assistant's names, `#rgb` or `#rrggbb` in any case, or an `[r, g, b]`
 * triplet — as `#rrggbb`. `primary`, `accent`, an empty value and anything else are nothing: the card keeps the
 * palette's accent.
 */
export function resolveAccent(choice: unknown, colors: PaletteModeColors): Hex | undefined {
  if (Array.isArray(choice) && choice.length === 3) {
    const parts = choice.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : NaN));
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return undefined;
    return `#${parts.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
  }
  if (typeof choice !== 'string') return undefined;
  const text = choice.trim().toLowerCase();
  if (isHaColorName(text)) return NAMED_COLORS[text](colors);
  if (/^#[0-9a-f]{3}$/.test(text))
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  return isHex(text) ? text : undefined;
}
