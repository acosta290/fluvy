/**
 * A list in groups (1.21, #189) is a chunk of its own: what lays a Tiles or a Scenes card's list out in the house's
 * rooms and floors, reads its names short and draws the scenes as chips is fetched by the first card asked for
 * groups, and what every page loads keeps only what declares a grouped card's height — which reaches the chunk by a
 * dynamic import alone, or the bundler would fold it back into core.
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

describe('the groups’ chunk', () => {
  it('holds what lays a list out in groups, and nothing of the cards that ask for it', () => {
    expect(chunkOf(at('cards/src/shared/groups.ts'))).toBe('groups');
    for (const path of [
      'cards/src/shared/lists.ts',
      'cards/src/tiles/tiles-card.ts',
      'cards/src/scenes/scenes-card.ts',
      'cards/src/heading/heading-card.ts',
    ])
      expect(chunkOf(at(path)), path).toBe('core');
    expect(chunkOf(at('cards/src/tiles/tiles-editor.ts'))).toBe('forms');
    expect(chunkOf(at('cards/src/scenes/scenes-editor.ts'))).toBe('forms');
  });

  it('is reached from what every page loads by a dynamic import alone', () => {
    expect(readFileSync(at('cards/src/shared/lists.ts'), 'utf8')).toContain(
      "import('./groups.js')",
    );
    for (const path of [
      'cards/src/shared/lists.ts',
      'cards/src/tiles/tiles-card.ts',
      'cards/src/scenes/scenes-card.ts',
    ])
      expect(
        statics(path).filter((from) => /\/groups\.js$/.test(from)),
        path,
      ).toEqual([]);
  });

  it('comes with the heights the automatic dashboards count with the house', () => {
    expect(statics('cards/src/house-heights.ts')).toContain('./shared/groups.js');
    expect(chunkOf(at('cards/src/house-heights.ts'))).toBe('house-heights');
  });
});
