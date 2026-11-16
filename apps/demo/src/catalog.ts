import { drawn, GALLERY, shortName, type Drawn } from '../../../tools/docs/src/gallery.js';

/**
 * The cards the demo has a page for: the documentation's gallery (`tools/docs/src/gallery.ts`), one example of every
 * card and of each of its layouts, the same examples the docs draw and print. A card's page is named by its short name
 * (`?card=tile`), a layout by its value (`&layout=compact`), and the YAML a page shows is the docs' own (`card-yaml.ts`)
 * of the example drawn, so the page and the docs never say different things.
 */
export interface DemoCard {
  readonly tag: string;
  /** Its tag without `fluvy-` and `-card`: its page's name, its docs page's and its frames'. */
  readonly short: string;
  /** Its base example first, then each other layout. */
  readonly examples: readonly Drawn[];
}

export const CARDS: readonly DemoCard[] = Object.entries(GALLERY).map(([tag, example]) => ({
  tag,
  short: shortName(tag),
  examples: drawn(tag, example),
}));

const BY_SHORT = new Map(CARDS.map((card) => [card.short, card]));

/** The card of a short name; none where there is no such card. */
export const cardOf = (short: string): DemoCard | undefined => BY_SHORT.get(short);

const BY_TYPE = new Map(CARDS.map((card) => [`custom:${card.tag}`, card]));

/** The card a configuration's `type` names (`custom:fluvy-tile-card`); none where it is none of the catalogue's. */
export const cardOfType = (type: string): DemoCard | undefined => BY_TYPE.get(type);

/** The values of a card's other layouts, in the gallery's order. */
export const layoutsOf = (card: DemoCard): readonly string[] =>
  card.examples.flatMap((example) => (example.layout ? [example.layout] : []));

/** The key a card's layouts are chosen by (`variant`, a tile's `size`…), as its YAML writes it. */
export const layoutKeyOf = (card: DemoCard): string => GALLERY[card.tag]?.layout ?? 'variant';

const DOCS = 'https://github.com/acosta290/fluvy/blob/main/docs/cards';

/** A card's page in the documentation. */
export const docsOf = (card: DemoCard): string => `${DOCS}/${card.short}.md`;

/** What Home Assistant's card picker calls a card and says of it. */
export interface CardWords {
  readonly name: string;
  readonly description: string;
}

/** The picker's "Fluvy ·" before every name, which a page about Fluvy's cards leaves out. */
const PREFIX = /^Fluvy\s*·\s*/;

/**
 * A card's name and line as the card picker lists it (`window.customCards`, in the page's language where the catalogue
 * speaks it); its short name where the catalogue has no entry for it.
 */
export function wordsOf(card: DemoCard): CardWords {
  const entry = window.customCards?.find((candidate) => candidate.type === card.tag);
  const name = entry?.name.replace(PREFIX, '') || card.short;
  return { name, description: entry?.description ?? '' };
}

/** Letters as typed for matching: no case, no diacritics ("energia" finds "Energía"). */
const plain = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/**
 * The cards a search finds, best first: every word typed must be in the card's name, its short name or its line; a
 * name that starts with the first word comes first, then one that holds it, then a line that does, each in the
 * gallery's order.
 */
export function searchCards(
  query: string,
  cards: readonly DemoCard[],
  words: (card: DemoCard) => CardWords,
): DemoCard[] {
  const terms = plain(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const [first = ''] = terms;
  return cards
    .map((card, index) => {
      const said = words(card);
      const name = plain(said.name);
      const all = `${name} ${plain(card.short)} ${plain(said.description)}`;
      if (!terms.every((term) => all.includes(term))) return undefined;
      const rank = name.startsWith(first) ? 0 : name.includes(first) ? 1 : 2;
      return { card, rank, index };
    })
    .filter((hit) => hit !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((hit) => hit.card);
}
