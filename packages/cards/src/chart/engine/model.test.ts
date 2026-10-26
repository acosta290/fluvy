import { describe, expect, it } from 'vitest';

import { evenly, sampleAt } from './model.js';

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
