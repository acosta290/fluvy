#!/usr/bin/env node
/**
 * Where the bytes of fluvy.js come from. Runs the production build in memory (nothing under dist/ is
 * touched) and groups Rollup's per-module rendered sizes (before minification) by package and folder,
 * next to the minified + gzip size of the whole file.
 *   node scripts/size.mjs [--top 25]
 */
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = join(root, '..', '..');
const top = Number(process.argv[process.argv.indexOf('--top') + 1] || 25);

let modules = {};
let code = '';
await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'silent',
  build: {
    write: false,
    rollupOptions: {
      plugins: [
        {
          name: 'fluvy-size',
          generateBundle(_, bundle) {
            for (const chunk of Object.values(bundle))
              if (chunk.type === 'chunk') {
                modules = { ...modules, ...chunk.modules };
                code += chunk.code;
              }
          },
        },
      ],
    },
  },
});

const label = (id) => {
  const clean = id.replace(/\0/g, '').split('?')[0];
  const rel = relative(workspace, clean).replace(/\\/g, '/');
  const nm = [...clean.matchAll(/node_modules\/((?:@[^/]+\/)?[^/.][^/]*)/g)]
    .map((x) => x[1])
    .filter((x) => !x.startsWith('.pnpm'));
  if (nm.length) return `dep · ${nm[nm.length - 1]}`;
  const m = rel.match(/^packages\/([^/]+)\/(?:src\/)?([^/]+)/);
  if (!m) return rel;
  const [, pkg, first] = m;
  if (pkg === 'cards')
    return `cards · ${first === 'shared' || first === 'helpers' || first === 'index.ts' ? first.replace('.ts', '') : first}`;
  if (pkg === 'ui' && first === 'styles') return 'ui · styles (css strings)';
  return `${pkg} · ${first.replace('.ts', '')}`;
};

const groups = new Map();
let total = 0;
for (const [id, m] of Object.entries(modules)) {
  const key = label(id);
  const bytes = m.renderedLength;
  total += bytes;
  groups.set(key, (groups.get(key) ?? 0) + bytes);
}
const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const pct = (n) => `${((n / total) * 100).toFixed(1)} %`;

const byFamily = new Map();
for (const [key, bytes] of rows) {
  const fam = key.split(' · ')[0];
  byFamily.set(fam, (byFamily.get(fam) ?? 0) + bytes);
}

console.log(
  `fluvy.js: ${kb(code.length)} minified · ${kb(gzipSync(code).length)} gzip · ${kb(total)} of module source rendered into it\n`,
);
console.log('| family | rendered | share |\n| --- | ---: | ---: |');
for (const [fam, bytes] of [...byFamily.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`| ${fam} | ${kb(bytes)} | ${pct(bytes)} |`);
console.log(`\n| module group (top ${top}) | rendered | share |\n| --- | ---: | ---: |`);
for (const [key, bytes] of rows.slice(0, top))
  console.log(`| ${key} | ${kb(bytes)} | ${pct(bytes)} |`);
