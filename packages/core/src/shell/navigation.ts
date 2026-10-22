import { walkShadow } from './dom.js';
import { inUse, wrap } from './patches.js';

/**
 * Settings' lists (`ha-config-navigation-list`: Settings, System) say which page an item opens only in a property,
 * which no stylesheet can read. After each render, while Fluvy is in use on the page, the list's icon circles are
 * told the glyph of their page (`data-fluvy-glyph`); the shell's icons sheet draws it, and while the house keeps Home
 * Assistant's icons that sheet is empty and the attribute does nothing. If Home Assistant reshapes the list, nothing
 * is written and the shell's report says so.
 */
export const GLYPH_ATTRIBUTE = 'data-fluvy-glyph';

type Item = HTMLElement & { href?: string };

function annotate(list: Element, glyphOf: (path: string) => string | undefined): void {
  for (const item of list.shadowRoot?.querySelectorAll<Item>('ha-list-item-button') ?? []) {
    const circle = item.querySelector('.icon-background');
    if (!circle) continue;
    const glyph = typeof item.href === 'string' ? glyphOf(item.href) : undefined;
    if (glyph) circle.setAttribute(GLYPH_ATTRIBUTE, glyph);
    else circle.removeAttribute(GLYPH_ATTRIBUTE);
  }
}

export async function patchNavigationGlyphs(
  registry: CustomElementRegistry,
  doc: Document,
  glyphOf: (path: string) => string | undefined,
): Promise<boolean> {
  const tag = 'ha-config-navigation-list';
  await registry.whenDefined(tag);
  const done = wrap(registry.get(tag)?.prototype, 'updated', 'navigationGlyphs', (list: Element) =>
    annotate(list, glyphOf),
  );
  // the lists already on the page
  if (done && inUse(doc))
    walkShadow(doc, (element) => {
      if (element.localName === tag) annotate(element, glyphOf);
    });
  return done;
}
