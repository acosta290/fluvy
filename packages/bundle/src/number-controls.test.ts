/**
 * The controls that set a number in place (1.23, #218) are a chunk of their own: a row's value between − and +, a
 * figure typed and their sheet are fetched by the first card that asks for one, and what every page loads keeps only
 * the number's model and its step — which reaches the chunk by a dynamic import alone, or the bundler would fold it
 * back into core.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chunkOf } from '../groups.mjs';

const PACKAGES = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/');
const at = (path: string): string => join(PACKAGES, path).replace(/\\/g, '/');

/** A module's static imports, a type's aside (the build erases those). */
const statics = (path: string): string[] =>
  [...readFileSync(at(path), 'utf8').matchAll(/^import (?!type\b)[^;]*?from '([^']+)';/gms)].map(
    (found) => found[1] as string,
  );

describe('the number controls’ chunk', () => {
  it('holds what sets a number in place, and nothing of the cards that ask for it', () => {
    expect(chunkOf(at('cards/src/shared/number-controls.ts'))).toBe('number-controls');
    for (const path of [
      'cards/src/shared/number.ts',
      'cards/src/entities/entities-card.ts',
      'cards/src/helpers/helpers-card.ts',
      'cards/src/helpers/number.ts',
    ])
      expect(chunkOf(at(path)), path).toBe('core');
  });

  it('is reached from what every page loads by a dynamic import alone', () => {
    expect(readFileSync(at('cards/src/shared/number.ts'), 'utf8')).toContain(
      "import('./number-controls.js')",
    );
    for (const path of [
      'cards/src/shared/number.ts',
      'cards/src/entities/entities-card.ts',
      'cards/src/helpers/helpers-card.ts',
      'cards/src/helpers/number.ts',
      'cards/src/helpers/context.ts',
    ])
      expect(
        statics(path).filter((from) => /number-controls\.js$/.test(from)),
        path,
      ).toEqual([]);
  });
});
