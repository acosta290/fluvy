// @vitest-environment happy-dom
import * as mdi from '@mdi/js';
import { LitElement, html } from 'lit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from '../icons/generated.js';
import { MDI_GLYPHS } from '../icons/mdi.js';
import { pathKey } from '../icons/path-key.js';
import { patchSvgIcons, redrawSvgIcons } from '../shell/svg-icons.js';

// (tests run from the package's folder)
const map = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../tools/icons/mdi-glyphs.json'), 'utf8'),
) as Record<string, string>;

describe("Home Assistant's Material icons drawn as ours", () => {
  it('knows every listed icon by its path, and each draws a glyph of the set', () => {
    for (const [name, glyph] of Object.entries(map)) {
      const path = (mdi as Record<string, string>)[name];
      expect(path, name).toBeTypeOf('string');
      expect(MDI_GLYPHS[pathKey(path!)], name).toBe(glyph);
      expect(ICON_PATHS[glyph], glyph).toBeTypeOf('string');
    }
  });

  it('keys no two listed paths alike, and no other Material icon as one of them', () => {
    const listed = new Set(Object.keys(map).map((name) => (mdi as Record<string, string>)[name]));
    const keys = new Set(Object.keys(MDI_GLYPHS));
    expect(keys.size).toBe(listed.size);
    for (const [name, path] of Object.entries(mdi as Record<string, string>)) {
      if (listed.has(path)) continue;
      expect(keys.has(pathKey(path)), name).toBe(false);
    }
  });
});

describe('the ha-svg-icon patch', () => {
  it('draws a known Material path as our glyph while the icons are on, and gives it back after', async () => {
    class SvgIcon extends LitElement {
      static override properties = { path: {} };
      declare path?: string;
      protected override render() {
        return html`<svg><path d=${this.path ?? ''}></path></svg>`;
      }
    }
    customElements.define('ha-svg-icon', SvgIcon);
    let on = true;
    expect(await patchSvgIcons(customElements, () => on)).toBe(true);
    const icon = document.createElement('ha-svg-icon') as SvgIcon;
    document.body.append(icon);
    icon.path = mdi.mdiPencil;
    await icon.updateComplete;
    expect(icon.path).toBe(ICON_PATHS['pencil']);
    // an icon of its own (not listed) is left as it is
    const other = document.createElement('ha-svg-icon') as SvgIcon;
    document.body.append(other);
    other.path = mdi.mdiAbacus;
    await other.updateComplete;
    expect(other.path).toBe(mdi.mdiAbacus);
    on = false;
    redrawSvgIcons(document, false);
    await icon.updateComplete;
    expect(icon.path).toBe(mdi.mdiPencil);
    on = true;
    redrawSvgIcons(document, true);
    await icon.updateComplete;
    expect(icon.path).toBe(ICON_PATHS['pencil']);
  });
});
