import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { usageHeight } from '../energy-family.js';
import { allocate, type Totals } from '../energy-model/allocate.js';
import { allocatePeriod } from '../energy-model/period.js';
import { readPrefs } from '../energy-model/prefs.js';
import { presetSpan, shiftSpan } from '../energy-period/picker.js';
import { figuresOf, writeFigure } from '../shared/units.js';
import {
  foldAt,
  returnedOf,
  slotEnergy,
  slotsOf,
  usageSeries,
  usageTicks,
  usedOf,
  type SlotEnergy,
} from './series.js';

/** A house in Madrid, on the server's clock. */
const HOUSE = {
  locale: { language: 'en', time_zone: 'server' },
  config: { time_zone: 'Europe/Madrid' },
} as unknown as HomeAssistant;

const HOUR = 3_600_000;
/** Thursday 17 September 2026, 21:47 in Madrid. */
const NOW = new Date('2026-09-17T19:47:12Z');
const TODAY = presetSpan(HOUSE, 'today', NOW);

const totals = (t: Partial<Totals>): Totals => ({
  solar: 0,
  fromGrid: 0,
  toGrid: 0,
  fromBattery: 0,
  toBattery: 0,
  ...t,
});

const BOTH: ReadonlySet<'solar' | 'battery' | 'grid'> = new Set(['solar', 'battery', 'grid']);
const OUTS: ReadonlySet<'battery' | 'grid'> = new Set(['battery', 'grid']);

