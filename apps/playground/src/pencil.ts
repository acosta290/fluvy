import type { HomeAssistant } from '@fluvy/core';
import { defineFormStub } from './ha-form.js';

type Config = Record<string, unknown>;
type Editor = HTMLElement & { hass?: HomeAssistant; setConfig(config: Config): void };

declare global {
  interface Window {
    /** What the pencil's dialog holds: the strategy's configuration as the form last said it. */
    fluvyPencil?: { config: Config };
  }
}

/**
 * Home Assistant's "Edit dashboard" dialog as the playground stands it in (`?panel=dashboard&state=pencil`), for
 * what its pencil opens on one of Fluvy's automatic dashboards: the dialog's surface and its title over the
 * dashboard's name, and in it the editor the strategy answers with, asked for as Home Assistant asks
 * (`getConfigElement` of `ll-strategy-dashboard-fluvy-home`). What the form says is handed back to it and kept on the
 * page (`window.fluvyPencil`), as the dialog holds it until Save.
 */
export async function mountPencil(stage: HTMLElement, hass: HomeAssistant): Promise<void> {
  defineFormStub();
  const dialog = document.createElement('section');
  dialog.className = 'pg-dialog';
  dialog.innerHTML =
    '<header><p class="pg-dialog__title">Edit dashboard</p><p class="pg-dialog__sub">Fluvy auto</p></header>';
  stage.classList.add('pg-pencil');
  stage.append(dialog);
  const strategy = customElements.get('ll-strategy-dashboard-fluvy-home') as unknown as {
    getConfigElement(): Promise<Editor>;
  };
  const editor = await strategy.getConfigElement();
  const held = { config: { type: 'custom:fluvy-home', hide: ['agenda'] } as Config };
  window.fluvyPencil = held;
  // the dialog was opened on the dashboard the page shows: its url path is the panel's
  editor.hass = { ...hass, panelUrl: 'fluvy-auto' } as HomeAssistant;
  editor.setConfig(held.config);
  editor.addEventListener('config-changed', (event) => {
    held.config = (event as CustomEvent<{ config: Config }>).detail.config;
    editor.setConfig(held.config);
  });
  dialog.append(editor);
}
