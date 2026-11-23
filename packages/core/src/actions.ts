import { haptic, setHaptics, type HapticKind } from '@fluvy/ui';
import { domainOf } from './entity.js';
import type { HomeAssistant, ServiceTarget } from './ha/types.js';
import type { Sheets } from './settings/schema.js';

export function fireEvent<T>(node: EventTarget, type: string, detail?: T): void {
  node.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: false }),
  );
}

/** Haptics live in `@fluvy/ui` (the controls buzz too); the cards reach them from here as before. */
export { haptic, setHaptics, type HapticKind };

export const moreInfo = (node: EventTarget, entityId: string): void =>
  fireEvent(node, 'hass-more-info', { entityId });

/**
 * Who opens Fluvy's own details sheets (1.20, #162): the cards' package says so (`details-family.ts`), and answers whether
 * it took the entity — one it has a sheet for, where the action (`own`: its `details`) or else the house asks for
 * Fluvy's, its last 24 hours where the action (its `history`, #243) or else the house shows them. Home Assistant's
 * dialog opens wherever it did not, and where nobody says (a page without the cards).
 */
export type DetailsSheetsOpener = (
  node: HTMLElement,
  hass: HomeAssistant,
  entityId: string,
  own: Pick<ActionConfig, 'details' | 'history'>,
) => boolean;
let detailsSheets: DetailsSheetsOpener | undefined;
export const setDetailsSheets = (opener: DetailsSheetsOpener | undefined): void => {
  detailsSheets = opener;
};

/** What Home Assistant keeps on its history entries: the page an entry was opened from, and the app's first entry. */
interface EntryState {
  readonly from?: string;
  readonly root?: boolean;
}

/**
 * Goes to a path as Home Assistant's own `navigate` does: a new entry records the page it was opened from (`from`, the
 * path without its query), which its back arrow reads to step back; a replaced entry keeps what was behind it (`from`)
 * and stays the app's first (`root`).
 */
export function navigate(path: string, replace = false): void {
  if (replace) {
    const { root, from } = (history.state ?? {}) as EntryState;
    const kept = { ...(root ? { root: true } : {}), ...(from === undefined ? {} : { from }) };
    history.replaceState(root || from !== undefined ? kept : null, '', path);
  } else history.pushState({ from: location.pathname }, '', path);
  fireEvent(window, 'location-changed', { replace });
}

/**
 * Back as Home Assistant's own arrow goes (`goBack`): a step back when this entry was opened from a page of the app,
 * else (a link, a fresh tab, a login page behind it) to `fallback` in its place.
 */
export function goBack(fallback = '/'): void {
  if ((history.state as EntryState | null)?.from !== undefined) history.back();
  else navigate(fallback, true);
}

/** What `confirmation` may say; Home Assistant's dialog reads it. */
export interface ActionConfirmation {
  text?: string;
  title?: string;
  confirm_text?: string;
  dismiss_text?: string;
  exemptions?: readonly { user: string }[];
}

/** A tap or a hold, as Home Assistant writes its actions. */
export interface ActionConfig {
  action:
    | 'more-info'
    | 'toggle'
    | 'navigate'
    | 'url'
    | 'perform-action'
    | 'call-service'
    | 'assist'
    | 'fire-dom-event'
    | 'none';
  entity?: string;
  navigation_path?: string;
  navigation_replace?: boolean;
  url_path?: string;
  perform_action?: string;
  data?: Record<string, unknown>;
  target?: ServiceTarget;
  /** `perform-action` as it was written before Home Assistant 2024.8: `call-service`, `service`, `service_data`. */
  service?: string;
  service_data?: Record<string, unknown>;
  /** Asked before the action runs, by Home Assistant's own dialog. */
  confirmation?: boolean | ActionConfirmation;
  /** Whose details a `more-info` opens (1.20, #162): Fluvy's sheet or Home Assistant's dialog; unset, the house's. */
  details?: Sheets;
  /** Whether Fluvy's sheet shows the last 24 hours at its foot (1.25, #243); unset, the house's for its kind. */
  history?: boolean;
  /** `fire-dom-event` hands the whole action on, so it carries whatever its listener reads (`browser_mod: {…}`). */
  [key: string]: unknown;
}

/** The service a toggle is, by domain: a cover opens, a lock unlocks, a vacuum starts — never a blind `homeassistant.toggle`. */
export function toggleService(
  hass: HomeAssistant,
  entityId: string,
): [domain: string, service: string] {
  const domain = domainOf(entityId);
  const state = hass.states[entityId]?.state;
  switch (domain) {
    case 'cover':
      return [domain, state === 'closed' || state === 'closing' ? 'open_cover' : 'close_cover'];
    case 'valve':
      return [domain, state === 'closed' ? 'open_valve' : 'close_valve'];
    case 'lock':
      return [domain, state === 'locked' ? 'unlock' : 'lock'];
    case 'vacuum':
      return [domain, state === 'cleaning' ? 'pause' : 'start'];
    case 'media_player':
      return [domain, 'media_play_pause'];
    case 'scene':
    case 'script':
      return [domain, 'turn_on'];
    case 'button':
    case 'input_button':
      return [domain, 'press'];
    case 'automation':
      return [domain, 'toggle'];
    // the domain's own service, like Home Assistant's own cards: `homeassistant.turn_on` works but hides the intent in the logbook
    case 'light':
    case 'switch':
    case 'fan':
    case 'humidifier':
    case 'siren':
    case 'input_boolean':
    case 'remote':
      return [domain, state === 'on' ? 'turn_off' : 'turn_on'];
    default:
      return ['homeassistant', state === 'on' ? 'turn_off' : 'turn_on'];
  }
}

