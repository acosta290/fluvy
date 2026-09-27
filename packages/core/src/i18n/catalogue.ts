import en from './locales/en.json';

/**
 * The shape of a catalogue, taken from English (the source every other language mirrors key for key): one table
 * per namespace — the shared words (`common`, `climate`, `editor`, …), one per card or page (`cover`, `panel`,
 * `history`, …) — and `words`, the naming stems the automatic dashboard reads a house by.
 */
export type Catalogue = typeof en;

export type Namespace = Exclude<keyof Catalogue, 'words'>;

/** The keys of one namespace (`'favourites' | 'class.awning' | …` for `cover`). */
export type KeyOf<N extends Namespace> = N extends unknown ? keyof Catalogue[N] & string : never;

/** A key with its namespace (`'climate.mode.heat'`, `'editor.title'`): what `localize()` and a card's `t()` take. */
export type MessageKey = { [N in Namespace]: `${N}.${KeyOf<N>}` }[Namespace];

export type Values = Readonly<Record<string, string | number>>;

/** A category of naming stems (`light`, `outdoor`, `solar`, …). */
export type WordCategory = keyof Catalogue['words'];

export const NAMESPACES = Object.keys(en).filter(
  (name) => name !== 'words',
) as readonly Namespace[];

/** English: inline, the fallback of every lookup. */
export const english: Catalogue = en;
