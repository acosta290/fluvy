import { describe, expect, it } from 'vitest';
import {
  areaUnder,
  bandPath,
  curveGeometry,
  plotScale,
  plotY,
  seriesPath,
  seriesY,
} from '../chart.js';
import { isoWeek } from '../clock.js';
import {
  clamp,
  decimalsOf,
  keyValue,
  precisionGain,
  saneRange,
  snap,
  stepOf,
} from '../controls/pointer.js';
import { chipColumns, optionColumns, optionGrid } from '../parts.js';

describe('snap', () => {
  it('lands on the step grid anchored at min, without float dust', () => {
    expect(snap(21.26, 15, 30, 0.5)).toBe(21.5);
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snap(97.4, 0, 100, 1)).toBe(97);
    expect(snap(7, 5, 35, 2)).toBe(7);
  });
  it('clamps to the range and tolerates a missing step', () => {
    expect(snap(140, 0, 100, 1)).toBe(100);
    expect(snap(-3, 0, 100, 1)).toBe(0);
    expect(snap(42.42, 0, 100, 0)).toBe(42.42);
    expect(snap(42.42, 0, 100, Number.NaN)).toBe(42.42);
    expect(snap(42.42, 0, 100, -1)).toBe(42.42);
  });
  it('lands a value that is not a number on min, never NaN', () => {
    expect(snap(Number.NaN, 5, 35, 0.5)).toBe(5);
    expect(snap(Number.POSITIVE_INFINITY, 5, 35, 0.5)).toBe(5);
  });
  it('a step wider than the range can only reach the ends', () => {
    expect(snap(12, 10, 20, 50)).toBe(10);
    expect(snap(20, 10, 20, 50)).toBe(20);
  });
});

describe('decimalsOf', () => {
  it('counts the decimals a step needs', () => {
    expect([1, 0.5, 0.25, 0.1, 2.55, 0.001, 1e-9, 0, Number.NaN].map(decimalsOf)).toEqual([
      0, 1, 2, 1, 2, 3, 6, 0, 0,
    ]);
  });
});

describe('saneRange', () => {
  it('falls back, swaps and keeps an empty range empty', () => {
    expect(saneRange(0, 100)).toEqual([0, 100]);
    expect(saneRange(100, 0)).toEqual([0, 100]);
    expect(saneRange(Number.NaN, Number.NaN)).toEqual([0, 100]);
    expect(saneRange(Number.NaN, Number.NaN, 0, 1)).toEqual([0, 1]);
    expect(saneRange(20, Number.NaN)).toEqual([20, 20]);
    expect(saneRange(Number.NaN, 20)).toEqual([0, 20]);
    expect(saneRange(7, 7)).toEqual([7, 7]);
  });
});

describe("stepOf and keyValue (the ruler's and the dial's keys)", () => {
  const key = (k: string, mods: Partial<KeyboardEventInit> = {}): KeyboardEvent =>
    ({
      key: k,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      ...mods,
    }) as KeyboardEvent;
  it("takes the card's step, or a hundredth of the range", () => {
    expect(stepOf(0.5, 15, 30)).toBe(0.5);
    expect(stepOf(0, 0, 255)).toBe(2.55);
    expect(stepOf(NaN, 5, 5)).toBe(1);
  });
  it('answers the slider keys: a step, five with Shift, a tenth a page, the ends', () => {
    expect(keyValue(key('ArrowUp'), 50, 0, 100, 1)).toBe(51);
    expect(keyValue(key('ArrowLeft', { shiftKey: true }), 50, 0, 100, 1)).toBe(45);
    expect(keyValue(key('PageDown'), 50, 0, 100, 1)).toBe(40);
    expect(keyValue(key('PageUp'), 20, 15, 30, 0.5)).toBe(21.5);
    expect(keyValue(key('Home'), 50, 10, 90, 1)).toBe(10);
    expect(keyValue(key('End'), 50, 10, 90, 1)).toBe(90);
  });
  it('leaves other keys, and chords, to the page', () => {
    expect(keyValue(key('a'), 50, 0, 100, 1)).toBeUndefined();
    expect(keyValue(key('ArrowUp', { ctrlKey: true }), 50, 0, 100, 1)).toBeUndefined();
  });
});

describe('precisionGain', () => {
  it('is 1:1 on the axis and falls to a tenth far from it', () => {
    expect(precisionGain(0)).toBe(1);
    expect(precisionGain(24)).toBe(1);
    expect(precisionGain(72)).toBeCloseTo(0.5, 5);
    expect(precisionGain(2000)).toBe(0.1);
    expect(precisionGain(-72)).toBeCloseTo(0.5, 5);
  });
});

