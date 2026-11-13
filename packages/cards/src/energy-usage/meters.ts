import type { HomeAssistant } from '@fluvy/core';
import type { Statistics } from '../energy-model/collection.js';
import { forgetStale, type Range, type Step } from '../energy-model/period.js';
import { unitsFor } from '../history-bars/units.js';

/**
 * What water or gas meters measured over a range, from Home Assistant's long-term statistics: each one's change in
 * every `step` bucket, asked in `unit` (Home Assistant converts a meter read in another unit of its class, and an
 * imported statistic is one like any other). One request for every meter, kept five minutes; null where the
 * statistics cannot be read.
 */

const cache = new Map<string, { at: number; promise: Promise<Statistics | null> }>();
const TTL = 5 * 60_000;

export function fetchMeters(
  hass: HomeAssistant,
  ids: readonly string[],
  range: Range,
  step: Step,
  unit: string,
): Promise<Statistics | null> {
  const key = `${range.start.toISOString()}|${range.end?.toISOString() ?? ''}|${step}|${unit}|${ids.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const units = unitsFor(unit);
  const promise = hass
    .callWS<Statistics>({
      type: 'recorder/statistics_during_period',
      start_time: range.start.toISOString(),
      ...(range.end ? { end_time: range.end.toISOString() } : {}),
      statistic_ids: [...ids],
      period: step,
      types: ['change'],
      ...(units ? { units } : {}),
    })
    .then((rows) => rows ?? {})
    .catch(() => null);
  forgetStale(cache);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export const clearMeterRanges = (): void => cache.clear();
