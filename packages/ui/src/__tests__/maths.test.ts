import { describe, expect, it } from 'vitest';
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
