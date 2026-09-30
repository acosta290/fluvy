import { haptic, setHaptics, type HapticKind } from '@fluvy/ui';
import { domainOf } from './entity.js';
import type { HomeAssistant, ServiceTarget } from './ha/types.js';

export function fireEvent<T>(node: EventTarget, type: string, detail?: T): void {
  node.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: false }),
  );
}

/** Haptics live in `@fluvy/ui` (the controls buzz too); the cards reach them from here as before. */
export { haptic, setHaptics, type HapticKind };

export const moreInfo = (node: EventTarget, entityId: string): void =>
  fireEvent(node, 'hass-more-info', { entityId });

export function navigate(path: string, replace = false): void {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace });
}

export interface ActionConfig {
  action:
    'more-info' | 'toggle' | 'navigate' | 'url' | 'perform-action' | 'fire-dom-event' | 'none';
  entity?: string;
  navigation_path?: string;
  url_path?: string;
  perform_action?: string;
  data?: Record<string, unknown>;
  target?: ServiceTarget;
  /** `fire-dom-event` hands the whole action on, so it carries whatever its listener reads (`browser_mod: {…}`). */
  [key: string]: unknown;
}

/** Domain-aware toggle: a cover opens, a lock unlocks, a vacuum starts — never a blind `homeassistant.toggle`. */
export function toggleEntity(hass: HomeAssistant, entityId: string): Promise<unknown> {
  const domain = domainOf(entityId);
  const state = hass.states[entityId]?.state;
  const target: ServiceTarget = { entity_id: entityId };
  switch (domain) {
    case 'cover':
      return hass.callService(
        'cover',
        state === 'closed' || state === 'closing' ? 'open_cover' : 'close_cover',
        {},
        target,
      );
    case 'valve':
      return hass.callService(
        'valve',
        state === 'closed' ? 'open_valve' : 'close_valve',
        {},
        target,
      );
    case 'lock':
      return hass.callService('lock', state === 'locked' ? 'unlock' : 'lock', {}, target);
    case 'vacuum':
      return hass.callService('vacuum', state === 'cleaning' ? 'pause' : 'start', {}, target);
    case 'media_player':
      return hass.callService('media_player', 'media_play_pause', {}, target);
    case 'scene':
      return hass.callService('scene', 'turn_on', {}, target);
    case 'script':
      return hass.callService('script', 'turn_on', {}, target);
    case 'button':
    case 'input_button':
      return hass.callService(domain, 'press', {}, target);
    case 'automation':
      return hass.callService('automation', 'toggle', {}, target);
    // the domain's own service, like Home Assistant's own cards: `homeassistant.turn_on` works but hides the intent in the logbook
    case 'light':
    case 'switch':
    case 'fan':
    case 'humidifier':
    case 'siren':
    case 'input_boolean':
    case 'remote':
      return hass.callService(domain, state === 'on' ? 'turn_off' : 'turn_on', {}, target);
    default:
      return hass.callService('homeassistant', state === 'on' ? 'turn_off' : 'turn_on', {}, target);
  }
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

export async function runAction(
  node: HTMLElement,
  hass: HomeAssistant,
  action: ActionConfig | undefined,
  fallbackEntity?: string,
): Promise<void> {
  const config = action ?? { action: 'more-info' };
  const entity = config.entity ?? fallbackEntity;
  switch (config.action) {
    case 'none':
      return;
    case 'more-info':
      if (entity) moreInfo(node, entity);
      return;
    case 'toggle':
      if (entity) {
        haptic(node, 'light');
        await toggleEntity(hass, entity);
      }
      return;
    case 'navigate':
      if (config.navigation_path) navigate(config.navigation_path);
      return;
    case 'url':
      if (config.url_path) window.open(config.url_path, '_blank', 'noopener');
      return;
    case 'fire-dom-event':
      // Home Assistant's own: the action as `ll-custom`'s detail, from the card, for the frontend
      // integrations that listen for it (browser_mod's popups, with `browser_id: THIS` resolved there).
      fireEvent(node, 'll-custom', config);
      return;
    case 'perform-action': {
      const [domain, service] = (config.perform_action ?? '').split('.', 2);
      if (domain && service) {
        haptic(node, 'light');
        await hass.callService(domain, service, config.data ?? {}, config.target);
      }
      return;
    }
  }
}
