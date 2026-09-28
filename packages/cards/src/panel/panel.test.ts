// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  SettingsStore,
  type EffectiveSettings,
  type HomeAssistant,
  type LookHandle,
  type SettingsHass,
} from '@fluvy/core';
import { exportSettings, importSettings } from './actions.js';
import type { PanelContext } from './model.js';
import type { FluvyPanel } from './panel.js';

/** A Home Assistant that keeps fluvy's settings in memory and answers the panel's dashboard questions. */
function fixture(admin = true, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { system: null, user: null };
  const subscribers: Record<string, Set<(message: { value: unknown }) => void>> = {
    system: new Set(),
    user: new Set(),
  };
  const layer = (type: string) => (type.includes('system') ? 'system' : 'user');
  const written: { type: string; value: unknown }[] = [];
  const storage = {
    connection: {
      subscribeMessage: async (
        callback: (m: { value: unknown }) => void,
        message: { type: string },
      ) => {
        subscribers[layer(message.type)]!.add(callback);
        callback({ value: data[layer(message.type)] });
        return () => undefined;
      },
    },
    callWS: async (message: { type: string; value: unknown }) => {
      written.push(message);
      data[layer(message.type)] = message.value;
      for (const listener of subscribers[layer(message.type)]!) listener({ value: message.value });
    },
  } as unknown as SettingsHass;
  const store = new SettingsStore(() => storage, undefined);
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  const previews: unknown[] = [];
  const handle: LookHandle = {
    store,
    settings: () => store.effective,
    preview: (look) => void previews.push(look),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop: () => undefined,
  };
  store.start((settings) => listeners.forEach((listener) => listener(settings)));
  const hass = {
    language: 'en',
    locale: { language: 'en' },
    themes: { darkMode: false },
    states: {},
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'U', is_admin: admin },
    config: { unit_system: { temperature: '°C', length: 'km' }, time_zone: 'Europe/Madrid' },
    callService: async () => undefined,
    panels: {
      lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
      'fluvy-auto': {
        component_name: 'lovelace',
        url_path: 'fluvy-auto',
        title: 'Fluvy auto',
        icon: 'fluvy:sun',
      },
    },
    localize: (key: string) => key,
    callWS: async (message: { type: string; url_path?: string | null }) =>
      message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
        ? { strategy: { type: 'custom:fluvy-home' } }
        : { views: [] },
    formatEntityState: (s: { state: string }) => s.state,
    ...extra,
  } as unknown as HomeAssistant;
  return { handle, hass, written, previews };
}

async function mount(admin = true, extra: Record<string, unknown> = {}) {
  await import('./define.js');
  const f = fixture(admin, extra);
  const panel = document.createElement('fluvy-panel') as HTMLElement & {
    hass: HomeAssistant;
    handle: LookHandle;
    tab: string;
    updateComplete: Promise<boolean>;
  };
  panel.handle = f.handle;
  panel.hass = f.hass;
  document.body.append(panel);
  await panel.updateComplete;
  const root = panel.shadowRoot!;
  const swatch = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.pn-swatch')].find(
      (b) => b.querySelector('.pn-swatch__name')?.textContent?.trim() === name,
    )!;
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.pn-bar button')].find(
      (b) => b.textContent?.trim() === text,
    );
  const row = (title: string) =>
    [...root.querySelectorAll<HTMLElement>('.fv-row')].find(
      (r) => r.querySelector('.fv-row__title')?.textContent?.trim() === title,
    );
  const chip = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('.fv-chip')].find((c) => c.textContent?.trim() === text);
  /** Opens the tab's dropdown and chooses the row with this name, as a finger would. */
  const pick = async (name: string) => {
    const select = root.querySelector('fluvy-select')!;
    const inside = select.shadowRoot!;
    inside.querySelector<HTMLButtonElement>('.fv-select')!.click();
    await select.updateComplete;
    [...inside.querySelectorAll<HTMLElement>('.fv-menu__item')]
      .find((r) => r.querySelector('.fv-menu__name')?.textContent?.trim() === name)!
      .click();
    await select.updateComplete;
  };
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
  };
  return { ...f, panel, root, swatch, button, row, chip, pick, settle };
}

