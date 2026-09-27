/** The settings panel's address (the integration registers it at `/fluvy`), and nothing that merely starts with it (`/fluvy-home`). */
const PANEL = /^\/fluvy(\/|$)/;

let loading: Promise<unknown> | undefined;

/** The panel's own file, fetched once. */
export const loadPanel = (): Promise<unknown> => (loading ??= import('./define.js'));

/**
 * The settings panel is its own file, fetched when its page is opened — every other page never pays for it. Home
 * Assistant creates the panel's element once the module has loaded; if the definition arrives after that, the element
 * upgrades in place and keeps what Home Assistant already handed it (its `hass`, `route`, `panel`, `narrow`).
 */
export function panelOnDemand(win: Window = window): void {
  const check = (): void => {
    if (PANEL.test(win.location.pathname)) void loadPanel();
  };
  check();
  win.addEventListener('location-changed', check);
  win.addEventListener('popstate', check);
}
