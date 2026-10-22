import { ICON_PATHS } from '../icons/generated.js';
import { MDI_GLYPHS } from '../icons/mdi.js';
import { pathKey } from '../icons/path-key.js';
import { walkShadow } from './dom.js';
import { guard, wrap } from './patches.js';

/**
 * Home Assistant's own chrome draws its Material icons with `ha-svg-icon`, told only a path (a property no stylesheet
 * can read): the edit bar's undo / redo / help / menu, the menus' items, pencils, close buttons, back arrows. While
 * the shell is on and the house keeps our icons, a path we know (`MDI_GLYPHS`, by a key of the path) is drawn as our
 * glyph on the same 24 grid; the Material path is kept on the element, and comes back when the icons go. Home
 * Assistant's own `willUpdate` runs first, always; a path is looked up only while our icons are drawn, so a page that
 * does not wear Fluvy never pays for it.
 */

interface SvgIcon extends HTMLElement {
  path?: string;
  __fluvyMdi?: string;
  requestUpdate(name?: string, oldValue?: unknown): void;
}

/** Our glyph's path for a Material path we know. */
const ourPath = (path: string | undefined): string | undefined => {
  if (!path) return undefined;
  const glyph = MDI_GLYPHS[pathKey(path)];
  return glyph ? ICON_PATHS[glyph] : undefined;
};

/** A path Home Assistant set (not ours) is the Material one: kept on the element, and drawn as ours. */
function drawOurs(icon: SvgIcon): void {
  const material = icon.path;
  const glyph = ourPath(material);
  if (material && glyph) {
    icon.__fluvyMdi = material;
    icon.path = glyph;
  } else if (material !== ourPath(icon.__fluvyMdi)) delete icon.__fluvyMdi;
}

/** Wraps `ha-svg-icon` once; `on()` says whether our icons are drawn now. */
export async function patchSvgIcons(
  registry: CustomElementRegistry,
  on: () => boolean,
): Promise<boolean> {
  await registry.whenDefined('ha-svg-icon');
  return wrap(
    registry.get('ha-svg-icon')?.prototype,
    'willUpdate',
    'svgIcons',
    (icon: SvgIcon, _: unknown, [changed]: [Map<string, unknown>]) => {
      // a path set in `willUpdate` is drawn in this same update
      if (changed.has('path')) drawOurs(icon);
    },
    on,
  );
}

/**
 * Every icon on the page redrawn after the icons were switched on or off (the Material path back, or ours), as part
 * of the patch (it steps aside with it).
 */
export const redrawSvgIcons = (doc: Document, on: boolean): void =>
  void guard(
    'svgIcons',
    () =>
      walkShadow(doc, (element) => {
        if (element.localName !== 'ha-svg-icon') return;
        const icon = element as SvgIcon;
        // the Material path kept while ours is drawn; any other path is Home Assistant's own, set while ours were off
        // (or before the patch)
        const kept = icon.__fluvyMdi;
        const material = kept && icon.path === ourPath(kept) ? kept : icon.path;
        const glyph = ourPath(material);
        if (!material || !glyph) return;
        icon.__fluvyMdi = material;
        icon.path = on ? glyph : material;
      }),
    doc,
  );
