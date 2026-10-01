import { describe, expect, it } from 'vitest';
import { stackOf, stackShape } from './stack.js';

const DAY = Date.parse('2026-09-30T22:00:00Z');
const bucket = (minute: number, totals: Record<string, number>) => ({
  start: DAY + minute * 60_000,
  totals: { solar: 0, fromGrid: 0, toGrid: 0, fromBattery: 0, toBattery: 0, ...totals },
});

describe('the house by source', () => {
  it('turns five minutes of energy into average power, allocated the dashboard’s way', () => {
    // 12:00: 0.25 kWh of sun in five minutes is 3 kW; 0.05 of it charged the battery, 0.1 went out
    const [p] = stackOf([bucket(720, { solar: 0.25, toBattery: 0.05, toGrid: 0.1 })], DAY);
    expect(p?.at).toBeCloseTo((720 + 2.5) / 1440);
    expect(p?.used.solar).toBeCloseTo(1.2);
    expect(p?.exported).toBeCloseTo(1.2);
    expect(p?.used.grid).toBe(0);
  });

  it('stacks from the sun up and keeps one kW scale above and below the line', () => {
    const points = stackOf(
      [
        bucket(0, { fromGrid: 0.05 }),
        bucket(720, { solar: 0.25, toGrid: 0.1 }),
        bucket(1200, { fromBattery: 0.05, fromGrid: 0.02 }),
      ],
      DAY,
    );
    const shape = stackShape(points, 320, 160);
    expect(shape.layers.map((l) => l.key)).toEqual(['solar', 'battery', 'grid']);
    expect(shape.exported).not.toBeNull();
    // 1.8 kW used at the top and 1.2 kW out: the line sits 12 + 148 × 1.8 / 3 down
    expect(shape.zero).toBeCloseTo(12 + (148 * 1.8) / 3);
    expect(shape.y(0)).toBeCloseTo(shape.zero);
  });

  it('a day with nothing exported keeps its line at the bottom', () => {
    const shape = stackShape(
      stackOf([bucket(0, { fromGrid: 0.1 }), bucket(5, { fromGrid: 0.1 })], DAY),
      320,
      160,
    );
    expect(shape.exported).toBeNull();
    expect(shape.zero).toBeCloseTo(160);
  });
});
