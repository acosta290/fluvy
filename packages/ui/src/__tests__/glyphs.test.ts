import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { glyphBody, isGlyph, type GlyphName } from '../glyphs.js';

const LAB = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'apps',
  'design-lab',
  'fluvy.js',
);

/** The design lab keeps its own copy of the glyph table (plain script, no modules). They must not drift. */
describe('glyph set', () => {
  it('contains every glyph of the design lab, path for path', async () => {
    const context: Record<string, unknown> = {
      document: {
        createElement: () => ({ style: {} }),
        body: { appendChild() {} },
        createRange: () => ({}),
      },
    };
    context['globalThis'] = context;
    vm.createContext(context);
    vm.runInContext(await readFile(LAB, 'utf8'), context);
    const lab = (context['FLUVY'] as { G: Record<string, string> }).G;
    for (const [name, svg] of Object.entries(lab)) {
      const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
      expect(isGlyph(name), `glyph "${name}" is missing`).toBe(true);
      expect(glyphBody(name as GlyphName).body, `glyph "${name}" differs from the design lab`).toBe(
        body,
      );
    }
  });
});
