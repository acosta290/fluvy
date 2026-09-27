import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en.js';
import { es } from '../i18n/es.js';
import { localize } from '../i18n/index.js';
import { createStrings } from '../i18n/strings.js';

describe('i18n', () => {
  it('Spanish mirrors English key for key, with nothing empty', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(es)) expect(value, key).not.toBe('');
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toBe('');
  });

  it('keeps the same placeholders in both languages', () => {
    const holes = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[])
      expect(holes(es[key]), key).toEqual(holes(en[key]));
  });

  it('localizes by the language prefix and falls back to English', () => {
    expect(localize({ language: 'es-ES' }, 'common.on')).toBe('Encendido');
    expect(localize({ language: 'de' }, 'common.on')).toBe('On');
    expect(localize(undefined, 'person.count', { home: 2, total: 3 })).toBe('2 of 3 home');
  });

  it('card-local tables behave the same way', () => {
    const s = createStrings({ en: { left: '{n} left' }, es: { left: 'Quedan {n}' } });
    expect(s({ language: 'es' }, 'left', { n: 3 })).toBe('Quedan 3');
    expect(s({ language: 'fr' }, 'left', { n: 3 })).toBe('3 left');
  });
});
