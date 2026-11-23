/**
 * Colours worn as they are named (1.25, #250) are a chunk of their own: Home Assistant's own value for each of its
 * colour names and the family a colour wears exactly are fetched by the first card that asks (or the house), and with
 * the light card's colours, whose bulbs glow those values; what every page loads keeps only the flag and the fetch —
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

describe('the exact colours’ chunk', () => {
  it('holds Home Assistant’s own colours and the family a colour wears exactly', () => {
    expect(chunkOf(at('tokens/src/ha/standard.ts'))).toBe('exact');
    expect(chunkOf(at('tokens/src/build/exact.ts'))).toBe('exact');
  });

  it('leaves the palette’s own colours, the cards and the light card’s colours where they were', () => {
    expect(chunkOf(at('tokens/src/ha/named.ts'))).toBe('core');
    expect(chunkOf(at('tokens/src/build/accent-family.ts'))).toBe('core');
    expect(chunkOf(at('core/src/look/accent.ts'))).toBe('core');
    expect(chunkOf(at('core/src/card.ts'))).toBe('core');
    expect(chunkOf(at('cards/src/light/colour.ts'))).toBe('light-colour');
  });

  it('is reached from what every page loads by a dynamic import alone', () => {
    expect(readFileSync(at('core/src/card.ts'), 'utf8')).toContain("import('@fluvy/tokens/exact')");
    for (const path of ['core/src/card.ts', 'core/src/look/accent.ts'])
      expect(
        statics(path).filter((from) => /tokens\/(exact|standard)$/.test(from)),
        path,
      ).toEqual([]);
  });
});
