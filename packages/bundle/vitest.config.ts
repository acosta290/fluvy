import { defineConfig } from 'vitest/config';

// the tests read the sources and the groups; they never build (`vite.config.ts` is the build's, not theirs). The module
// cache in this package's own node_modules: the workspace's shared one is emptied by whichever package first sees the
// lockfile changed, and two packages running at once raced over it (ENOTEMPTY)
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], fsModuleCachePath: 'node_modules/.vitest-cache' },
});
