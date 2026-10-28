import { describe, expect, it } from 'vitest';
import {
  attributeSeries,
  momentOf,
  numberOf,
  readList,
  timedAttributes,
  usualList,
  type Day,
} from './attribute.js';

/*
 * The lists the price and forecast integrations write, read as readings: Nordpool's raw today and tomorrow (quarters
 * kept, a negative price kept, an empty tomorrow nothing more), Tibber's map, ENTSO-E's and Frank Energie's entries,
 * a plain day of values, Solcast's percentiles as a band, the keys named by the card, and which attributes are lists.
 */

const HOUR = 3_600_000;
const QUARTER = HOUR / 4;
const MIDNIGHT = Date.parse('2026-09-17T00:00:00+02:00');
const TODAY: Day = { start: MIDNIGHT, length: 24 * HOUR };
const TOMORROW: Day = { start: MIDNIGHT + 24 * HOUR, length: 24 * HOUR };

const iso = (t: number): string => new Date(t).toISOString();
/** A day of Nordpool's quarters, as `raw_today` lists them. */
const nordpool = (start: number, value: (q: number) => number) =>
  Array.from({ length: 96 }, (_unused, q) => ({
    start: iso(start + q * QUARTER),
    end: iso(start + (q + 1) * QUARTER),
    value: value(q),
  }));

describe('a moment and a value, as integrations write them', () => {
  it('reads an ISO date and time, a Unix time in seconds or milliseconds, never an hour’s number', () => {
    expect(momentOf('2026-09-17T13:00:00+02:00')).toBe(Date.parse('2026-09-17T11:00:00Z'));
    expect(momentOf('2026-09-17')).toBe(Date.parse('2026-09-17'));
    expect(momentOf(1_789_642_800)).toBe(1_789_642_800_000);
    expect(momentOf(1_789_642_800_000)).toBe(1_789_642_800_000);
    expect(momentOf(13)).toBeNull();
    expect(momentOf('13:00')).toBeNull();
    expect(momentOf('soon')).toBeNull();
  });

  it('reads a number or one written as text, nothing else', () => {
    expect(numberOf(0.123)).toBe(0.123);
    expect(numberOf('-0.012')).toBe(-0.012);
    expect(numberOf('')).toBeNull();
    expect(numberOf('2026-09-17')).toBeNull();
    expect(numberOf(null)).toBeNull();
  });
});

describe('the lists', () => {
  it('Nordpool: today’s and tomorrow’s quarters as one series, each to its end, a negative price kept', () => {
    const attributes = {
      raw_today: nordpool(MIDNIGHT, (q) => 0.1 + q / 1000),
      raw_tomorrow: nordpool(MIDNIGHT + 24 * HOUR, (q) => (q === 54 ? -0.012 : 0.2)),
      today: Array.from({ length: 96 }, () => 0.1),
    };
    const { name, readings } = attributeSeries(attributes, undefined, {}, TODAY, TOMORROW);
    expect(name).toBe('raw_today');
    expect(readings).toHaveLength(192);
    expect(readings[0]).toEqual({ t: MIDNIGHT, v: 0.1, end: MIDNIGHT + QUARTER });
    expect(readings[95]?.t).toBe(MIDNIGHT + 95 * QUARTER);
    expect(readings[96 + 54]?.v).toBe(-0.012);
    // named, the same: its tomorrow read after it
    expect(attributeSeries(attributes, 'raw_today', {}, TODAY, TOMORROW).readings).toHaveLength(
      192,
    );
  });

  it('Nordpool before tomorrow is published: an empty tomorrow is nothing more', () => {
    const attributes = { raw_today: nordpool(MIDNIGHT, () => 0.1), raw_tomorrow: [] };
    expect(attributeSeries(attributes, undefined, {}, TODAY, TOMORROW).readings).toHaveLength(96);
  });

  it('Nordpool’s plain lists: a day’s values spread across it, tomorrow’s from its own midnight', () => {
    const attributes = {
      today: Array.from({ length: 24 }, (_unused, h) => h / 100),
      tomorrow: Array.from({ length: 24 }, () => 0.3),
    };
    const { readings } = attributeSeries(attributes, 'today', {}, TODAY, TOMORROW);
    expect(readings).toHaveLength(48);
    expect(readings[13]).toEqual({ t: MIDNIGHT + 13 * HOUR, v: 0.13, end: MIDNIGHT + 14 * HOUR });
    expect(readings[24]?.t).toBe(MIDNIGHT + 24 * HOUR);
    // 96 values are quarters
    expect(
      readList(
        Array.from({ length: 96 }, () => 1),
        {},
        TODAY,
      )[1]?.t,
    ).toBe(MIDNIGHT + QUARTER);
  });

  it('Tibber: a map of hours to prices', () => {
    const prices = { [iso(MIDNIGHT + HOUR)]: 0.21, [iso(MIDNIGHT)]: 0.2, nonsense: 3 };
    expect(readList(prices)).toEqual([
      { t: MIDNIGHT, v: 0.2 },
      { t: MIDNIGHT + HOUR, v: 0.21 },
    ]);
  });

  it('ENTSO-E and Frank Energie: their own keys found', () => {
    expect(readList([{ time: iso(MIDNIGHT), price: '0.09' }])).toEqual([{ t: MIDNIGHT, v: 0.09 }]);
    expect(readList([{ from: iso(MIDNIGHT), till: iso(MIDNIGHT + HOUR), price: 0.24 }])).toEqual([
      { t: MIDNIGHT, v: 0.24, end: MIDNIGHT + HOUR },
    ]);
  });

  it('Solcast: its estimate, with its tenth and ninetieth percentiles as its low and high', () => {
    const forecast = [
      { period_start: iso(MIDNIGHT), pv_estimate: 1.2, pv_estimate10: 0.9, pv_estimate90: 1.4 },
    ];
    expect(readList(forecast)).toEqual([{ t: MIDNIGHT, v: 1.2, low: 0.9, high: 1.4 }]);
  });

  it('the keys a card names, where the usual ones are not the list’s', () => {
    const list = [{ at: iso(MIDNIGHT), kwh: 2, price: 9 }];
    expect(readList(list, { time_key: 'at', value_key: 'kwh' })).toEqual([{ t: MIDNIGHT, v: 2 }]);
  });

  it('reads nothing of what is no list of moments: a colour’s three numbers, words, an empty list', () => {
    expect(readList([255, 128, 0], {}, TODAY)).toEqual([]);
    expect(readList(['a', 'b'])).toEqual([]);
    expect(readList([])).toEqual([]);
    expect(readList(42)).toEqual([]);
  });
});

describe('which attributes are lists', () => {
  const attributes = {
    raw_today: nordpool(MIDNIGHT, () => 0.1),
    rgb_color: [255, 0, 0],
    unit: 'kWh',
    prices: { [iso(MIDNIGHT)]: 0.2, [iso(MIDNIGHT + HOUR)]: 0.3 },
  };

  it('offers those that read as a series', () => {
    expect(timedAttributes(attributes, TODAY)).toEqual(['raw_today', 'prices']);
  });

  it('knows the usual ones, first of all', () => {
    expect(usualList(attributes)).toBe('raw_today');
    expect(usualList({ unit: 'kWh' })).toBeUndefined();
  });

  it('reads the first list there is where none of the usual ones is', () => {
    const own = {
      slots: [
        { start: iso(MIDNIGHT), value: 1 },
        { start: iso(MIDNIGHT + HOUR), value: 2 },
      ],
    };
    expect(attributeSeries(own, undefined, {}, TODAY, TOMORROW).name).toBe('slots');
  });
});
