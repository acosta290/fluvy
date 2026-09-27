#!/usr/bin/env node
/**
 * Sets Fluvy's version everywhere it is written, in one go:
 *
 *   node tools/release/version.mjs 1.2.0
 *
 * - `version` in the root package.json (what the build stamps into the bundle and its manifest) and in every
 *   workspace package.json (they are private and move together);
 * - `version` in custom_components/fluvy/manifest.json (what Home Assistant and HACS read);
 * - CHANGELOG.md: the `## [Unreleased]` section becomes `## [x.y.z] — YYYY-MM-DD` and a new, empty Unreleased
 *   section opens above it.
 *
 * Nothing is committed or tagged here; the commands to do so are printed at the end.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceManifests } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: node tools/release/version.mjs <x.y.z>');
  process.exit(2);
}

const setVersion = async (file) => {
  const text = await readFile(file, 'utf8');
  const next = text.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`);
  if (next === text) throw new Error(`${relative(root, file)}: no "version" field`);
  await writeFile(file, next);
  console.log(`${relative(root, file)} → ${version}`);
};

for (const file of await workspaceManifests(root)) await setVersion(file);
await setVersion(join(root, 'custom_components', 'fluvy', 'manifest.json'));

const changelog = join(root, 'CHANGELOG.md');
const text = await readFile(changelog, 'utf8');
if (!text.includes('## [Unreleased]'))
  throw new Error('CHANGELOG.md: no "## [Unreleased]" section');
const date = new Date().toISOString().slice(0, 10);
await writeFile(
  changelog,
  text.replace('## [Unreleased]', `## [Unreleased]\n\n## [${version}] — ${date}`),
);
console.log(`CHANGELOG.md → [${version}] — ${date}`);

console.log(`
Review the changelog entry, then:
  git commit -s -am "Release ${version}" && git tag v${version} && git push --follow-tags`);
