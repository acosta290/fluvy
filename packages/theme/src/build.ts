import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PALETTE, derivePalettes } from '@fluvy/tokens';
import { emitThemeYaml } from './emit.js';
import { validateThemeYaml } from './validate.js';

// the theme lives inside the integration, which installs it: custom_components/fluvy/themes
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'custom_components',
  'fluvy',
  'themes',
);

// one theme, the default look: every other palette is applied live by the bundle
const palette = derivePalettes().find((entry) => entry.name === DEFAULT_PALETTE);
if (!palette) throw new Error(`the default palette "${DEFAULT_PALETTE}" is not registered`);
await rm(OUT, { recursive: true, force: true }); // the folder ships as is: nothing stale may stay in it
await mkdir(OUT, { recursive: true });
const yaml = emitThemeYaml(palette);
const problems = validateThemeYaml(yaml);
if (problems.length > 0) {
  for (const p of problems) console.error(`${p.path}: ${p.message}`);
  throw new Error(`fluvy.yaml failed validation (${problems.length} problems)`);
}
await writeFile(join(OUT, 'fluvy.yaml'), yaml, 'utf8');
console.log(`fluvy.yaml · ${yaml.split('\n').length} lines · valid`);
