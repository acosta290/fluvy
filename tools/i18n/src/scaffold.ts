/**
 * A new language's catalogue, key for key from English, every string left in English to be translated (the check
 * reports how many are still English); the naming words start empty and take the language's own stems.
 *
 *   pnpm i18n scaffold nl
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LOCALES, readCatalogue, type Table, type Words } from './lib.js';

const code = process.argv[2];
if (!code || !/^[a-z]{2}(-[A-Z]{2})?$/.test(code)) {
  console.error('usage: pnpm i18n scaffold <code>   (es, pt-BR)');
  process.exit(2);
}
const english = await readCatalogue('en');
const scaffold: Record<string, Table | Words> = {};
for (const [namespace, table] of Object.entries(english))
  scaffold[namespace] =
    namespace === 'words'
      ? Object.fromEntries(Object.keys(table).map((category) => [category, []]))
      : table;
const file = join(LOCALES, `${code}.json`);
await writeFile(file, `${JSON.stringify(scaffold, null, 2)}\n`);
console.log(
  `${file}: ${Object.keys(scaffold).length} namespaces, in English — translate it, then add the language to languages.ts`,
);
