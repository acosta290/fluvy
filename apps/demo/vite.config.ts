import { defineConfig } from 'vite';

/** Published under https://acosta290.github.io/fluvy/ — the base is the repository's name. */
export default defineConfig({
  base: '/fluvy/',
  server: { host: '127.0.0.1', fs: { allow: ['../..'] } },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
