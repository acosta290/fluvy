// @vitest-environment happy-dom
import * as mdi from '@mdi/js';
import { LitElement, html } from 'lit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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
  /** Home Assistant's icon: a path, and an update of its own that the patch must never skip. */
  class SvgIcon extends LitElement {
    static override properties = { path: {} };
    declare path?: string;
    __fluvyMdi?: string;
    ownUpdates = 0;
    protected override willUpdate(): void {
      this.ownUpdates += 1;
    }
    protected override render() {
      return html`<svg><path d=${this.path ?? ''}></path></svg>`;
    }
  }
  /** Whether our icons are drawn (the shell's: the page wears Fluvy and the house keeps our icons). */
  let on = true;
  const icon = async (path: string): Promise<SvgIcon> => {
    const element = document.body.appendChild(document.createElement('ha-svg-icon') as SvgIcon);
    element.path = path;
    await element.updateComplete;
    return element;
  };

  it('draws a known Material path as our glyph while the icons are on, and gives it back after', async () => {
    customElements.define('ha-svg-icon', SvgIcon);
    expect(await patchSvgIcons(customElements, () => on)).toBe(true);
    const pencil = await icon(mdi.mdiPencil);
    expect(pencil.path).toBe(ICON_PATHS['pencil']);
    expect(pencil.ownUpdates).toBe(1);
    // an icon of its own (not listed) is left as it is
    const other = await icon(mdi.mdiAbacus);
    expect(other.path).toBe(mdi.mdiAbacus);
    on = false;
    redrawSvgIcons(document, false);
    await pencil.updateComplete;
    expect(pencil.path).toBe(mdi.mdiPencil);
    on = true;
    redrawSvgIcons(document, true);
    await pencil.updateComplete;
    expect(pencil.path).toBe(ICON_PATHS['pencil']);
    document.body.replaceChildren();
  });

  it('looks no path up while our icons are off, and draws the path Home Assistant set meanwhile when they come back', async () => {
    const pencil = await icon(mdi.mdiPencil);
    on = false;
    redrawSvgIcons(document, false);
    await pencil.updateComplete;
    // another theme: Home Assistant draws its own, and nothing of ours is kept on a new icon
    const close = await icon(mdi.mdiClose);
    expect(close.path).toBe(mdi.mdiClose);
    expect(close.__fluvyMdi).toBeUndefined();
    expect(close.ownUpdates).toBe(1);
    // a path Home Assistant set while ours were off is the one drawn when they come back
    pencil.path = mdi.mdiDelete;
    await pencil.updateComplete;
    on = true;
    redrawSvgIcons(document, true);
    await pencil.updateComplete;
    expect(pencil.path).toBe(ICON_PATHS['trash']);
    expect(close.path).toBe(ICON_PATHS['close']);
    on = false;
    redrawSvgIcons(document, false);
    await pencil.updateComplete;
    expect(pencil.path).toBe(mdi.mdiDelete);
    on = true;
    document.body.replaceChildren();
  });

  it('steps aside when ours throws: the icon draws Home Assistant’s path, and every one after it too', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = document.body.appendChild(document.createElement('ha-svg-icon') as SvgIcon);
    Object.defineProperty(element, '__fluvyMdi', {
      set: () => {
        throw new Error('sealed');
      },
    });
    element.path = mdi.mdiPencil;
    await element.updateComplete;
    expect(element.ownUpdates).toBe(1);
    expect(element.path).toBe(mdi.mdiPencil);
    expect(warn).toHaveBeenCalledTimes(1);
    const after = await icon(mdi.mdiPencil);
    expect(after.path).toBe(mdi.mdiPencil);
    // nor are the icons redrawn as ours
    redrawSvgIcons(document, true);
    await after.updateComplete;
    expect(after.path).toBe(mdi.mdiPencil);
    warn.mockRestore();
  });
});
