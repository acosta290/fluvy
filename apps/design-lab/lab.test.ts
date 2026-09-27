import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The lab is hand-written CSS and JS referring to generated custom properties, so a token
 * rename silently turns a `var()` into "unset" and the page simply stops painting something.
 * This catches that: every brand token the lab mentions has to exist in the build output.
 *
 * `lab.js` assembles some names from template literals (`--fluvy-state-${key}-fill`), so an
 * interpolation is treated as a wildcard and the reference has to match at least one
 * emitted token.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_JSON = resolve(HERE, '../../packages/tokens/dist/tokens.json');

interface TokensDump {
  readonly brand: { readonly prefix: string };
  readonly scales: { readonly cssVars: Record<string, string> };
  readonly palettes: readonly {
    readonly name: string;
    readonly modes: Record<string, { readonly cssVars: Record<string, string> }>;
  }[];
}

function loadTokens(): TokensDump {
  try {
    return JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as TokensDump;
  } catch {
    throw new Error(`Missing ${TOKENS_JSON}. Run \`pnpm -r build\` before \`pnpm -r test\`.`);
  }
}

const tokens = loadTokens();
const prefix = `--${tokens.brand.prefix}-`;

const defined: string[] = [
  ...Object.keys(tokens.scales.cssVars),
  ...tokens.palettes.flatMap((palette) =>
    Object.values(palette.modes).flatMap((mode) => Object.keys(mode.cssVars)),
  ),
];

/** `var(--fluvy-foo)` and `var(--fluvy-state-${key}-fill)` alike. */
const VAR_REFERENCE = /var\(\s*(--[a-z0-9-]*(?:\$\{[^}]+\}[a-z0-9-]*)*)/g;
/** Custom properties the lab declares for itself (`--tile-fill`, `--swatch-color`, …). */
const LOCAL_DECLARATION = /--[a-z0-9-]+(?=\s*:)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matcherFor(reference: string): RegExp {
  const pattern = reference
    .split(/\$\{[^}]+\}/)
    .map(escapeRegExp)
    .join('[a-z0-9-]+');
  return new RegExp(`^${pattern}$`);
}

function brandReferences(source: string): string[] {
  return [...source.matchAll(VAR_REFERENCE)]
    .map((match) => match[1] ?? '')
    .filter((name) => name.startsWith(prefix));
}

const SOURCES = ['lab.css', 'gallery.css', 'lab.js', 'gallery.js', 'glyphs.js'];

describe.each(SOURCES.map((name) => [name, resolve(HERE, name)] as const))('%s', (_label, path) => {
  const source = readFileSync(path, 'utf8');

  it('only references brand tokens the build actually emits', () => {
    const own = new Set(source.match(LOCAL_DECLARATION) ?? []);
    const missing = [...new Set(brandReferences(source))]
      .filter((reference) => !own.has(reference))
      .filter((reference) => {
        const matcher = matcherFor(reference);
        return !defined.some((name) => matcher.test(name));
      })
      .sort();
    expect(missing).toEqual([]);
  });
});

describe('token coverage', () => {
  it('checks a meaningful number of brand tokens across the lab', () => {
    const all = SOURCES.flatMap((name) =>
      brandReferences(readFileSync(resolve(HERE, name), 'utf8')),
    );
    expect(new Set(all).size).toBeGreaterThan(40);
  });
});
