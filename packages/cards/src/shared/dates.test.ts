import { afterEach, describe, expect, it } from 'vitest';
import { setLanguageOverride, type HomeAssistant } from '@fluvy/core';
import { dateLanguage } from './dates.js';

const house = (language: string): HomeAssistant =>
  ({ language, locale: { language } }) as unknown as HomeAssistant;

describe('the language a page writes its dates in', () => {
  afterEach(() => setLanguageOverride(undefined));

  it('is Home Assistant’s own locale, as the cards and its own pages write them', () => {
    expect(dateLanguage(house('en-GB'))).toBe('en-GB');
    expect(dateLanguage(house('en'))).toBe('en');
    expect(dateLanguage(house('pt'))).toBe('pt');
    expect(dateLanguage(house('de'))).toBe('de');
    expect(dateLanguage(undefined)).toBe('en');
  });

  it('is the language the person chose where it is not Home Assistant’s, Fluvy’s English the United Kingdom’s', () => {
    setLanguageOverride('es');
    expect(dateLanguage(house('en-GB'))).toBe('es');
    setLanguageOverride('en');
    expect(dateLanguage(house('de'))).toBe('en-GB');
    // chosen where Home Assistant speaks it already: Home Assistant's own
    expect(dateLanguage(house('en-GB'))).toBe('en-GB');
    expect(dateLanguage(house('en'))).toBe('en');
  });
});
