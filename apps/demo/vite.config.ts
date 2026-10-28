import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** The playground's own pages the Web page card shows (`apps/playground/public/web`). */
const WEB = new URL('../playground/public/web/', import.meta.url);

/**
 * The Web page sheet's pages, beside the demo's own files (`/fluvy/web/…`): emitted with the build and served by the
 * dev server, so a card's plate loads on Pages as it does in the playground.
 */
function webPages(): Plugin {
  const pages = (): string[] => readdirSync(WEB).filter((file) => file.endsWith('.html'));
  return {
    name: 'fluvy-demo-web-pages',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file = /^\/fluvy\/web\/([\w-]+\.html)$/.exec(request.url?.split('?')[0] ?? '')?.[1];
        if (!file || !pages().includes(file)) return next();
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(readFileSync(new URL(file, WEB)));
      });
    },
    generateBundle() {
      for (const file of pages())
        this.emitFile({
          type: 'asset',
          fileName: `web/${file}`,
          source: readFileSync(new URL(file, WEB)),
        });
    },
  };
}

/** Published under https://acosta290.github.io/fluvy/ — the base is the repository's name. */
export default defineConfig({
  base: '/fluvy/',
  plugins: [webPages()],
  server: { host: '127.0.0.1', fs: { allow: ['../..'] } },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
