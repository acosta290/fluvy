import type { HassEntity, HomeAssistant } from './ha/types.js';

/**
 * One honest view of an entity. `unavailable`, `unknown` and `missing` are first-class: a fifth of a
 * real instance sits in one of them at any time, so no card may assume a usable state.
 */
export type EntityStatus = 'ok' | 'unavailable' | 'unknown' | 'missing';

export interface EntityView {
  readonly id: string;
  readonly domain: string;
  readonly status: EntityStatus;
  readonly stateObj: HassEntity | undefined;
  readonly state: string;
  readonly name: string;
  readonly areaName: string;
  /** Numeric state, or null when the state is not a finite number. */
  readonly number: number | null;
  readonly unit: string;
  readonly deviceClass: string;
  supports(bit: number): boolean;
  attr<T = unknown>(key: string): T | undefined;
}

/** A finite number from an attribute, or null — integrations send null, strings and nothing at all. */
export function numberAttr(view: EntityView, key: string): number | null {
  const value = view.attr<unknown>(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A text attribute without its surrounding spaces, or '' when there is none (or it is not text). */
export function textAttr(view: EntityView, key: string): string {
  const value = view.attr<unknown>(key);
  return typeof value === 'string' ? value.trim() : '';
}

export const domainOf = (entityId: string): string =>
  entityId.slice(0, Math.max(0, entityId.indexOf('.')));

const titleCase = (id: string): string => {
  const object = id.slice(id.indexOf('.') + 1).replace(/_/g, ' ');
  return object.charAt(0).toUpperCase() + object.slice(1);
};

export function resolveEntity(hass: HomeAssistant | undefined, id: string | undefined): EntityView {
  const entityId = id ?? '';
  const stateObj = hass?.states[entityId];
  const status: EntityStatus = !stateObj
    ? 'missing'
    : stateObj.state === 'unavailable'
      ? 'unavailable'
      : stateObj.state === 'unknown'
        ? 'unknown'
        : 'ok';
  const registry = hass?.entities?.[entityId]; // may be absent: some states never enter the registry
  const device = registry?.device_id ? hass?.devices?.[registry.device_id] : undefined;
  const areaId = registry?.area_id ?? device?.area_id ?? undefined;
  // `Number('')` and `Number('  ')` are 0: only a state with digits in it is a number
  const parsed =
    stateObj && status === 'ok' && /\d/.test(stateObj.state) ? Number(stateObj.state) : NaN;
  return {
    id: entityId,
    domain: domainOf(entityId),
    status,
    stateObj,
    state: stateObj?.state ?? 'missing',
    name: stateObj?.attributes.friendly_name ?? registry?.name ?? titleCase(entityId),
    areaName: (areaId && hass?.areas?.[areaId]?.name) || '',
    number: Number.isFinite(parsed) ? parsed : null,
    unit: stateObj?.attributes.unit_of_measurement ?? '',
    deviceClass: stateObj?.attributes.device_class ?? '',
    supports: (bit) => ((stateObj?.attributes.supported_features ?? 0) & bit) !== 0,
    attr: <T>(key: string) => stateObj?.attributes[key] as T | undefined,
  };
}

const ACTIVE_OFF = new Set([
  'off',
  'closed',
  'locked',
  'idle',
  'standby',
  'paused',
  'docked',
  'not_home',
  'disarmed',
  'unavailable',
  'unknown',
  'missing',
  'below_horizon',
]);

/**
 * Whether a state of a domain reads as "on/active" (what takes a filled tone): a state a history holds, without the
 * entity it belonged to.
 */
export function isActiveState(domain: string, state: string): boolean {
  // A sensor only measures: "21.5 °C" is not an on state, so it never takes the active fill.
  if (domain === 'sensor' || domain === 'number' || domain === 'input_number') return false;
  if (domain === 'climate' || domain === 'water_heater') return state !== 'off';
  return !ACTIVE_OFF.has(state);
}

/** Whether the entity reads as "on/active" for the purposes of a filled tone. */
export function isActive(view: EntityView): boolean {
  if (view.status !== 'ok') return false;
  return isActiveState(view.domain, view.state);
}

export const isUsable = (view: EntityView): boolean =>
  view.status === 'ok' || view.status === 'unknown';
