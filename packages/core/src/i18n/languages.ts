/**
 * The languages Fluvy speaks: one entry per catalogue in `./locales/`, with what the panel shows for it and the
 * cultural data its words need (the greeting's hours). Everything that lists, offers or resolves a language reads
 * this table; adding a language is one entry here, one catalogue, one integration translation file.
 */

export const LANGUAGE_CODES = ['en', 'es', 'de', 'nl', 'fr', 'it', 'pt-BR'] as const;

/** A code as Home Assistant reports `hass.language` for it (`pt-BR`, not `pt_BR`). */
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** A person's choice in Fluvy's settings: Home Assistant's language, or one of ours. */
export type CardLanguage = 'auto' | LanguageCode;

/** When the day's parts begin, in hours: the greeting's bands (`evening` absent: the afternoon runs into the night). */
export interface DayParts {
  readonly morning: number;
  readonly afternoon: number;
  readonly evening?: number;
  readonly night: number;
}

export interface LanguageInfo {
  readonly code: LanguageCode;
  /** The language's own name: what the select shows. */
  readonly name: string;
  /** Its English name: the select's hint, and what the docs say. */
  readonly english: string;
  readonly dayParts: DayParts;
}

export const LANGUAGES: Readonly<Record<LanguageCode, LanguageInfo>> = {
  en: {
    code: 'en',
    name: 'English',
    english: 'English',
    // English greets the evening until 22:00 and only then says "night" (a farewell before that)
    dayParts: { morning: 5, afternoon: 12, evening: 18, night: 22 },
  },
  es: {
    code: 'es',
    name: 'Español',
    english: 'Spanish',
    // no evening: "buenas tardes" runs from lunch to about 20:00, "buenas noches" greets from then on
    dayParts: { morning: 5, afternoon: 13, night: 20 },
  },
  de: {
    code: 'de',
    name: 'Deutsch',
    english: 'German',
    dayParts: { morning: 5, afternoon: 11, evening: 18, night: 23 },
  },
  nl: {
    code: 'nl',
    name: 'Nederlands',
    english: 'Dutch',
    dayParts: { morning: 5, afternoon: 12, evening: 18, night: 24 },
  },
  fr: {
    code: 'fr',
    name: 'Français',
    english: 'French',
    // "bonjour" all day, "bonsoir" from 18:00: the afternoon says the morning's word
    dayParts: { morning: 5, afternoon: 12, evening: 18, night: 24 },
  },
  it: {
    code: 'it',
    name: 'Italiano',
    english: 'Italian',
    dayParts: { morning: 5, afternoon: 13, evening: 18, night: 23 },
  },
  'pt-BR': {
    code: 'pt-BR',
    name: 'Português',
    english: 'Portuguese (Brazil)',
    dayParts: { morning: 5, afternoon: 12, evening: 19, night: 24 },
  },
};

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);

export const isCardLanguage = (value: unknown): value is CardLanguage =>
  value === 'auto' || isLanguageCode(value);

/** The languages a person may choose, English first and the rest by their own names. */
export const offeredLanguages = (): readonly LanguageInfo[] => [
  LANGUAGES.en,
  ...LANGUAGE_CODES.filter((code) => code !== 'en')
    .map((code) => LANGUAGES[code])
    .sort((a, b) => a.name.localeCompare(b.name)),
];

/**
 * The language Fluvy speaks for a tag Home Assistant reports: the tag itself, else its base (`es-ES` → `es`), else the
 * variant shipped for that base (`pt` → `pt-BR`), else English.
 */
export function resolveLanguage(tag: string | undefined): LanguageCode {
  if (!tag) return 'en';
  if (isLanguageCode(tag)) return tag;
  const base = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
  if (isLanguageCode(base)) return base;
  const shipped = LANGUAGE_CODES.find((code) => code.split('-')[0] === base);
  return shipped ?? 'en';
}

/** Fluvy has words in this language (any variant of it): its own copy is used rather than Home Assistant's translation. */
export function speaks(tag: string | undefined): boolean {
  if (!tag) return false;
  const base = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
  return LANGUAGE_CODES.some((code) => code.split('-')[0] === base);
}
