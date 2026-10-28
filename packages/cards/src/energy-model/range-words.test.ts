import { ensureLanguage, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { rangeWords } from './range-words.js';

/** A house on a clock without summer time (Reykjavik's, UTC the year round), read in `language`. */
const house = (language: string): HomeAssistant =>
  ({
    language,
    locale: { language, number_format: 'language', time_format: '24', time_zone: 'server' },
    config: { time_zone: 'Atlantic/Reykjavik' },
  }) as unknown as HomeAssistant;

/** Saturday 24 October 2026, noon. */
const NOW = new Date('2026-10-24T12:00:00Z');

/** A range of whole days on the house's clock, ending as Home Assistant ends one (the last day's last moment). */
const days = (from: string, to = from): { start: Date; end: Date } => ({
  start: new Date(`${from}T00:00:00Z`),
  end: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1),
});

describe('rangeWords', () => {
  it('names today and yesterday, then a day by its date, with its year only when it is not this one', () => {
    const en = house('en');
    expect(rangeWords(en, days('2026-10-24'), NOW)).toBe('Today');
    expect(rangeWords(en, days('2026-10-23'), NOW)).toBe('Yesterday');
    expect(rangeWords(en, days('2026-10-22'), NOW)).toMatch(/^Oct 22$|^22 Oct$/);
    expect(rangeWords(en, days('2025-10-24'), NOW)).toContain('2025');
  });

  it('spans days in one month and across months as one range', () => {
    const en = house('en');
    expect(rangeWords(en, days('2026-10-12', '2026-10-18'), NOW)).toMatch(/12.*18/);
    const across = rangeWords(en, days('2026-09-17', '2026-10-03'), NOW);
    expect(across).toMatch(/17/);
    expect(across).toMatch(/Sep/);
    expect(across).toMatch(/Oct/);
  });

  it('a whole month is its name, a whole year its number, several whole months their names', () => {
    const en = house('en');
    expect(rangeWords(en, days('2026-09-01', '2026-09-30'), NOW)).toBe('September');
    expect(rangeWords(en, days('2026-01-01', '2026-12-31'), NOW)).toBe('2026');
    expect(rangeWords(en, days('2025-09-01', '2025-09-30'), NOW)).toContain('2025');
    const quarter = rangeWords(en, days('2026-01-01', '2026-03-31'), NOW);
    expect(quarter).toMatch(/Jan/);
    expect(quarter).toMatch(/Mar/);
  });

  it('a midnight end belongs to the day before it (our own ranges end so)', () => {
    const en = house('en');
    expect(
      rangeWords(
        en,
        { start: new Date('2026-10-23T00:00:00Z'), end: new Date('2026-10-24T00:00:00Z') },
        NOW,
      ),
    ).toBe('Yesterday');
  });

  it('speaks the house’s language', async () => {
    await ensureLanguage('es');
    await ensureLanguage('de');
    const es = house('es');
    expect(rangeWords(es, days('2026-10-24'), NOW)).toBe('Hoy');
    expect(rangeWords(es, days('2026-10-23'), NOW)).toBe('Ayer');
    expect(rangeWords(es, days('2026-09-01', '2026-09-30'), NOW)).toBe('septiembre');
    const de = house('de');
    expect(rangeWords(de, days('2026-10-24'), NOW)).toBe('Heute');
    expect(rangeWords(de, days('2026-10-23'), NOW)).toBe('Gestern');
    expect(rangeWords(de, days('2026-09-01', '2026-09-30'), NOW)).toBe('September');
  });
});
