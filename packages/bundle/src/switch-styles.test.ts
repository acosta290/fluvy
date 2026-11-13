/**
 * The switch styles (1.20, #177) are a chunk of their own: the wall rocker's drawing, its sheet and what a tile's
 * entity makes of it are fetched by the first tile asked for one, and what every page loads keeps only the tile's
 * hook — which reaches the chunk by a dynamic import alone, or the bundler would fold it back into core.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chunkOf } from '../groups.mjs';

const PACKAGES = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/');
const at = (path: string): string => join(PACKAGES, path).replace(/\\/g, '/');

describe('the switch styles’ chunk', () => {
  it('holds the rocker’s drawing, its sheet and the tile’s glue', () => {
    for (const path of [
      'cards/src/tile/rocker.ts',
      'ui/src/controls/switch-styles.ts',
      'ui/src/styles/switch-styles.ts',
      'ui/src/styles/generated/switch-styles.ts',
    ])
      expect(chunkOf(at(path)), path).toBe('switch-styles');
  });

  it('leaves the tile, its editor and the slider styles where they were', () => {
    expect(chunkOf(at('cards/src/tile/tile-card.ts'))).toBe('core');
    expect(chunkOf(at('cards/src/tile/tile-editor.ts'))).toBe('forms');
    expect(chunkOf(at('ui/src/controls/slider-styles.ts'))).toBe('slider-styles');
  });

  it('is reached from the tile by a dynamic import alone', () => {
    const tile = readFileSync(at('cards/src/tile/tile-card.ts'), 'utf8');
    expect(tile).toContain("import('./rocker.js')");
    // a static import of the chunk's modules (a type's aside, which the build erases) would bring them back
    const statics = [...tile.matchAll(/^import (?!type\b)[^;]*?from '([^']+)';/gms)].map(
      (m) => m[1],
    );
    expect(statics.filter((from) => /rocker|switch-styles/.test(from!))).toEqual([]);
  });
});
