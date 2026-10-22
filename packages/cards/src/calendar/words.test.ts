import { ensureLanguage, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { Words } from './words.js';

/** 17 September 2026, a Thursday. */
const THURSDAY = new Date(2026, 8, 17, 9, 30);

const hass = (language: string): HomeAssistant =>
  ({ language, locale: { language, time_format: '24' } }) as unknown as HomeAssistant;

describe('the calendar’s words', () => {
  it('label a day with its weekday as wide as the language writes it there', async () => {
    await ensureLanguage('ja');
    const english = new Words(hass('en'));
    expect(english.dayLabel(THURSDAY, null)).toBe('Thursday 17');
    expect(english.dayLabel(THURSDAY, 4)).toBe('Thursday 17 · 4 events');
    // Japanese writes the weekday short, in full-width parentheses after the day: 17日（木）, never 17日（木曜日）
    const japanese = new Words(hass('ja'));
    expect(japanese.dayLabel(THURSDAY, null)).toBe('17日（木）');
    expect(japanese.dayLabel(THURSDAY, 4)).toBe('17日（木） · イベント4件');
    // the day's name elsewhere keeps its long form
    expect(japanese.weekday(THURSDAY, 'long')).toBe('木曜日');
  });
});
