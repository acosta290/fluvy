import { PANEL_TABS, type PanelTab } from './state.js';

/**
 * What Home Assistant would do and the demo cannot: a card asking for an entity's more-info dialog, a tab or a
 * chevron navigating to a page. The demo says so in a notice and stays where it is; the panel's own tabs
 * (`/fluvy/<tab>`) become the demo's view.
 */
export interface BridgeHooks {
  moreInfo(entityId: string): void;
  panelTab(tab: PanelTab): void;
  navigate(path: string): void;
  /** Puts the demo's own URL back after a `history.pushState` a card made. */
  restoreUrl(): void;
}

export function installBridges(hooks: BridgeHooks): () => void {
  const onMoreInfo = (event: Event): void => {
    const entityId = (event as CustomEvent<{ entityId?: string }>).detail?.entityId;
    if (entityId) hooks.moreInfo(entityId);
  };
  const onLocation = (): void => {
    const segments = location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const tab = (PANEL_TABS as readonly string[]).includes(last) ? (last as PanelTab) : undefined;
    if (segments[segments.length - 2] === 'fluvy' && tab) hooks.panelTab(tab);
    else hooks.navigate(`/${segments.join('/')}`);
    hooks.restoreUrl();
  };
  document.addEventListener('hass-more-info', onMoreInfo, true);
  window.addEventListener('location-changed', onLocation);
  return () => {
    document.removeEventListener('hass-more-info', onMoreInfo, true);
    window.removeEventListener('location-changed', onLocation);
  };
}