describe('the slots of a range', () => {
  it('a day in hours from its midnight, 23 on the day the clocks go forward and 25 on the day they go back', () => {
    const slots = slotsOf(HOUSE, TODAY, 'hour', NOW);
    expect(slots).toHaveLength(24);
    expect(new Date(slots[0] as number).toISOString()).toBe('2026-09-16T22:00:00.000Z');
    const spring = presetSpan(HOUSE, 'today', new Date('2026-03-29T12:00:00Z'));
    const autumn = presetSpan(HOUSE, 'today', new Date('2026-10-25T12:00:00Z'));
    expect(slotsOf(HOUSE, spring, 'hour')).toHaveLength(23);
    expect(slotsOf(HOUSE, autumn, 'hour')).toHaveLength(25);
  });

  it('a week and a month in days from midnight to midnight, a year in its twelve months', () => {
    const week = slotsOf(HOUSE, presetSpan(HOUSE, 'this_week', NOW), 'day', NOW);
    expect(week).toHaveLength(7);
    // each slot a midnight in Madrid, a day apart (the week has no clock change)
    expect(week.every((t, i) => i === 0 || t - (week[i - 1] as number) === 24 * HOUR)).toBe(true);
    expect(slotsOf(HOUSE, presetSpan(HOUSE, 'this_month', NOW), 'day', NOW)).toHaveLength(30);
    // October's last Sunday changes the clock: its 31 days are still 31 slots
    const october = presetSpan(HOUSE, 'this_month', new Date('2026-10-10T12:00:00Z'));
    expect(slotsOf(HOUSE, october, 'day')).toHaveLength(31);
    const year = slotsOf(HOUSE, presetSpan(HOUSE, 'this_year', NOW), 'month', NOW);
    expect(year).toHaveLength(12);
    expect(new Date(year[11] as number).toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('an open range runs to now', () => {
    expect(slotsOf(HOUSE, { start: TODAY.start }, 'hour', NOW)).toHaveLength(22);
  });
});

describe('a slot’s energy is the dashboard’s arithmetic', () => {
  const slots = slotsOf(HOUSE, TODAY, 'hour', NOW);
  const at = (hour: number): number => (slots[0] as number) + hour * HOUR;

  it('each bucket allocated on its own: used by origin as allocate says, what went out as the meters say', () => {
    const noon = totals({ solar: 3, fromGrid: 0.2, toGrid: 1.1, toBattery: 0.9 });
    const evening = totals({ fromGrid: 0.6, fromBattery: 0.8, toGrid: 0.1 });
    const energy = slotEnergy(
      [
        { start: at(12), totals: noon },
        { start: at(20), totals: evening },
      ],
      slots,
      TODAY.end.getTime(),
    );
    for (const [hour, bucket] of [
      [12, noon],
      [20, evening],
    ] as const) {
      const a = allocate(bucket);
      const slot = energy[hour] as SlotEnergy;
      expect(slot.used.solar).toBeCloseTo(a.usedSolar, 9);
      expect(slot.used.battery).toBeCloseTo(a.usedBattery, 9);
      expect(slot.used.grid).toBeCloseTo(a.usedGrid, 9);
      expect(usedOf(slot)).toBeCloseTo(a.usedTotal, 9);
      expect(slot.charged).toBe(bucket.toBattery);
      expect(slot.exported).toBe(bucket.toGrid);
    }
    expect(usedOf(energy[3])).toBe(0);
  });

  it('several buckets in one slot add their allocations, never an allocation of their sum', () => {
    // a day's night and noon in one day slot: the grid charged the battery at night, the sun ran the house at noon
    const day = slotsOf(HOUSE, presetSpan(HOUSE, 'this_week', NOW), 'day', NOW);
    const night = totals({ fromGrid: 1, toBattery: 1 });
    const noon = totals({ solar: 1 });
    const [slot] = slotEnergy(
      [
        { start: day[0] as number, totals: night },
        { start: (day[0] as number) + 12 * HOUR, totals: noon },
      ],
      day.slice(0, 1),
      (day[0] as number) + 24 * HOUR,
    );
    expect(slot?.used.solar).toBe(1);
    expect(slot?.used.grid).toBe(0);
    expect(slot?.charged).toBe(1);
    // allocated as one sum, the sun would have gone into the battery and the house would have run on the grid
    const sum = allocate(totals({ fromGrid: 1, toBattery: 1, solar: 1 }));
    expect([sum.usedSolar, sum.usedGrid]).toEqual([0, 1]);
  });

  it('Home Assistant’s statistics of a followed range land in the same slots', () => {
    const prefs = {
      energy_sources: [
        { type: 'grid', stat_energy_from: 'sensor.in', stat_energy_to: 'sensor.out' },
        { type: 'solar', stat_energy_from: 'sensor.sun' },
      ],
    };
    const rows = (values: readonly number[]) =>
      values.map((change, hour) => ({ start: at(hour), change }));
    const stats = {
      'sensor.in': rows([0.5, 0.4, 0, 0]),
      'sensor.out': rows([0, 0, 0.6, 0]),
      'sensor.sun': rows([0, 0, 1.4, 0.3]),
    };
    const period = allocatePeriod(stats, readPrefs(prefs).sources);
    const energy = slotEnergy(period.buckets, slots, TODAY.end.getTime());
    const used = energy.reduce((sum, slot) => sum + usedOf(slot), 0);
    expect(used).toBeCloseTo(period.allocation.usedTotal, 9);
    expect(energy.reduce((sum, slot) => sum + returnedOf(slot), 0)).toBeCloseTo(0.6, 9);
  });

  it('a bucket past the range, or before its first slot, is not drawn', () => {
    const energy = slotEnergy(
      [
        { start: (slots[0] as number) - HOUR, totals: totals({ fromGrid: 5 }) },
        { start: TODAY.end.getTime() + 1, totals: totals({ fromGrid: 5 }) },
      ],
      slots,
      TODAY.end.getTime(),
    );
    expect(energy.every((slot) => usedOf(slot) === 0)).toBe(true);
  });
});

describe('the series drawn', () => {
  const slot = (used: Partial<SlotEnergy['used']>, charged = 0, exported = 0): SlotEnergy => ({
    used: { solar: 0, battery: 0, grid: 0, ...used },
    charged,
    exported,
  });
  const SLOTS = [slot({ solar: 1, battery: 0.5, grid: 2 }, 0.4, 0.3), slot({ grid: 1 }, 0, 1.2)];

  it('from the sun up, then what went out below the line: the battery’s charge and the export, below zero', () => {
    const series = usageSeries(SLOTS, { ins: BOTH, outs: OUTS });
    expect(series.map((s) => s.key)).toEqual(['solar', 'battery', 'grid', 'charged', 'exported']);
    const charged = series.find((s) => s.key === 'charged');
    const exported = series.find((s) => s.key === 'exported');
    expect(charged?.values).toEqual([-0.4, -0]);
    expect(exported?.values).toEqual([-0.3, -1.2]);
    // a total is what the series moved, whatever its side
    expect(exported?.total).toBeCloseTo(1.5, 9);
    expect(series.find((s) => s.key === 'grid')?.total).toBe(3);
  });

  it('the card’s sources in their order, named and coloured; one shown false is left out with what went out through it', () => {
    const series = usageSeries(SLOTS, {
      ins: BOTH,
      outs: OUTS,
      sources: [
        { type: 'grid', name: 'Utility', color: '#7c5cff' },
        'solar',
        { type: 'battery', show: false },
      ],
    });
    expect(series.map((s) => s.key)).toEqual(['grid', 'solar', 'exported']);
    expect(series[0]).toMatchObject({ name: 'Utility', color: '#7c5cff', kind: 'grid' });
    // the export wears the grid's colour
    expect(series[2]).toMatchObject({ kind: 'grid', color: '#7c5cff' });
  });

  it('a kind listed twice is its first entry; one the house has no meter for draws nothing', () => {
    const series = usageSeries(SLOTS, {
      ins: new Set(['grid']),
      outs: new Set(),
      sources: [{ type: 'grid', name: 'First' }, { type: 'grid', name: 'Second' }, 'solar'],
    });
    expect(series.map((s) => [s.key, s.name])).toEqual([['grid', 'First']]);
  });

  it('a grid without an export meter has no export; show_returns false leaves both out', () => {
    expect(usageSeries(SLOTS, { ins: BOTH, outs: new Set(['battery']) }).map((s) => s.key)).toEqual(
      ['solar', 'battery', 'grid', 'charged'],
    );
    expect(usageSeries(SLOTS, { ins: BOTH, outs: OUTS, returns: false }).map((s) => s.key)).toEqual(
      ['solar', 'battery', 'grid'],
    );
  });

  it('past max_sources the last fold into one Other, two at least, which is one of the max', () => {
    expect(foldAt(3, 6)).toBe(3);
    expect(foldAt(3, 3)).toBe(3);
    expect(foldAt(3, 2)).toBe(1);
    expect(foldAt(7, 6)).toBe(5);
    // nothing, or a word: the six; under two: two
    expect(foldAt(7, undefined)).toBe(5);
    expect(foldAt(3, 'many')).toBe(3);
    expect(foldAt(3, 1)).toBe(1);
    const series = usageSeries(SLOTS, { ins: BOTH, outs: OUTS, max: 2 });
    expect(series.map((s) => s.key)).toEqual(['solar', 'other', 'charged', 'exported']);
    expect(series[1]?.values).toEqual([2.5, 1]);
    expect(series[1]?.kind).toBeUndefined();
  });
});

describe('the scale hugs the columns on both sides of zero', () => {
  it('the step whose outermost ticks span the least, three to five of them, each side at or beyond its extreme', () => {
    // a week rising to 18 and falling to 9: −10 · 0 · 10 · 20, where the engine's first step that fits read −20 … 40
    expect(usageTicks(-9, 18).ticks).toEqual([-10, 0, 10, 20]);
    // past −10 the fall needs −20: by 10 that is six ticks, so the step that spans least in five or fewer is 25
    expect(usageTicks(-10.5, 20.1).ticks).toEqual([-25, 0, 25]);
    // a day: −1.2 … 1.6 — by 1 and by 2 they span alike, the more ticks win
    expect(usageTicks(-1.2, 1.6).ticks).toEqual([-2, -1, 0, 1, 2]);
    // a rise alone: from zero, written with the step's decimals
    const day = usageTicks(0, 1.6);
    expect(day.ticks).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(day.decimals).toBe(1);
    // 640: 750 hugs it closer than 800
    expect(usageTicks(0, 640).ticks).toEqual([0, 250, 500, 750]);
    // a month of a year in kWh
    expect(usageTicks(-412, 803).ticks).toEqual([-500, 0, 500, 1000]);
  });

  it('every tick reaches the extremes and never more than five stand; nothing at all is zero alone', () => {
    for (const [low, high] of [
      [-0.03, 0.4],
      [-7.7, 2.2],
      [0, 99],
      [-1234, 5678],
      [-0.6, 0],
    ] as const) {
      const { ticks } = usageTicks(low, high);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect(ticks[0]).toBeLessThanOrEqual(low);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(high);
      expect(ticks).toContain(0);
    }
    expect(usageTicks(0, 0).ticks).toEqual([0]);
  });
});

describe('the figures, in one unit a set', () => {
  it('kWh read in the unit the largest asks for, or the one the card asks', () => {
    const write = (kWh: number, asked = {}): string => {
      const figures = figuresOf(undefined, asked, 'Wh', kWh * 1000);
      return `${writeFigure(undefined, kWh * 1000, figures)} ${figures.unit}`;
    };
    expect(write(15.78)).toBe('15.8 kWh');
    expect(write(0.45)).toBe('450 Wh');
    expect(write(4250)).toBe('4.3 MWh');
    expect(write(15.78, { unit: 'Wh' })).toBe('15,780 Wh');
    expect(write(15.78, { decimals: 2 })).toBe('15.78 kWh');
  });
});

describe('the period before', () => {
  it('a day’s is yesterday, a week’s the week before, a year’s the year before, slot for slot', () => {
    const before = shiftSpan(HOUSE, TODAY, -1);
    expect(slotsOf(HOUSE, before, 'hour')).toHaveLength(24);
    const year = presetSpan(HOUSE, 'this_year', NOW);
    expect(slotsOf(HOUSE, shiftSpan(HOUSE, year, -1), 'month')).toHaveLength(12);
  });
});

describe('the declared height', () => {
  it('full: the head, the chips, the chart and its axis, and the legend’s rows (five names fold into two at 360)', () => {
    const type = 'custom:fluvy-energy-usage-card';
    expect(usageHeight({ type })).toBe(472);
    expect(usageHeight({ type, show_period: false })).toBe(412);
    expect(usageHeight({ type, collection_key: 'energy_x' })).toBe(412);
    expect(usageHeight({ type, show_legend: false, show_period: false })).toBe(304);
    // the grid alone: one name, one row
    expect(usageHeight({ type, show_period: false, sources: ['grid'], show_returns: false })).toBe(
      360,
    );
    expect(usageHeight({ type, variant: 'compact' })).toBe(240);
    expect(usageHeight({ type, variant: 'mini' })).toBe(168);
  });

  it('never by the house: a source shown false, or listed twice, is counted as the card draws it', () => {
    const type = 'custom:fluvy-energy-usage-card';
    expect(
      usageHeight({
        type,
        show_period: false,
        sources: ['grid', 'grid', { type: 'solar', show: false }],
      }),
    ).toBe(usageHeight({ type, show_period: false, sources: ['grid'] }));
  });
});
