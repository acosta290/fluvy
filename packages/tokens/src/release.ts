import { readFileSync } from 'node:fs';

/**
 * The product's version: one number for the tokens' files, the theme and the bundle, read from the root
 * `package.json` (the one file a release bumps). Build-time only — the browser code never imports it.
 */
export const RELEASE_VERSION: string = (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
