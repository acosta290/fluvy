import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

describe('the cards folder', () => {
  it("holds no strings.ts: a card says its words with strings('<name>') where it says them", () => {
    const folders = readdirSync(SRC, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(folders.filter((folder) => existsSync(join(SRC, folder, 'strings.ts')))).toEqual([]);
  });
});
