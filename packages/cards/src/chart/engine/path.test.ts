import { describe, expect, it } from 'vitest';

import { areaPath, bandPath, linePath, runsOf, splitAt, yAt, type Pt } from './path.js';

/** Readings evenly spaced over 120 on a 0 … 10 scale 50 tall: the plot `yAt` is checked on. */
const plot = (values: ReadonlyArray<number | null>): Array<Pt | null> =>
  values.map((v, i) => (v === null ? null : [(i / (values.length - 1)) * 120, 50 - v * 5]));

describe('a line', () => {
  it('joins its readings smoothly (Catmull-Rom, tension 1/6), straight, or held across each slot', () => {
    const points: Pt[] = [
      [0, 50],
      [50, 0],
      [100, 50],
    ];
    expect(linePath(points, 'smooth')).toBe(
      'M0.00,50.00 C8.33,41.67 33.33,0.00 50.00,0.00 C66.67,0.00 91.67,41.67 100.00,50.00',
    );
    expect(linePath(points, 'straight')).toBe('M0.00,50.00 L50.00,0.00 L100.00,50.00');
    expect(linePath(points, 'step')).toBe('M0.00,50.00 H50.00 V0.00 H100.00 V50.00');
  });

  it('breaks at a gap (a new M), draws nothing for a lone reading between gaps, nothing for one reading', () => {
    expect(linePath(plot([1, 2, null, 4, 5]), 'straight')).toBe(
      'M0.00,45.00 L30.00,40.00 M90.00,30.00 L120.00,25.00',
    );
    expect(linePath(plot([1, null, 4, null, 5]), 'straight')).toBe('');
    expect(linePath([[0, 0]], 'smooth')).toBe('');
    expect(runsOf(plot([1, 2, null, 4])).map((run) => run.at)).toEqual([0, 3]);
  });
});

describe('the area under a line', () => {
  it('closes each run on the floor, its end to two decimals and its start as short as it goes', () => {
    expect(
      areaPath(
        [
          [0, 10],
          [100, 0],
        ],
        'straight',
        50,
      ),
    ).toBe('M0.00,10.00 L100.00,0.00 L100.00,50.00 L0,50.00 Z');
    // a lone classic curve writes its floor bare, as 1.0 did
    expect(
      areaPath(
        [
          [0, 10],
          [100, 0],
        ],
        'straight',
        120,
        '120',
      ),
    ).toBe('M0.00,10.00 L100.00,0.00 L100.00,120 L0,120 Z');
  });

  it('leaves the floor bare under a gap, and is nothing where there is no line', () => {
    expect(areaPath(plot([1, 2, null, 4, 5]), 'straight', 50)).toBe(
      'M0.00,45.00 L30.00,40.00 L30.00,50.00 L0,50.00 Z M90.00,30.00 L120.00,25.00 L120.00,50.00 L90,50.00 Z',
    );
    expect(areaPath([], 'smooth', 50)).toBe('');
  });
});

describe('a band', () => {
  it('runs across the highs and back along the lows, closed', () => {
    expect(
      bandPath(
        [
          [0, 50],
          [100, 50],
        ],
        [
          [0, 0],
          [100, 0],
        ],
      ),
    ).toBe('M0.00,0.00 L100.00,0.00 L100.00,50.00 L0.00,50.00 Z');
    expect(bandPath([[0, 1]], [[0, 0]])).toBe('');
  });
});

describe('where the drawn line is', () => {
  const values = [3, 9, 1, 7, 2, 8, 4];
  const points = plot(values);

  it('passes through every reading, and stays near the pair it joins between them', () => {
    values.forEach((v, i) =>
      expect(yAt(points, 'smooth', (i / 6) * 120)).toBeCloseTo(50 - v * 5, 6),
    );
    for (let x = 0; x <= 120; x += 0.5) {
      const y = yAt(points, 'smooth', x) as number;
      expect(y).toBeGreaterThanOrEqual(-8);
      expect(y).toBeLessThanOrEqual(58);
    }
  });

  it('holds a step’s reading to the next, joins a straight line, and is nothing in a gap or past the ends', () => {
    expect(yAt(points, 'step', 10)).toBe(35);
    expect(yAt(points, 'straight', 10)).toBeCloseTo(20, 9);
    expect(yAt(plot([1, 2, null, 4, 5]), 'straight', 60)).toBeNull();
    expect(yAt(points, 'smooth', 121)).toBeNull();
    expect(yAt([[0, 0]], 'smooth', 0)).toBeNull();
  });
});

describe('what has happened and what is forecast', () => {
  const points: Pt[] = [
    [0, 10],
    [10, 20],
    [20, 30],
    [30, 40],
  ];

  it('share the point at now, so the forecast starts where the past ends', () => {
    expect(splitAt(points, 1, 'smooth')).toEqual({
      past: points.slice(0, 2),
      future: points.slice(1),
    });
    expect(splitAt(points, 3, 'smooth')).toEqual({ past: points, future: [] });
  });

  it('runs a step’s past on to its slot’s end, where its forecast starts', () => {
    // a step's points carry the last slot's end: three readings, four points
    expect(splitAt(points, 1, 'step')).toEqual({
      past: [points[0], points[1], [20, 20]],
      future: [[20, 20], points[2], points[3]],
    });
    expect(splitAt(points, 2, 'step')).toEqual({ past: points, future: [] });
  });
});
