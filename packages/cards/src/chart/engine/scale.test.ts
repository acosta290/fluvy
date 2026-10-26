import { describe, expect, it } from 'vitest';

import { airScale, niceStep, niceTicks, tightScale, unitScale, yOf } from './scale.js';

describe('a nice step', () => {
  it('is 1, 2, 2.5 or 5 times a power of ten, the smallest that spans the range in four steps or fewer', () => {
    expect(niceStep(35.4)).toEqual({ step: 10, decimals: 0 });
    expect(niceStep(28.7)).toEqual({ step: 10, decimals: 0 });
    expect(niceStep(16.8)).toEqual({ step: 5, decimals: 0 });
    expect(niceStep(203)).toEqual({ step: 100, decimals: 0 });
    expect(niceStep(11)).toEqual({ step: 5, decimals: 0 });
    expect(niceStep(9)).toEqual({ step: 2.5, decimals: 1 });
    expect(niceStep(2.9)).toEqual({ step: 1, decimals: 0 });
    expect(niceStep(0.45)).toEqual({ step: 0.2, decimals: 1 });
    expect(niceStep(1200)).toEqual({ step: 500, decimals: 0 });
  });

  it('takes the intervals asked for, and answers 1 for nothing', () => {
    expect(niceStep(35.4, 4)).toEqual({ step: 10, decimals: 0 });
    expect(niceStep(35.4, 8)).toEqual({ step: 5, decimals: 0 });
    expect(niceStep(0)).toEqual({ step: 1, decimals: 0 });
    expect(niceStep(Number.NaN)).toEqual({ step: 1, decimals: 0 });
  });
});

describe('nice ticks', () => {
  it('run from zero to a tick above the highest bar', () => {
    expect(niceTicks(0, 35.4).ticks).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(0, 16.8).ticks).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(0, 28.7).ticks).toEqual([0, 10, 20, 30]);
    expect(niceTicks(0, 0.45)).toEqual({
      min: 0,
      max: 0.6,
      step: 0.2,
      ticks: [0, 0.2, 0.4, 0.6],
      decimals: 1,
    });
  });

  it('always hold zero: a scale of positive readings starts there, a signed one crosses it on a tick', () => {
    expect(niceTicks(12, 24).ticks).toEqual([0, 10, 20, 30]);
    expect(niceTicks(-3.2, 8.1).ticks).toEqual([-5, 0, 5, 10]);
    expect(niceTicks(-40, 0).ticks).toEqual([-40, -30, -20, -10, 0]);
  });

  it('never run to more than four intervals: a signed scale widened to whole ticks takes the next step', () => {
    // by 2.5 these widen to five intervals (the flow sheet's hybrid inverter read −7.5 … 5.0)
    expect(niceTicks(-5.05, 2.55).ticks).toEqual([-10, -5, 0, 5]);
    expect(niceTicks(-2.55, 5.05).ticks).toEqual([-5, 0, 5, 10]);
    expect(niceTicks(-0.01, 7.56).ticks).toEqual([-5, 0, 5, 10]);
    expect(niceTicks(-7.56, 0.01).ticks).toEqual([-10, -5, 0, 5]);
    expect(niceTicks(-0.01, 0.77)).toMatchObject({ ticks: [-0.5, 0, 0.5, 1], decimals: 1 });
    // a scale that holds four by its first step keeps it
    expect(niceTicks(-3.2, 8.1, 3).ticks).toEqual([-5, 0, 5, 10]);
  });

  it('hold both ends and zero in the intervals asked for, over any extent either side of zero', () => {
    const wrong: string[] = [];
    for (let lo = 0; lo >= -30; lo -= 0.11)
      for (let hi = 0; hi <= 30; hi += 0.13)
        for (const intervals of [3, 4]) {
          const { ticks, min, max } = niceTicks(lo, hi, intervals);
          if (
            ticks.length - 1 > intervals ||
            min > lo + 1e-9 ||
            max < hi - 1e-9 ||
            !ticks.includes(0)
          )
            wrong.push(`${lo.toFixed(2)} … ${hi.toFixed(2)} in ${intervals}: ${ticks.join(' ')}`);
        }
    expect(wrong).toEqual([]);
  });

  it('is the one tick, zero, for a set with nothing in it', () => {
    expect(niceTicks(0, 0)).toEqual({ min: 0, max: 0, step: 0, ticks: [0], decimals: 0 });
    expect(niceTicks(Number.NaN, Number.NaN).ticks).toEqual([0]);
  });
});

describe('a lone series’ own ends', () => {
  it('are its lowest and highest readings; a flat series says so', () => {
    expect(tightScale([3, 9, 1, 7])).toEqual({ min: 1, max: 9, flat: false });
    expect(tightScale([5, 5])).toEqual({ min: 5, max: 5, flat: true });
    expect(tightScale([])).toEqual({ min: 0, max: 1, flat: true });
  });
});

describe('a shared scale with air', () => {
  it('gives the ends a tenth of the range, centres a flat series and can keep the floor at zero', () => {
    expect(airScale([[0, 10]])).toEqual({ min: -1, max: 11 });
    expect(airScale([[5, 5]])).toEqual({ min: 4, max: 6 });
    expect(airScale([[2, 10]], true)).toEqual({ min: 0, max: 10.8 });
    expect(airScale([[]])).toEqual({ min: 0, max: 1 });
  });

  it('reads past the gaps of several series', () => {
    expect(
      airScale([
        [0, null, 10],
        [null, 5],
      ]),
    ).toEqual({ min: -1, max: 11 });
  });
});

describe('where a value sits', () => {
  const box = { top: 0, bottom: 50 };
  it('puts the scale’s top on the plot’s top and its floor on the plot’s floor', () => {
    expect(yOf(10, { min: 0, max: 10 }, box)).toBe(0);
    expect(yOf(0, { min: 0, max: 10 }, box)).toBe(50);
    expect(yOf(5, { min: 0, max: 10 }, box)).toBe(25);
  });

  it('keeps a reading past the scale on its edge, never outside the plot, and a flat scale in the middle', () => {
    expect(yOf(99, { min: 0, max: 10 }, box)).toBe(0);
    expect(yOf(-4, { min: 0, max: 10 }, { top: 44, bottom: 112 })).toBe(112);
    expect(yOf(5, { min: 5, max: 5 }, { top: 44, bottom: 112 })).toBe(78);
  });
});

describe('the unit a set of figures is written in', () => {
  it('is chosen by the largest, up to giga, for the base units that scale', () => {
    expect(unitScale(3200, 'W')).toEqual({ unit: 'kW', divisor: 1000 });
    expect(unitScale(400, 'W')).toEqual({ unit: 'W', divisor: 1 });
    expect(unitScale(-2.5e6, 'Wh')).toEqual({ unit: 'MWh', divisor: 1e6 });
    expect(unitScale(4e9, 'VA')).toEqual({ unit: 'GVA', divisor: 1e9 });
  });

  it('passes any other unit, and a figure that is not one, through', () => {
    expect(unitScale(12_000, 'L')).toEqual({ unit: 'L', divisor: 1 });
    expect(unitScale(Number.NaN, 'W')).toEqual({ unit: 'W', divisor: 1 });
  });
});
