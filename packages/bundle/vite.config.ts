import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Fluvy's one version and licence: the root package.json's (tokens and theme read the same)
const { version, license } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string; license: string };

/**
 * Lit `css` literals are written for reading (Prettier lays them out rule by rule); the bundle carries them
 * compact. Only their static text changes — comments go, whitespace runs become one space, none is kept
 * beside `{`, `}` or `;` — never an interpolation, and only in fluvy's own sources.
 */
function compactCssLiterals(): Plugin {
  const compact = (text: string): string =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};])\s*/g, '$1');
  return {
    name: 'fluvy-compact-css-literals',
    transform(code, id) {
      if (!id.includes('/packages/') || id.includes('/node_modules/') || !code.includes('css`'))
        return null;
      const out = code.replace(/\bcss`((?:[^`\\]|\\.)*)`/g, (_whole, body: string) => {
        const parts = body.split(/(\$\{[^}]*\})/);
        return `css\`${parts
          .map((part) => (part.startsWith('${') ? part : compact(part)))
          .join('')
          .trim()}\``;
      });
      return { code: out, map: null };
    },
  };
}

/**
 * What the pages and the settings panel share and a dashboard never needs: the date picker both pages open, the
 * time field inside it, the dropdown. Fetched with whichever of them opens first; core must not reach for any of
 * it (a static import from core would drag the chunk onto every dashboard — `finish.mjs` refuses such a build).
 */
const PAGES =
  /\/packages\/(cards\/src\/shared\/date-picker\.ts|ui\/src\/controls\/(time-field|select)\.ts)/;

/** What only the Activity page uses (all of its folder but the takeover): fetched the first time `/logbook` is opened. */
const ACTIVITY =
  /\/packages\/(cards\/src\/activity\/(?!takeover\.ts)|core\/src\/activity\/|ui\/src\/controls\/time-(rail|field)\.ts)/;

/**
 * What only the History page uses (its folder but the takeover, and the window it reads — not `series.ts`, which the
 * sensor and energy cards draw their sparklines from): fetched the first time `/history` is opened.
 */
const HISTORY =
  /\/packages\/(cards\/src\/history\/(?!takeover\.ts)|core\/src\/history\/(?!series\.ts))/;

/** Fluvy's settings panel (all of its folder but the switch that fetches it): fetched when `/fluvy` is opened. */
const PANEL = /\/packages\/cards\/src\/panel\/(?!on-demand\.ts)/;

/** The automatic dashboard's strategy (all of its folder but the definer): fetched when a dashboard asks for it. */
const STRATEGY = /\/packages\/cards\/src\/strategy\/(?!define\.ts)/;

/** A language's catalogue (English ships in core): fetched the first time that language is spoken. */
const LANGUAGE = /\/packages\/core\/src\/i18n\/locales\/(?!en\.json)([\w-]+)\.json/;

/**
 * Where each module goes, first match wins: a language's catalogue, the page controls, the Activity page, the History
 * page, the settings panel, and everything else (Fluvy's packages and Lit) in `core`. The bundle's own entry stays
 * in `fluvy.js`. Rolldown processes the groups in this order; the priorities only say so out loud.
 */
const GROUPS: ReadonlyArray<{
  name: string | ((id: string) => string);
  test: RegExp | ((id: string) => boolean);
}> = [
  { name: (id) => `lang-${LANGUAGE.exec(id)?.[1]}`, test: LANGUAGE },
  { name: 'pages', test: PAGES },
  { name: 'activity', test: ACTIVITY },
  { name: 'history', test: HISTORY },
  { name: 'panel', test: PANEL },
  { name: 'strategy', test: STRATEGY },
  { name: 'core', test: (id) => !id.includes('/packages/bundle/src/') },
];

/**
 * The build Home Assistant loads (the integration serves it from `custom_components/fluvy/frontend`, under a URL
 * named after the build) and what it shares with the pages loaded on demand. The entry keeps only its own code and
 * imports the rest from `chunks/core-<hash>.js`; the pages fetched on demand (Activity, History, the settings panel)
 * import the same file, so they all reach one copy of everything. Chunk names carry their content hash: they never
 * go stale. Lit is bundled (pinned to Home Assistant's 3.3.3).
 */
export default defineConfig({
  plugins: [compactCssLiterals()],
  define: { __FLUVY_VERSION__: JSON.stringify(version) },
  build: {
    target: 'es2022',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'fluvy.js' },
    outDir: '../../custom_components/fluvy/frontend',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: { format: { comments: /^!/ }, compress: { passes: 2 } },
    rolldownOptions: {
      // the entry's exports stay as written (the loader reads `version`); a group may then hold only what its test names
      preserveEntrySignatures: 'allow-extension',
      output: {
        inlineDynamicImports: false,
        chunkFileNames: 'chunks/[name]-[hash].js',
        codeSplitting: {
          // a group holds what its test names, nothing it imports: the imports keep their own chunk (the old Rollup rule)
          includeDependenciesRecursively: false,
          groups: GROUPS.map((group, index) => ({ ...group, priority: GROUPS.length - index })),
        },
        banner: `/*! Fluvy v${version} · a theme and card library for Home Assistant · SPDX-License-Identifier: ${license} · https://github.com/acosta290/fluvy */`,
      },
    },
    sourcemap: false,
    reportCompressedSize: false,
  },
});
