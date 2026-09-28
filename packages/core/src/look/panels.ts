import { walkShadow } from '../shell/dom.js';
import { PANEL_ATTRIBUTE } from './attributes.js';

interface PanelPrototype {
  updated?: (changed: unknown) => void;
  __fluvyLook?: true;
}

type PanelElement = HTMLElement & { panel?: { url_path?: string } };
/** Home Assistant's card editor dialog: it knows which panel it was opened on through `hass.panelUrl`. */
type DialogElement = HTMLElement & { hass?: { panelUrl?: string } };

type Wears = (urlPath: string | undefined) => boolean;

/** Marks one panel from its dashboard's url path; true when the mark changed. */
function mark(panel: PanelElement, wears: Wears): boolean {
  const on = wears(panel.panel?.url_path);
  if (panel.hasAttribute(PANEL_ATTRIBUTE) === on) return false;
  panel.toggleAttribute(PANEL_ATTRIBUTE, on);
  return true;
}

/**
 * Keeps every dashboard panel marked: `ha-panel-lovelace`'s one update method is wrapped (a panel is
 * reused from dashboard to dashboard, so each update re-reads its url path); `changed` runs when a mark
 * moves, so the cards inside look for the theme again. False if Home Assistant
 * reshaped the element: the `dashboards` scope then does nothing, and `everywhere` still works.
 */
export async function patchLovelacePanels(
  registry: CustomElementRegistry,
  wears: Wears,
  changed: () => void,
): Promise<boolean> {
  await registry.whenDefined('ha-panel-lovelace');
  const proto = registry.get('ha-panel-lovelace')?.prototype as PanelPrototype | undefined;
  const original = proto?.updated;
  if (!proto || typeof original !== 'function') return false;
  if (!proto.__fluvyLook) {
    proto.updated = function (this: PanelElement, changes: unknown): void {
      original.call(this, changes);
      if (mark(this, wears)) changed();
    };
    proto.__fluvyLook = true;
  }
  return true;
}

/**
 * Keeps the card editor dialog marked as the dashboard it was opened on: the colour picker's swatches then show
 * the palette's colours (they resolve where the dialog lives, outside the panel). Wrapped as the panels are.
 */
export async function patchEditDialog(
  registry: CustomElementRegistry,
  wears: Wears,
): Promise<boolean> {
  await registry.whenDefined('hui-dialog-edit-card');
  const proto = registry.get('hui-dialog-edit-card')?.prototype as PanelPrototype | undefined;
  const original = proto?.updated;
  if (!proto || typeof original !== 'function') return false;
  if (!proto.__fluvyLook) {
    proto.updated = function (this: DialogElement, changes: unknown): void {
      original.call(this, changes);
      this.toggleAttribute(PANEL_ATTRIBUTE, wears(this.hass?.panelUrl));
    };
    proto.__fluvyLook = true;
  }
  return true;
}

/** Re-marks the panels (and an open card editor) on the page now (the settings changed); true when a mark changed. */
export function markPanels(doc: Document, wears: Wears): boolean {
  let changed = false;
  walkShadow(doc, (element) => {
    if (element.localName === 'ha-panel-lovelace' && mark(element as PanelElement, wears))
      changed = true;
    if (element.localName === 'hui-dialog-edit-card') {
      const dialog = element as DialogElement;
      const on = wears(dialog.hass?.panelUrl);
      if (dialog.hasAttribute(PANEL_ATTRIBUTE) !== on) dialog.toggleAttribute(PANEL_ATTRIBUTE, on);
    }
  });
  return changed;
}
