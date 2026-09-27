import type { HomeAssistant } from '../ha/types.js';
import type { HistoryPeriod } from './types.js';
import type { Statistics } from './window.js';

/**
 * The recorder's long-term statistics for a window: one row per period with its mean and the ends it moved between.
 * A window wider than a couple of days is read this way — the recorder purges states long before its statistics.
 */
export async function fetchWindowStatistics(
  hass: HomeAssistant,
  entityIds: readonly string[],
  start: Date,
  end: Date,
  period: Exclude<HistoryPeriod, 'raw'>,
): Promise<Statistics> {
  if (!entityIds.length) return {};
  // a period is stamped at its start: reading one period earlier fills the first one the window shows
  const from = new Date(start.getTime() - (period === 'hour' ? 3_600_000 : 86_400_000));
  try {
    return await hass.callWS<Statistics>({
      type: 'recorder/statistics_during_period',
      start_time: from.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: [...entityIds],
      period,
      types: ['mean', 'min', 'max', 'state'],
    });
  } catch {
    return {}; // no statistics (a house without a recorder, an entity that keeps none): the states are the history
  }
}
