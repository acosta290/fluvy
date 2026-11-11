// @vitest-environment happy-dom
import { mdiCog } from '@mdi/js';
import { css, html, LitElement } from 'lit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { ICON_PATHS } from '../icons/generated.js';
import { startLook } from '../look/start.js';
import { ORIGINAL_ICONS, sidebarIconsCss } from '../shell/css/chrome.js';
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

/** Home Assistant's icon, told a path; the shell draws a Material path it knows as our glyph. */
class FakeSvgIcon extends LitElement {
  static override properties = { path: {} };
  declare path?: string;
}

/** Home Assistant's Settings list, whose icon circles and Material icons are Settings' icon choice. */
class FakeConfigList extends LitElement {
  protected override render() {
    return html`<div class="icon-background"><ha-svg-icon .path=${mdiCog}></ha-svg-icon></div>`;
  }
}

/** Home Assistant's sidebar: Settings' item, whose glyph and Material icon are the sidebar's icon choice. */
class FakeSidebar extends LitElement {
  protected override render() {
    return html`<ha-list-item-button id="sidebar-config"
      ><ha-svg-icon slot="start" .path=${mdiCog}></ha-svg-icon
    ></ha-list-item-button>`;
  }
}

const sheetOf = (root: ShadowRoot | null | undefined, marker: string): CSSStyleSheet | undefined =>
  root?.adoptedStyleSheets.find((sheet) =>
    [...sheet.cssRules].some((rule) => rule.cssText.includes(marker)),
  );

