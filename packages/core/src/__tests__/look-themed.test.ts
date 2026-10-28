// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { THEMED_ATTRIBUTE } from '../look/attributes.js';
import { declarationsOf } from '../look/css.js';
import { themedRule, watchThemes, wearsFluvy } from '../look/themed.js';

interface ThemeRecord {
  cacheKey: string | undefined;
  keys: { [name: string]: '' };
}
type Themed = HTMLElement & { __themes?: ThemeRecord };

/** What the Fluvy theme file writes (Linen's colours), a copy of it under a name of the person's, another theme. */
const LINEN = { 'fluvy-theme': '1', 'fluvy-palette': 'linen', 'primary-color': '#856529' };
const THEMES: { [name: string]: { [key: string]: string } } = {
  Fluvy: LINEN,
  'Fluvy Linen': LINEN,
  Other: { 'primary-color': '#ff9800' },
};

/**
 * Home Assistant's `applyThemesOnElement` (frontend 2026.10) as far as an element goes: its record first, then the
 * theme's variables inline, and the variables the last theme wrote emptied.
 */
function applyTheme(element: HTMLElement, theme?: string, dark = false): void {
  const themed = element as Themed;
  const styles: { [name: string]: string } = { ...themed.__themes?.keys };
  const keys: ThemeRecord['keys'] = {};
  for (const [name, value] of Object.entries((theme && THEMES[theme]) ?? {})) {
    styles[`--${name}`] = value;
    keys[`--${name}`] = '';
  }
  themed.__themes = { cacheKey: theme && dark ? `${theme}__dark` : theme, keys };
  for (const [name, value] of Object.entries(styles)) element.style.setProperty(name, value);
}

/** The look's sheet for the marked elements, Volt's. */
const sheet = new CSSStyleSheet();
sheet.replaceSync(
  themedRule(declarationsOf({ palette: 'volt', shape: 'soft', pills: 'round' }, 'light')),
);

/** A view as Home Assistant draws it: its own shadow root, on the page. */
function view(): HTMLElement {
  const element = document.createElement('div');
  element.attachShadow({ mode: 'open' });
  document.body.append(element);
  return element;
}

const beat = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

describe('an element Home Assistant themed with the theme named Fluvy', () => {
  const changed = vi.fn();
  const stop = watchThemes(document, () => sheet, changed);

  it('wears the look over the colours Home Assistant wrote on it, in either mode', async () => {
    const element = view();
    applyTheme(element, 'Fluvy');
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(true);
    expect(element.shadowRoot?.adoptedStyleSheets).toContain(sheet);
    // Home Assistant's own variables stay as it wrote them; the look's win over them
    expect(element.style.getPropertyValue('--fluvy-palette')).toBe('linen');
    expect(getComputedStyle(element).getPropertyValue('--fluvy-palette')).toBe('volt');
    await beat();
    expect(changed).toHaveBeenCalledTimes(1);
    // dark mode is a theme of its own to Home Assistant (`Fluvy__dark`): the mark stays, and nothing moved
    applyTheme(element, 'Fluvy', true);
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(true);
    await beat();
    expect(changed).toHaveBeenCalledTimes(1);
    element.remove();
    changed.mockClear();
  });

  it('gets the sheet in the tree it sits in when it has no shadow root of its own (a section)', () => {
    const host = view();
    const section = document.createElement('div');
    host.shadowRoot?.append(section);
    applyTheme(section, 'Fluvy');
    expect(section.hasAttribute(THEMED_ATTRIBUTE)).toBe(true);
    expect(host.shadowRoot?.adoptedStyleSheets).toContain(sheet);
    const loose = document.body.appendChild(document.createElement('div'));
    applyTheme(loose, 'Fluvy');
    expect(document.adoptedStyleSheets).toContain(sheet);
    // out of the page: marked, its sheet given where Home Assistant themes it again (on its connect)
    const detached = document.createElement('div');
    expect(() => applyTheme(detached, 'Fluvy')).not.toThrow();
    expect(detached.hasAttribute(THEMED_ATTRIBUTE)).toBe(true);
    host.remove();
    loose.remove();
    document.adoptedStyleSheets = [];
  });

  it('keeps Home Assistant’s record as it left it, so its next theme empties the last one’s colours', () => {
    const element = view();
    applyTheme(element, 'Fluvy');
    const record = (element as Themed).__themes;
    expect(record?.cacheKey).toBe('Fluvy');
    expect(Object.hasOwn(element, '__themes')).toBe(false);
    applyTheme(element, 'Other');
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(false);
    expect(element.style.getPropertyValue('--fluvy-palette')).toBe('');
    expect(element.style.getPropertyValue('--primary-color')).toBe('#ff9800');
    applyTheme(element, 'Fluvy');
    applyTheme(element);
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(false);
    expect(element.getAttribute('style') ?? '').not.toContain('--');
    element.remove();
  });

  it('leaves another theme, and the page itself, as Home Assistant themed them', () => {
    expect(wearsFluvy({ cacheKey: 'Fluvy' })).toBe(true);
    expect(wearsFluvy({ cacheKey: 'Fluvy__dark' })).toBe(true);
    expect(wearsFluvy({ cacheKey: 'Fluvy Linen' })).toBe(false);
    expect(wearsFluvy({ cacheKey: 'default' })).toBe(false);
    expect(wearsFluvy(undefined)).toBe(false);
    const element = view();
    applyTheme(element, 'Fluvy Linen');
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(false);
    expect(element.shadowRoot?.adoptedStyleSheets).toEqual([]);
    // `<html>` wears the look's own sheet (`engine.ts`)
    applyTheme(document.documentElement, 'Fluvy');
    expect(document.documentElement.hasAttribute(THEMED_ATTRIBUTE)).toBe(false);
    applyTheme(document.documentElement);
    element.remove();
  });

  it('has the cards look again once for a whole view’s themes', async () => {
    changed.mockClear();
    const elements = [view(), view(), view()];
    for (const element of elements) applyTheme(element, 'Fluvy');
    expect(changed).not.toHaveBeenCalled();
    await beat();
    expect(changed).toHaveBeenCalledTimes(1);
    for (const element of elements) element.remove();
  });

  it('marks what Home Assistant themed before the bundle arrived', () => {
    const early = view();
    // a record of its own, as Home Assistant set it before the accessor was there
    const record = { cacheKey: 'Fluvy', keys: {} };
    Object.defineProperty(early, '__themes', {
      value: record,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    const restart = watchThemes(document, () => sheet, changed);
    expect(early.hasAttribute(THEMED_ATTRIBUTE)).toBe(true);
    expect(early.shadowRoot?.adoptedStyleSheets).toContain(sheet);
    expect(Object.hasOwn(early, '__themes')).toBe(false);
    expect((early as Themed).__themes).toBe(record);
    restart();
    early.remove();
  });

  it('marks nothing once stopped, and still keeps Home Assistant’s records', () => {
    stop();
    const element = view();
    applyTheme(element, 'Fluvy');
    expect(element.hasAttribute(THEMED_ATTRIBUTE)).toBe(false);
    expect((element as Themed).__themes?.cacheKey).toBe('Fluvy');
    element.remove();
  });

  it('watches nothing where another script owns the record’s name', async () => {
    const other = new Window();
    const proto = other.HTMLElement.prototype;
    Object.defineProperty(proto, '__themes', {
      value: 'theirs',
      writable: true,
      configurable: true,
    });
    watchThemes(other.document as unknown as Document, () => sheet, changed);
    expect(Object.getOwnPropertyDescriptor(proto, '__themes')?.value).toBe('theirs');
    await other.happyDOM.close();
  });
});
