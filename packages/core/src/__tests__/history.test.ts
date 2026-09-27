import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant } from '../ha/types.js';
import {
  clearHistoryCache,
  fetchHistory,
  fetchStatistics,
  resample,
  summarise,
} from '../history/series.js';

describe('history', () => {
  it('resamples to evenly spaced points holding the last known value', () => {
    const points = [
      { t: 0, v: 1 },
      { t: 50, v: 3 },
      { t: 90, v: 7 },
    ];
    expect(resample(points, 0, 100, 4)).toEqual([1, 3, 3, 7]);
  });
  it('returns nothing for an empty series and summarises the rest', () => {
    expect(resample([], 0, 100, 4)).toEqual([]);
    expect(summarise([])).toBeNull();
    expect(summarise([1, 2, 3])).toMatchObject({ min: 1, max: 3, average: 2 });
  });
});

describe('history cache', () => {
  afterEach(() => {
    clearHistoryCache();
    vi.useRealTimers();
  });

  const hassWith = (callWS: HomeAssistant['callWS']): HomeAssistant =>
    ({ callWS }) as unknown as HomeAssistant;
  // rows spread over the last day, oldest first (`lu` is seconds)
  const rows = (values: readonly (string | number)[]) => ({
    'sensor.t': values.map((s, i) => ({
      s: String(s),
      lu: Date.now() / 1000 - 86_400 + ((i + 1) / (values.length + 1)) * 86_400,
    })),
  });

  it('shares one call per entity and window between cards for five minutes', async () => {
    const callWS = vi.fn(async () => rows([1, 2, 3]));
    const hass = hassWith(callWS as unknown as HomeAssistant['callWS']);
    const [a, b] = await Promise.all([
      fetchHistory(hass, 'sensor.t', 24, 4),
      fetchHistory(hass, 'sensor.t', 24, 4),
    ]);
    expect(callWS).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    await fetchHistory(hass, 'sensor.t', 6, 4); // another window is another key
    expect(callWS).toHaveBeenCalledTimes(2);
  });

  it('does not remember a failed fetch: the next card retries', async () => {
    let fail = true;
    const callWS = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return rows([5, 6]);
    });
    const hass = hassWith(callWS as unknown as HomeAssistant['callWS']);
    expect(await fetchHistory(hass, 'sensor.t')).toBeNull();
    fail = false;
    expect(await fetchHistory(hass, 'sensor.t')).toMatchObject({ min: 5, max: 6 });
    expect(callWS).toHaveBeenCalledTimes(2);
  });

  it('ignores states that are not numbers, including the empty string', async () => {
    const hass = hassWith((async () =>
      rows(['', 'unavailable', '4', 'unknown', '2'])) as unknown as HomeAssistant['callWS']);
    const series = await fetchHistory(hass, 'sensor.t', 24, 2);
    expect(series).toMatchObject({ min: 2, max: 4 });
  });

  it('keeps statistics and history apart even for the same entity', async () => {
    const callWS = vi.fn(async (message: { type: string }) =>
      message.type === 'recorder/statistics_during_period'
        ? {
            'sensor.t': [
              { start: 0, end: 1, change: 1.5 },
              { start: 1, end: 2, change: null },
            ],
          }
        : rows([9, 9]),
    );
    const hass = hassWith(callWS as unknown as HomeAssistant['callWS']);
    expect(await fetchStatistics(hass, 'sensor.t', new Date(0))).toEqual([1.5, 0]);
    expect(await fetchHistory(hass, 'sensor.t')).toMatchObject({ min: 9 });
    expect(callWS).toHaveBeenCalledTimes(2);
  });

  it('expires after the TTL', async () => {
    vi.useFakeTimers();
    const callWS = vi.fn(async () => rows([1]));
    const hass = hassWith(callWS as unknown as HomeAssistant['callWS']);
    await fetchHistory(hass, 'sensor.t');
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    await fetchHistory(hass, 'sensor.t');
    expect(callWS).toHaveBeenCalledTimes(2);
  });
});
