import { describe, expect, it } from 'vitest';
import type { EntityView } from '@fluvy/core';
import { liveTotals, powerBuckets, powered } from './power-day.js';
import type { PrefSource } from './prefs.js';

const source = (kind: PrefSource['kind'], measure: PrefSource['measure']): PrefSource => ({
  kind,
  measure,
  energyIn: [],
  energyOut: [],
});
const rows = (means: Record<string, Array<number | null>>) =>
  Object.fromEntries(
    Object.entries(means).map(([id, list]) => [
      id,
      list.flatMap((mean, i) => (mean === undefined ? [] : [{ start: i * 300_000, mean }])),
    ]),
  );

describe('the day from the power sensors', () => {
  it('splits a signed sensor by its own sign: one phase imports while another exports', () => {
    const sources = [
      source('grid', { power: ['sensor.l1', 'sensor.l2', 'sensor.l3'] }),
      source('solar', { power: ['sensor.pv'] }),
    ];
    const [b] = powerBuckets(
      rows({ 'sensor.l1': [-0.4], 'sensor.l2': [1], 'sensor.l3': [0.9], 'sensor.pv': [3.2] }),
      sources,
    );
    expect(b?.totals.fromGrid).toBeCloseTo(1.9);
    expect(b?.totals.toGrid).toBeCloseTo(0.4);
    expect(b?.totals.solar).toBeCloseTo(3.2);
  });

  it('reads an inverted battery and a pair of grid sensors', () => {
    const sources = [
      source('battery', { power: ['sensor.bat'], invert: true }),
      source('grid', { import: 'sensor.in', export: 'sensor.out' }),
    ];
    const [b] = powerBuckets(
      rows({ 'sensor.bat': [-0.6], 'sensor.in': [1.9], 'sensor.out': [0.4] }),
      sources,
    );
    // a meter that counts charging as positive, inverted: −0.6 is 0.6 kW of discharge
    expect(b?.totals.fromBattery).toBeCloseTo(0.6);
    expect(b?.totals.toBattery).toBe(0);
    expect(b?.totals.fromGrid).toBeCloseTo(1.9);
    expect(b?.totals.toGrid).toBeCloseTo(0.4);
  });

  it('keeps the sun one way: an inverter’s night draw is not negative sun', () => {
    const [b] = powerBuckets(rows({ 'sensor.pv': [-0.01], 'sensor.grid': [0.5] }), [
      source('solar', { power: ['sensor.pv'] }),
      source('grid', { power: ['sensor.grid'] }),
    ]);
    expect(b?.totals.solar).toBe(0);
  });

  it('a bucket without the grid or the battery is a gap; without the sun, the sun at rest', () => {
    const sources = [
      source('grid', { power: ['sensor.grid'] }),
      source('solar', { power: ['sensor.pv'] }),
    ];
    const buckets = powerBuckets(
      rows({ 'sensor.grid': [0.5, null, 0.4], 'sensor.pv': [null, 1, null] }),
      sources,
    );
    expect(buckets.map((b) => b.start / 300_000)).toEqual([0, 2]);
    expect(buckets[0]?.totals.solar).toBe(0);
  });

  it('draws from power only when every source says its power', () => {
    expect(powered([source('grid', { power: ['sensor.g'] }), source('solar', null)])).toBe(false);
    expect(powered([source('grid', { power: ['sensor.g'] })])).toBe(true);
    expect(powered([])).toBe(false);
  });
});

describe('the house right now', () => {
  const view = (state: string, unit = 'W'): EntityView =>
    ({
      status: 'ok',
      state,
      number: Number(state),
      unit,
      deviceClass: 'power',
      attr: () => undefined,
    }) as unknown as EntityView;
  const missing = {
    status: 'missing',
    state: 'unavailable',
    number: null,
  } as unknown as EntityView;

  it('adds every source live, in watts', () => {
    const states: Record<string, EntityView> = {
      'sensor.grid': view('1500'),
      'sensor.pv': view('3200'),
      'sensor.bat': view('-600'),
    };
    const totals = liveTotals(
      [
        source('grid', { power: ['sensor.grid'] }),
        source('solar', { power: ['sensor.pv'] }),
        source('battery', { power: ['sensor.bat'] }),
      ],
      (id) => states[id] ?? missing,
    );
    expect(totals?.fromGrid).toBe(1500);
    expect(totals?.solar).toBe(3200);
    expect(totals?.toBattery).toBe(600);
  });

  it('says nothing when a sensor cannot be read', () => {
    expect(liveTotals([source('grid', { power: ['sensor.gone'] })], () => missing)).toBeNull();
  });
});
