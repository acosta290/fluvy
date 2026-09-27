import { walkShadow } from './dom.js';

/**
 * Settings' lists (`ha-config-navigation-list`: Settings, System) say which page an item opens only in a property,
 * which no stylesheet can read. After each render the list's icon circles are told the glyph of their page
 * (`data-fluvy-glyph`); the shell's icons sheet draws it, and while the house keeps Home Assistant's icons that
 * sheet is empty and the attribute does nothing. If Home Assistant reshapes the list, nothing is written and the
 * shell's report says so.
 */
export const GLYPH_ATTRIBUTE = 'data-fluvy-glyph';

interface ListPrototype {
  updated?: (changed: unknown) => void;
  __fluvyGlyphs?: true;
}

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
  const proto = registry.get(tag)?.prototype as ListPrototype | undefined;
  const original = proto?.updated;
  if (!proto || typeof original !== 'function') return false;
  if (!proto.__fluvyGlyphs) {
    proto.updated = function (this: HTMLElement, changed: unknown): void {
      original.call(this, changed);
      annotate(this, glyphOf);
    };
    proto.__fluvyGlyphs = true;
  }
  // the lists already on the page
  walkShadow(doc, (element) => {
    if (element.localName === tag) annotate(element, glyphOf);
  });
  return true;
}
