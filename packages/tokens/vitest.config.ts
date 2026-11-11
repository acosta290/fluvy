import { defineConfig } from 'vitest/config';

// the module cache in this package's own node_modules: the workspace's shared one is emptied by whichever package
// first sees the lockfile changed, and two packages running at once raced over it (ENOTEMPTY)
// the tests read their times in UTC, whatever the machine's zone: a fixture's house has none of its own
export default defineConfig({
  test: { env: { TZ: 'UTC' }, fsModuleCachePath: 'node_modules/.vitest-cache' },
});
