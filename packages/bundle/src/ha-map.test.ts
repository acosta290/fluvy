/**
 * Home Assistant's own map on a plate of ours (1.26, #266) is a chunk of its own: what makes it through Home
 * Assistant's card helpers, fits it again as its plate's size settles and tells it the house and the page's mode is
 * fetched by the first Map card drawn as a map and the first Vehicle card asked for one — and each reaches it by a
 * dynamic import alone, or the bundler would fold it back into the chunk that asks (the Map card's is core, which
 * every page loads).
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

const ASKING = ['cards/src/map/map-card.ts', 'cards/src/vehicle/vehicle-card.ts'];

describe('the map’s chunk', () => {
  it('holds what makes Home Assistant’s map on a plate, and nothing of the cards that ask for it', () => {
    expect(chunkOf(at('cards/src/shared/ha-map.ts'))).toBe('ha-map');
    expect(chunkOf(at('cards/src/map/map-card.ts'))).toBe('core');
    expect(chunkOf(at('cards/src/vehicle/vehicle-card.ts'))).toBe('vehicle');
    // it draws nothing of its own: no module of ours travels with it
    expect(statics('cards/src/shared/ha-map.ts')).toEqual([]);
  });

  it('is reached by a dynamic import alone', () => {
    for (const path of ASKING) {
      expect(readFileSync(at(path), 'utf8'), path).toContain("import('../shared/ha-map.js')");
      expect(
        statics(path).filter((from) => /ha-map\.js$/.test(from)),
        path,
      ).toEqual([]);
    }
  });
});
