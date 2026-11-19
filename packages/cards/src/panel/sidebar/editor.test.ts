// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { render } from 'lit';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PanelContext } from '../model.js';
import type { SidebarEditor } from './editor.js';

/*
 * A dashboard's sidebar in the panel on a page that opened on Fluvy's settings panel, a reload on
 * `/fluvy/dashboard/<dashboard>/sidebar`: Home Assistant's card helpers, which bring its stack editor, are not on the
 * window until its dashboards' module loads; the section asks for that module as Home Assistant's router does, and a
 * person's own lists open in the stack editor, not in the YAML field that stands in where there is none.
 */

/** Home Assistant's app as far as its router: `home-assistant` › `home-assistant-main` › `partial-panel-resolver`. */
function app(routes: Record<string, unknown>): void {
  const root = document.createElement('home-assistant');
  const main = document.createElement('home-assistant-main');
  const resolver = Object.assign(document.createElement('partial-panel-resolver'), {
    routerOptions: { routes },
  });
  root.attachShadow({ mode: 'open' }).append(main);
  main.attachShadow({ mode: 'open' }).append(resolver);
  document.body.append(root);
}

/** Home Assistant's stack editor, as the section speaks to it. */
class StackEditor extends HTMLElement {
  hass: unknown;
  lovelace: unknown;
  config: LovelaceCardConfig | undefined;
  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
  }
}

/** Home Assistant's dashboards' module: it puts the card helpers on the window, which build a stack as it does. */
const dashboardsModule = vi.fn(() => {
  window.loadCardHelpers = () =>
    Promise.resolve({
      createCardElement: () => {
        if (!customElements.get('hui-vertical-stack-card'))
          customElements.define(
            'hui-vertical-stack-card',
            class extends HTMLElement {
              static getConfigElement(): Promise<HTMLElement> {
                if (!customElements.get('hui-stack-card-editor'))
                  customElements.define('hui-stack-card-editor', StackEditor);
                return Promise.resolve(document.createElement('hui-stack-card-editor'));
              }
            },
          );
        return document.createElement('hui-vertical-stack-card');
      },
    });
  return Promise.resolve();
});

const CLOCK = { type: 'custom:fluvy-clock-card', face: 'digital' };
const HASS = { language: 'en', states: {}, user: { is_admin: true } } as unknown as HomeAssistant;

/** The panel, as far as the section reads it: one dashboard, whose sidebar is the person's own. */
const context = {
  hass: HASS,
  t: (key: string) => key,
  admin: true,
  wide: false,
  dashboards: [{ urlPath: 'tablet', title: 'Tablet', stored: true }],
  sidebarOf: () => ({ header: [CLOCK] }),
  editSidebar: () => undefined,
} as unknown as PanelContext;

/**
 * The section as the panel makes it, drawn into the page: its module fetched afresh (the stack editor it waits for is
 * the module's, asked for once).
 */
async function section(): Promise<{
  editor: SidebarEditor;
  host: { requestUpdate: Mock; sidebar: Mock };
  drawn: HTMLElement;
  draw: () => void;
}> {
  vi.resetModules();
  const { SidebarEditor: Section } = await import('./editor.js');
  const drawn = document.createElement('div');
  document.body.append(drawn);
  const host = { requestUpdate: vi.fn(), sidebar: vi.fn() };
  const editor = new Section(host);
  return { editor, host, drawn, draw: () => render(editor.render(context, 'tablet'), drawn) };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('a dashboard’s sidebar in a panel that opened cold', () => {
  it('opens a person’s list in its YAML field at once where no stack editor can come', async () => {
    const { editor, drawn, draw } = await section();
    draw();
    expect(drawn.querySelector('.se-yaml')).not.toBeNull();
    expect(drawn.querySelector('.se-stack')).toBeNull();
    editor.dispose();
  });

  it('opens a person’s list in Home Assistant’s stack editor, its dashboards’ module asked for as the router does', async () => {
    app({
      config: { tag: 'ha-panel-config', load: () => Promise.resolve() },
      lovelace: { tag: 'ha-panel-lovelace', load: dashboardsModule },
    });
    const { editor, host, drawn, draw } = await section();
    draw();
    // the stack editor is on its way: the list waits for it, the YAML field does not stand in meanwhile
    expect(drawn.querySelector('.se-yaml')).toBeNull();
    await vi.waitFor(() => expect(host.requestUpdate).toHaveBeenCalled());
    draw();
    expect(dashboardsModule).toHaveBeenCalledTimes(1);
    const stack = drawn.querySelector<StackEditor>('.se-stack hui-stack-card-editor');
    expect(stack?.config).toEqual({ type: 'vertical-stack', cards: [CLOCK] });
    expect(drawn.querySelector('.se-yaml')).toBeNull();
    editor.dispose();
  });
});
