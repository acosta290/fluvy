#!/usr/bin/env node
/**
 * Every interaction suite, one after the other, in a real Chromium against the playground on :5183 (start it with
 * `FLUVY_NO_HMR=1 pnpm --filter @fluvy/playground dev`). Each suite prints its own pass / fail lines; this prints one
 * line per suite at the end and exits 1 when any suite failed — what `pnpm visual` and CI run.
 *   node visual.mjs                 every tools/render/interactions*.mjs
 *   node visual.mjs panel history   only those (the part of the file name after "interactions-")
 *   node visual.mjs --jobs 8        that many suites at once, each one's lines printed together when it ends (the
 *                                   suites share nothing but the playground; CI runs them one after the other)
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf('--jobs');
const jobs = at === -1 ? 1 : Math.max(1, Number(args[at + 1]) || 1);
const wanted = at === -1 ? args : args.filter((_, i) => i !== at && i !== at + 1);
const keyOf = (name) => name.replace(/^interactions-?|\.mjs$/g, '') || 'base';
const suites = (await readdir(here))
  .filter((name) => /^interactions(-[\w-]+)?\.mjs$/.test(name))
  .filter((name) => !wanted.length || wanted.includes(keyOf(name)))
  .sort();
if (!suites.length) {
  console.error(`no suite matches ${wanted.join(', ')}`);
  process.exit(1);
}

const run = (name) =>
  new Promise((resolve) => {
    const started = Date.now();
    // one at a time a suite speaks as it goes; several at once, each keeps its lines until it ends
    if (jobs === 1) console.log(`\n━━ ${name}`);
    const child = spawn(process.execPath, [join(here, name)], {
      stdio: jobs === 1 ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    const lines = [];
    child.stdout?.on('data', (chunk) => lines.push(chunk));
    child.stderr?.on('data', (chunk) => lines.push(chunk));
    child.on('close', (code) => {
      if (jobs > 1) process.stdout.write(`\n━━ ${name}\n${Buffer.concat(lines).toString()}`);
      resolve({ name, code: code ?? 1, seconds: (Date.now() - started) / 1000 });
    });
  });

const results = [];
const queue = [...suites];
await Promise.all(
  Array.from({ length: Math.min(jobs, suites.length) }, async () => {
    for (let suite = queue.shift(); suite; suite = queue.shift()) results.push(await run(suite));
  }),
);
results.sort((a, b) => a.name.localeCompare(b.name));

console.log('\n━━ summary');
for (const { name, code, seconds } of results)
  console.log(`${code === 0 ? '✓' : '✗'} ${name} (${seconds.toFixed(0)} s)`);
const failed = results.filter((r) => r.code !== 0).length;
console.log(`${results.length - failed}/${results.length} suites passed`);
process.exit(failed ? 1 : 0);
