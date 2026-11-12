import { setHoldToSlide, setMotionPreference } from '@fluvy/ui';
import { setHaptics } from '../actions.js';
import {
  PREFERENCES_EVENT,
  refreshCards,
  resyncCardThemes,
  setCardDefaults,
  setChartDefaults,
  setLightDefaults,
  setSliderDefaults,
} from '../card.js';
import { ensureFonts } from '../fonts.js';
import type { HomeAssistant } from '../ha/types.js';
import { setLanguageOverride } from '../i18n/index.js';
import { DEVICE_KEY, isLite, wornLite } from '../settings/device.js';
import { cachedSettings, SettingsStore } from '../settings/store.js';
import {
  resolveSettings,
  HOUSE_DEFAULTS,
  ICON_PLACES,
  pageScope,
  PERSONAL_DEFAULTS,
  wearsLook,
  type EffectiveSettings,
} from '../settings/schema.js';
import { NO_FRAME } from '../shell/css/chrome.js';
import {
  attachToElementClass,
  browserEnv,
  inUse,
  onPanelFrame,
  setWorn,
  themed,
  versionNote,
} from '../shell/index.js';
import { LookEngine } from './engine.js';
import { ACTIVITY_CARD, ORIGINAL_ACTIVITY, ORIGINAL_HISTORY } from './attributes.js';
import { paintRoot, wallKeepsOwn } from './background.js';
import { chromeOf, tabsOf } from './css.js';
import { markPanels, patchEditDialog, patchLovelacePanels } from './panels.js';
import { watchThemes } from './themed.js';
import {
  FLAT_ATTRIBUTE,
  markRoots,
  patchViewRoots,
  SIDEBAR_LOGO_ATTRIBUTE,
  SIDEBAR_SEPARATORS_ATTRIBUTE,
  TABLET_ATTRIBUTE,
  type RootElement,
  type TabsFor,
} from './tabs.js';
import { watchTablet } from './tablet.js';
import { safeStorage } from '../storage.js';

/**
 * What the panel can show on its page before it is saved: the look and the house's status colours, where it applies
 * (scope, dashboards, the frame, the menus' icons, our Activity page), the lights', the charts' and the cards' defaults
 * and a person's preferences (language, motion, haptics, hold to slide).
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
    | 'holdToSlide'
    | 'activityCard'
    | 'lightTint'
    | 'lightColors'
    | 'statuses'
    | 'charts'
    | 'chartSets'
    | 'cards'
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
  /** This device's own settings were saved (the panel): Lite is worn, or taken off, at once. */
  wearDevice(): void;
  stop(): void;
}

type HassElement = Element & { hass?: HomeAssistant };

/** Home Assistant's app object as its root element holds it (undefined before the app renders). */
export const appHass = (): HomeAssistant | undefined =>
  (document.querySelector('home-assistant') as HassElement | null)?.hass;

/**
 * Home Assistant's app once it has connected (it connects before any panel renders); undefined after a minute, or as
 * soon as `live` says the one waiting has gone (a look stopped asks no more).
 */
