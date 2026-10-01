import { describe, expect, it } from 'vitest';
import {
  fractionOf,
  labelRoom,
  signedGeometry,
  ticksOf,
  TICKS,
  valueBox,
  valueRoom,
} from './signed.js';

describe('the signed gauge', () => {
  it('is the approved drawing at 320: R 104 about (160, 124), the ends beside its feet, 220 tall', () => {
    const g = signedGeometry(320, 46);
    expect([g.r, g.cx, g.cy, g.major, g.minor]).toEqual([104, 160, 124, 16, 8]);
    expect([g.endsTop, g.endsLeft, g.endsRight, g.height]).toEqual([196, 36, 36, 220]);
    expect(valueBox(g, 'l')).toEqual({ label: 88, value: 104 });
  });

  it('shrinks to a narrow column and puts the ends’ words under its feet, on the grid', () => {
    const g = signedGeometry(136, 46);
    expect(g.r).toBe(64);
    expect(g.endsLeft).toBe(0);
    expect(g.endsRight).toBe(0);
    expect(g.endsTop % 4).toBe(0);
    expect(g.height % 4).toBe(0);
    // the ends' words start under the feet of the ring
    expect(g.endsTop).toBeGreaterThanOrEqual(g.cy + g.r * Math.SQRT1_2);
  });

  it('keeps the ring beside long end words by shrinking it, while it can', () => {
    const g = signedGeometry(320, 100);
    expect(g.r).toBe(80);
    expect(g.endsLeft).toBeGreaterThanOrEqual(0);
  });

  it('puts zero at the top: each side its own scale', () => {
    expect(fractionOf(-1800, -5000, 5000)).toBeCloseTo(-0.36, 10);
    expect(fractionOf(2400, -1000, 4000)).toBeCloseTo(0.6, 10);
    expect(fractionOf(-800, -400, 5000)).toBe(-1);
    expect(fractionOf(0, -5000, 5000)).toBe(0);
  });

  it('lights the ticks from zero to the value, the zero tick with them; none when unknown', () => {
    const g = signedGeometry(320, 46);
    const ticks = ticksOf(g, -0.36);
    expect(ticks).toHaveLength(TICKS + 1);
    const lit = ticks.flatMap((t, i) => (t.lit ? [i] : []));
    expect(lit).toEqual([13, 14, 15, 16, 17, 18, 19, 20]);
    // the zero tick stands straight up at the top
    const zero = ticks[TICKS / 2]!;
    expect(zero.x1).toBeCloseTo(160, 6);
    expect(zero.y1).toBeCloseTo(20, 6);
    expect(zero.y2).toBeCloseTo(36, 6);
    expect(ticksOf(g, 0.5).filter((t) => t.lit)).toHaveLength(11);
    expect(ticksOf(g, null).some((t) => t.lit)).toBe(false);
  });

  it('measures the room inside the ring for the value and its label', () => {
    const g = signedGeometry(320, 46);
    expect(valueRoom(g, 'l')).toBeCloseTo(2 * Math.sqrt(84 * 84 - 24 * 24), 6);
    expect(labelRoom(g, 'l')).toBe(150);
    expect(valueRoom(signedGeometry(136, 46), 'm')).toBeGreaterThan(80);
  });
});
