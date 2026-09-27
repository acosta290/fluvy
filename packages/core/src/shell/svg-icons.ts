import { ICON_PATHS } from '../icons/generated.js';
import { MDI_GLYPHS } from '../icons/mdi.js';
import { pathKey } from '../icons/path-key.js';
import { walkShadow } from './dom.js';

/**
 * Home Assistant's own chrome draws its Material icons with `ha-svg-icon`, told only a path (a property no stylesheet
 * can read): the edit bar's undo / redo / help / menu, the menus' items, pencils, close buttons, back arrows. While
 * the shell is on and the house keeps our icons, a path we know (`MDI_GLYPHS`, by a key of the path) is drawn as our
 * glyph on the same 24 grid; the Material path is kept on the element, and comes back when the icons go.
 */

interface SvgIcon extends HTMLElement {
  path?: string;
  __fluvyMdi?: string;
  requestUpdate(name?: string, oldValue?: unknown): void;
}

interface SvgIconPrototype {
  willUpdate?: (changed: Map<string, unknown>) => void;
  __fluvyIcons?: true;
}

const ours = (path: string | undefined): string | undefined => {
  if (!path) return undefined;
  const glyph = MDI_GLYPHS[pathKey(path)];
  return glyph ? ICON_PATHS[glyph] : undefined;
};

/** Wraps `ha-svg-icon` once; `on()` says whether our icons are drawn now. */
export async function patchSvgIcons(
  registry: CustomElementRegistry,
  on: () => boolean,
): Promise<boolean> {
  await registry.whenDefined('ha-svg-icon');
  const proto = registry.get('ha-svg-icon')?.prototype as SvgIconPrototype | undefined;
  if (!proto) return false;
  if (!proto.__fluvyIcons) {
    const original = proto.willUpdate;
    proto.willUpdate = function (this: SvgIcon, changed: Map<string, unknown>): void {
      if (changed.has('path') && this.path !== undefined) {
        // a path Home Assistant sets (not ours) is the Material one: kept, and drawn as ours while they are on
        const glyph = ours(this.path);
        if (glyph) this.__fluvyMdi = this.path;
        else if (this.path !== ours(this.__fluvyMdi)) delete this.__fluvyMdi;
        if (glyph && on()) this.path = glyph;
      }
      original?.call(this, changed);
    };
    proto.__fluvyIcons = true;
  }
  return true;
}

/** Every icon on the page redrawn after the icons were switched on or off (the Material path back, or ours). */
export function redrawSvgIcons(doc: Document, on: boolean): void {
  walkShadow(doc, (element) => {
    if (element.localName !== 'ha-svg-icon') return;
    const icon = element as SvgIcon;
    // an icon drawn before the patch knows only its Material path
    const material = icon.__fluvyMdi ?? (ours(icon.path) ? icon.path : undefined);
    if (!material) return;
    icon.__fluvyMdi = material;
    icon.path = on ? (ours(material) ?? material) : material;
  });
}
