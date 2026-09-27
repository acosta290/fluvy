import { DEMO_DASHBOARDS } from '@fluvy/demo-home';
import '@fluvy/cards/panel';
import {
  LookEngine,
  refreshCards,
  setLanguageOverride,
  SettingsStore,
  type EffectiveSettings,
  type HomeAssistant,
  type Look,
  type LookHandle,
  type SettingsHass,
} from '@fluvy/core';
import { setMotionPreference } from '@fluvy/ui';

/**
 * A moment of the panel to look at, `?state=`: a look chosen but not applied (`pending`), a custom palette
 * being made (`custom`), someone who is not an administrator (`guest`), a house without the automatic
 * dashboard (`missing`), Reset armed (`armed`), the notice after a save (`saved`), a person wearing their own
 * look (`own`), the look on the whole of Home Assistant (`everywhere`, with the frame), a look tried on the whole
 * app with nothing changed (`trial`), a profile that chose the Fluvy theme (`themed`), edits on the other tabs
 * waiting to be saved (`edits`). Several join with commas.
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
  | 'edits';

/**
 * The settings panel outside Home Assistant: `?panel=appearance` (or scope, dashboard, preferences, about).
 * Its settings live in memory behind the same websocket messages Home Assistant answers, and the live
 * look engine applies them to this page — what the panel does here is what it does at home.
 */
export function mountPanel(
  stage: HTMLElement,
  hass: HomeAssistant,
  tab: string,
  dark: boolean,
  states: readonly PanelState[] = [],
): void {
  const has = (state: PanelState): boolean => states.includes(state);
  // the dashboards as Home Assistant hands them to every frontend (its own Overview, the house's, maybe ours)
  hass = { ...hass, panels: panelsFor(states) } as HomeAssistant;
  if (has('guest')) hass = { ...hass, user: { ...hass.user, is_admin: false } } as HomeAssistant;
  if (has('themed'))
    hass = {
      ...hass,
      selectedTheme: { theme: 'Fluvy' },
      themes: { ...hass.themes, theme: 'Fluvy' },
    } as HomeAssistant;
  const data: Record<'system' | 'user', unknown> = { system: null, user: null };
  const subscribers: Record<'system' | 'user', Set<(message: { value: unknown }) => void>> = {
    system: new Set(),
    user: new Set(),
  };
  const layer = (type: string): 'system' | 'user' => (type.includes('system') ? 'system' : 'user');
  const storage: SettingsHass = {
    connection: {
      subscribeMessage: async <T>(callback: (message: T) => void, message: { type: string }) => {
        const key = layer(message.type);
        const listener = callback as (message: { value: unknown }) => void;
        subscribers[key].add(listener);
        setTimeout(() => listener({ value: data[key] }), 0);
        return () => subscribers[key].delete(listener);
      },
    },
    callWS: async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
      const key = layer(message.type);
      data[key] = message['value'];
      for (const listener of subscribers[key]) listener({ value: data[key] });
      return undefined as T;
    },
  } as unknown as SettingsHass;

  const engine = new LookEngine(document, () => new CSSStyleSheet(), undefined);
  const store = new SettingsStore(() => storage, undefined);
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  let previewed: Parameters<LookHandle['preview']>[0] = null;
  // as at home: the look on the page, and the language and motion the cards use
  const apply = (): void => {
    const now = previewed ? { ...store.effective, ...previewed } : store.effective;
    engine.apply(now, dark);
    setLanguageOverride(now.language === 'auto' ? undefined : now.language);
    setMotionPreference(now.motion);
    refreshCards();
  };
  const handle: LookHandle = {
    store,
    settings: () => store.effective,
    preview: (look) => {
      previewed = look;
      apply();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop: () => store.stop(),
  };
  store.start((settings) => {
    apply();
    for (const listener of listeners) listener(settings);
  });

  if (has('own')) void store.savePersonal({ palette: 'blaze', shape: 'round' });
  if (has('everywhere')) void store.saveHouse({ scope: 'everywhere', frame: true });

  const panel = document.createElement('fluvy-panel') as HTMLElement & {
    hass: HomeAssistant;
    handle: LookHandle;
    route: { prefix: string; path: string };
    narrow: boolean;
    draft: Look | undefined;
    resetArmed: boolean;
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
    if (has('trial')) panel.tryOnApp = true;
    if (has('edits')) {
      panel.houseEdit = { frame: false };
      panel.personalEdit = { haptics: false };
    }
    if (has('saved')) panel.notice = hass.language === 'es' ? 'Guardado' : 'Saved';
  }, 50);
}

/** The dashboard panels of the demo home (one of them the automatic one, unless `missing`). */
function panelsFor(states: readonly PanelState[]): HomeAssistant['panels'] {
  const dashboards = DEMO_DASHBOARDS.filter(
    (dashboard) => !(states.includes('missing') && dashboard.url_path === 'fluvy-auto'),
  );
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

/** What Home Assistant answers the panel about the dashboards' configs. */
export const PANEL_WS: Record<string, (message: Record<string, unknown>) => unknown> = {
  'lovelace/config': (message) =>
    message['url_path'] === 'fluvy-auto'
      ? { strategy: { type: 'custom:fluvy-home' } }
      : { views: [] },
  'lovelace/config/save': () => undefined,
  'lovelace/dashboards/create': () => undefined,
};
