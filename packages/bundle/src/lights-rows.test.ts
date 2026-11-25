/**
 * What 1.26 gave the Room lights card (#261: its lights as a list's rows, what ends its head as it says) is a chunk of
 * its own: it is fetched by the first card that asks for either, and what every page loads keeps only the card —
 * which reaches the chunk by a dynamic import alone, or the bundler would fold it back into core.
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

describe('the Room lights card’s rows', () => {
  it('are a chunk of their own, the card itself what every page loads', () => {
    expect(chunkOf(at('cards/src/lights/rows.ts'))).toBe('lights-rows');
    expect(chunkOf(at('cards/src/lights/lights-card.ts'))).toBe('core');
    expect(chunkOf(at('cards/src/lights/lights-editor.ts'))).toBe('forms');
  });

  it('are reached from the card by a dynamic import alone, and bring nothing but what core has', () => {
    expect(readFileSync(at('cards/src/lights/lights-card.ts'), 'utf8')).toContain(
      "import('./rows.js')",
    );
    expect(
      statics('cards/src/lights/lights-card.ts').filter((from) => /\/rows\.js$/.test(from)),
    ).toEqual([]);
    // what the rows are drawn with is core's: the chunk is their drawing and the head's ending alone
    for (const from of statics('cards/src/lights/rows.ts'))
      expect(
        from.startsWith('.')
          ? chunkOf(at(join('cards/src/lights', from).replace(/\.js$/, '.ts')))
          : 'core',
        from,
      ).toBe('core');
  });
});
