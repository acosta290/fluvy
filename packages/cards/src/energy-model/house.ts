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

/** What `energy/solar_forecast` answers: by forecasting config entry, the Wh each stretch is expected to make, by the instant it starts. */
export type SolarForecasts = Readonly<
  Record<string, { readonly wh_hours?: Readonly<Record<string, number>> } | undefined>
>;

const forecasts = new WeakMap<object, { hour: number; promise: Promise<SolarForecasts | null> }>();
const HOUR = 3_600_000;

/**
 * The forecasts of the house's arrays, asked once per connection and hour of the clock (an integration refreshes its
 * own a few times a day; every card on a view asks the same question). `null` when they cannot be read, which is not
 * kept: the next card to ask asks Home Assistant again.
 */
export function fetchSolarForecast(
  hass: HomeAssistant,
  now = Date.now(),
): Promise<SolarForecasts | null> {
  const key = (hass.connection as object | undefined) ?? hass;
  const hour = Math.floor(now / HOUR);
  const hit = forecasts.get(key);
  if (hit?.hour === hour) return hit.promise;
  const promise = hass.callWS<SolarForecasts>({ type: 'energy/solar_forecast' }).catch(() => null);
  forecasts.set(key, { hour, promise });
  void promise.then((answer) => {
    if (answer === null && forecasts.get(key)?.promise === promise) forecasts.delete(key);
  });
  return promise;
}
