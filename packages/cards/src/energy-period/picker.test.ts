import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import {
  chosenDays,
  gridDays,
  grainOf,
  holdsNow,
  midnightOf,
  presetSpan,
  shiftSpan,
  storageKey,
  type Span,
} from './picker.js';

/** A house in Madrid whose profile shows the server's clock, weeks from Monday. */
const MADRID = {
  language: 'en',
  locale: { language: 'en', time_zone: 'server', first_weekday: 'monday' },
  config: { time_zone: 'Europe/Madrid' },
} as unknown as HomeAssistant;
const SUNDAYS = {
  ...MADRID,
  locale: { ...MADRID.locale, first_weekday: 'sunday' },
} as unknown as HomeAssistant;
/** The browser's own clock (the profile does not ask for the server's). */
const BROWSER = {
  language: 'en',
  locale: { language: 'en' },
  config: {},
} as unknown as HomeAssistant;

/** Thursday 17 September 2026, 21:47 in Madrid (CEST, UTC+2). */
const NOW = new Date('2026-09-17T19:47:12Z');

const iso = ({ start, end }: Span): [string, string] => [start.toISOString(), end.toISOString()];
const span = (start: string, end: string): Span => ({ start: new Date(start), end: new Date(end) });

describe('the presets, on the house’s clock', () => {
  it('today and yesterday: midnight to the last moment of the day', () => {
    expect(iso(presetSpan(MADRID, 'today', NOW))).toEqual([
      '2026-09-16T22:00:00.000Z',
      '2026-09-17T21:59:59.999Z',
    ]);
    expect(iso(presetSpan(MADRID, 'yesterday', NOW))).toEqual([
      '2026-09-15T22:00:00.000Z',
      '2026-09-16T21:59:59.999Z',
    ]);
  });

  it('this week, from the first weekday the profile names', () => {
    expect(iso(presetSpan(MADRID, 'this_week', NOW))).toEqual([
      '2026-09-13T22:00:00.000Z',
      '2026-09-20T21:59:59.999Z',
    ]);
    expect(iso(presetSpan(SUNDAYS, 'this_week', NOW))).toEqual([
      '2026-09-12T22:00:00.000Z',
      '2026-09-19T21:59:59.999Z',
    ]);
  });

  it('this month and this year, across a change of the clocks', () => {
    expect(iso(presetSpan(MADRID, 'this_month', NOW))).toEqual([
      '2026-08-31T22:00:00.000Z',
      '2026-09-30T21:59:59.999Z',
    ]);
    // the year starts in winter time (UTC+1) and ends in it
    expect(iso(presetSpan(MADRID, 'this_year', NOW))).toEqual([
      '2025-12-31T23:00:00.000Z',
      '2026-12-31T22:59:59.999Z',
    ]);
  });

  it('a midnight is found on the day the clocks go back (25 October 2026: 25 hours)', () => {
    expect(midnightOf(MADRID, { year: 2026, month: 10, day: 25 }).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    );
    expect(midnightOf(MADRID, { year: 2026, month: 10, day: 26 }).toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    );
  });
});

describe('walking a span by its grain', () => {
  it('a day by a day, through the night the clocks change', () => {
    const day = span('2026-10-24T22:00:00.000Z', '2026-10-25T22:59:59.999Z');
    expect(iso(shiftSpan(MADRID, day, 1))).toEqual([
      '2026-10-25T23:00:00.000Z',
      '2026-10-26T22:59:59.999Z',
    ]);
    expect(iso(shiftSpan(MADRID, presetSpan(MADRID, 'today', NOW), -1))).toEqual(
      iso(presetSpan(MADRID, 'yesterday', NOW)),
    );
  });

  it('a week by seven days, a month by a month (31 days back to August), a year by a year', () => {
    expect(iso(shiftSpan(MADRID, presetSpan(MADRID, 'this_week', NOW), -1))).toEqual([
      '2026-09-06T22:00:00.000Z',
      '2026-09-13T21:59:59.999Z',
    ]);
    expect(iso(shiftSpan(MADRID, presetSpan(MADRID, 'this_month', NOW), -1))).toEqual([
      '2026-07-31T22:00:00.000Z',
      '2026-08-31T21:59:59.999Z',
    ]);
    expect(iso(shiftSpan(MADRID, presetSpan(MADRID, 'this_year', NOW), 1))).toEqual([
      '2026-12-31T23:00:00.000Z',
      '2027-12-31T22:59:59.999Z',
    ]);
  });

  it('a span that is not whole days walks by its length', () => {
    const odd = span('2026-09-17T10:00:00.000Z', '2026-09-17T13:59:59.999Z');
    expect(iso(shiftSpan(MADRID, odd, -1))).toEqual([
      '2026-09-17T06:00:00.000Z',
      '2026-09-17T09:59:59.999Z',
    ]);
  });
});

describe('a span’s grain', () => {
  it('reads the presets back, wherever they are', () => {
    expect(grainOf(MADRID, presetSpan(MADRID, 'yesterday', NOW))).toBe('day');
    expect(grainOf(MADRID, presetSpan(MADRID, 'this_week', NOW))).toBe('week');
    expect(grainOf(MADRID, shiftSpan(MADRID, presetSpan(MADRID, 'this_month', NOW), -1))).toBe(
      'month',
    );
    expect(grainOf(MADRID, presetSpan(MADRID, 'this_year', NOW))).toBe('year');
  });

  it('seven days from another weekday, three days or part of a day are custom', () => {
    expect(grainOf(SUNDAYS, presetSpan(MADRID, 'this_week', NOW))).toBe('custom');
    expect(grainOf(MADRID, span('2026-09-13T22:00:00.000Z', '2026-09-16T21:59:59.999Z'))).toBe(
      'custom',
    );
    expect(grainOf(MADRID, span('2026-09-17T10:00:00.000Z', '2026-09-17T13:59:59.999Z'))).toBe(
      'custom',
    );
  });

  it('holds now while the span is the current one', () => {
    expect(holdsNow(presetSpan(MADRID, 'this_month', NOW), NOW)).toBe(true);
    expect(holdsNow(presetSpan(MADRID, 'yesterday', NOW), NOW)).toBe(false);
  });
});

describe('the date grid’s days', () => {
  it('are the house’s whole days, and back', () => {
    const start = new Date(2026, 8, 14).getTime();
    const end = new Date(2026, 8, 17).getTime();
    const chosen = chosenDays(BROWSER, start, end);
    expect(chosen.start.getTime()).toBe(start);
    expect(chosen.end.getTime()).toBe(end - 1);
    expect(gridDays(BROWSER, chosen)).toEqual({ start, end });
  });
});

it('remembers a preset where Home Assistant reads it', () => {
  expect(storageKey('energy_fluvy-energy')).toBe('energy-default-period-_energy_fluvy-energy');
});
