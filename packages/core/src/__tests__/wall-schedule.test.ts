import { describe, expect, it } from 'vitest';
import { inNight, nextChange, wallDark } from '../wall/schedule.js';

const at = (hhmm: string, day = 15): Date => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return new Date(2026, 8, day, h, m, 0, 0);
};
const hours = (from: string, to: string) => ({ theme: 'hours' as const, from, to });
const sun = (state: string, rising: Date, setting: Date) => ({
  state,
  attributes: { next_rising: rising.toISOString(), next_setting: setting.toISOString() },
});

describe('the wall’s day and night', () => {
  it('reads a night that crosses midnight, and one that does not', () => {
    expect(inNight(23 * 60, '22:00', '07:00')).toBe(true);
    expect(inNight(3 * 60, '22:00', '07:00')).toBe(true);
    expect(inNight(12 * 60, '22:00', '07:00')).toBe(false);
    expect(inNight(7 * 60, '22:00', '07:00')).toBe(false); // `to` is the first minute of day
    expect(inNight(13 * 60, '12:00', '14:00')).toBe(true);
    expect(inNight(13 * 60, '14:00', '14:00')).toBe(false); // no night at all
  });

  it('answers dark, follow, sun and hours', () => {
    expect(wallDark({ theme: 'dark', from: '', to: '' }, at('12:00'), undefined)).toBe(true);
    expect(wallDark({ theme: 'follow', from: '', to: '' }, at('23:00'), undefined)).toBeUndefined();
    expect(wallDark(hours('22:00', '07:00'), at('23:30'), undefined)).toBe(true);
    expect(wallDark(hours('22:00', '07:00'), at('08:00'), undefined)).toBe(false);
    const night = sun('below_horizon', at('07:10', 16), at('19:40'));
    expect(wallDark({ theme: 'sun', from: '', to: '' }, at('23:00'), night)).toBe(true);
    expect(
      wallDark({ theme: 'sun', from: '', to: '' }, at('12:00'), { state: 'above_horizon' }),
    ).toBe(false);
    expect(wallDark({ theme: 'sun', from: '', to: '' }, at('12:00'), undefined)).toBeUndefined();
  });

  it('knows when the answer next changes', () => {
    const MIN = 60_000;
    expect(nextChange(hours('22:00', '07:00'), at('23:30'), undefined)).toBe(7.5 * 60 * MIN);
    expect(nextChange(hours('22:00', '07:00'), at('12:00'), undefined)).toBe(10 * 60 * MIN);
    expect(nextChange(hours('14:00', '14:00'), at('12:00'), undefined)).toBeUndefined();
    const day = sun('above_horizon', at('07:10', 16), at('19:40'));
    expect(nextChange({ theme: 'sun', from: '', to: '' }, at('12:00'), day)).toBe(
      at('19:40').getTime() - at('12:00').getTime(),
    );
    // a stale rising in the past is skipped; nothing ahead means nothing to wait for
    expect(
      nextChange(
        { theme: 'sun', from: '', to: '' },
        at('20:00'),
        sun('below_horizon', at('07:10'), at('19:40')),
      ),
    ).toBeUndefined();
    expect(nextChange({ theme: 'dark', from: '', to: '' }, at('12:00'), undefined)).toBeUndefined();
    expect(
      nextChange({ theme: 'follow', from: '', to: '' }, at('12:00'), undefined),
    ).toBeUndefined();
  });
});
