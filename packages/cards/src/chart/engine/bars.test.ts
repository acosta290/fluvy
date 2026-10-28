import { describe, expect, it } from 'vitest';

import { barGeometry, barPath, columns, labelled, labelsApart, thinStep } from './bars.js';

describe('date labels', () => {
  it('thin to every n-th bar so neighbours keep 12 px, and never under every bar', () => {
    expect(thinStep(38, 276 / 7)).toBe(2); // "Oct 03" at 39 a slot: 50 over 39.4 → every second day
    expect(thinStep(20, 276 / 7)).toBe(1);
    expect(thinStep(38, 276 / 30)).toBe(6);
    expect(thinStep(38, 0)).toBe(1);
  });

  it('stand apart once placed: a label kept inside the plot at an end may crowd its neighbour', () => {
    expect(
      labelsApart([
        { x: 20, width: 40 },
        { x: 80, width: 40 },
      ]),
    ).toBe(true); // 40 … 60: 20 apart
    expect(
      labelsApart([
        { x: 20, width: 40 },
        { x: 70, width: 40 },
      ]),
    ).toBe(false); // 40 … 50: 10 apart
    expect(labelsApart([{ x: 20, width: 40 }])).toBe(true);
    expect(labelsApart([])).toBe(true);
  });

  it('keep the last bar labelled, counting back from it', () => {
    expect(labelled(7, 1)).toEqual([true, true, true, true, true, true, true]);
    expect(labelled(7, 2)).toEqual([true, false, true, false, true, false, true]);
    expect(labelled(30, 6).filter(Boolean).length).toBe(5);
    expect(labelled(30, 6)[29]).toBe(true);
    expect(labelled(30, 6)[0]).toBe(false);
  });
});

describe('a bar in its slot', () => {
  it('takes 40 % of the slot on whole pixels, between 2 and 40, its corners 4 at most', () => {
    expect(barGeometry(7, 276)).toEqual({ slot: 276 / 7, bar: 16, radius: 4 });
    expect(barGeometry(92, 276).bar).toBe(2);
    expect(barGeometry(92, 276).radius).toBe(1);
    expect(barGeometry(3, 700).bar).toBe(40);
    expect(barGeometry(0, 276).bar).toBe(40);
  });
});

describe('a bar as a path', () => {
  it('is rounded at the top and flat on the zero line, or the other way round for a bar that hangs', () => {
    expect(barPath(10, 20, 16, 40, 4, 'top')).toBe('M10,24a4,4 0 0 1 4,-4h8a4,4 0 0 1 4,4v36h-16z');
    expect(barPath(10, 20, 16, 40, 4, 'bottom')).toBe(
      'M10,20h16v36a4,4 0 0 1 -4,4h-8a4,4 0 0 1 -4,-4z',
    );
  });

  it('never rounds more than half the bar, however short or thin', () => {
    expect(barPath(0, 0, 16, 2, 4, 'top')).toBe('M0,1a1,1 0 0 1 1,-1h14a1,1 0 0 1 1,1v1h-16z');
    expect(barPath(0, 0, 2, 40, 4, 'top')).toBe('M0,1a1,1 0 0 1 1,-1h0a1,1 0 0 1 1,1v39h-2z');
    expect(barPath(0.25, 3.33, 16, 40, 4, 'top').startsWith('M0.3,7.3a4,4')).toBe(true);
  });

  it('is rounded at both ends for a bar that floats clear of its axis', () => {
    expect(barPath(10, 20, 16, 40, 4, 'both')).toBe(
      'M10,24a4,4 0 0 1 4,-4h8a4,4 0 0 1 4,4v32a4,4 0 0 1 -4,4h-8a4,4 0 0 1 -4,-4z',
    );
  });
});

describe('columns', () => {
  // a plot 100 tall, 0 on its floor: a value is its own height
  const y = (v: number): number => 100 - v;

  it('draws one bar a slot for one series, from the zero line, rounded at the end away from it', () => {
    const drawn = columns({ series: [[10, null, 30]], count: 3, left: 0, width: 300, y });
    expect(drawn.map((c) => [c.slot, c.y, c.height, c.sign])).toEqual([
      [0, 90, 10, 1],
      [2, 70, 30, 1],
    ]);
    expect(drawn[0]?.d).toBe(barPath(30, 90, 40, 10, 4, 'top'));
  });

  it('stacks several by sign, only the outermost segment of each sign rounded', () => {
    const drawn = columns({ series: [[10], [20], [-5]], count: 1, left: 0, width: 100, y });
    expect(drawn.map((c) => [c.series, c.y, c.height, c.outer])).toEqual([
      [0, 90, 10, false],
      [1, 70, 20, true],
      [2, 100, 5, true],
    ]);
    expect(drawn[0]?.d).toBe(barPath(30, 90, 40, 10, 0, 'top'));
    expect(drawn[2]?.d).toBe(barPath(30, 100, 40, 5, 4, 'bottom'));
  });

  it('rounds both ends where asked, keeps a trickle visible, and draws nothing for nothing', () => {
    const both = columns({ series: [[10]], count: 1, left: 0, width: 100, y, caps: 'both' });
    expect(both[0]?.d).toBe(barPath(30, 90, 40, 10, 4, 'both'));
    const trickle = columns({ series: [[0.2]], count: 1, left: 0, width: 100, y, least: 2 });
    expect(trickle[0]?.height).toBe(2);
    expect(columns({ series: [[0, null]], count: 2, left: 0, width: 100, y })).toEqual([]);
  });
});
