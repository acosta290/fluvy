import { defineConfig } from 'vitest/config';

// the module cache in this package's own node_modules: the workspace's shared one is emptied by whichever package
// first sees the lockfile changed, and two packages running at once raced over it (ENOTEMPTY)
export default defineConfig({ test: { fsModuleCachePath: 'node_modules/.vitest-cache' } });
