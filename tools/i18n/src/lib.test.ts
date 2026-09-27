import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate, OUT } from './build.js';
import { catalogueCodes, compare, compareIntegration, readCatalogue, ROOT } from './lib.js';

describe('the catalogues on disk', () => {
  it('are the languages the registry names', async () => {
    const registry = await readFile(
      join(ROOT, 'packages', 'core', 'src', 'i18n', 'languages.ts'),
      'utf8',
    );
    const codes =
      /LANGUAGE_CODES = \[([^\]]+)\]/
        .exec(registry)?.[1]
        ?.match(/'([^']+)'/g)
        ?.map((s) => s.slice(1, -1)) ?? [];
    expect([...codes].sort()).toEqual(await catalogueCodes());
  });

  it('mirror English key for key, with the same placeholders and words', async () => {
    const english = await readCatalogue('en');
    for (const code of await catalogueCodes()) {
      if (code === 'en') continue;
      const errors = compare(code, await readCatalogue(code), english, true).filter(
        (p) => p.level === 'error',
      );
      expect(errors.map((p) => `${p.language} ${p.text}`)).toEqual([]);
    }
  });

  it('have their integration translation, key for key with strings.json', async () => {
    for (const code of await catalogueCodes())
      expect((await compareIntegration(code)).map((p) => p.text)).toEqual([]);
  });

  it('are what the strategy’s generated words were built from', async () => {
    expect(await readFile(OUT, 'utf8')).toBe(await generate());
  });
});
