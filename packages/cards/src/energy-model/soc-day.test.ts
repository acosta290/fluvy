import { describe, expect, it } from 'vitest';
import type { PrefSource } from './prefs.js';
import { chargedBatteries, chargeNow, chargePoints } from './soc-day.js';

const DAY = Date.parse('2026-09-30T22:00:00Z');
const battery = (soc: string, capacity?: number): PrefSource => ({
  kind: 'battery',
  measure: null,
  energyIn: [],
  energyOut: [],
  soc,
  ...(capacity ? { capacity } : {}),
});
const at = (minute: number): number => DAY + minute * 60_000 + 150_000;

describe('the batteries’ charge through the day', () => {
  it('reads the batteries that state a charge', () => {
    const sources: PrefSource[] = [
      battery('sensor.a', 10),
      { kind: 'grid', measure: null, energyIn: [], energyOut: [] },
      { kind: 'battery', measure: null, energyIn: [], energyOut: [] },
    ];
    expect(chargedBatteries(sources).map((b) => b.soc)).toEqual(['sensor.a']);
  });

  it('places each five minutes on the day by its middle', () => {
    const points = chargePoints(
      {
        'sensor.a': [
          [at(0), 40],
          [at(5), 41],
        ],
      },
      [battery('sensor.a', 10)],
      DAY,
    );
    expect(points.map((p) => p.level)).toEqual([40, 41]);
    expect(points[0]?.at).toBeCloseTo(2.5 / 1440);
  });

  it('weights two batteries by their capacity', () => {
    const points = chargePoints(
      { 'sensor.a': [[at(0), 80]], 'sensor.b': [[at(0), 20]] },
      [battery('sensor.a', 15), battery('sensor.b', 5)],
      DAY,
    );
    expect(points[0]?.level).toBeCloseTo(65);
  });

  it('knows no group charge when two batteries do not say their capacity', () => {
    const points = chargePoints(
      { 'sensor.a': [[at(0), 80]], 'sensor.b': [[at(0), 20]] },
      [battery('sensor.a'), battery('sensor.b')],
      DAY,
    );
    expect(points).toEqual([]);
    expect(chargeNow([battery('sensor.a'), battery('sensor.b')], () => 50)).toBeNull();
  });

  it('leaves a gap where a battery was not read, never a guess', () => {
    const points = chargePoints(
      {
        'sensor.a': [
          [at(0), 80],
          [at(5), 81],
        ],
        'sensor.b': [[at(5), 30]],
      },
      [battery('sensor.a', 10), battery('sensor.b', 10)],
      DAY,
    );
    expect(points).toHaveLength(1);
    expect(points[0]?.level).toBeCloseTo(55.5);
  });

  it('reads the charge now from the live sensors', () => {
    expect(chargeNow([battery('sensor.a', 10)], () => 62)).toBe(62);
    expect(chargeNow([battery('sensor.a', 10)], () => null)).toBeNull();
  });
});
