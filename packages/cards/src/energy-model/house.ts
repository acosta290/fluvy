import type { HomeAssistant } from '@fluvy/core';
import type { EnergyPrefs } from './prefs.js';

/**
 * The house's energy preferences, asked once per connection and kept for five minutes (several cards on a view ask
 * the same question). `null` when energy was never configured, or the user may not read it.
 */
const cache = new WeakMap<object, { at: number; promise: Promise<EnergyPrefs | null> }>();
const TTL = 5 * 60_000;

export function fetchPrefs(hass: HomeAssistant): Promise<EnergyPrefs | null> {
  const key = (hass.connection as object | undefined) ?? hass;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass.callWS<EnergyPrefs>({ type: 'energy/get_prefs' }).catch(() => null);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}
