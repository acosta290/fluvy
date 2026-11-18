/**
 * What `pnpm check` holds the gallery, the pictures, the editors' defaults, the docs' sentences and the guides to,
 * without a browser: every card has its example and every value of its layout select its line; an example is a
 * configuration its card's editor could have written (its newest names, no key it does not show, no default written
 * out, no test hook); every example, a card's base and each of its layouts, has its picture in light and in dark,
 * taken of that very example; every select and switch of a card's form says what the card does without it; every key
 * and field says what it does; and every guide written by hand is a card's, under its page's own headings. Each
 * returns what is wrong, a line a finding; nothing wrong is an empty list.
 */
import type { LovelaceCardConfig } from '@fluvy/core';
import type { CardDoc } from './cards.js';
import { GALLERY, layoutKey, mounted, type Example } from './gallery.js';
import { MEANINGS } from './meanings.js';
import { GUIDE_OF, GUIDES, type Guides } from './pages.js';
import {
  digest,
  FOLDER,
  MANIFEST,
  MODES,
  pictureName,
  pictureStem,
  thumbStem,
  type Manifest,
} from './pictures.js';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What stands between a list's items, with the keys it carries. */
const BETWEEN = new Set(['section', 'divider']);

/**
 * A configuration held to its card, the base's or what a layout adds to it: its keys the newest names, each one the
 * editor shows, none a hook of the tests', no default written out, and its lists' items the fields their editor shows.
 */
function checkConfig(card: CardDoc, config: LovelaceCardConfig, where: string): string[] {
  const found: string[] = [];
  // its keys: the newest names, each one the editor shows, none a hook of the tests'
  const read = card.normalise(config) as Readonly<Record<string, unknown>>;
  // a name read as another, but for one still a key of its own whose older values alone are moved
  const older = new Set(
    card.reads
      .map((name) => name.from)
      .filter((name) => !card.keys.some((key) => key.key === name)),
  );
  for (const key of Object.keys(config)) {
    if (key.startsWith('_')) found.push(`${where}: \`${key}\` is a test's hook, not a key`);
    else if (older.has(key) || !(key in read))
      found.push(`${where}: \`${key}\` is an older name: write the one it is read as`);
    // a list whose items carry an older name is said item by item below
    else if (
      !Array.isArray(config[key]) &&
      JSON.stringify(read[key]) !== JSON.stringify(config[key])
    )
      found.push(`${where}: \`${key}\` holds an older value: write the one it is read as`);
    else if (!card.known.has(key)) found.push(`${where}: \`${key}\` is no key of its editor`);
  }
  // no default written out: an example is what a person would have to write
  for (const key of card.keys)
    if ('default' in key && key.key in config && config[key.key] === key.default)
      found.push(
        `${where}: \`${key.key}: ${String(key.default)}\` is the card's default: leave it out`,
      );
  // its lists' items: an id, or a map of the fields the list's editor shows
  for (const list of card.lists) {
    const items = config[list.key];
    if (items === undefined) continue;
    if (!Array.isArray(items)) {
      found.push(`${where}: \`${list.key}\` is a list`);
      continue;
    }
    const fields = new Set(list.item.map((key) => key.key));
    items.forEach((item: unknown, index) => {
      if (typeof item === 'string') return;
      if (!isRecord(item)) {
        found.push(`${where}: ${list.key}[${index}] is neither an id nor a map`);
        return;
      }
      if (list.sections && BETWEEN.has(String(item['type']))) return;
      for (const key of Object.keys(item))
        if (!fields.has(key))
          found.push(`${where}: ${list.key}[${index}].${key} is no field of its items`);
    });
  }
  return found;
}

/** The gallery held to the cards: an example each, a line a layout, and each example a configuration of its card. */
export function checkGallery(
  cards: readonly CardDoc[],
  gallery: Readonly<Record<string, Example>> = GALLERY,
): string[] {
  const found: string[] = [];
  const tags = new Set(cards.map((card) => card.tag));
  for (const tag of Object.keys(gallery))
    if (!tags.has(tag)) found.push(`${tag}: an example for a card the catalogue does not have`);

  for (const card of cards) {
    const example = gallery[card.tag];
    if (!example) {
      found.push(`${card.tag}: no example in tools/docs/src/gallery.ts`);
      continue;
    }
    const { config } = example;
    if (config.type !== `custom:${card.tag}`)
      found.push(`${card.tag}: its example's type is ${String(config.type)}`);

    found.push(...checkConfig(card, config, card.tag));
    for (const [value, variant] of Object.entries(example.variants ?? {}))
      if (variant.config)
        found.push(
          ...checkConfig(card, { type: config.type, ...variant.config }, `${card.tag} · ${value}`),
        );

    // its layouts: the base in the card's own, a line for every other value of the select, and none for no value
    const variants = Object.keys(example.variants ?? {});
    const { layout } = card;
    if (!layout) {
      if (variants.length || example.layout || example.own)
        found.push(`${card.tag}: its example names layouts, and its editor has no layout select`);
      continue;
    }
    if (layoutKey(example) !== layout.key)
      found.push(
        `${card.tag}: its layouts are chosen by \`${layout.key}\`, its example says \`${layoutKey(example)}\``,
      );
    if (layout.key in config)
      found.push(
        `${card.tag}: its example names \`${layout.key}\`: the base is the card's own layout`,
      );
    const own = example.own ?? layout.default;
    if (!layout.values.includes(own))
      found.push(`${card.tag}: \`${own}\` is no value of its \`${layout.key}\``);
    for (const value of layout.values)
      if (value !== own && !variants.includes(value))
        found.push(`${card.tag}: no example for \`${layout.key}: ${value}\``);
    for (const value of variants)
      if (value === own || !layout.values.includes(value))
        found.push(
          `${card.tag}: an example for \`${layout.key}: ${value}\`, which is ${value === own ? 'the base' : 'no value of it'}`,
        );
  }
  return found;
}

