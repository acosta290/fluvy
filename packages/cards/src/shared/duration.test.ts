import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import {
  durationText,
  spanText,
  unitGap,
  widestDuration,
  withUnit,
  withUnits,
} from './duration.js';

const house = (language: string): HomeAssistant =>
  ({
    language,
    locale: { language, number_format: 'language' },
    states: {},
  }) as unknown as HomeAssistant;
const en = house('en');
const ja = house('ja');

describe('a figure and its unit', () => {
  it('keeps a space before a Latin unit, none before a kana or kanji one', () => {
    expect(unitGap('min')).toBe(' ');
    expect(unitGap('kWh')).toBe(' ');
    expect(unitGap('分')).toBe('');
    expect(unitGap('時間')).toBe('');
    expect(unitGap('本')).toBe('');
    expect(withUnit(12, 'min')).toBe('12 min');
    expect(withUnit(12, '分')).toBe('12分');
    expect(withUnit('5.2', '時間')).toBe('5.2時間');
  });

  it('joins several with a space, or attached when the units attach', () => {
    expect(
      withUnits([
        [2, 'h'],
        [10, 'min'],
      ]),
    ).toBe('2 h 10 min');
    expect(
      withUnits([
        [2, '時間'],
        [10, '分'],
      ]),
    ).toBe('2時間10分');
    expect(
      withUnits([
        [2, '時間'],
        ['88', ''],
      ]),
    ).toBe('2時間88');
  });
});

describe('a span as a readout says it', () => {
  it('leads with the larger unit and keeps the last for the unit slot', () => {
    expect(durationText(en, 45 * 60)).toEqual({ value: '45', unit: 'min' });
    expect(durationText(en, 2 * 3600 + 3 * 60)).toEqual({ value: '2 h 03', unit: 'min' });
    expect(durationText(en, 3 * 86400 + 7 * 3600)).toEqual({ value: '3 d 7', unit: 'h' });
    expect(durationText(en, null)).toEqual({ value: '—', unit: '' });
  });

  it('says it in Japanese with the units attached', () => {
    expect(durationText(ja, 45 * 60)).toEqual({ value: '45', unit: '分' });
    expect(durationText(ja, 2 * 3600 + 3 * 60)).toEqual({ value: '2時間03', unit: '分' });
    expect(durationText(ja, 3 * 86400 + 7 * 3600)).toEqual({ value: '3日7', unit: '時間' });
    expect(spanText(en, 72 * 60)).toBe('1 h 12 min');
    expect(spanText(ja, 72 * 60)).toBe('1時間12分');
    expect(spanText(ja, null)).toBe('—');
  });

  it('gives the widest span a readout lays itself out by, in the language', () => {
    expect(widestDuration(en)).toEqual({ value: '88 h 88', unit: 'min' });
    expect(widestDuration(ja)).toEqual({ value: '88時間88', unit: '分' });
  });
});
