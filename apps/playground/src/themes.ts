import { html, LitElement } from 'lit';
import {
  HOUSE_DEFAULTS,
  LookEngine,
  PANEL_ATTRIBUTE,
  PERSONAL_DEFAULTS,
  resolveSettings,
  resyncCardThemes,
  watchThemes,
  type EffectiveSettings,
  type Look,
} from '@fluvy/core';
import type { StatusColours } from '@fluvy/tokens/runtime';
import { adoptLast } from '../../../packages/core/src/shell/dom.js';
import fluvyFile from '../../../custom_components/fluvy/themes/fluvy.yaml?raw';

/*
 * A view Home Assistant themed (#72), `?viewtheme=Fluvy`: the frames' wrapper — a dashboard's `hui-view-container`, or
 * the stage, which has no shadow root of its own as a section has none — themed as Home Assistant's
 * `applyThemesOnElement` (frontend 2026.10) themes a view, a section or a card's `theme:`: its record (`__themes`)
 * first, then every variable of the theme inline, an `--rgb-*` triplet beside each hex, the last theme's emptied.
 * `Fluvy` is the shipped theme file (`fluvy.yaml`, Linen's colours); `Sandstone` the same file under a name of the
 * person's own, a theme the look leaves as it is. The look is the engine's, as the bundle runs it, with its watch on the
 * records (`look/themed.ts`): on every page, or with `&lookscope=dashboards` on the dashboard alone (the root standing
 * for its panel).
 *
 * For the suites: `fluvyApplyTheme(element, name)` themes any element so (no name: none), `fluvyLook({ look, dark })`
 * applies another look or mode as the settings would.
 */

type Vars = Record<string, string>;
interface ThemeFile {
  readonly base: Vars;
  readonly light: Vars;
  readonly dark: Vars;
}

/** A theme file as Home Assistant reads it: its top level, then `modes:` with `light:` and `dark:`. */
function parse(text: string): ThemeFile {
  const file: ThemeFile = { base: {}, light: {}, dark: {} };
  let part: keyof ThemeFile = 'base';
  for (const line of text.split('\n')) {
    const mode = /^ {4}(light|dark):$/.exec(line)?.[1];
    if (mode === 'light' || mode === 'dark') part = mode;
    const [, key, value] = /^ +([\w-]+): (".*")$/.exec(line) ?? [];
    // a value is a YAML double-quoted string escaping only `\` and `"`: as JSON reads it
    if (key && value) file[part][key] = JSON.parse(value) as string;
  }
  return file;
}

const fluvy = parse(fluvyFile);
const THEMES: Record<string, ThemeFile> = { Fluvy: fluvy, Sandstone: fluvy };

type Themed = HTMLElement & { __themes?: { cacheKey?: string; keys?: Record<string, ''> } };

/** Home Assistant's `applyThemesOnElement` for a theme of the house's (no name: the element's theme taken off). */
export function applyTheme(element: HTMLElement, name: string | undefined, dark: boolean): void {
  const themed = element as Themed;
  const theme = name ? THEMES[name] : undefined;
  const rules: Vars = theme ? { ...theme.base, ...(dark ? theme.dark : theme.light) } : {};
  const styles: Vars = { ...themed.__themes?.keys };
  const keys: Record<string, ''> = {};
  for (const [key, value] of Object.entries(rules)) {
    styles[`--${key}`] = value;
    keys[`--${key}`] = '';
    const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
    if (!hex || `rgb-${key}` in rules) continue;
    const n = parseInt(hex, 16);
    styles[`--rgb-${key}`] = `${n >> 16},${(n >> 8) & 255},${n & 255}`;
    keys[`--rgb-${key}`] = '';
  }
  themed.__themes = { ...(name ? { cacheKey: dark ? `${name}__dark` : name } : {}), keys };
  for (const [key, value] of Object.entries(styles)) element.style.setProperty(key, value);
}

/** Home Assistant's `hui-view-container`: a shadow root of its own around its view. */
class MockViewContainer extends LitElement {
  override render() {
    return html`<slot></slot>`;
  }
}

export interface ViewThemeOptions {
  readonly theme: string;
  readonly look: Look;
  readonly dark: boolean;
  readonly statuses: StatusColours;
  /** The look on the dashboard alone (the `dashboards` scope), else on every page. */
  readonly dashboards: boolean;
}

/** Puts the look on the page, starts its watch, then themes the frames' wrapper: `root` a dashboard's, or the stage. */
export async function mountViewTheme(root: HTMLElement, options: ViewThemeOptions): Promise<void> {
  let dark = options.dark;
  let settings: EffectiveSettings = {
    ...resolveSettings(HOUSE_DEFAULTS, PERSONAL_DEFAULTS),
    look: options.look,
    scope: options.dashboards ? 'dashboards' : 'everywhere',
    statuses: options.statuses,
  };
  const engine = new LookEngine(document, () => new CSSStyleSheet(), undefined);
  // as the bundle's look applies it: the cards look again for their theme when it moved
  const apply = (): void => {
    if (engine.apply(settings, dark)) resyncCardThemes();
  };
  apply();
  watchThemes(document, () => engine.themedSheet(), resyncCardThemes);
  Object.assign(window, {
    fluvyApplyTheme: (element: HTMLElement, name?: string) => applyTheme(element, name, dark),
    fluvyLook: (next: { look?: Look; dark?: boolean }) => {
      settings = { ...settings, ...(next.look ? { look: next.look } : {}) };
      dark = next.dark ?? dark;
      apply();
    },
  });
  let wrapper = root;
  if (root.localName === 'hui-root') {
    if (!customElements.get('hui-view-container'))
      customElements.define('hui-view-container', MockViewContainer);
    await (root as LitElement).updateComplete;
    const shadow = root.shadowRoot as ShadowRoot;
    const view = shadow.querySelector('#view') as MockViewContainer;
    await view.updateComplete;
    wrapper = view;
    if (options.dashboards) {
      adoptLast(shadow, engine.panelSheet);
      root.setAttribute(PANEL_ATTRIBUTE, '');
    }
    // the cards went in before the view was drawn: they look for their theme in it, as Home Assistant's connect in a
    // drawn view
    resyncCardThemes();
  }
  applyTheme(wrapper, options.theme, dark);
}