/**
 * The pictures held to the gallery: each example's in light and in dark among `files` (the names in
 * `docs/images/cards/`, a thumbnail's with its folder), a card's base, its thumbnail and each of its other layouts,
 * each taken of the example as it stands (the manifest's digest), and no picture of no example.
 */
export function checkPictures(
  cards: readonly CardDoc[],
  files: readonly string[],
  manifest: Manifest,
): string[] {
  const found: string[] = [];
  const names = new Set<string>();
  const stems = new Set<string>();
  for (const card of cards)
    for (const one of card.drawn) {
      const stem = pictureStem(card.short, one.layout);
      const what = one.layout ? `${card.tag} · ${one.layout}` : card.tag;
      stems.add(stem);
      // the base is drawn once more as the card's thumbnail, of the same example by the same run
      for (const taken of one.layout ? [stem] : [stem, thumbStem(card.short)])
        for (const mode of MODES) {
          const name = pictureName(taken, mode);
          names.add(name);
          if (!files.includes(name)) found.push(`${FOLDER}/${name} is missing`);
        }
      const entry = manifest[stem];
      if (!entry) found.push(`${what}: its picture is not in ${FOLDER}/${MANIFEST}`);
      else if (entry.example !== digest(mounted(one)))
        found.push(`${what}: its picture is of another example than the gallery's`);
    }
  for (const name of files)
    if (name.endsWith('.webp') && !names.has(name))
      found.push(`${FOLDER}/${name} is the picture of no example`);
  for (const stem of Object.keys(manifest))
    if (!stems.has(stem)) found.push(`${FOLDER}/${MANIFEST}: \`${stem}\` is no example`);
  return found.length
    ? [...found, 'run `pnpm docs:images` (the playground running) for the pictures']
    : [];
}

/** Every select and switch of a card's form says what the card does without it, by a value or in words. */
export function checkDefaults(cards: readonly CardDoc[]): string[] {
  return cards.flatMap((card) =>
    card.keys
      .filter((key) => /^(choices?( or text)?|boolean)$/.test(key.type))
      .filter((key) => !key.required && !('default' in key) && !key.defaultWords)
      .map(
        (key) =>
          `${card.tag}: \`${key.key}\` declares no default: say it in the card's \`defaults\`, or in words in UNDECLARED (tools/docs/src/cards.ts)`,
      ),
  );
}

/**
 * Every key of a card, every list and every field of its items says what it does, in a sentence of `MEANINGS` or in
 * the editor's helper; and every sentence of `MEANINGS` is one some key reads.
 */
export function checkMeanings(
  cards: readonly CardDoc[],
  meanings: Readonly<Record<string, string>> = MEANINGS,
): string[] {
  const read = new Set<string>();
  const found: string[] = [];
  for (const card of cards)
    for (const [key, where] of [
      ...card.keys.map((key) => [key, key.key] as const),
      ...card.lists.map((list) => [list, `${list.key}[]`] as const),
      ...card.lists.flatMap((list) =>
        list.item.map((key) => [key, `${list.key}[].${key.key}`] as const),
      ),
    ]) {
      if (key.meaningOf) read.add(key.meaningOf);
      if (!key.meaning && !key.helper)
        found.push(
          `${card.tag}: \`${where}\` does not say what it does: write its sentence in MEANINGS (tools/docs/src/meanings.ts)`,
        );
    }
  for (const name of Object.keys(meanings))
    if (!read.has(name)) found.push(`MEANINGS: \`${name}\` is read by no key: take it away`);
  return found;
}

/** A guide's lines outside its fenced blocks: a YAML comment in one is no heading. */
function prose(guide: string): string[] {
  let fenced = false;
  return guide.split('\n').filter((line) => {
    const fence = /^\s*(?:```|~~~)/.test(line);
    if (fence) fenced = !fenced;
    return !fenced && !fence;
  });
}

/**
 * The guides written by hand held to the pages they are spliced into (`guides`: each by the name of its file in
 * `tools/docs/guides/`, without `.md`): each is a card's, says something, and heads its parts from `###` down, under
 * its page's own "Guide"; and a card whose guide is another's (`guideOf`) names a card.
 */
export function checkGuides(
  cards: readonly CardDoc[],
  guides: Guides,
  guideOf: typeof GUIDE_OF = GUIDE_OF,
): string[] {
  const shorts = new Set(cards.map((card) => card.short));
  return [
    ...Object.entries(guides).flatMap(([short, guide = '']) => {
      const file = `${GUIDES}/${short}.md`;
      if (!shorts.has(short)) return [`${file} is the guide of no card`];
      if (!guide.trim()) return [`${file} says nothing: write the guide, or take the file away`];
      return prose(guide)
        .filter((line) => /^#{1,2} /.test(line))
        .map((line) => `${file}: "${line}" heads a page: a guide's headings start at \`###\``);
    }),
    ...Object.entries(guideOf)
      .filter(([short, [other]]) => !shorts.has(short) || !shorts.has(other))
      .map(
        ([short, [other]]) =>
          `GUIDE_OF: \`${short}\` reads the guide of \`${other}\`, and one of them is no card`,
      ),
  ];
}
