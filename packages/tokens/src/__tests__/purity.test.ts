import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every module `runtime.ts` reaches, by its relative imports. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      const spec = match[1]!;
      if (!spec.startsWith('.')) continue;
      walk(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
    }
  };
  walk(entry);
  return seen;
}

describe('the browser entry', () => {
  it('reaches no module that needs Node (the release stamp and the build stay outside)', () => {
    const files = closure(resolve(SRC, 'runtime.ts'));
    expect(files.size).toBeGreaterThan(20);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(/from\s+'node:/.test(source), file.replace(SRC, 'src')).toBe(false);
    }
    expect([...files].some((f) => f.endsWith('release.ts'))).toBe(false);
    expect([...files].some((f) => f.endsWith('build/run.ts'))).toBe(false);
  });
});
