import { defineConfig } from 'vite';

export default defineConfig({
  // FLUVY_NO_HMR=1: a second server for test runs: files stay watched (fresh modules on the next load) but a running page is never reloaded under a test
  server: {
    host: '127.0.0.1',
    fs: { allow: ['../..'] },
    ...(process.env['FLUVY_NO_HMR'] ? { hmr: false } : {}),
  },
  build: { target: 'es2022', outDir: 'dist' },
});