describe('the settings panel', () => {
  it('shows the house’s look chosen, and a picked palette as pending until it is applied', async () => {
    const { panel, root, swatch, written } = await mount();
    expect(swatch('Linen').classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-bar')).toBeNull();
    swatch('Volt').click();
    await panel.updateComplete;
    expect(swatch('Volt').classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-bar')).not.toBeNull();
    expect(written).toEqual([]);
    panel.remove();
  });

  it('applies the chosen look to the house', async () => {
    const { panel, swatch, button, written, handle } = await mount();
    swatch('Blaze').click();
    await panel.updateComplete;
    button('Apply to the house')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    expect(handle.settings().look.palette).toBe('blaze');
    panel.remove();
  });

  it('names the change it would apply, and keeps offering it on every tab', async () => {
    const { panel, root, swatch } = await mount();
    swatch('Volt').click();
    await panel.updateComplete;
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Linen → Volt');
    panel.tab = 'about';
    await panel.updateComplete;
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Linen → Volt');
    panel.remove();
  });

  it('wears the look being chosen on the whole panel', async () => {
    const { panel, root, swatch } = await mount();
    const accent = () =>
      [...(root as ShadowRoot).adoptedStyleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .map((rule) => rule.cssText)
        .find((text) => /^:host\s*\{/.test(text) && text.includes('--fluvy-accent:'));
    const before = accent();
    swatch('Blaze').click();
    await panel.updateComplete;
    expect(accent()).toBeDefined();
    expect(accent()).not.toBe(before);
    panel.remove();
  });

  it('offers a person who is not an admin one way to apply: for themselves', async () => {
    const { panel, swatch, button } = await mount(false);
    swatch('Mint').click();
    await panel.updateComplete;
    expect(button('Apply to the house')).toBeUndefined();
    expect(button('Only for me')).toBeUndefined();
    expect(button('Apply for me')?.classList.contains('fv-btn--accent')).toBe(true);
    panel.remove();
  });

  it('tells someone who is not an admin the truth about the dashboards', async () => {
    const { panel, root, row } = await mount(false);
    panel.tab = 'dashboard';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
    expect(row('Fluvy auto')).toBeDefined();
    expect(root.textContent).not.toContain('Not created yet');
    panel.tab = 'scope';
    await panel.updateComplete;
    // their own Overview under its Home Assistant name, and the automatic dashboard, as they are
    expect(row('Overview')).toBeDefined();
    expect(row('Fluvy auto')?.querySelector('.fv-switch')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    panel.tab = 'dashboard';
    await panel.updateComplete;
    // the sidebar switch is an administrator's
    expect(row('Show in the sidebar')).toBeUndefined();
    panel.remove();
  });

  it('lists the automatic dashboard in the sidebar, or takes its entry out', async () => {
    const updates: Record<string, unknown>[] = [];
    const { panel, row, settle } = await mount(true, {
      callWS: async (message: { type: string; url_path?: string | null }) => {
        if (message.type === 'lovelace/dashboards/update') {
          updates.push(message);
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') {
          return [
            {
              id: 'fluvy_auto',
              url_path: 'fluvy-auto',
              title: 'Fluvy auto',
              icon: 'fluvy:sun',
              show_in_sidebar: updates.length === 0,
            },
          ];
        }
        return message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
          ? { strategy: { type: 'custom:fluvy-home' } }
          : { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    const sidebar = row('Show in the sidebar')!;
    expect(sidebar.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    sidebar.querySelector<HTMLElement>('.fv-hit')!.click();
    await settle();
    await settle();
    expect(updates).toEqual([
      { type: 'lovelace/dashboards/update', dashboard_id: 'fluvy_auto', show_in_sidebar: false },
    ]);
    // the list answers again, and the row shows it
    expect(
      row('Show in the sidebar')?.querySelector('.fv-switch')?.getAttribute('aria-checked'),
    ).toBe('false');
    panel.remove();
  });

  it('lets the house keep Home Assistant’s own icons in its menus, shown before it is saved', async () => {
    const { panel, root, row, button, written, handle, previews, settle } = await mount();
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await panel.updateComplete;
    const icons = row('Our icons in the menus');
    expect(icons?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    const saves = written.length;
    icons?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    // an edit: on the screen at once, saved only from the bar
    expect(written.length).toBe(saves);
    expect(previews.at(-1)).toEqual({ icons: false });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Our icons in the menus · Off',
    );
    button('Save')!.click();
    await settle();
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    expect(handle.settings().icons).toBe(false);
    // Home Assistant handed the saved value back: nothing is pending (the bar is on its way out), nothing previewed
    expect(root.querySelector('.pn-foot:not(.is-leaving) .pn-bar')).toBeNull();
    expect(previews.at(-1)).toBeNull();
    panel.remove();
  });

  it('lets the house keep Home Assistant’s own Activity page', async () => {
    const { panel, root, row, button, handle, previews, settle } = await mount();
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await panel.updateComplete;
    const activity = row('Our Activity view');
    expect(activity?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    activity?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    expect(previews.at(-1)).toEqual({ activity: false });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Our Activity view · Off',
    );
    button('Save')!.click();
    await settle();
    expect(handle.settings().activity).toBe(false);
    panel.remove();
  });

  it('shows a language on the panel before it is saved, and discards it back', async () => {
    const { panel, root, pick, button, written, previews, settle } = await mount();
    panel.tab = 'preferences';
    await panel.updateComplete;
    const shown = () =>
      root
        .querySelector('fluvy-select')
        ?.shadowRoot?.querySelector('.fv-select__value')
        ?.textContent?.trim();
    expect(shown()).toBe('Automatic');
    await pick('Español');
    await settle();
    expect(written).toEqual([]);
    expect(previews.at(-1)).toEqual({ language: 'es' });
    // the panel speaks the chosen language as soon as its words arrive (a chunk of their own)
    expect(shown()).toBe('Español');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toMatch(
      /^(Language|Idioma) · Español$/,
    );
    (button('Descartar') ?? button('Discard'))!.click();
    await settle();
    expect(previews.at(-1)).toBeNull();
    expect(shown()).toBe('Automatic');
    panel.remove();
  });

  it('says why only on dashboards cannot hold while the profile wears the Fluvy theme', async () => {
    const { panel, root, settle } = await mount(true, {
      selectedTheme: { theme: 'Fluvy' },
      themes: { darkMode: false, theme: 'Fluvy', default_theme: 'default', themes: {} },
    });
    panel.tab = 'scope';
    await settle();
    expect(root.querySelector('.pn-note')?.textContent).toContain(
      'Your profile uses the Fluvy theme',
    );
    const asked: unknown[] = [];
    panel.addEventListener('settheme', (event) => asked.push((event as CustomEvent).detail));
    root.querySelector<HTMLButtonElement>('.pn-note .fv-btn')!.click();
    expect(asked).toEqual([{ theme: '' }]);
    panel.remove();
  });

  it('says a theme of their own keeps Home Assistant, and offers the Fluvy theme', async () => {
    const { panel, root, handle, settle } = await mount(true, {
      selectedTheme: { theme: 'default' },
      themes: { darkMode: false, theme: 'default', default_theme: 'default', themes: {} },
    });
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await settle();
    expect(root.querySelector('.pn-note')?.textContent).toContain('Your theme is Home Assistant');
    const asked: unknown[] = [];
    panel.addEventListener('settheme', (event) => asked.push((event as CustomEvent).detail));
    root.querySelector<HTMLButtonElement>('.pn-note .fv-btn')!.click();
    expect(asked).toEqual([{ theme: 'Fluvy' }]);
    panel.remove();
  });

  it('offers the accents of the style chosen, and keeps a listed one’s place when the style changes', async () => {
    const { panel, root, settle } = await mount();
    (panel as unknown as { draft: unknown }).draft = {
      palette: { character: 'vivid', base: 'cool', accent: '#ff4a1a', fill: 'tint' },
      shape: 'soft',
      pills: 'round',
    };
    await settle();
    const dots = () =>
      [...root.querySelectorAll<HTMLElement>('.pn-card .pn-dots')][0]!.querySelectorAll('.pn-dot');
    expect(dots()[2]?.getAttribute('aria-label')).toBe('#ff4a1a');
    expect(dots()[2]?.getAttribute('aria-pressed')).toBe('true');
    [...root.querySelectorAll<HTMLElement>('.fv-chip')]
      .find((c) => c.textContent?.trim() === 'Pastel')!
      .click();
    await settle();
    expect(dots()[2]?.getAttribute('aria-label')).toBe('#f9c09e');
    expect(dots()[2]?.getAttribute('aria-pressed')).toBe('true');
    panel.remove();
  });

  it('saves the buttons’ roundness with the look', async () => {
    const { panel, root, button, handle, settle } = await mount();
    [...root.querySelectorAll<HTMLElement>('.fv-option')]
      .find((o) => o.textContent?.includes('Crisp') && o.textContent.includes('6'))!
      .click();
    await settle();
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Pill → Crisp');
    button('Apply to the house')!.click();
    await settle();
    expect(handle.settings().look.pills).toBe('crisp');
    panel.remove();
  });

  it('resets the house only on a second tap, and says so after the first', async () => {
    const { panel, row, written } = await mount();
    panel.tab = 'about';
    await panel.updateComplete;
    row('Reset the house’s settings')!.click();
    await panel.updateComplete;
    expect(row('Tap again to reset')).toBeDefined();
    expect(written).toEqual([]);
    row('Tap again to reset')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    panel.remove();
  });

  it('exports every setting and the automatic dashboard’s options, and imports them back', async () => {
    const saved: { type: string; url_path?: string; config?: unknown }[] = [];
    const strategy = { type: 'custom:fluvy-home', thermostat_variant: 'ruler', hide: ['media'] };
    const { panel, handle, settle } = await mount(true, {
      callWS: async (message: { type: string; url_path?: string | null; config?: unknown }) => {
        if (message.type === 'lovelace/config/save') saved.push(message as never);
        return message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
          ? { strategy }
          : { views: [] };
      },
    });
    await handle.store.saveHouse({ palette: 'volt', shape: 'round', pills: 'soft', frame: false });
    await handle.store.savePersonal({ language: 'es', haptics: false });
    await settle();
    // the file the browser would download
    let file: Blob | undefined;
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => ((file = blob), 'blob:fluvy');
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    const ops = panel as unknown as { context(): PanelContext };
    exportSettings(panel as unknown as FluvyPanel, ops.context());
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    const exported = JSON.parse(await file!.text()) as Record<string, Record<string, unknown>>;
    expect(exported['fluvy']).toBe(1);
    expect(exported['house']).toMatchObject({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      frame: false,
    });
    expect(exported['personal']).toMatchObject({ language: 'es', haptics: false });
    expect(exported['dashboard']).toEqual({ thermostat_variant: 'ruler', hide: ['media'] });
    // another house, reset; the file brings it all back
    await handle.store.saveHouse({ palette: 'linen', shape: 'soft', pills: 'round', frame: true });
    await handle.store.savePersonal({ language: 'auto', haptics: true });
    importSettings(
      panel as unknown as FluvyPanel,
      new File([JSON.stringify(exported)], 'fluvy-settings.json'),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handle.settings().look).toEqual({ palette: 'volt', shape: 'round', pills: 'soft' });
    expect(handle.settings().frame).toBe(false);
    expect(handle.settings().language).toBe('es');
    expect(saved.at(-1)?.config).toEqual({
      strategy: { type: 'custom:fluvy-home', thermostat_variant: 'ruler', hide: ['media'] },
    });
    panel.remove();
  });

  it('attaches to the look when it starts after the panel is made (Home Assistant makes it first)', async () => {
    await import('./define.js');
    const f = fixture();
    const panel = document.createElement('fluvy-panel') as HTMLElement & {
      hass: HomeAssistant;
      handle: LookHandle;
      updateComplete: Promise<boolean>;
    };
    document.body.append(panel);
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.pn-card')).toBeNull();
    panel.handle = f.handle;
    panel.hass = f.hass;
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.pn-card')).not.toBeNull();
    panel.remove();
  });

  it('ends a look tried on the whole app when the panel closes', async () => {
    const { panel, root, previews } = await mount();
    const toggle = root.querySelector<HTMLElement>('.fv-switch, [role="switch"]');
    toggle?.click();
    await panel.updateComplete;
    expect(previews.at(-1)).toEqual({ look: { palette: 'linen', shape: 'soft', pills: 'round' } });
    panel.remove();
    expect(previews.at(-1)).toBeNull();
  });
});
