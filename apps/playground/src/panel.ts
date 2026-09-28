import { DEMO_AREAS, DEMO_DASHBOARDS } from '@fluvy/demo-home';
import '@fluvy/cards/panel';
import type { HomeAssistant, Look, LookHandle } from '@fluvy/core';
import { createMemoryLook, type MemoryLook } from './look-memory.js';

/**
 * A moment of the panel to look at, `?state=`: a look chosen but not applied (`pending`), a custom palette
 * being made (`custom`), someone who is not an administrator (`guest`), a house without the automatic
 * dashboard (`missing`), Reset armed (`armed`), the notice after a save (`saved`), a person wearing their own
 * look (`own`), the look on the whole of Home Assistant (`everywhere`, with the frame), a look tried on the whole
 * app with nothing changed (`trial`), a profile that chose the Fluvy theme (`themed`), edits on the other tabs
 * waiting to be saved (`edits`), the language menu open (`menu`), every template's dashboard created
 * (`dashboards`), a dashboard's Recreate row armed (`recreate`). Several join with commas.
 */
export type PanelState =
  | 'pending'
  | 'custom'
  | 'guest'
  | 'missing'
  | 'armed'
  | 'saved'
  | 'own'
  | 'everywhere'
  | 'trial'
  | 'themed'
  | 'edits'
  | 'menu'
  | 'dashboards'
  | 'recreate';

/** The dashboards our templates create, as the panel would (the home's is `fluvy-auto` in the demo home already). */
const TEMPLATE_DASHBOARDS = [
  {
    url_path: 'fluvy-rooms',
    title: 'Fluvy · Rooms',
    icon: 'fluvy:rooms',
    type: 'custom:fluvy-rooms',
  },
  {
    url_path: 'fluvy-energy',
    title: 'Fluvy · Energy',
    icon: 'fluvy:bolt',
    type: 'custom:fluvy-energy',
  },
  {
    url_path: 'fluvy-security',
    title: 'Fluvy · Security',
    icon: 'fluvy:shield',
    type: 'custom:fluvy-security',
  },
  { url_path: 'fluvy-wall', title: 'Fluvy · Wall', icon: 'fluvy:frame', type: 'custom:fluvy-wall' },
] as const;
/** The template dashboards this page has (created by the state, or by the panel's Create). */
const created = new Map<string, (typeof TEMPLATE_DASHBOARDS)[number]>();
/** Tells the mounted panel the dashboards changed (Home Assistant hands a new `panels` in that case). */
let onPanels: (() => void) | undefined;

/**
 * The settings panel outside Home Assistant: `?panel=appearance` (or scope, dashboard, preferences, about).
 * Its settings live in memory behind the same websocket messages Home Assistant answers, and the live
 * look engine applies them to this page — what the panel does here is what it does at home. A page that already
 * runs on a `MemoryLook` (the demo) hands it over, so the panel shows that page's settings.
 */
export function mountPanel(
  stage: HTMLElement,
  hass: HomeAssistant,
  tab: string,
  dark: boolean,
  states: readonly PanelState[] = [],
  look: MemoryLook = createMemoryLook(document, dark),
): { panel: HTMLElement; look: MemoryLook } {
  const has = (state: PanelState): boolean => states.includes(state);
  created.clear();
  if (has('dashboards')) {
    for (const dashboard of TEMPLATE_DASHBOARDS) created.set(dashboard.url_path, dashboard);
    // the wall's "rooms shown" are the house's areas: the demo home's, on this page
    hass = {
      ...hass,
      areas: Object.fromEntries(DEMO_AREAS.map((area) => [area.area_id, { ...area }])),
    } as HomeAssistant;
  }
  // the dashboards as Home Assistant hands them to every frontend (its own Overview, the house's, maybe ours)
  hass = { ...hass, panels: panelsFor(states) } as HomeAssistant;
  if (has('guest')) hass = { ...hass, user: { ...hass.user, is_admin: false } } as HomeAssistant;
  if (has('themed'))
    hass = {
      ...hass,
      selectedTheme: { theme: 'Fluvy' },
      themes: { ...hass.themes, theme: 'Fluvy' },
    } as HomeAssistant;
  const { handle } = look;
  const { store } = handle;

  if (has('own')) void store.savePersonal({ palette: 'blaze', shape: 'round' });
  if (has('everywhere')) void store.saveHouse({ scope: 'everywhere', frame: true });

  const panel = document.createElement('fluvy-panel') as HTMLElement & {
    hass: HomeAssistant;
    handle: LookHandle;
    route: { prefix: string; path: string };
    narrow: boolean;
    draft: Look | undefined;
    resetArmed: boolean;
    recreateArmed: string;
    tryOnApp: boolean;
    houseEdit: Record<string, unknown>;
    personalEdit: Record<string, unknown>;
    notice: string;
    updateComplete: Promise<boolean>;
  };
  panel.handle = handle;
  panel.route = { prefix: '/fluvy', path: `/${tab}` };
  panel.narrow = window.innerWidth < 870;
  panel.hass = hass;
  onPanels = () => {
    panel.hass = { ...panel.hass, panels: panelsFor(states) } as HomeAssistant;
  };
  stage.classList.add('pg-panel');
  stage.append(panel);
  // the moment asked for, once the panel has its settings
  setTimeout(() => {
    if (has('pending')) panel.draft = { palette: 'volt', shape: 'round', pills: 'round' };
    if (has('custom'))
      panel.draft = {
        palette: {
          character: 'vivid',
          base: 'cool',
          accent: '#ff4a1a',
          fill: 'solid',
          highlight: '#e2ff3d',
        },
        shape: 'soft',
        pills: 'round',
      };
    if (has('armed')) panel.resetArmed = true;
    if (has('recreate')) panel.recreateArmed = 'fluvy-auto';
    if (has('trial')) panel.tryOnApp = true;
    if (has('edits')) {
      panel.houseEdit = { frame: false };
      panel.personalEdit = { haptics: false };
    }
    if (has('saved')) panel.notice = hass.language === 'es' ? 'Guardado' : 'Saved';
    if (has('menu'))
      void panel.updateComplete.then(() => {
        const select = panel.shadowRoot?.querySelector('fluvy-select');
        if (select) select.open = true;
      });
  }, 50);
  return { panel, look };
}

