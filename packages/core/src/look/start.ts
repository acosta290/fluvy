import { setMotionPreference } from '@fluvy/ui';
import { setHaptics } from '../actions.js';
import { PREFERENCES_EVENT, refreshCards, resyncCardThemes } from '../card.js';
import type { HomeAssistant } from '../ha/types.js';
import { setLanguageOverride } from '../i18n/index.js';
import { cachedSettings, SettingsStore } from '../settings/store.js';
import {
  resolveSettings,
  HOUSE_DEFAULTS,
  pageScope,
  PERSONAL_DEFAULTS,
  wearsLook,
  type EffectiveSettings,
} from '../settings/schema.js';
import { NO_FRAME, ORIGINAL_ICONS } from '../shell/css/chrome.js';
import { attachToElementClass, browserEnv, onPanelFrame } from '../shell/index.js';
import { LookEngine } from './engine.js';
import { ACTIVITY_CARD, ORIGINAL_ACTIVITY, ORIGINAL_HISTORY } from './attributes.js';
import { markPanels, patchEditDialog, patchLovelacePanels } from './panels.js';
import { safeStorage } from '../storage.js';

/**
 * What the panel can show on its page before it is saved: the look, where it applies (scope, dashboards, the
 * frame, the menus' icons, our Activity page) and a person's preferences (language, motion, haptics).
 */
export type LookPreview = Partial<
  Pick<
    EffectiveSettings,
    | 'look'
    | 'scope'
    | 'dashboards'
    | 'frame'
    | 'icons'
    | 'activity'
    | 'language'
    | 'motion'
    | 'haptics'
    | 'activityCard'
  >
>;

/** What the wall tells the look: whether this page is a wall (no frame) and the mode it forces (undefined: Home Assistant's). */
export interface WallState {
  readonly on: boolean;
  readonly dark: boolean | undefined;
}

export interface LookHandle {
  /** The settings, live; the panel reads and writes them here. */
  readonly store: SettingsStore;
  /** What this person sees now. */
  settings(): EffectiveSettings;
  /** Shows settings on this page only, without saving them (the panel's live preview); null ends it. */
  preview(preview: LookPreview | null): void;
  /** Calls `listener` whenever the settings change (here or on another device). */
  onChange(listener: (settings: EffectiveSettings) => void): () => void;
  /** The wall's say: on, the frame goes; a forced mode re-derives the look. */
  setWall(state: WallState): void;
  stop(): void;
}

type HassElement = Element & { hass?: HomeAssistant };

/** Home Assistant's app object as its root element holds it (undefined before the app renders). */
export const appHass = (): HomeAssistant | undefined =>
  (document.querySelector('home-assistant') as HassElement | null)?.hass;

