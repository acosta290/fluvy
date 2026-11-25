/**
 * What the greeting draws beyond its words (1.26, #260: its date and its weather as buttons of their own, a line of
 * quick actions under it) is a chunk of its own: it is fetched by the first greeting whose config asks for any of it,
 * and what every page loads keeps only the greeting — which reaches the chunk by a dynamic import alone, or the bundler
 * would fold it back into core, and the rounds with it.
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

describe('what the greeting draws beyond its words', () => {
  it('is a chunk of its own, the greeting itself what every page loads', () => {
    expect(chunkOf(at('cards/src/hello/more.ts'))).toBe('hello-more');
    expect(chunkOf(at('cards/src/hello/hello-card.ts'))).toBe('core');
    expect(chunkOf(at('cards/src/hello/hello-editor.ts'))).toBe('forms');
  });

  it('is reached from the greeting by a dynamic import alone; its rounds are the quick actions’', () => {
    expect(readFileSync(at('cards/src/hello/hello-card.ts'), 'utf8')).toContain(
      "import('./more.js')",
    );
    expect(
      statics('cards/src/hello/hello-card.ts').filter((from) =>
        /\/more\.js$|\/rounds\.js$/.test(from),
      ),
    ).toEqual([]);
    expect(statics('cards/src/hello/more.ts')).toContain('../shared/rounds.js');
    expect(chunkOf(at('cards/src/shared/rounds.ts'))).toBe('quick-actions');
  });
});
