#!/usr/bin/env node
/**
 * Dumps the fluvy glyph table (24 grid, stroke bodies) as JSON for the outliner:
 *   npx tsx tools/icons/extract-glyphs.mjs > glyphs.json   (then tools/icons/outline.py glyphs.json packages/core/src/icons/generated.ts)
 */
import { glyphBody, glyphNames } from '../../packages/ui/src/glyphs.ts';
const out = {};
for (const name of glyphNames) out[name] = glyphBody(name);
process.stdout.write(JSON.stringify(out, null, 1));