export function toggleEntity(hass: HomeAssistant, entityId: string): Promise<unknown> {
  const [domain, service] = toggleService(hass, entityId);
  return hass.callService(domain, service, {}, { entity_id: entityId });
}

export const TOGGLE_DOMAINS = new Set([
  'light',
  'switch',
  'input_boolean',
  'fan',
  'humidifier',
  'siren',
  'automation',
  'cover',
  'valve',
  'lock',
  'vacuum',
  'media_player',
  'scene',
  'script',
  'button',
  'input_button',
  'group',
  'remote',
]);

/**
 * What a stray tap may flip (1.23): on and off, open and shut, what a second tap undoes. A row's switch is for these
 * alone (the Entities and Meters cards), and so is a round's tap where it names none (the Rounds card); a vacuum, a
 * player, a scene, a script and a button open their details there, never started or run by a slip.
 */
export const SAFE_TOGGLE: ReadonlySet<string> = new Set([
  'light',
  'switch',
  'input_boolean',
  'fan',
  'humidifier',
  'siren',
  'automation',
  'cover',
  'valve',
  'group',
  'remote',
]);

/** What a round's tap turns on and off where it names no tap of its own: what is safe, and a lock (`confirmationOf`). */
export const ROUND_TOGGLE: ReadonlySet<string> = new Set([...SAFE_TOGGLE, 'lock']);

/**
 * What an action asks before it runs: its own `confirmation`; where it says none, a toggle that would unlock a lock
 * asks (1.23), Home Assistant's dialog naming the service, and locking stays one tap. `confirmation: false`, Home
 * Assistant's own key, says never.
 */
export function confirmationOf(
  hass: HomeAssistant,
  action: ActionConfig,
  entity: string | undefined,
): ActionConfig['confirmation'] {
  if (action.confirmation !== undefined) return action.confirmation;
  return action.action === 'toggle' && entity !== undefined
    ? toggleService(hass, entity)[1] === 'unlock' || undefined
    : undefined;
}

/**
 * What only Home Assistant's own handler does: ask first (`confirmation` — its dialog, its words, its exemptions)
 * and open Assist. The action goes to it as `hass-action`, which its root element answers. A toggle goes as the
 * service Fluvy would have called, so a vacuum still starts and a cover still opens. Where nobody answers (outside
 * Home Assistant), an action that had to be asked about does not run.
 */
function handOver(
  node: HTMLElement,
  hass: HomeAssistant,
  config: ActionConfig,
  entity: string | undefined,
): void {
  let action = config;
  if (config.action === 'toggle') {
    if (!entity) return;
    const [domain, service] = toggleService(hass, entity);
    action = {
      ...config,
      action: 'perform-action',
      perform_action: `${domain}.${service}`,
      target: { entity_id: entity },
    };
  }
  fireEvent(node, 'hass-action', { config: { entity, tap_action: action }, action: 'tap' });
}

/**
 * Whether an action has something to do: never `none`, nor more-info or a toggle with no entity to act on (its own or
 * the card's — a card of many has none). A surface that would be drawn as a button asks first: one that does nothing
 * is not drawn.
 */
export function actionRuns(action: ActionConfig | undefined, fallbackEntity?: string): boolean {
  const kind = action?.action ?? 'more-info';
  return kind === 'more-info' || kind === 'toggle'
    ? Boolean(action?.entity ?? fallbackEntity)
    : kind !== 'none';
}

export async function runAction(
  node: HTMLElement,
  hass: HomeAssistant,
  action: ActionConfig | undefined,
  fallbackEntity?: string,
): Promise<void> {
  const config: ActionConfig = action ?? { action: 'more-info' };
  const entity = config.entity ?? fallbackEntity;
  if (config.action === 'none') return;
  const confirmation = confirmationOf(hass, config, entity);
  if (confirmation || config.action === 'assist') {
    // the action itself where it asks of its own: what Home Assistant hands back at its yes is that very object
    handOver(
      node,
      hass,
      confirmation && confirmation !== config.confirmation ? { ...config, confirmation } : config,
      entity,
    );
    return;
  }
  switch (config.action) {
    case 'more-info':
      if (entity && !detailsSheets?.(node, hass, entity, config)) moreInfo(node, entity);
      return;
    case 'toggle':
      if (entity) {
        haptic(node, 'light');
        await toggleEntity(hass, entity);
      }
      return;
    case 'navigate':
      if (config.navigation_path) navigate(config.navigation_path, config.navigation_replace);
      return;
    case 'url':
      if (config.url_path) window.open(config.url_path, '_blank', 'noopener');
      return;
    case 'fire-dom-event':
      // Home Assistant's own: the action as `ll-custom`'s detail, from the card, for the frontend
      // integrations that listen for it (browser_mod's popups, with `browser_id: THIS` resolved there).
      fireEvent(node, 'll-custom', config);
      return;
    case 'perform-action':
    case 'call-service': {
      const [domain, service] = (config.perform_action ?? config.service ?? '').split('.', 2);
      if (domain && service) {
        haptic(node, 'light');
        await hass.callService(
          domain,
          service,
          config.data ?? config.service_data ?? {},
          config.target,
        );
      }
      return;
    }
  }
}
