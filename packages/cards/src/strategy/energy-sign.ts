import type { HomeAssistant } from '@fluvy/core';

/** One hour of a power sensor's long-term statistics. */
export interface HourMean {
  readonly start: number;
  readonly mean?: number | null;
}

/**
 * Whether a grid power meter counts what the house imports as negative (and exports as positive) — the
 * opposite of the flow card's convention. The energy dashboard's preferences say so when they carry the
 * grid's power sensor; when the strategy found the meter by its name instead, the last day answers it:
 * in the hours without production a house can only import, so a meter that reads mostly negative then is
 * signed the other way. Without a single dark hour (or with a battery, which can export at night) it cannot
 * tell, and keeps the card's convention.
 */
export function exportPositive(
  grid: readonly HourMean[],
  solar: readonly HourMean[] | undefined,
): boolean {
  const production = new Map((solar ?? []).map((hour) => [hour.start, Math.abs(hour.mean ?? 0)]));
  const peak = Math.max(0, ...production.values());
  const dark = grid.filter(
    (hour): hour is HourMean & { mean: number } =>
      typeof hour.mean === 'number' && (production.get(hour.start) ?? 0) <= peak * 0.01,
  );
  if (dark.length < 3) return false;
  return dark.filter((hour) => hour.mean < 0).length > dark.length / 2;
}

/** `exportPositive` on the last 24 hours of the recorder's hourly statistics; false when they cannot be read. */
export async function gridExportPositive(
  hass: HomeAssistant,
  grid: string,
  solar: string | undefined,
): Promise<boolean> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  try {
    const stats = await hass.callWS<Record<string, readonly HourMean[] | undefined>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: solar ? [grid, solar] : [grid],
      period: 'hour',
      types: ['mean'],
    });
    const hours = stats?.[grid];
    return Array.isArray(hours)
      ? exportPositive(hours, solar ? (stats[solar] ?? []) : undefined)
      : false;
  } catch {
    return false;
  }
}
