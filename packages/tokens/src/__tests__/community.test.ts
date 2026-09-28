import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { derivePalette } from '../build/derive.js';
import { buildReports } from '../emit/contrast.js';
import { COMMUNITY_PALETTES } from '../palettes/community/index.js';
import { paletteFileName, parsePaletteFile } from '../palettes/file.js';
import { seedOf } from '../runtime.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'palettes', 'community');
const files = readdirSync(DIR)
  .filter((file) => file.endsWith('.fluvy-palette.json'))
  .sort();

describe('the community palettes', () => {
  it('are the files beside the index, each named after itself, each parsed as it is', () => {
    expect(files.map((file) => file)).toEqual(COMMUNITY_PALETTES.map(paletteFileName));
    for (const file of files) {
      const parsed = parsePaletteFile(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
      expect(parsed, file).toBeDefined();
      expect(COMMUNITY_PALETTES.find((entry) => entry.name === parsed!.name)).toEqual(parsed);
    }
    expect(new Set(COMMUNITY_PALETTES.map((entry) => entry.name)).size).toBe(
      COMMUNITY_PALETTES.length,
    );
  });

  it('pass the palette gates in both modes (a vivid accent’s chroma is its author’s)', () => {
    for (const entry of COMMUNITY_PALETTES) {
      const palette = derivePalette(seedOf(entry.palette));
      for (const report of buildReports([palette])) {
        const failed = [...report.contrast, ...report.structural].filter(
          (gate) => !gate.pass && !/accent-chroma/.test(gate.id),
        );
        expect(
          failed.map((gate) => gate.id),
          `${entry.name} ${report.mode}`,
        ).toEqual([]);
      }
    }
  });
});
