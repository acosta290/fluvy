/**
 * The tones: the roles a part of a card is drawn in, each a set of four palette colours — the ink (a line, a glyph,
 * a value), the fill of an "on" surface, that fill's hairline, and the ink on that fill. One table for the whole
 * language: `styles/fluvy/tones.css` is generated from it (one rule per tone naming every carrier), and the editors
 * offer `TONES` by their words in the catalogue (`tone.<name>`).
 */
export type Tone =
  | 'accent'
  | 'light'
  | 'heat'
  | 'cool'
  | 'dry'
  | 'fan'
  | 'water'
  | 'solar'
  | 'grid'
  | 'media'
  | 'presence'
  | 'armed'
  | 'battery'
  | 'house'
  | 'gas'
  | 'vehicle'
  | 'neutral'
  | 'off'
  | 'warning';

/** The four colours a tone carries, as token names without the `--fluvy-` prefix. */
export interface ToneVars {
  readonly ink: string;
  readonly fill: string;
  readonly border: string;
  readonly on: string;
}

const state = (key: string): ToneVars => ({
  ink: `state-${key}`,
  fill: `state-${key}-fill`,
  border: `state-${key}-fill-border`,
  on: `state-${key}-on-fill`,
});

export const TONE_VARS: Readonly<Record<Tone, ToneVars>> = {
  accent: {
    ink: 'accent',
    fill: 'accent-fill',
    border: 'accent-fill-border',
    on: 'accent-on-fill',
  },
  light: state('light-active'),
  heat: state('climate-heat'),
  cool: state('climate-cool'),
  dry: state('climate-dry'),
  fan: state('climate-fan'),
  water: state('energy-water'),
  solar: state('energy-solar'),
  grid: state('energy-grid'),
  media: state('media-playing'),
  presence: state('presence-home'),
  armed: state('security-armed'),
  battery: state('energy-battery'),
  house: state('energy-home'),
  gas: state('energy-gas'),
  // a car as a source (V2H): its own colour among the energy lanes, the water's teal (the two never share a diagram)
  vehicle: state('energy-water'),
  neutral: { ink: 'text-secondary', fill: 'page', border: 'border', on: 'text-secondary' },
  // an unreachable device: the disabled ink on nothing, in a dashed hairline
  off: { ink: 'unavailable', fill: 'transparent', border: 'unavailable-border', on: 'unavailable' },
  warning: {
    ink: 'warning',
    fill: 'warning-fill',
    border: 'warning-fill-border',
    on: 'warning-on-fill',
  },
};

/** The tones a card or an item may be given (`off` is a skin the state decides, never a choice), each with its word in the catalogue. */
export const TONES = [
  'accent',
  'light',
  'heat',
  'cool',
  'dry',
  'fan',
  'water',
  'solar',
  'grid',
  'media',
  'presence',
  'armed',
  'battery',
  'house',
  'gas',
  'vehicle',
  'neutral',
  'warning',
] as const satisfies readonly Tone[];
export type ChoosableTone = (typeof TONES)[number];

export const ALL_TONES: readonly Tone[] = [...TONES, 'off'];

/** A token name as a reference: `transparent` stays a keyword. */
const ref = (name: string): string => (name === 'transparent' ? name : `var(--fluvy-${name})`);

/**
 * The carriers of a tone: the classes that take its four variables. `.fv-tone--X` is the plain carrier (a chart's
 * wrapper, a calendar block); the rest are the parts whose own class already names the tone.
 */
export const TONE_CARRIERS = [
  '.fv-tone--{t}',
  '.fv-ico--{t}',
  '.fv-badge--{t}',
  '.fv-option.is-active.fv-option--{t}',
  '.fv-tile--{t}.is-on',
  '.fv-ruler--{t}',
  '.fv-dial--{t}',
  '.fv-knob--{t}',
  '.fv-switch--{t}',
] as const;

/** `styles/fluvy/tones.css`: one rule per tone naming every carrier, and its bar. Written by `build:styles`. */
export function renderTonesCss(): string {
  const lines: string[] = [
    '/* Generated from packages/ui/src/tones.ts by scripts/build-styles.ts — do not edit. */',
    '/* Every tone: its ink, fill, fill hairline and on-fill ink, on every carrier of a tone; and its bar. */',
    '',
  ];
  for (const tone of ALL_TONES) {
    const vars = TONE_VARS[tone];
    lines.push(
      `${TONE_CARRIERS.map((carrier) => carrier.replace('{t}', tone)).join(',\n')} {`,
      `  --tone-ink: ${ref(vars.ink)};`,
      `  --tone-fill: ${ref(vars.fill)};`,
      `  --tone-border: ${ref(vars.border)};`,
      `  --tone-on: ${ref(vars.on)};`,
      '}',
      // a neutral bar is a hairline's grey, not the secondary text's; an off bar draws nothing
      `.fv-bar--${tone} {`,
      `  background: ${tone === 'neutral' ? ref('border-strong') : tone === 'off' ? 'transparent' : ref(vars.ink)};`,
      '}',
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
