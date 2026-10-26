import type { HomeAssistant } from '@fluvy/core';
import { houseMidnight, rangeOf, stepFor, type Period, type Range, type Step } from './period.js';

/**
 * The grid's fossil energy over a range, asked the way the Energy dashboard asks it (`getFossilEnergyConsumption`
 * in Home Assistant's frontend): the grid's import meters weighed hour by hour (day by day over a week or a month)
 * by the grid's fossil share, a CO₂ signal sensor in %. The answer is kWh per bucket; the range's is their sum.
 */

/** The house's CO₂ signal, as the Energy dashboard finds it: the first `co2signal` entity whose unit is %. */
export function co2SignalOf(hass: HomeAssistant | undefined): string | undefined {
  for (const entry of Object.values(hass?.entities ?? {})) {
    if (entry.platform !== 'co2signal') continue;
    const state = hass?.states[entry.entity_id];
    if (state?.attributes.unit_of_measurement === '%') return state.entity_id;
  }
  return undefined;
}

/** The buckets' sum, as Home Assistant answers them; `null` when it could not tell. */
export function fossilOf(
  answer: Readonly<Record<string, number>> | null | undefined,
): number | null {
  if (!answer || typeof answer !== 'object') return null;
  const values = Object.values(answer).map(Number);
  return values.every(Number.isFinite) ? values.reduce((sum, v) => sum + v, 0) : null;
}

const cache = new Map<string, { at: number; promise: Promise<number | null> }>();
const TTL = 5 * 60_000;

/** Resolves the range's fossil energy in kWh, or `null` when Home Assistant cannot tell. */
export function fetchFossilRange(
  hass: HomeAssistant,
  imports: readonly string[],
  co2: string,
  range: Range,
  step: Exclude<Step, '5minute'> = stepFor(range),
): Promise<number | null> {
  if (!imports.length) return Promise.resolve(null);
  // an open range ends with today, in the house's zone (tomorrow's midnight, found from tomorrow's own clock)
  const end = range.end ?? houseMidnight(hass, new Date(Date.now() + 86_400_000));
  const key = `${range.start.toISOString()}|${end.toISOString()}|${step}|${co2}|${imports.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass
    .callWS<Record<string, number> | null>({
      type: 'energy/fossil_energy_consumption',
      start_time: range.start.toISOString(),
      end_time: end.toISOString(),
      energy_statistic_ids: [...imports],
      co2_statistic_id: co2,
      period: step,
    })
    .then(fossilOf)
    .catch(() => null);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** A period's fossil energy up to the end of today: `fetchFossilRange` in an hour's buckets for a day and a day's otherwise. */
export const fetchFossil = (
  hass: HomeAssistant,
  imports: readonly string[],
  co2: string,
  period: Period,
  now: Date,
): Promise<number | null> =>
  fetchFossilRange(
    hass,
    imports,
    co2,
    {
      ...rangeOf(hass, now, period),
      end: houseMidnight(hass, new Date(now.getTime() + 86_400_000)),
    },
    period === 'day' ? 'hour' : 'day',
  );

export const clearFossilCache = (): void => cache.clear();
