import { BRAND, DEFAULT_MODE, DEFAULT_PALETTE } from '../config.js';
import { RELEASE_VERSION } from '../release.js';
import type { Palette } from '../types.js';
import { haSharedVars } from '../ha/groups.js';
import { allPaletteVars, defaultColors, scaleVars, type VarGroup } from './vars.js';

const INDENT = '  ';

function renderGroups(groups: readonly VarGroup[]): string {
  return groups
    .map((group) => {
      const comment = `${INDENT}/* ${group.title} */`;
      const lines = group.declarations.map(([name, value]) => `${INDENT}${name}: ${value};`);
      return [comment, ...lines].join('\n');
    })
    .join('\n\n');
}

function renderBlock(selector: string, groups: readonly VarGroup[]): string {
  return `${selector} {\n${renderGroups(groups)}\n}`;
}

/**
 * The design-lab stylesheet: every palette × mode as an attribute-scoped block.
 *
 * Attribute selectors (0,2,0) outrank the `:root` defaults (0,1,0), so a block wins
 * wherever `data-palette` and `data-mode` are both set — on `<html>` for the whole page,
 * or on a single section so a sheet can show all eighteen combinations at once.
 */
export function emitLabCss(palettes: readonly Palette[]): string {
  const header = [
    '/*',
    ` * ${BRAND.npmScope}/tokens v${RELEASE_VERSION} — generated, do not edit.`,
    ' * Source: packages/tokens/src. Rebuild with `pnpm --filter @fluvy/tokens build`.',
    ' *',
    ' * Every colour is a plain #rrggbb: Home Assistant reads theme values from',
    ' * JavaScript and mangles oklch()/color-mix()/rgba() when it appends alpha.',
    ' */',
  ].join('\n');

  const blocks = [
    renderBlock(':root', [...scaleVars(), ...haSharedVars()]),
    renderBlock(
      `:root /* defaults: ${DEFAULT_PALETTE} ${DEFAULT_MODE} */`,
      allPaletteVars(defaultColors(palettes)),
    ),
    ...palettes.flatMap((palette) =>
      (['light', 'dark'] as const).map((mode) =>
        renderBlock(
          `[data-palette='${palette.name}'][data-mode='${mode}']`,
          allPaletteVars(palette[mode]),
        ),
      ),
    ),
  ];

  return `${header}\n\n${blocks.join('\n\n')}\n`;
}
