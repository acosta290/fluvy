import { describe, expect, it } from 'vitest';
import { aggregate, BELOW_ROOM, integrate, meterBlock, stackOf, stackShape } from './stack.js';

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
    expect(p?.charged).toBeCloseTo(0.6);
    expect(p?.exported).toBeCloseTo(1.2);
    expect(p?.used.grid).toBe(0);
  });

  it('reads power buckets as they are: kW means need no conversion', () => {
    const [p] = stackOf([bucket(720, { solar: 6, toBattery: 4.5, toGrid: 0.2 })], DAY, 5, 'kW');
    expect(p?.used.solar).toBeCloseTo(1.3);
    expect(p?.charged).toBeCloseTo(4.5);
    expect(p?.exported).toBeCloseTo(0.2);
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
    expect(shape.below.map((b) => b.key)).toEqual(['exported']);
    // 1.8 kW used at the top and 1.2 kW out: the line sits 12 + 148 × 1.8 / 3 down
    expect(shape.zero).toBeCloseTo(12 + (148 * 1.8) / 3);
    expect(shape.y(0)).toBeCloseTo(shape.zero);
  });

  it('draws the battery’s charge under the line, the export under it', () => {
    const points = stackOf(
      [
        bucket(720, { solar: 0.5, toBattery: 0.3, toGrid: 0.1 }),
        bucket(725, { solar: 0.5, toBattery: 0.3, toGrid: 0.1 }),
      ],
      DAY,
    );
    const shape = stackShape(points, 320, 160);
    expect(shape.below.map((b) => b.key)).toEqual(['charged', 'exported']);
    // 1.2 kW used, 3.6 kW charged and 1.2 kW exported: one scale for 1.2 up and 4.8 down
    expect(shape.zero).toBeCloseTo(12 + (148 * 1.2) / 6);
  });

  it('a day with nothing out keeps its line at the bottom', () => {
    const shape = stackShape(
      stackOf([bucket(0, { fromGrid: 0.1 }), bucket(5, { fromGrid: 0.1 })], DAY),
      320,
      160,
    );
    expect(shape.below).toEqual([]);
    expect(shape.zero).toBeCloseTo(160);
  });

  it('never joins points across a gap: a run a stretch of data, a lone point across its own bucket', () => {
    const points = stackOf(
      [
        bucket(0, { fromGrid: 0.05 }),
        bucket(5, { fromGrid: 0.05 }),
        // the recorder was down from 00:10 to 00:30
        bucket(30, { fromGrid: 0.05 }),
      ],
      DAY,
    );
    const shape = stackShape(points, 1440, 160);
    const grid = shape.layers.find((l) => l.key === 'grid');
    expect(grid?.line.match(/M/g)?.length).toBe(2);
    // the lone point at 00:30 spans 00:30–00:35 (1 px a minute)
    expect(grid?.line).toContain('M30.0,');
    expect(grid?.line).toContain('35.0,');
  });
});

describe('coarse meters', () => {
  it('sums five-minute changes into fifteen-minute blocks, so 0.1 kWh steps even out', () => {
    // 1.2 kW from the grid on a meter that ticks in 0.1 kWh: 0, 0.1, 0.2, 0.1, 0, 0.2
    const steps = [0, 0.1, 0.2, 0.1, 0, 0.2];
    const blocks = aggregate(
      steps.map((fromGrid, i) => bucket(i * 5, { fromGrid })),
      DAY,
    );
    expect(blocks.map((b) => b.totals.fromGrid)).toEqual([
      expect.closeTo(0.3),
      expect.closeTo(0.3),
    ]);
    const points = stackOf(blocks, DAY, 15);
    expect(points.map((p) => p.used.grid)).toEqual([expect.closeTo(1.2), expect.closeTo(1.2)]);
  });

  it('keeps a gap as a gap: a block with no bucket is absent', () => {
    const blocks = aggregate([bucket(0, { fromGrid: 0.1 }), bucket(60, { fromGrid: 0.1 })], DAY);
    expect(blocks.map((b) => (b.start - DAY) / 60_000)).toEqual([0, 60]);
  });

  it('integrates a curve of power into the day’s energy', () => {
    const points = stackOf(
      [bucket(0, { fromGrid: 1.2 }), bucket(5, { solar: 3, toBattery: 0.6, toGrid: 0.6 })],
      DAY,
      5,
      'kW',
    );
    const day = integrate(points, 5);
    expect(day.used.grid).toBeCloseTo(0.1);
    expect(day.used.solar).toBeCloseTo(0.15);
    expect(day.charged).toBeCloseTo(0.05);
    expect(day.exported).toBeCloseTo(0.05);
  });
});

describe('the block meters are drawn in', () => {
  const zero = {
    solar: 0,
    fromGrid: 0,
    toGrid: 0,
    fromBattery: 0,
    toBattery: 0,
    generator: 0,
    fromVehicle: 0,
    toVehicle: 0,
  };
  const night = (step: number, kw: number) =>
    Array.from({ length: 96 }, (_, i) => {
      // a meter that counts in `step` kWh at a steady draw: whole steps, a tick whenever one is due
      const before = Math.floor((i * kw) / 12 / step + 1e-9);
      const after = Math.floor(((i + 1) * kw) / 12 / step + 1e-9);
      return { start: i * 300_000, totals: { ...zero, fromGrid: (after - before) * step } };
    });

  it('keeps the quarter for a precise meter', () => {
    expect(meterBlock(night(0.001, 0.4))).toBe(15);
  });

  it('widens it until a coarse meter’s step no longer shows', () => {
    // 0.1 kWh at 0.4 kW ticks about once a quarter: only an hour (four ticks) hides the step
    expect(meterBlock(night(0.1, 0.4))).toBe(60);
    expect(meterBlock(night(0.1, 2))).toBe(30);
    expect(meterBlock(night(0.1, 4))).toBe(15);
    expect(meterBlock([])).toBe(15);
  });
});

describe('the room under the line', () => {
  it('keeps the tag’s 28 px under the zero line when little went out, on one scale', () => {
    const point = (exported: number) => ({
      at: 0.5,
      used: { solar: 4, battery: 0, gas: 0, vehicle: 0, grid: 0 },
      charged: 0,
      exported,
    });
    const shape = stackShape([point(0.05), { ...point(0.05), at: 0.51 }], 1440, 200);
    expect(200 - shape.zero).toBeCloseTo(BELOW_ROOM);
    // the same kW is the same height above and below
    expect(shape.y(1) - shape.y(2)).toBeCloseTo(shape.y(-1) - shape.y(0));
    // nothing out: no room taken
    expect(stackShape([point(0), { ...point(0), at: 0.51 }], 1440, 200).zero).toBe(200);
  });
});
