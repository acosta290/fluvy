import { describe, expect, it } from 'vitest';
import { durationParts } from '../energy-model/duration.js';
import { modeKind } from '../energy-model/modes.js';
import { markAt, markedLabels } from './marked-ruler.js';

describe('a mode read from its words', () => {
  it('knows off, the sun and full power, and names nothing it does not know', () => {
    expect(modeKind('off')).toBe('off');
    expect(modeKind('Paused')).toBe('off');
    expect(modeKind('pv')).toBe('sun');
    expect(modeKind('Solar only')).toBe('sun');
    expect(modeKind('full_solar')).toBe('sun');
    expect(modeKind('now')).toBe('fast');
    expect(modeKind('Boost')).toBe('fast');
    expect(modeKind('force_charge')).toBe('fast');
    // a minimum from the grid topped up by the sun is neither
    expect(modeKind('minpv')).toBe('other');
    expect(modeKind('min_pv')).toBe('other');
    expect(modeKind('self_use')).toBe('other');
    expect(modeKind('eco_mode')).toBe('other');
    expect(modeKind('off_grid')).toBe('other');
  });
});

describe('a span of time', () => {
  it('is minutes, hours and minutes, or days and hours', () => {
    expect(durationParts(45 * 60)).toEqual([{ value: '45', unit: 'min' }]);
    expect(durationParts(130 * 60)).toEqual([
      { value: '2', unit: 'h' },
      { value: '10', unit: 'min' },
    ]);
    expect(durationParts(123 * 60)).toEqual([
      { value: '2', unit: 'h' },
      { value: '03', unit: 'min' },
    ]);
    expect(durationParts((31 * 60 + 20) * 60)).toEqual([
      { value: '1', unit: 'd' },
      { value: '7', unit: 'h' },
    ]);
  });

  it('rounds to the minute, and is nothing when it is not a time', () => {
    expect(durationParts(59.6 * 60)).toEqual([
      { value: '1', unit: 'h' },
      { value: '00', unit: 'min' },
    ]);
    expect(durationParts(20)).toEqual([{ value: '0', unit: 'min' }]);
    expect(durationParts(-1)).toBeNull();
    expect(durationParts(Number.NaN)).toBeNull();
  });
});

describe('the labels under a marked ruler', () => {
  // every word 6 px a character, the numbers as wide as they are written
  const measure = (text: string): number => text.length * 6;
  const numbers = [
    [0, '0'],
    [0.5, '50'],
    [1, '100'],
  ] as const;

  it('puts the ends flush and the rest centred on their value', () => {
    expect(markedLabels(320, numbers, null, measure)).toEqual([
      { text: '0', left: 0, mark: false },
      { text: '50', left: 154, mark: false },
      { text: '100', left: 302, mark: false },
    ]);
  });

  it('gives a number’s place to the mark’s word it would meet', () => {
    // "Reserve" (42) at 20 % of 320: 43 → 85; "0" ends at 6, 37 px clear
    expect(markedLabels(320, numbers, { fraction: 0.2, text: 'Reserve' }, measure)).toEqual([
      { text: '0', left: 0, mark: false },
      { text: 'Reserve', left: 43, mark: true },
      { text: '50', left: 154, mark: false },
      { text: '100', left: 302, mark: false },
    ]);
    // "Target" at 90 %: 270 → 306 meets "100"
    expect(
      markedLabels(320, numbers, { fraction: 0.9, text: 'Target' }, measure).map((l) => l.text),
    ).toEqual(['0', '50', 'Target']);
  });

  it('keeps the mark’s word inside the ruler', () => {
    const [label] = markedLabels(320, [], { fraction: 1, text: 'Target' }, measure);
    expect(label).toEqual({ text: 'Target', left: 284, mark: true });
    expect(markedLabels(132, [], { fraction: 0.05, text: 'Reserve' }, measure)[0]?.left).toBe(0);
  });

  it('draws the mark inside the ruler, and under the marker when the level is there', () => {
    expect(markAt(320, 0.2, 64)).toEqual({ x: 64, covered: false });
    expect(markAt(320, 0.2, 25)).toEqual({ x: 64, covered: true });
    expect(markAt(320, 1, null)).toEqual({ x: 319, covered: false });
    // the marker stops 4 px past the ruler's end: a mark at 100 % is under a full charge
    expect(markAt(320, 1, 100).covered).toBe(true);
  });
});
