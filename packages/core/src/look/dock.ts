import type { HomeAssistant } from '../ha/types.js';

/*
 * The sidebar beside the page (This device, 1.20, #173, after @maxhayim's "Tablet, horizontal"): on a wide screen it
 * stays hidden until a menu button asks for it, then stands beside the page (the page moves over for it), and the next
 * ask hides it again, where Home Assistant opens a hidden sidebar as a drawer over the page and folds a docked one to
 * its icons. The two states are Home Assistant's own ("Always hide the sidebar", and docked), set through the event its
 * own setting sends (`hass-dock-sidebar`), so the browser remembers the last as it would. Its own file, fetched only
 * where the device chose it (`start.ts`).
 *
 * The ask is Home Assistant's `hass-toggle-menu`, whatever sent it: the header's menu button, the sidebar's, an app's
 * (an add-on panel draws its own), a panel in a frame (it forwards its own), by a tap, a touch or a key. It is caught on
 * its way down, before `home-assistant-main` acts on it; a hold of the sidebar's button (its edit) sends none.
 */

type Dock = 'docked' | 'always_hidden';

/** `home-assistant-main`, as far as its menu goes: whether it draws a phone's drawer, the sidebar's state, the app. */
export type Main = Element & {
  readonly narrow?: boolean;
  readonly hass?: Pick<HomeAssistant, 'dockedSidebar' | 'kioskMode'> & {
    readonly auth?: { readonly external?: { readonly config?: { readonly hasSidebar?: boolean } } };
  };
};

/**
 * What the sidebar becomes on a menu's ask: docked from hidden, hidden from docked or from its icons. Undefined leaves
 * the ask to Home Assistant: a phone's drawer, a kiosk, the companion app's own sidebar (Home Assistant asks the app to
 * show it) and an ask that says which (`open`: the companion app's "show the sidebar").
 */
export function nextDock(main: Main, open: boolean | undefined): Dock | undefined {
  const { hass } = main;
  if (
    !hass ||
    main.narrow ||
    hass.kioskMode ||
    hass.auth?.external?.config?.hasSidebar ||
    open !== undefined
  )
    return undefined;
  return hass.dockedSidebar === 'always_hidden' ? 'docked' : 'always_hidden';
}

const isMain = (target: EventTarget): target is Main =>
  (target as Element).localName === 'home-assistant-main';

/** Answers the menus' asks while `on` says this device chose it; gives back the way to stop. */
export function watchSidebar(on: () => boolean, view: Window = window): () => void {
  const ask = (event: Event): void => {
    if (!on()) return;
    const main = event.composedPath().find(isMain);
    const dock = main && nextDock(main, (event as CustomEvent<{ open?: boolean }>).detail?.open);
    if (!dock) return;
    event.stopImmediatePropagation();
    main.dispatchEvent(
      new CustomEvent('hass-dock-sidebar', { detail: { dock }, bubbles: true, composed: true }),
    );
  };
  view.addEventListener('hass-toggle-menu', ask, true);
  return () => view.removeEventListener('hass-toggle-menu', ask, true);
}
