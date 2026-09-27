#!/usr/bin/env node
/**
 * Puts a local build of the integration into a Home Assistant configuration folder — a Docker instance's bind
 * mount, a folder shared over Samba or SSHFS, anything this machine can write to:
 *
 *   pnpm build
 *   pnpm ha:install --config /path/to/homeassistant/config            # the whole integration
 *   pnpm ha:install --config /path/to/homeassistant/config --frontend-only
 *
 * The whole integration (Python + build + theme) needs a restart of Home Assistant; the first time, add the
 * integration afterwards (Settings → Devices & services → Add integration → Fluvy). `--frontend-only` copies
 * just the build and the theme for a quick look at a change: the running process serves the folder under the
 * URL of the build it started with, so reload with the browser's cache disabled — never in production.
 */
import { cp, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = join(root, 'custom_components', 'fluvy');
const args = process.argv.slice(2);
const config = args[args.indexOf('--config') + 1];
const frontendOnly = args.includes('--frontend-only');
if (!args.includes('--config') || !config) {
  console.error(
    'usage: node tools/dev/install.mjs --config <home assistant config folder> [--frontend-only]',
  );
  process.exit(2);
}

const exists = (path) =>
  stat(path)
    .then(() => true)
    .catch(() => false);
const configDir = resolve(config);
if (!(await exists(join(configDir, 'configuration.yaml'))))
  fail(`${configDir} has no configuration.yaml: is it a Home Assistant configuration folder?`);
if (
  !(await exists(join(source, 'frontend', 'manifest.json'))) ||
  !(await exists(join(source, 'themes', 'fluvy.yaml')))
)
  fail('there is no build to install: run `pnpm build` first');

const target = join(configDir, 'custom_components', 'fluvy');
if (await exists(target)) {
  const manifest = await readFile(join(target, 'manifest.json'), 'utf8').catch(() => '');
  if (!/"domain":\s*"fluvy"/.test(manifest))
    fail(`${target} exists and is not Fluvy: not touching it`);
}

const built = JSON.parse(await readFile(join(source, 'frontend', 'manifest.json'), 'utf8'));
const skip = (path) => !/(^|\/)__pycache__(\/|$)/.test(path);
if (frontendOnly) {
  for (const folder of ['frontend', 'themes']) {
    await rm(join(target, folder), { recursive: true, force: true });
    await cp(join(source, folder), join(target, folder), { recursive: true });
  }
  console.log(`Fluvy ${built.version} (build ${built.build}): the build and the theme are in ${target}.
No restart needed for the files themselves; reload the page with the browser's cache disabled.`);
} else {
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true, filter: skip });
  console.log(`Fluvy ${built.version} (build ${built.build}) is in ${target}.
Restart Home Assistant (Settings → System → Restart). The first time, add the integration afterwards:
Settings → Devices & services → Add integration → Fluvy. Then reload the browser twice (the service worker
serves the old page once).`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
