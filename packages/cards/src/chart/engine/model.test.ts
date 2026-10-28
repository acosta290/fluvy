import { describe, expect, it } from 'vitest';

import { bucket, evenly, sampleAt } from './model.js';

describe('readings evenly spaced across a window', () => {
  it('read the last reading at or before each slot’s end: a recorder’s reading holds until the next', () => {
    const points = [
      { t: 0, v: 1 },
      { t: 25, v: 2 },
      { t: 70, v: 3 },
    ];
    expect(evenly(points, { start: 0, end: 100 }, 4)).toEqual([2, 2, 3, 3]);
  });

  it('are a gap before the first reading, and where a reading is itself a gap', () => {
    expect(
      evenly(
        [
          { t: 40, v: 5 },
          { t: 60, v: null },
        ],
        { start: 0, end: 100 },
        4,
      ),
    ).toEqual([null, 5, null, null]);
    expect(evenly([], { start: 0, end: 1 }, 0)).toEqual([]);
  });
});

describe('a series read at a fraction of its length', () => {
  it('interpolates between the two nearest readings, clamped to the ends', () => {
    expect(sampleAt([10, 20, 30], 0.25)).toBe(15);
    expect(sampleAt([10, 20, 30], 1)).toBe(30);
    expect(sampleAt([10, 20, 30], 2)).toBe(30);
    expect(sampleAt([7], 0.5)).toBe(7);
    expect(sampleAt([], 0.5)).toBeNull();
  });
});

describe('readings gathered into bars', () => {
  it('take a measure’s mean over each slot, at most one bar a reading', () => {
    expect(bucket([1, 3, 5, 7, 9, 11], 3, 'mean')).toEqual([2, 6, 10]);
    expect(bucket([1, 2, 3], 6, 'mean')).toEqual([1, 2, 3]);
    expect(bucket([], 24, 'mean')).toEqual([]);
  });

  it('take what a counter gained over each slot, a reset counted from nothing', () => {
    expect(bucket([10, 11, 13, 16, 20, 25], 3, 'change')).toEqual([1, 5, 9]);
    // from the slot before's last reading: 11 → 2 is a reset (2 counted since), 2 → 9 gained 7
    expect(bucket([10, 11, 13, 2, 4, 9], 3, 'increase')).toEqual([1, 2, 7]);
    expect(bucket([10, 11, 13, 2, 4, 9], 3, 'change')).toEqual([1, -9, 7]);
  });

  it('spread readings that do not divide evenly over the slots', () => {
    expect(bucket([1, 2, 3, 4, 5, 6, 7], 3, 'mean')).toEqual([1.5, 3.5, 6]);
  });
});