describe('curveGeometry', () => {
  it('needs two points', () => {
    expect(curveGeometry([], { w: 320, h: 120 })).toBeNull();
    expect(curveGeometry([1], { w: 320, h: 120 })).toBeNull();
  });
  it('spans the extent and puts the cursor on the curve at "now"', () => {
    const g = curveGeometry([0, 10], { w: 320, h: 120, pad: 8, extent: 0.5 });
    expect(g).not.toBeNull();
    expect(g!.cursorX).toBeCloseTo(160, 5);
    expect(g!.cursorY).toBeCloseTo(8, 5); // the last value is the maximum → top padding
    expect(g!.line.startsWith('M0.00,112.00')).toBe(true);
  });
  it('draws a flat series through the middle instead of dividing by zero', () => {
    const g = curveGeometry([5, 5, 5], { w: 300, h: 100, pad: 10 });
    expect(g!.cursorY).toBeCloseTo(50, 5);
    expect(g!.line).not.toMatch(/NaN/);
  });
  it('refuses what it cannot draw: a zero width, a NaN, an empty extent', () => {
    expect(curveGeometry([1, 2], { w: 0, h: 100 })).toBeNull();
    expect(curveGeometry([1, Number.NaN], { w: 300, h: 100 })).toBeNull();
    const g = curveGeometry([1, 2, 3], { w: 300, h: 100, extent: 0 });
    expect(g).not.toBeNull();
    expect(g!.line).not.toMatch(/NaN/);
    expect(curveGeometry([1, 2], { w: 300, h: 100, cursor: Number.NaN })!.cursorX).toBe(300);
  });
});

describe('small rules', () => {
  it('lays option tiles out so none gets too narrow', () => {
    expect([1, 2, 3, 4, 5, 6].map(optionColumns)).toEqual([1, 2, 3, 2, 3, 3]);
  });
  it('knows ISO weeks', () => {
    expect(isoWeek(new Date(2026, 8, 17))).toBe(38);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe('option grid', () => {
  it('fills every row edge to edge: a shorter last row splits the column among its own tiles', () => {
    expect(optionGrid(3, 3)).toEqual({ tracks: 3, spans: [1, 1, 1] });
    expect(optionGrid(4, 2)).toEqual({ tracks: 2, spans: [1, 1, 1, 1] });
    expect(optionGrid(5, 3)).toEqual({ tracks: 6, spans: [2, 2, 2, 3, 3] });
    expect(optionGrid(7, 3)).toEqual({ tracks: 3, spans: [1, 1, 1, 1, 1, 1, 3] });
    expect(optionGrid(2, 3)).toEqual({ tracks: 2, spans: [1, 1] });
  });
});

describe('chip columns', () => {
  it('keeps one row while short labels fit, and goes to rows before cutting a label', () => {
    expect(chipColumns(['Eco', 'Comfort', 'None'])).toBe(3);
    expect(chipColumns(['Auto', 'Low', 'Medium', 'High'])).toBe(4);
    expect(chipColumns(['Silent', 'Basic', 'Strong', 'Full Speed'])).toBe(2);
    expect(chipColumns(['1', '2', '3', '4', '5'])).toBe(5);
    expect(chipColumns(['Quiet', 'Low', 'Medium', 'High', 'Turbo', 'Auto'])).toBe(3);
  });
});

describe('plots of several series (the History page)', () => {
  const o = { w: 100, h: 50, pad: 0, padTop: 0, min: 0, max: 10 };

  it('shares one scale, so two series can be compared by eye', () => {
    expect(plotY(10, o)).toBe(0);
    expect(plotY(0, o)).toBe(50);
    expect(plotY(5, o)).toBe(25);
    expect(plotY(99, o)).toBe(0); // a reading past the scale sits on its edge, never outside the chart
  });

  it('draws a stepped series as the recorder holds it', () => {
    expect(seriesPath([0, 10], { ...o, step: true })).toBe('M0.00,50.00 H100.00 V0.00');
    expect(seriesPath([5], o)).toBe(''); // one reading is not a line
  });

  it('reads the curve it drew: a dot placed by seriesY can never leave the line', () => {
    const values = [3, 9, 1, 7, 2, 8, 4];
    const plot = { w: 120, h: 50, pad: 0, min: 0, max: 10 };
    // at every sample the curve passes exactly through its reading
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * plot.w;
      expect(seriesY(values, plot, x)).toBeCloseTo(plotY(values[i] as number, plot), 6);
    }
    // between two samples it stays within the pair it joins, plus the smoothing's own overshoot
    for (let x = 0; x <= plot.w; x += 0.5) {
      const y = seriesY(values, plot, x) as number;
      expect(y).toBeGreaterThanOrEqual(-8);
      expect(y).toBeLessThanOrEqual(plot.h + 8);
    }
    // a stepped series holds its reading until the next one
    expect(seriesY([0, 10], { ...o, step: true }, 40)).toBe(plotY(0, o));
    expect(seriesY([5], o, 10)).toBeNull(); // one reading is not a line
  });

  it('closes the area under a series, and the band a summary moved in', () => {
    expect(areaUnder('M0,0 L10,0', o)).toBe('M0,0 L10,0 L100.00,50.00 L0,50.00 Z');
    expect(bandPath([0, 0], [10, 10], o)).toBe(
      'M0.00,0.00 L100.00,0.00 L100.00,50.00 L0.00,50.00 Z',
    );
  });

  it('gives a scale its air, centres a flat series and can keep the floor at zero', () => {
    expect(plotScale([[0, 10]])).toEqual({ min: -1, max: 11 });
    expect(plotScale([[5, 5]])).toEqual({ min: 4, max: 6 });
    expect(plotScale([[2, 10]], true)).toEqual({ min: 0, max: 10.8 });
    expect(plotScale([[]])).toEqual({ min: 0, max: 1 });
  });
});
