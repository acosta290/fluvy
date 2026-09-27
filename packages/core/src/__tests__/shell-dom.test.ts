// @vitest-environment happy-dom
import { css, html, LitElement } from 'lit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { ORIGINAL_ICONS } from '../shell/css/chrome.js';
import { startShell } from '../shell/index.js';

/*
 * The one test of the shell against real Lit classes in a DOM: `ha-dialog-header` stands in for Home
 * Assistant's (a Lit element with its own static styles, finalised and rendered before the shell starts;
 * chosen because its sheet uses selectors happy-dom's CSS parser keeps — it drops `::slotted`), so the
 * mechanism the registry relies on — a sheet pushed into `elementStyles` reaches instances created
 * later, the live ones adopt it once, the theme switch fills and empties it — runs as it does in HA.
 */
class FakeHeader extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;
  protected override render() {
    return html`<span class="header-title">Title</span>`;
  }
}

/** Home Assistant's Settings list, whose icon circles are one of the house's icon choices. */
class FakeConfigList extends LitElement {
  protected override render() {
    return html`<div class="icon-background"></div>`;
  }
}

const sheetOf = (root: ShadowRoot | null | undefined, marker: string): CSSStyleSheet | undefined =>
  root?.adoptedStyleSheets.find((sheet) =>
    [...sheet.cssRules].some((rule) => rule.cssText.includes(marker)),
  );

describe('shell on real Lit classes', () => {
  let before: FakeHeader;
  let list: FakeConfigList;
  let shell: ReturnType<typeof startShell>;
  beforeAll(async () => {
    customElements.define('ha-dialog-header', FakeHeader);
    customElements.define('ha-config-navigation-list', FakeConfigList);
    before = document.createElement('ha-dialog-header') as FakeHeader;
    list = document.createElement('ha-config-navigation-list') as FakeConfigList;
    document.body.append(before, list);
    await before.updateComplete;
    await list.updateComplete;
    document.documentElement.style.setProperty(THEME_SENTINEL, '1');
    shell = startShell();
  });
  afterAll(() => shell?.stop());

  it('attaches its sheet to the class and to the instance already on the page', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // whenDefined, then the batched microtask
    const klass = customElements.get('ha-dialog-header') as unknown as { elementStyles: unknown[] };
    expect(klass.elementStyles.some((entry) => entry instanceof CSSStyleSheet)).toBe(true);
    expect(sheetOf(before.shadowRoot, 'header-title')).toBeDefined();
  });

  it('reaches an instance created after it started, last among its sheets', async () => {
    const after = document.createElement('ha-dialog-header') as FakeHeader;
    document.body.append(after);
    await after.updateComplete;
    const sheets = after.shadowRoot?.adoptedStyleSheets ?? [];
    expect(sheetOf(after.shadowRoot, 'header-title')).toBe(sheets[sheets.length - 1]);
  });

  it('empties every sheet when the theme goes and fills them again when it returns', async () => {
    const sheet = sheetOf(before.shadowRoot, 'header-title') as CSSStyleSheet;
    document.documentElement.style.removeProperty(THEME_SENTINEL);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sheet.cssRules.length).toBe(0);
    document.documentElement.style.setProperty(THEME_SENTINEL, '1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sheet.cssRules.length).toBeGreaterThan(0);
  });

  it('keeps Home Assistant’s own icons when the house chooses them, and nothing else changes', async () => {
    const icons = sheetOf(list.shadowRoot, 'icon-background') as CSSStyleSheet;
    const header = sheetOf(before.shadowRoot, 'header-title') as CSSStyleSheet;
    expect(icons.cssRules.length).toBeGreaterThan(0);
    document.documentElement.toggleAttribute(ORIGINAL_ICONS, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(icons.cssRules.length).toBe(0);
    expect(header.cssRules.length).toBeGreaterThan(0);
    document.documentElement.toggleAttribute(ORIGINAL_ICONS, false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(icons.cssRules.length).toBeGreaterThan(0);
  });

  it('reports the class as attached, the instances it styles and its probe found', () => {
    const report = shell?.report();
    const header = report?.sheets.find((entry) => entry.id === 'dialog-header');
    expect(report?.active).toBe(true);
    expect(header).toMatchObject({ attached: true, instances: 2, probe: true });
  });
});
