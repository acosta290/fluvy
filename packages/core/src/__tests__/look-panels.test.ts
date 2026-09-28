// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PANEL_ATTRIBUTE } from '../look/attributes.js';
import { markPanels, patchEditDialog } from '../look/panels.js';

describe('the card editor dialog', () => {
  it('wears the look of the dashboard it was opened on, as its panel does', async () => {
    class Dialog extends HTMLElement {
      hass?: { panelUrl?: string };
      updates = 0;
      updated(): void {
        this.updates += 1;
      }
    }
    customElements.define('hui-dialog-edit-card', Dialog);
    const wears = (urlPath: string | undefined): boolean => urlPath === 'fluvy-auto';
    expect(await patchEditDialog(customElements, wears)).toBe(true);
    const dialog = document.createElement('hui-dialog-edit-card') as Dialog;
    document.body.append(dialog);
    dialog.hass = { panelUrl: 'fluvy-auto' };
    dialog.updated();
    expect(dialog.updates).toBe(1); // Home Assistant's own update still runs
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(true);
    dialog.hass = { panelUrl: 'lovelace' };
    dialog.updated();
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(false);
    // the settings changed: the open dialog is marked again with the panels
    dialog.hass = { panelUrl: 'fluvy-auto' };
    markPanels(document, wears);
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(true);
    dialog.remove();
  });
});
