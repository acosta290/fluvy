#!/usr/bin/env node
/**
 * Refreshes `src/__tests__/ha-vars.json`: every custom property name that appears in Home Assistant's
 * frontend source. The theme test checks that each Home Assistant name the theme writes is one HA
 * actually has (a renamed or retired variable fails the build instead of silently doing nothing).
 *   git clone --depth 1 https://github.com/home-assistant/frontend /tmp/ha-frontend
 *   node scripts/ha-vars.mjs /tmp/ha-frontend
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

if (!process.argv[2]) {
  console.error('usage: node scripts/ha-vars.mjs <path to a clone of home-assistant/frontend>');
  process.exit(2);
}
const root = resolve(process.argv[2]);
const names = new Set();
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith('.ts'))
      for (const match of (await readFile(path, 'utf8')).matchAll(/--[a-z0-9][a-z0-9_-]*/g))
        names.add(match[0]);
  }
}
await walk(join(root, 'src'));
// the frontend's release (pyproject), e.g. 20260826.7; its package.json says 1.0.0
const version =
  (await readFile(join(root, 'pyproject.toml'), 'utf8')).match(/^version\s*=\s*"([^"]+)"/m)?.[1] ??
  'unknown';
const out = resolve(import.meta.dirname, '../src/__tests__/ha-vars.json');
await writeFile(
  out,
  `${JSON.stringify({ frontend: version, names: [...names].sort() }, null, 0).replace(/","/g, '",\n"')}\n`,
);
console.log(`${names.size} names from frontend ${version} → ${out}`);
