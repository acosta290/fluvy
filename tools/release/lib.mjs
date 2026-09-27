import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Every package.json the workspace declares (root first), from pnpm-workspace.yaml's globs. */
export async function workspaceManifests(root) {
  const workspace = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [...workspace.matchAll(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1]);
  const files = [join(root, 'package.json')];
  for (const glob of globs) {
    if (!glob.endsWith('/*')) continue;
    const dir = join(root, glob.slice(0, -2));
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue;
      const file = join(dir, entry.name, 'package.json');
      await readFile(file)
        .then(() => files.push(file))
        .catch(() => undefined);
    }
  }
  return files;
}

export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
