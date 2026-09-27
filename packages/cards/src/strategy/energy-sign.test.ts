import { describe, expect, it } from 'vitest';
import { exportPositive, type HourMean } from './energy-sign.js';

const day = (values: readonly number[]): HourMean[] =>
  values.map((mean, i) => ({ start: i * 3600_000, mean }));
// a sunny day: nothing at night, production from 8 to 19
const SUN = day([
  0, 0, 0, 0, 0, 0, 0, 0, 200, 900, 2000, 3000, 3200, 3100, 2600, 1800, 900, 300, 50, 0, 0, 0, 0, 0,
]);

describe('exportPositive', () => {
  it('reads a meter that is negative in the dark hours as signed the other way', () => {
    const meter = day(SUN.map((h) => (h.mean ? 400 - (h.mean as number) : -1300)));
    expect(exportPositive(meter, SUN)).toBe(true);
  });

  it('keeps a meter that imports as positive at night', () => {
    const meter = day(SUN.map((h) => (h.mean ? (h.mean as number) * -0.5 : 1300)));
    expect(exportPositive(meter, SUN)).toBe(false);
  });

  it('without solar every hour is dark: a house cannot export', () => {
    expect(exportPositive(day(Array(24).fill(-800)), undefined)).toBe(true);
    expect(exportPositive(day(Array(24).fill(800)), undefined)).toBe(false);
  });

  it('cannot tell from fewer than three dark hours, or without readings', () => {
    expect(exportPositive(day([-500, -500]), undefined)).toBe(false);
    expect(exportPositive(day([]), SUN)).toBe(false);
  });
});
