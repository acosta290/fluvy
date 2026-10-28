import { describe, expect, it } from 'vitest';

import { arcDash, arcPath, knobAt, polar, radialTicks } from './ring.js';

describe('rings', () => {
  it('find a point on the circle, clockwise from three o’clock', () => {
    const [x, y] = polar(50, 50, 10, 90);
    expect(x).toBeCloseTo(50, 9);
    expect(y).toBeCloseTo(60, 9);
  });

  it('draw an arc, the large one past half a turn', () => {
    expect(arcPath(50, 50, 10, 0, 90)).toBe('M60.00,50.00 A10,10 0 0 1 50.00,60.00');
    expect(arcPath(50, 50, 10, 135, 405)).toMatch(/ A10,10 0 1 1 /);
  });

  it('light a share of the circle as a dash, an outside share at the nearest end, none for nothing', () => {
    const circumference = (2 * Math.PI * 10).toFixed(1);
    expect(arcDash(0.5, 10)).toBe(`${(Math.PI * 10).toFixed(1)} ${circumference}`);
    expect(arcDash(2, 10)).toBe(`${circumference} ${circumference}`);
    expect(arcDash(null, 10)).toBe(`0.0 ${circumference}`);
  });

  it('place ticks over a sweep, inward by their length, lit by the rule', () => {
    const ticks = radialTicks({
      cx: 0,
      cy: 0,
      r: 10,
      count: 3,
      from: 0,
      sweep: 180,
      length: (i) => (i === 1 ? 4 : 2),
      lit: (_i, place) => place <= 0.5,
    });
    expect(ticks.map((t) => t.lit)).toEqual([true, true, false]);
    expect(ticks[1]?.y1).toBeCloseTo(10, 9);
    expect(ticks[1]?.y2).toBeCloseTo(6, 9);
  });

  it('put a knob at its share of the sweep, clamped to its ends', () => {
    const [x, y] = knobAt(0, 0, 10, -90, 360, 0.25);
    expect(x).toBeCloseTo(10, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(knobAt(0, 0, 10, 0, 90, 3)).toEqual(knobAt(0, 0, 10, 0, 90, 1));
  });
});
