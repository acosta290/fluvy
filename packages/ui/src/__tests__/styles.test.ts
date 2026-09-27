import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build, transformStylesheet } from '../../scripts/build-styles.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('stylesheet transform', () => {
  it('turns the lab frame into the host and the dark frame into the dark host', () => {
    const css = transformStylesheet(
      `.fv-frame { color: red; } .fv-frame * { margin: 0; } [data-mode='dark'] .fv-knob { opacity: 1; } .lab-sheet { width: 900px; }`,
    );
    expect(css).toBe(':host{color:red}*{margin:0}:host([dark]) .fv-knob{opacity:1}');
  });

  it('drops frame widths and makes full-width px grids proportional', () => {
    expect(transformStylesheet('.cl-card { width: 360px; height: 10px; }')).toBe(
      '.cl-card{height:10px}',
    );
    expect(
      transformStylesheet(
        '.g { display: grid; grid-template-columns: 96px 96px 96px; gap: 16px; }',
      ),
    ).toBe(
      '.g{display:grid;grid-template-columns:minmax(0,96fr) minmax(0,96fr) minmax(0,96fr);gap:16px}',
    );
    // a grid that does not fill its column keeps its pixels (a 264 px keypad stays a keypad)
    expect(
      transformStylesheet('.k { grid-template-columns: 72px 72px 72px; gap: 24px; }'),
    ).toContain('72px 72px 72px');
  });

  it('keeps keyframes and media queries intact', () => {
    const css = transformStylesheet(
      '@keyframes a { from { opacity: 0; } to { opacity: 1; } } @media (hover: hover) { .x:hover { color: blue; } }',
    );
    expect(css).toContain(
      '@keyframes a{from { opacity:0;} to { opacity:1;}}'.replace('from {', 'from {'),
    );
    expect(css).toContain('@media (hover: hover){.x:hover{color:blue}}');
  });

  it('the committed generated files are in sync with styles/*.css and the tokens', async () => {
    const expected = await build();
    const dir = join(ROOT, 'src', 'styles', 'generated');
    expect((await readdir(dir)).sort()).toEqual(Object.keys(expected).sort());
    for (const [file, content] of Object.entries(expected))
      expect(
        await readFile(join(dir, file), 'utf8'),
        `${file} is stale: run pnpm --filter @fluvy/ui build:styles`,
      ).toBe(content);
  });
});
