/**
 * What an energy device's mode (a `select` / `input_select` of a charger or a battery) does, read from the option's
 * own words — integrations name them freely ("off", "pv", "min_pv", "now", "Solar only", "Boost") — so a mode tile
 * can carry a glyph and say what it means. Only a plain case is named: `minpv` is neither the sun alone nor full
 * power, and a word that is not recognised is `other`, never a guess.
 */
export type ModeKind = 'off' | 'sun' | 'fast' | 'other';

const OFF = new Set(['off', 'stop', 'stopped', 'pause', 'paused', 'disabled', 'disable', 'none']);
const SUN = new Set(['pv', 'solar', 'sun', 'surplus', 'excess', 'photovoltaic']);
const FAST = new Set([
  'fast',
  'max',
  'maximum',
  'now',
  'boost',
  'force',
  'forced',
  'quick',
  'immediate',
  'immediately',
  'instant',
  'rapid',
]);
/** Words that make a mode a mix (a minimum from the grid topped up by the sun): never the sun alone. */
const MIXED = new Set(['min', 'minimum', 'minpv', 'grid']);

const words = (option: string): string[] =>
  option
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function modeKind(option: string): ModeKind {
  const tokens = words(option);
  if (tokens.length === 1 && OFF.has(tokens[0] as string)) return 'off';
  if (tokens.some((t) => MIXED.has(t))) return 'other';
  if (tokens.some((t) => SUN.has(t))) return 'sun';
  if (tokens.some((t) => FAST.has(t))) return 'fast';
  return 'other';
}

/** A mode's glyph; `other` takes the device's own (the car, the battery). */
export const MODE_GLYPH = { off: 'power', sun: 'sun', fast: 'bolt' } as const;

/** The options a select offers, as text (integrations send anything). */
export function selectOptions(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((option): option is string => typeof option === 'string' && option !== '')
    : [];
}
