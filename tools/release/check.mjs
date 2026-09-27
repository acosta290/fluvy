#!/usr/bin/env node
/**
 * The release invariants, as a check that fails loudly:
 *
 *   node tools/release/check.mjs                 what `pnpm check` runs: the versions and the metadata agree
 *   node tools/release/check.mjs --release       before a release is built: the integration folder is complete too
 *   node tools/release/check.mjs --tag v1.2.0    in CI, on a tag: the tag names the same version
 *
 * - one version: the root package.json, every workspace package.json and custom_components/fluvy/manifest.json;
 * - one set of metadata (license, author, homepage, repository, bugs, engines) on every workspace package;
 * - with --release: the build the integration ships is present (frontend/manifest.json with its build stamp,
 *   fluvy.js, loader.js, the theme, the icons) and no compressed sidecar lies beside a script.
 */
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, workspaceManifests } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const release = args.includes('--release') || args.includes('--tag');
const tag = args[args.indexOf('--tag') + 1];
const problems = [];
const problem = (text) => problems.push(text);

const rootManifest = await readJson(join(root, 'package.json'));
const { version } = rootManifest;
const META = ['license', 'author', 'homepage', 'repository', 'bugs', 'engines'];

for (const file of await workspaceManifests(root)) {
  const manifest = await readJson(file);
  const name = relative(root, file);
  if (manifest.version !== version) problem(`${name}: version ${manifest.version} ≠ ${version}`);
  for (const key of META) {
    const expected =
      key === 'repository' && file !== join(root, 'package.json')
        ? { ...rootManifest.repository, directory: relative(root, dirname(file)) }
        : rootManifest[key];
    if (JSON.stringify(manifest[key]) !== JSON.stringify(expected))
      problem(`${name}: "${key}" differs from the root package.json`);
  }
}

const integration = join(root, 'custom_components', 'fluvy');
const haManifest = await readJson(join(integration, 'manifest.json'));
if (haManifest.version !== version)
  problem(`custom_components/fluvy/manifest.json: version ${haManifest.version} ≠ ${version}`);
if (args.includes('--tag') && tag !== `v${version}`) problem(`tag ${tag} ≠ v${version}`);

if (release) {
  const exists = async (path) =>
    stat(join(integration, path))
      .then(() => true)
      .catch(() => false);
  for (const path of [
    'frontend/fluvy.js',
    'frontend/loader.js',
    'frontend/manifest.json',
    'frontend/fonts/inter-variable.woff2',
    'themes/fluvy.yaml',
    'brand/icon.png',
    'brand/icon@2x.png',
  ])
    if (!(await exists(path)))
      problem(`custom_components/fluvy/${path} is missing (run pnpm build)`);
  if (await exists('frontend/manifest.json')) {
    const built = await readJson(join(integration, 'frontend', 'manifest.json'));
    if (built.version !== version)
      problem(`frontend/manifest.json: version ${built.version} ≠ ${version}`);
    if (!/^[0-9a-f]{8}$/.test(built.build ?? '')) problem('frontend/manifest.json: no build stamp');
  }
  const sidecars = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(gz|br)$/.test(entry.name)) sidecars.push(relative(root, path));
    }
  };
  await walk(integration);
  for (const file of sidecars)
    problem(`${file}: a compressed sidecar would be served in place of its script`);
}

if (problems.length > 0) {
  for (const text of problems) console.error(`✗ ${text}`);
  process.exit(1);
}
console.log(
  `✓ Fluvy ${version}: versions and metadata agree${release ? ', the integration folder is complete' : ''}`,
);