describe('shell on real Lit classes', () => {
  let before: FakeHeader;
  let list: FakeConfigList;
  let sidebar: FakeSidebar;
  let shell: ReturnType<typeof startShell>;
  beforeAll(async () => {
    customElements.define('ha-dialog-header', FakeHeader);
    customElements.define('ha-svg-icon', FakeSvgIcon);
    customElements.define('ha-config-navigation-list', FakeConfigList);
    customElements.define('ha-sidebar', FakeSidebar);
    before = document.createElement('ha-dialog-header') as FakeHeader;
    list = document.createElement('ha-config-navigation-list') as FakeConfigList;
    sidebar = document.createElement('ha-sidebar') as FakeSidebar;
    document.body.append(before, list, sidebar);
    await before.updateComplete;
    await list.updateComplete;
    await sidebar.updateComplete;
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

  /**
   * What each place draws now: whether the sidebar's glyphs and Settings' circles are filled, and the path of the
   * Material icon in each (ours, `gear`, or Home Assistant's cog).
   */
  const drawn = (): (boolean | string | undefined)[] => {
    const path = (host: Element): string | undefined =>
      host.shadowRoot?.querySelector<FakeSvgIcon>('ha-svg-icon')?.path;
    const glyphs = sheetOf(sidebar.shadowRoot, 'sidebar-notifications');
    const circles = sheetOf(list.shadowRoot, 'data-fluvy-glyph');
    return [glyphs !== undefined, circles !== undefined, path(sidebar), path(list)];
  };
  const GEAR = ICON_PATHS['gear'];

  it('keeps Home Assistant’s own icons where the house chooses them, each place on its own, and nothing else changes', async () => {
    const header = sheetOf(before.shadowRoot, 'header-title') as CSSStyleSheet;
    const html = document.documentElement;
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
    expect(drawn()).toEqual([true, true, GEAR, GEAR]);
    // the sidebar ours, Settings Home Assistant's: its circles and its Material icons
    html.setAttribute(ORIGINAL_ICONS, 'settings');
    await settle();
    expect(drawn()).toEqual([true, false, GEAR, mdiCog]);
    // the reverse: the gear of the sidebar's Settings item is Home Assistant's cog
    html.setAttribute(ORIGINAL_ICONS, 'sidebar');
    await settle();
    expect(drawn()).toEqual([false, true, mdiCog, GEAR]);
    html.setAttribute(ORIGINAL_ICONS, 'sidebar settings');
    await settle();
    expect(drawn()).toEqual([false, false, mdiCog, mdiCog]);
    expect(header.cssRules.length).toBeGreaterThan(0);
    // an icon Home Assistant draws while its place keeps its own stays its own
    const late = list.shadowRoot!.appendChild(document.createElement('ha-svg-icon') as FakeSvgIcon);
    late.path = mdiCog;
    await late.updateComplete;
    expect(late.path).toBe(mdiCog);
    late.remove();
    html.removeAttribute(ORIGINAL_ICONS);
    await settle();
    expect(drawn()).toEqual([true, true, GEAR, GEAR]);
  });

  it('takes each place’s choice from the house’s settings, as the look says it on the page', async () => {
    const look = startLook();
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    look?.preview({ icons: { sidebar: true, settings: false } });
    await settle();
    expect(document.documentElement.getAttribute(ORIGINAL_ICONS)).toBe('settings');
    expect(drawn()).toEqual([true, false, GEAR, mdiCog]);
    look?.preview({ icons: { sidebar: false, settings: true } });
    await settle();
    expect(document.documentElement.getAttribute(ORIGINAL_ICONS)).toBe('sidebar');
    expect(drawn()).toEqual([false, true, mdiCog, GEAR]);
    // the house's own (ours in both, as before 1.19): nothing said
    look?.preview(null);
    await settle();
    expect(document.documentElement.hasAttribute(ORIGINAL_ICONS)).toBe(false);
    expect(drawn()).toEqual([true, true, GEAR, GEAR]);
    look?.stop();
  });

  it('reports the class as attached, the instances it styles and its probe found', () => {
    const report = shell?.report();
    const header = report?.sheets.find((entry) => entry.id === 'dialog-header');
    expect(report?.active).toBe(true);
    expect(header).toMatchObject({ attached: true, instances: 2, probe: true });
  });
});

describe('the sidebar’s glyphs', () => {
  /** What the rules of the sidebar's icon sheet reach in a sidebar drawn as Home Assistant 2026.9 to 2026.11 draw it. */
  const reached = (markup: string): string[] => {
    const nav = document.createElement('nav');
    nav.innerHTML = markup;
    document.body.append(nav);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sidebarIconsCss);
    const hit = new Set<string>();
    for (const rule of sheet.cssRules)
      if (rule instanceof CSSStyleRule)
        for (const element of nav.querySelectorAll(rule.selectorText))
          hit.add(`${element.parentElement?.id} ${element.localName}`);
    nav.remove();
    return [...hit].sort();
  };

  it('paint the icons alone: the count of Settings and the notifications keeps its figures (#86)', () => {
    expect(
      reached(`
        <ha-list-item-button id="sidebar-panel-history" class="selected">
          <ha-svg-icon slot="start"></ha-svg-icon><span slot="headline">History</span>
        </ha-list-item-button>
        <ha-list-item-button id="sidebar-panel-5c53de3b_esphome">
          <ha-icon slot="start"></ha-icon><span slot="headline">ESPHome</span>
        </ha-list-item-button>
        <ha-list-item-button id="sidebar-config">
          <ha-svg-icon slot="start"></ha-svg-icon><span class="badge" slot="start">3</span>
          <span slot="headline">Settings</span><span class="badge" slot="end">3</span>
        </ha-list-item-button>
        <ha-list-item-button id="sidebar-notifications">
          <ha-svg-icon slot="start"></ha-svg-icon><span class="badge" slot="start">1</span>
          <span slot="headline">Notifications</span><span class="badge" slot="end">1</span>
        </ha-list-item-button>`),
    ).toEqual([
      'sidebar-config ha-svg-icon',
      'sidebar-notifications ha-svg-icon',
      'sidebar-panel-5c53de3b_esphome ha-icon',
      'sidebar-panel-history ha-svg-icon',
    ]);
  });
});
