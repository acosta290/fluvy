/**
 * What the weather card, the clock's sky and the hello card read from a `weather` entity the same way: the fifteen
 * conditions, their one glyph each (never a sun at night), their words and the compass's, and whether it is night.
 */
import type { HomeAssistant } from '@fluvy/core';
import type { GlyphName } from '@fluvy/ui';

/** Home Assistant's closed set of weather conditions. */
export const CONDITIONS = [
  'sunny',
  'clear-night',
  'partlycloudy',
  'cloudy',
  'rainy',
  'pouring',
  'snowy',
  'snowy-rainy',
  'hail',
  'fog',
  'lightning',
  'lightning-rainy',
  'windy',
  'windy-variant',
  'exceptional',
] as const;

export type Condition = (typeof CONDITIONS)[number];

export const isCondition = (state: string): state is Condition =>
  (CONDITIONS as readonly string[]).includes(state);

/** One condition, one glyph across the library (the day face). */
const GLYPHS: Readonly<Record<Condition, GlyphName>> = {
  sunny: 'sun',
  'clear-night': 'moon',
  partlycloudy: 'cloudSun',
  cloudy: 'cloud',
  rainy: 'rain',
  pouring: 'rain',
  snowy: 'snowCloud',
  'snowy-rainy': 'sleet',
  hail: 'sleet',
  fog: 'fog',
  lightning: 'storm',
  'lightning-rainy': 'storm',
  windy: 'wind',
  'windy-variant': 'wind',
  exceptional: 'warn',
};

/** Never a sun at night. */
const NIGHT_GLYPHS: Readonly<Partial<Record<Condition, GlyphName>>> = {
  sunny: 'moon',
  partlycloudy: 'cloudMoon',
};

/** A condition's glyph, its night face after dark; `fallback` for a state outside the fifteen. */
export function conditionGlyph(
  state: string,
  night: boolean,
  fallback: GlyphName = 'cloud',
): GlyphName {
  if (!isCondition(state)) return fallback;
  return (night ? NIGHT_GLYPHS[state] : undefined) ?? GLYPHS[state];
}

/** The eight compass points, as string keys. */
export const COMPASS = [
  'dir.n',
  'dir.ne',
  'dir.e',
  'dir.se',
  'dir.s',
  'dir.sw',
  'dir.w',
  'dir.nw',
] as const;

export type CompassKey = (typeof COMPASS)[number];

/** A wind bearing in degrees as its nearest compass point. */
export const compassKey = (bearing: number): CompassKey =>
  COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8] ?? 'dir.n';

/** The sun decides day and night for the whole instance; without it, only a clear night says so. */
export function isNight(hass: HomeAssistant | undefined, condition = ''): boolean {
  const sun = hass?.states['sun.sun']?.state;
  if (sun === 'below_horizon') return true;
  if (sun === 'above_horizon') return false;
  return condition === 'clear-night';
}

/**
 * The conditions' and the compass's words in the languages fluvy ships (the design's copy: "Clear" and "Showers",
 * not Home Assistant's "Clear, night" and "Rainy"; W is O in Spanish). A card spreads them into its own table.
 */
export const WEATHER_WORDS = {
  en: {
    sunny: 'Sunny',
    'clear-night': 'Clear',
    partlycloudy: 'Partly cloudy',
    cloudy: 'Cloudy',
    rainy: 'Showers',
    pouring: 'Heavy rain',
    snowy: 'Snow',
    'snowy-rainy': 'Sleet',
    hail: 'Hail',
    fog: 'Fog',
    lightning: 'Thunderstorm',
    'lightning-rainy': 'Thunderstorm',
    windy: 'Windy',
    'windy-variant': 'Windy',
    exceptional: 'Exceptional',
    'dir.n': 'N',
    'dir.ne': 'NE',
    'dir.e': 'E',
    'dir.se': 'SE',
    'dir.s': 'S',
    'dir.sw': 'SW',
    'dir.w': 'W',
    'dir.nw': 'NW',
  },
  es: {
    sunny: 'Soleado',
    'clear-night': 'Despejado',
    partlycloudy: 'Nubes y claros',
    cloudy: 'Nublado',
    rainy: 'Chubascos',
    pouring: 'Lluvia fuerte',
    snowy: 'Nieve',
    'snowy-rainy': 'Aguanieve',
    hail: 'Granizo',
    fog: 'Niebla',
    lightning: 'Tormenta',
    'lightning-rainy': 'Tormenta',
    windy: 'Viento',
    'windy-variant': 'Viento',
    exceptional: 'Excepcional',
    'dir.n': 'N',
    'dir.ne': 'NE',
    'dir.e': 'E',
    'dir.se': 'SE',
    'dir.s': 'S',
    'dir.sw': 'SO',
    'dir.w': 'O',
    'dir.nw': 'NO',
  },
} as const satisfies Record<'en' | 'es', Record<Condition | CompassKey, string>>;