export async function connected(
  app: () => HomeAssistant | undefined = appHass,
  live: () => boolean = () => true,
): Promise<HomeAssistant | undefined> {
  for (let tries = 0; tries < 600 && live(); tries += 1) {
    const hass = app();
    if (hass?.connection) return hass;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

let handle: LookHandle | undefined;

/**
 * Starts the look once for the page: the last settings this browser saw are applied at once (no flash
 * of another palette), then the house's and this person's settings are subscribed to and every change is
 * applied live — the look, where it applies, the person's preferences (language, motion, haptics), and Inter
 * once Fluvy is in use on the page. Dark mode is Home Assistant's: the look follows it whenever Home Assistant
 * re-applies its theme.
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
  /**
   * Whether this device draws Lite (#165): read again as its choice is saved, here or in another tab, and as the
   * system's motion changes (Auto follows it).
   */
  let lite = isLite();
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  /**
   * What this page wears: the settings, or the settings being previewed on it, turned down where the device draws Lite
   * — "everywhere" only while Home Assistant's theme for this person is Fluvy (`pageScope`).
   */
  const current = (): EffectiveSettings => {
    const shown = previewed ? { ...settings, ...previewed } : settings;
    const now = lite ? wornLite(shown) : shown;
    const scope = pageScope(now.scope, appHass()?.themes?.theme);
    return scope === now.scope ? now : { ...now, scope };
  };
  /**
   * The frame as the house wants it, told to `<home-assistant>` only while the page wears Fluvy (the frame's sheet is
   * empty on any other, and Home Assistant's elements carry nothing of ours there); a wall has none whatever the house
   * says: the dashboard fills the tablet.
   */
  const frame = (): void => {
    const off = !current().frame || wall.on;
    env.document
      .querySelector('home-assistant')
      ?.toggleAttribute(NO_FRAME, off && themed(env.document));
  };
  /** The mode the page is in: the wall's, else Home Assistant's, else the system's. */
  const dark = (): boolean => wall.dark ?? appHass()?.themes?.darkMode ?? prefersDark();
  const apply = (): void => {
    const changed = engine.apply(current(), dark());
    if (changed) resyncCardThemes();
    frame();
    // Inter, once Fluvy is in use on the page (the theme on, the look covering the app, a wall, a dashboard that
    // wears the look): a page on another theme fetches no font of ours
    if (inUse(env.document)) ensureFonts();
  };
  const wears = (urlPath: string | undefined): boolean =>
    current().scope === 'dashboards' && wearsLook(current(), urlPath);
  // the patches on Home Assistant's elements act on the dashboards that wear the look too
  setWorn(wears);
  /** The tabs a dashboard wears: every dashboard's while the whole app wears the look, else the look's dashboards'. */
  const tabsFor: TabsFor = (urlPath) => {
    const now = current();
    return now.scope === 'everywhere' || wearsLook(now, urlPath)
      ? { tabs: tabsOf(now.look), chrome: chromeOf(now.look) }
      : null;
  };
  /**
   * The page's background a dashboard's root wears (`background.ts`): the house's where its dashboard wears the look,
   * the dashboard's own over it — on a wall the wall's own choice wins (its mesh, plain, or the dashboard's).
   */
  const paint = (root: RootElement): void => {
    const now = current();
    const worn = !wallKeepsOwn(env.document, now.wall.background) && tabsFor(root.hass?.panelUrl);
    paintRoot(root, worn ? now.background : undefined, now.look, dark(), lite);
  };
  /**
   * Every mark of the dashboards again: the panels (the cards look again when one moved), their headers' tabs and their
   * backgrounds.
   */
  const remark = (): void => {
    if (markPanels(env.document, wears)) resyncCardThemes();
    markRoots(env.document, tabsFor, paint);
  };
  /** The menu as on a tablet held sideways: the sidebar is Home Assistant's own until the look covers the whole app. */
  const tablet = (): boolean => current().scope === 'everywhere' && chromeOf(current().look).tablet;
  const preferences = (): void => {
    const now = current();
    setMotionPreference(now.motion);
    setHaptics(now.haptics);
    setHoldToSlide(now.holdToSlide);
    setLanguageOverride(now.language === 'auto' ? undefined : now.language);
    // Home Assistant's own icons in its menus where the house keeps them, place by place, said on the page and its
    // panel frames (each one's shell empties those sheets)
    engine.keepIcons(ICON_PLACES.filter((place) => !now.icons[place]).join(' '));
    // Home Assistant's own Activity page, if the house keeps it (the takeover gives the page back)
    env.document.documentElement.toggleAttribute(ORIGINAL_ACTIVITY, !now.activity);
    env.document.documentElement.toggleAttribute(ORIGINAL_HISTORY, !now.history);
    env.document.documentElement.toggleAttribute(ACTIVITY_CARD, now.activityCard);
    // the lights', the charts', the cards' and the sliders' defaults: every card that leaves them to the house draws again
    setLightDefaults({ tint: now.lightTint, colors: now.lightColors });
    setChartDefaults({ settings: now.charts, sets: now.chartSets });
    setCardDefaults(now.cards);
    setSliderDefaults(now.sliders);
    // the corner of every page: the sidebar's head (the shell's sheets fill on these), the dashboards' headers marked
    const chrome = chromeOf(now.look);
    env.document.documentElement.toggleAttribute(SIDEBAR_LOGO_ATTRIBUTE, chrome.logo);
    env.document.documentElement.toggleAttribute(FLAT_ATTRIBUTE, !chrome.dividers);
    env.document.documentElement.toggleAttribute(TABLET_ATTRIBUTE, tablet());
    if (chrome.separators.length)
      env.document.documentElement.setAttribute(
        SIDEBAR_SEPARATORS_ATTRIBUTE,
        chrome.separators.join(' '),
      );
    else env.document.documentElement.removeAttribute(SIDEBAR_SEPARATORS_ATTRIBUTE);
    // what is not a card (a page of ours) follows the preferences too
    window.dispatchEvent(new Event(PREFERENCES_EVENT));
  };

  preferences();
  apply();
  void attachToElementClass('ha-panel-lovelace', engine.panelSheet, env);
  // a card connects before its panel is marked: the cards look again whenever a mark moves
  void patchLovelacePanels(env.customElements, wears, resyncCardThemes);
  // the card editor's colour swatches show the palette's colours: the dialog wears the look of its dashboard (and
  // its preview looks again when that mark moves)
  void attachToElementClass('hui-dialog-edit-card', engine.panelSheet, env);
  void patchEditDialog(env.customElements, wears, resyncCardThemes);
  // the view tabs as the house chose them, in every dashboard's header, and the page's background under its view
  // (re-marked on each of its updates)
  void patchViewRoots(env.customElements, tabsFor, paint);
  // a view, a section or a card Home Assistant themed with the theme named Fluvy wears the look over the theme file's
  // colours it wrote on it (the cards inside look again when one is marked)
  const offThemes = watchThemes(env.document, () => engine.themedSheet(), resyncCardThemes);
  const offFrames = onPanelFrame((frame) =>
    engine.addDocument(frame.document, frame.createSheet()),
  );
  // Home Assistant re-applies its theme inline on <html> when dark mode or the theme itself changes: the look
  // follows (another theme takes the pages back, and only Fluvy's dashboards stay marked)
  const observer = new MutationObserver(() => {
    apply();
    remark();
  });
  observer.observe(env.document.documentElement, { attributes: true, attributeFilter: ['style'] });

  /**
   * This device draws Lite, or Full, again: the cards move (or stop) and blur as it says, and a page's background is
   * in focus or blurred again under its header.
   */
  const wearDevice = (): void => {
    const before = current();
    lite = isLite();
    preferences();
    apply();
    remark();
    if (current().motion !== before.motion) refreshCards();
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  reduced.addEventListener('change', wearDevice);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === DEVICE_KEY) wearDevice();
  };
  window.addEventListener('storage', onStorage);
  const offTablet = watchTablet(env.document, tablet);

  let running = true;
  void connected(appHass, () => running).then((hass) => {
    if (!hass || !handle) return;
    console.debug(`[fluvy] ${versionNote()}`);
    frame(); // `<home-assistant>` exists now
    store.start((next) => {
      const before = current();
      settings = next;
      const changed = current().language !== before.language || current().motion !== before.motion;
      preferences();
      apply();
      remark();
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
      // a previewed scope marks the dashboards as a saved one would, and previewed tabs show in their headers
      remark();
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
      // a wall draws its own background, or lets the dashboard's through, in the mode it forces
      remark();
    },
    wearDevice,
    stop: () => {
      running = false;
      observer.disconnect();
      reduced.removeEventListener('change', wearDevice);
      window.removeEventListener('storage', onStorage);
      offTablet();
      offFrames();
      offThemes();
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
