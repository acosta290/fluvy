import { describe, expect, it } from 'vitest';

import { quarterTicks, roundTicks, tickText, type QuartersOptions } from './axis.js';

const HOUR = 3_600_000;
/** 21:47 on a Thursday, in UTC (the labels are written in UTC here). */
const NOW = Date.UTC(2026, 8, 17, 21, 47);
const clock = (t: number): string => new Date(t).toISOString().slice(11, 16);

describe('a tick as a scale writes it', () => {
  it('is the house’s number format with a true minus', () => {
    expect(tickText(undefined, -5, 0)).toBe('−5');
    expect(tickText(undefined, 2.5, 1)).toBe('2.5');
  });
});

describe('a rolling window’s clock (the sensor’s axis)', () => {
  const options = (hours: number, holds: QuartersOptions['holds']): QuartersOptions => ({
    hours,
    now: NOW,
    time: clock,
    daysAgo: (days) => `${days} days ago`,
    nowWord: 'Now',
    holds,
  });

  it('writes the times at the quarters ending in "Now" where five keep 12 apart', () => {
    expect(quarterTicks(options(24, () => true))).toEqual([
      [0, '21:47'],
      [0.25, '03:47'],
      [0.5, '09:47'],
      [0.75, '15:47'],
      [1, 'Now'],
    ]);
  });

  it('keeps three, else the two ends, where five would crowd', () => {
    expect(quarterTicks(options(24, (items) => items.length <= 3)).map(([f]) => f)).toEqual([
      0, 0.5, 1,
    ]);
    expect(quarterTicks(options(24, (items) => items.length <= 2)).map(([f]) => f)).toEqual([0, 1]);
    expect(quarterTicks(options(24, () => false)).map(([f]) => f)).toEqual([0, 1]);
  });

  it('counts days back from two days on', () => {
    expect(quarterTicks(options(48, () => true))).toEqual([
      [0, '2 days ago'],
      [0.5, '1 days ago'],
      [1, 'Now'],
    ]);
    expect(quarterTicks(options(168, () => false))).toEqual([
      [0, '7 days ago'],
      [1, 'Now'],
    ]);
  });
});

describe('a window with two fixed ends (the History page’s axis)', () => {
  const marks = (start: number, end: number, width: number) =>
    roundTicks({
      start,
      end,
      width,
      labelWidth: (text) => text.length * 6,
      time: clock,
      weekday: () => 'Thu',
      day: (t) => new Date(t).toISOString().slice(8, 10),
      date: (t) => new Date(t).toISOString().slice(5, 10),
      dateYear: (t) => new Date(t).toISOString().slice(0, 10),
    });

  it('always says where it starts and where it stops, the round hours between them where they hold', () => {
    const start = Date.UTC(2026, 8, 17, 6, 0);
    const ticks = marks(start, start + 12 * HOUR, 1000);
    expect(ticks[0]).toEqual([0, '06:00']);
    expect(ticks[ticks.length - 1]).toEqual([1, '18:00']);
    expect(ticks.length).toBeGreaterThan(2);
    for (const [fraction] of ticks) expect(fraction).toBeGreaterThanOrEqual(0);
  });

  it('is nothing for a window with no length', () => {
    expect(marks(NOW, NOW, 300)).toEqual([]);
  });
});
