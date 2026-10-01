import type { EntityView, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { houseDay, houseHour, loadDay, loadPowerDay } from './day.js';
import { hourlyForecast } from './forecast.js';

const HOUR = 3_600_000;

/**
 * "Today" is the house's, never the browser's: a house on Kiritimati (UTC+14, a zone no test runner is in) whose
 * user reads the server's time. At 20:00 UTC on the 17th it is 10:00 on the 18th there; the day began at 10:00 UTC.
 */
const ZONE = 'Pacific/Kiritimati';
const NOW = new Date('2026-09-17T20:00:00Z');
const MIDNIGHT = Date.parse('2026-09-17T10:00:00Z');

const house = (answer: (message: Record<string, unknown>) => unknown, asked: unknown[] = []) =>
  ({
    config: { time_zone: ZONE },
    locale: { time_zone: 'server' },
    callWS: async (message: Record<string, unknown>) => {
      asked.push(message);
      return answer(message);
    },
  }) as unknown as HomeAssistant;

describe('the production card reads the house’s day', () => {
  it('places an instant in the house’s hour and date', () => {
    const hass = house(() => ({}));
    expect(houseHour(hass, NOW)).toBe(10);
    expect(houseDay(hass, NOW)).toBe('2026-9-18');
    // the browser's own clock when the user reads their local time
    const local = { ...hass, locale: { time_zone: 'local' } } as unknown as HomeAssistant;
    expect(houseHour(local, NOW)).toBe(NOW.getHours());
  });

  it('asks from the hour before the house’s midnight and files each row under the house’s hour', async () => {
    const asked: Record<string, unknown>[] = [];
    const hass = house(
      () => ({
        'sensor.pv': [
          { start: MIDNIGHT - HOUR, end: MIDNIGHT, change: 0.9, state: 100 }, // yesterday's last hour: the baseline only
          { start: MIDNIGHT + 7 * HOUR, end: MIDNIGHT + 8 * HOUR, change: 0.4, state: 100.4 },
          { start: MIDNIGHT + 8 * HOUR, end: MIDNIGHT + 9 * HOUR, change: 1.1, state: 101.5 },
        ],
      }),
      asked,
    );
    const day = await loadDay(hass, 'sensor.pv', 'kWh', NOW);
    expect(asked[0]).toMatchObject({ start_time: '2026-09-17T09:00:00.000Z', period: 'hour' });
    expect(day?.hours[7]).toBe(0.4);
    expect(day?.hours[8]).toBe(1.1);
    expect(day?.hours.filter((h) => h !== null)).toHaveLength(2);
    expect(day?.baseline).toBe(101.5);
  });

  it('integrates a power sensor: each hour’s mean, and the hour in progress from its five-minute means', async () => {
    const asked: Record<string, unknown>[] = [];
    const hass = house((message) => {
      if (message['period'] === 'hour')
        return {
          'sensor.pv_power': [
            { start: MIDNIGHT + 8 * HOUR, end: MIDNIGHT + 9 * HOUR, mean: 900 },
            { start: MIDNIGHT + 9 * HOUR, end: MIDNIGHT + 10 * HOUR, mean: 1500 },
          ],
        };
      // since 20:00 UTC (the house's 10:00): nothing compiled yet in this test's instant, so ask an hour later below
      return { 'sensor.pv_power': [] };
    }, asked);
    const day = await loadPowerDay(hass, 'sensor.pv_power', NOW);
    expect(day?.hours[8]).toBe(900);
    expect(day?.hours[9]).toBe(1500);
    expect(asked[0]).toMatchObject({
      start_time: '2026-09-17T10:00:00.000Z',
      types: ['mean'],
      units: { power: 'W' },
    });
    expect(asked[1]).toMatchObject({ period: '5minute', start_time: '2026-09-17T20:00:00.000Z' });

    const later = house((message) =>
      message['period'] === 'hour'
        ? { 'sensor.pv_power': [] }
        : {
            'sensor.pv_power': Array.from({ length: 6 }, (_u, i) => ({
              start: MIDNIGHT + 10 * HOUR + i * 300_000,
              end: MIDNIGHT + 10 * HOUR + (i + 1) * 300_000,
              mean: 1200,
            })),
          },
    );
    const half = await loadPowerDay(later, 'sensor.pv_power', new Date(MIDNIGHT + 10.5 * HOUR));
    expect(half?.hours[10]).toBeCloseTo(600); // half an hour at 1.2 kW
  });

  it('files a forecast’s hours on the house’s clock, and leaves another day’s out', () => {
    const view = {
      unit: 'kWh',
      attr: (key: string) =>
        key === 'wh_hours'
          ? {
              '2026-09-18T09:00:00+14:00': 400, // the house's 09:00 today
              '2026-09-17T23:00:00+00:00': 300, // 13:00 in the house, today
              '2026-09-17T09:00:00+14:00': 999, // yesterday there
            }
          : undefined,
    } as unknown as EntityView;
    const day = hourlyForecast(view, NOW, ZONE);
    expect(day?.unit).toBe('Wh');
    expect(day?.hours[9]).toBe(400);
    expect(day?.hours[13]).toBe(300);
    expect(day?.hours.reduce((a, b) => a + b, 0)).toBe(700);
  });
});
