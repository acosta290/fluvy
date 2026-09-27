/**
 * What the language tools share: the catalogues on disk, their flattening, the comparison of a language with
 * English (missing, extra, empty, placeholders, the naming words), and the languages the registry
 * names. Used by the check (`pnpm i18n`) and by the vitest suite in core, so both say the same.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const LOCALES = join(ROOT, 'packages', 'core', 'src', 'i18n', 'locales');
export const INTEGRATION = join(ROOT, 'custom_components', 'fluvy');
export const DOCS_TABLE = join(ROOT, 'docs', 'translating.md');

export type Table = Readonly<Record<string, string>>;
export type Words = Readonly<Record<string, readonly string[]>>;
export type Catalogue = Readonly<Record<string, Table | Words>>;

export interface Problem {
  readonly level: 'error' | 'warning';
  readonly language: string;
  readonly text: string;
}

export async function readCatalogue(code: string): Promise<Catalogue> {
  return JSON.parse(await readFile(join(LOCALES, `${code}.json`), 'utf8')) as Catalogue;
}

/** The languages that have a catalogue on disk. */
export async function catalogueCodes(): Promise<string[]> {
  return (await readdir(LOCALES))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -5))
    .sort();
}

export const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

const isWords = (namespace: string): boolean => namespace === 'words';

/**
 * A language against English: every key present (missing ones are warnings, or errors when `strict`), none that
 * English lacks, none empty, the same placeholders, every word category present.
 */
export function compare(
  language: string,
  catalogue: Catalogue,
  english: Catalogue,
  strict = false,
): Problem[] {
  const problems: Problem[] = [];
  const problem = (level: Problem['level'], text: string): void => {
    problems.push({ level, language, text });
  };
  for (const [namespace, table] of Object.entries(english)) {
    const own = catalogue[namespace];
    if (isWords(namespace)) {
      const categories = Object.keys(table);
      for (const category of categories) {
        const list = (own as Words | undefined)?.[category];
        if (!Array.isArray(list)) problem('error', `words.${category}: missing`);
        else if (list.some((w) => typeof w !== 'string' || w.trim() === ''))
          problem('error', `words.${category}: an empty stem`);
      }
      for (const category of Object.keys(own ?? {}))
        if (!categories.includes(category)) problem('error', `words.${category}: not in English`);
      continue;
    }
    if (!own) {
      problem(strict ? 'error' : 'warning', `${namespace}: the whole namespace is missing`);
      continue;
    }
    const keys = Object.keys(table);
    for (const key of keys) {
      const text = (own as Table)[key];
      if (text === undefined) {
        problem(strict ? 'error' : 'warning', `${namespace}.${key}: missing`);
        continue;
      }
      if (typeof text !== 'string' || text.trim() === '')
        problem('error', `${namespace}.${key}: empty`);
      else {
        const expected = placeholders((table as Table)[key] ?? '');
        const found = placeholders(text);
        if (expected.join(',') !== found.join(','))
          problem(
            'error',
            `${namespace}.${key}: placeholders {${found.join(', ')}} ≠ English {${expected.join(', ')}}`,
          );
      }
    }
    for (const key of Object.keys(own))
      if (!(key in table)) problem('error', `${namespace}.${key}: not in English`);
    const order = keys.filter((k) => k in own);
    const ownOrder = Object.keys(own).filter((k) => k in table);
    if (order.join('\n') !== ownOrder.join('\n'))
      problem('warning', `${namespace}: keys are not in English's order`);
  }
  for (const namespace of Object.keys(catalogue))
    if (!(namespace in english)) problem('error', `${namespace}: a namespace English lacks`);
  return problems;
}

/** Flattens `strings.json`-shaped translation files to dotted keys. */
export function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object')
    return Object.assign(
      {},
      ...Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      ),
    ) as Record<string, string>;
  return {};
}

/** The integration's translation file for a language, against `strings.json`: the same keys and placeholders. */
export async function compareIntegration(language: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  const source = flatten(
    JSON.parse(await readFile(join(INTEGRATION, 'strings.json'), 'utf8')) as unknown,
  );
  const file = join(INTEGRATION, 'translations', `${language}.json`);
  let translated: Record<string, string>;
  try {
    translated = flatten(JSON.parse(await readFile(file, 'utf8')) as unknown);
  } catch {
    problems.push({ level: 'error', language, text: `translations/${language}.json: missing` });
    return problems;
  }
  for (const [key, text] of Object.entries(source)) {
    const own = translated[key];
    if (own === undefined)
      problems.push({
        level: 'error',
        language,
        text: `translations/${language}.json: ${key} missing`,
      });
    else if (placeholders(own).join(',') !== placeholders(text).join(','))
      problems.push({
        level: 'error',
        language,
        text: `translations/${language}.json: ${key} placeholders differ from strings.json`,
      });
  }
  for (const key of Object.keys(translated))
    if (!(key in source))
      problems.push({
        level: 'error',
        language,
        text: `translations/${language}.json: ${key} is not in strings.json`,
      });
  return problems;
}