/** The dashboard panels of the demo home (one of them the home template's, unless `missing`) and the created ones. */
function panelsFor(states: readonly PanelState[]): HomeAssistant['panels'] {
  const dashboards = [
    ...DEMO_DASHBOARDS.filter(
      (dashboard) => !(states.includes('missing') && dashboard.url_path === 'fluvy-auto'),
    ),
    ...[...created.values()].map(({ url_path, title, icon }) => ({ url_path, title, icon })),
  ];
  return {
    lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
    ...Object.fromEntries(
      dashboards.map((dashboard) => [
        dashboard.url_path,
        { component_name: 'lovelace', ...dashboard },
      ]),
    ),
    fluvy: { component_name: 'custom', url_path: 'fluvy', title: 'Fluvy', icon: 'fluvy:sun' },
  };
}

/** Whether the demo home's dashboards are listed in the sidebar (the panel's switch changes it here). */
const inSidebar = new Map(DEMO_DASHBOARDS.map((dashboard) => [dashboard.url_path, true]));

/** What Home Assistant answers the panel about the dashboards: their configs and the dashboards collection. */
/** What a template dashboard's configuration says (its options, once saved here). */
const configs = new Map<string, Record<string, unknown>>();

export const PANEL_WS: Record<string, (message: Record<string, unknown>) => unknown> = {
  'lovelace/config': (message) => {
    const url = String(message['url_path']);
    const saved = configs.get(url);
    if (saved) return saved;
    if (url === 'fluvy-auto') return { strategy: { type: 'custom:fluvy-home' } };
    const made = created.get(url);
    return made ? { strategy: { type: made.type } } : { views: [] };
  },
  'lovelace/config/save': (message) => {
    configs.set(String(message['url_path']), message['config'] as Record<string, unknown>);
    return undefined;
  },
  'lovelace/dashboards/create': (message) => {
    const made = TEMPLATE_DASHBOARDS.find(
      (dashboard) => dashboard.url_path === message['url_path'],
    );
    if (made) {
      created.set(made.url_path, made);
      // a created dashboard reaches every frontend as a new `panels`: the panel reads the list again
      setTimeout(() => onPanels?.(), 0);
    }
    return undefined;
  },
  'lovelace/dashboards/list': () =>
    [...DEMO_DASHBOARDS, ...created.values()].map((dashboard) => ({
      id: dashboard.url_path.replace(/-/g, '_'),
      url_path: dashboard.url_path,
      title: dashboard.title,
      icon: dashboard.icon,
      show_in_sidebar: inSidebar.get(dashboard.url_path) ?? true,
      require_admin: false,
      mode: 'storage',
    })),
  'lovelace/dashboards/update': (message) => {
    const url = String(message['dashboard_id']).replace(/_/g, '-');
    if (typeof message['show_in_sidebar'] === 'boolean')
      inSidebar.set(url, message['show_in_sidebar']);
    return undefined;
  },
};