/** Home Assistant's app once it has connected (it connects before any panel renders). */
async function connected(): Promise<HomeAssistant | undefined> {
  for (let tries = 0; tries < 600; tries += 1) {
    const hass = appHass();
    if (hass?.connection) return hass;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

let handle: LookHandle | undefined;

/**
 * Starts the look once for the page: the last settings this browser saw are applied at once (no flash
 * of another palette), then the house's and this person's settings are subscribed to and every change is
 * applied live — the look, where it applies, and the person's preferences (language, motion, haptics).
 * Dark mode is Home Assistant's: the look follows it whenever Home Assistant re-applies its theme.
 */
export function startLook(): LookHandle | undefined {
  if (handle) return handle;
  const env = browserEnv();
  if (!env) return undefined;
  const storage = safeStorage();
  const early = (globalThis as { __fluvyEarlyLook?: CSSStyleSheet }).__fluvyEarlyLook;
  const engine = new LookEngine(env.document, env.createSheet, storage, early);
  const store = new SettingsStore(appHass, storage);
  let settings = cachedSettings(storage) ?? resolveSettings(HOUSE_DEFAULTS, PERSONAL_DEFAULTS);

  const prefersDark = (): boolean =>
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  let previewed: LookPreview | null = null;
  let wall: WallState = { on: false, dark: undefined };
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  /**
   * What this page wears: the settings, or the settings being previewed on it — "everywhere" only while Home
   * Assistant's theme for this person is Fluvy (`pageScope`).
   */
  const current = (): EffectiveSettings => {
    const now = previewed ? { ...settings, ...previewed } : settings;
    const scope = pageScope(now.scope, appHass()?.themes?.theme);
    return scope === now.scope ? now : { ...now, scope };
  };
  const apply = (): void => {
    const changed = engine.apply(
      current(),
      wall.dark ?? appHass()?.themes?.darkMode ?? prefersDark(),
    );
    if (changed) resyncCardThemes();
  };
  const wears = (urlPath: string | undefined): boolean =>
    current().scope === 'dashboards' && wearsLook(current(), urlPath);
  const preferences = (): void => {
    const now = current();
    setMotionPreference(now.motion);
    setHaptics(now.haptics);
    setLanguageOverride(now.language === 'auto' ? undefined : now.language);
    // a wall has no frame whatever the house says: the dashboard fills the tablet
    env.document.querySelector('home-assistant')?.toggleAttribute(NO_FRAME, !now.frame || wall.on);
    // Home Assistant's own icons in its menus, if the house keeps them (the shell empties its icon sheets)
    env.document.documentElement.toggleAttribute(ORIGINAL_ICONS, !now.icons);
    // Home Assistant's own Activity page, if the house keeps it (the takeover gives the page back)
    env.document.documentElement.toggleAttribute(ORIGINAL_ACTIVITY, !now.activity);
    env.document.documentElement.toggleAttribute(ORIGINAL_HISTORY, !now.history);
    env.document.documentElement.toggleAttribute(ACTIVITY_CARD, now.activityCard);
    // what is not a card (a page of ours) follows the preferences too
    window.dispatchEvent(new Event(PREFERENCES_EVENT));
  };

  preferences();
  apply();
  void attachToElementClass('ha-panel-lovelace', engine.panelSheet, env);
  // a card connects before its panel is marked: the cards look again whenever a mark moves
  void patchLovelacePanels(env.customElements, wears, resyncCardThemes);
  // the card editor's colour swatches show the palette's colours: the dialog wears the look of its dashboard
  void attachToElementClass('hui-dialog-edit-card', engine.panelSheet, env);
  void patchEditDialog(env.customElements, wears);
  const offFrames = onPanelFrame((frame) =>
    engine.addDocument(frame.document, frame.createSheet()),
  );
  // Home Assistant re-applies its theme inline on <html> when dark mode or the theme itself changes: the look
  // follows (another theme takes the pages back, and only Fluvy's dashboards stay marked)
  const observer = new MutationObserver(() => {
    apply();
    if (markPanels(env.document, wears)) resyncCardThemes();
  });
  observer.observe(env.document.documentElement, { attributes: true, attributeFilter: ['style'] });

  void connected().then((hass) => {
    if (!hass || !handle) return;
    preferences(); // `<home-assistant>` exists now
    store.start((next) => {
      const before = current();
      settings = next;
      const changed = current().language !== before.language || current().motion !== before.motion;
      preferences();
      apply();
      if (markPanels(env.document, wears)) resyncCardThemes();
      if (changed) refreshCards();
      for (const listener of listeners) listener(next);
    });
  });

  handle = {
    store,
    settings: () => settings,
    preview: (next) => {
      const before = current();
      previewed = next;
      preferences();
      apply();
      // a previewed scope marks the dashboards as a saved one would
      if (markPanels(env.document, wears)) resyncCardThemes();
      // the cards speak (and move) as previewed
      if (current().language !== before.language || current().motion !== before.motion)
        refreshCards();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setWall: (state) => {
      wall = state;
      preferences();
      apply();
    },
    stop: () => {
      observer.disconnect();
      offFrames();
      store.stop();
      handle = undefined;
    },
  };
  return handle;
}

/** The running look (the panel's way in); undefined before `startLook()`. */
export function lookHandle(): LookHandle | undefined {
  return handle;
}
