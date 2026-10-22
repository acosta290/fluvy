// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { PANEL_ATTRIBUTE } from '../look/attributes.js';
import { markPanels, patchEditDialog, patchLovelacePanels } from '../look/panels.js';

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
    let moved = 0;
    expect(await patchEditDialog(customElements, wears, () => (moved += 1))).toBe(true);
    const dialog = document.createElement('hui-dialog-edit-card') as Dialog;
    document.body.append(dialog);
    dialog.hass = { panelUrl: 'fluvy-auto' };
    dialog.updated();
    expect(dialog.updates).toBe(1); // Home Assistant's own update still runs
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(true);
    // the preview inside looks for the theme again when the mark moves, and only then (#40)
    expect(moved).toBe(1);
    dialog.updated();
    expect(moved).toBe(1);
    dialog.hass = { panelUrl: 'lovelace' };
    dialog.updated();
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(false);
    expect(moved).toBe(2);
    // the settings changed: the open dialog is marked again with the panels, and that is a change of its own
    dialog.hass = { panelUrl: 'fluvy-auto' };
    expect(markPanels(document, wears)).toBe(true);
    expect(dialog.hasAttribute(PANEL_ATTRIBUTE)).toBe(true);
    expect(markPanels(document, wears)).toBe(false);
    dialog.remove();
  });
});

describe('a dashboard panel', () => {
  class Panel extends HTMLElement {
    panel?: { url_path?: string };
    updates = 0;
    updated(): void {
      this.updates += 1;
    }
  }

  it('is marked after Home Assistant’s update on any page, and steps aside when ours throws', async () => {
    customElements.define('ha-panel-lovelace', Panel);
    let wears = (urlPath: string | undefined): boolean => urlPath === 'fluvy-home';
    let moved = 0;
    expect(
      await patchLovelacePanels(
        customElements,
        (url) => wears(url),
        () => (moved += 1),
      ),
    ).toBe(true);
    const panel = document.body.appendChild(new Panel());
    panel.panel = { url_path: 'fluvy-home' };
    panel.updated();
    expect([panel.updates, panel.hasAttribute(PANEL_ATTRIBUTE), moved]).toEqual([1, true, 1]);
    // the next dashboard does not wear the look (and the page wears another theme): the mark comes off
    panel.panel = { url_path: 'lovelace' };
    panel.updated();
    expect([panel.updates, panel.hasAttribute(PANEL_ATTRIBUTE), moved]).toEqual([2, false, 2]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    wears = () => {
      throw new Error('settings unreadable');
    };
    panel.updated();
    panel.updated();
    expect(panel.updates).toBe(4);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[fluvy\] lovelacePanels stepped aside/);
    warn.mockRestore();
  });
});
