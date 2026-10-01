import { describe, expect, it } from 'vitest';
import {
  netCharge,
  prefBatteries,
  stateOfCharge,
  timeLeft,
  totalCapacity,
  wayOf,
  type Cell,
} from './pack.js';

const cell = (level: Cell['level'], capacity?: number, charge?: Cell['charge']): Cell => ({
  level,
  capacity,
  charge,
});

describe('a group of batteries', () => {
  it('weighs its state of charge by capacity when every battery states one', () => {
    // 7.2 kWh + 2 kWh stored of 15: 61 %, not the 56 % of a plain mean
    expect(stateOfCharge([cell(72, 10), cell(40, 5)])).toBeCloseTo(61.33, 2);
    expect(stateOfCharge([cell(72, 10), cell(56, 10)])).toBe(64);
  });

  it('says nothing when a capacity is missing, rather than assume the batteries equal', () => {
    expect(stateOfCharge([cell(72, 10), cell(40)])).toBeNull();
    expect(stateOfCharge([cell(48), cell(90)])).toBeNull();
    expect(stateOfCharge([cell(48)])).toBe(48);
    // a battery whose charge cannot be read, or that has none to read, leaves the group's unknown
    expect(stateOfCharge([cell(72, 10), cell(null, 10)])).toBeNull();
    expect(stateOfCharge([cell(72, 10), cell(undefined, 10)])).toBeNull();
    // none has one: there is nothing to draw
    expect(stateOfCharge([cell(undefined, 10), cell(undefined)])).toBeUndefined();
    expect(stateOfCharge([])).toBeUndefined();
  });

  it('keeps a reading inside 0–100 %', () => {
    expect(stateOfCharge([cell(104, 10)])).toBe(100);
    expect(stateOfCharge([cell(-3)])).toBe(0);
  });

  it('sums its power, and knows it only when every battery is read', () => {
    expect(netCharge([cell(72, 10, 2200), cell(56, 10, 1120)])).toBe(3320);
    // one charges, the other discharges: the net decides
    expect(netCharge([cell(48, 10, 800), cell(90, 5, -500)])).toBe(300);
    expect(netCharge([cell(48, 10, 800), cell(90, 5, null)])).toBeNull();
    expect(netCharge([cell(48, 10, 800), cell(90, 5, undefined)])).toBeNull();
    expect(netCharge([cell(48), cell(90)])).toBeUndefined();
  });

  it('adds its capacity only when every battery states one', () => {
    expect(totalCapacity([cell(1, 10), cell(1, 5)])).toBe(15);
    expect(totalCapacity([cell(1, 10), cell(1)])).toBeUndefined();
    expect(totalCapacity([cell(1, 0)])).toBeUndefined();
    expect(totalCapacity([])).toBeUndefined();
  });

  it('rests below 10 W either way', () => {
    expect(wayOf(10)).toBe('charging');
    expect(wayOf(9.9)).toBe('idle');
    expect(wayOf(-9.9)).toBe('idle');
    expect(wayOf(-10)).toBe('discharging');
  });
});

describe('full in, empty in', () => {
  it('counts the approved sheet: two 10 kWh batteries at 64 %, 3.3 kW in → full in 2 h 10 min', () => {
    const seconds = timeLeft([cell(72, 10, 2200), cell(56, 10, 1120)], 20);
    expect(Math.round((seconds ?? 0) / 60)).toBe(130);
  });

  it('counts down to the reserve while discharging, to empty without one', () => {
    // 81 % of 13.5 kWh is 10.94; 2.7 kWh kept back; 8.24 kWh at 1.2 kW
    expect(Math.round((timeLeft([cell(81, 13.5, -1200)], 20) ?? 0) / 60)).toBe(412);
    expect(Math.round((timeLeft([cell(81, 13.5, -1200)]) ?? 0) / 60)).toBe(547);
  });

  it('says nothing when there is nothing to count or something it needs is unknown', () => {
    expect(timeLeft([cell(15, 10, -800)], 20)).toBeNull(); // under the reserve already
    expect(timeLeft([cell(100, 10, 500)])).toBeNull(); // full
    expect(timeLeft([cell(50, 10, 5)])).toBeNull(); // resting
    expect(timeLeft([cell(50, undefined, 500)])).toBeNull(); // no capacity
    // one charging, the other draining: the group is never full nor empty at these powers
    expect(timeLeft([cell(48, 10, 800), cell(70, 10, -500)])).toBeNull();
    expect(timeLeft([cell(null, 10, 500)])).toBeNull(); // no charge
    expect(timeLeft([cell(50, 10, null)])).toBeNull(); // no power
    expect(timeLeft([cell(50, 10, 500), cell(50, undefined, 500)])).toBeNull(); // one capacity missing
  });
});

describe('the Energy dashboard’s batteries', () => {
  it('reads each with its power, state of charge and capacity; a battery with a charge and no power counts', () => {
    const list = prefBatteries({
      energy_sources: [
        { type: 'grid', stat_energy_from: 'sensor.in', stat_rate: 'sensor.grid' },
        { type: 'solar', stat_energy_from: 'sensor.pv', stat_rate: 'sensor.pv_power' },
        {
          type: 'battery',
          stat_energy_from: 'sensor.b_out',
          stat_energy_to: 'sensor.b_in',
          stat_rate: 'sensor.b',
          stat_soc: 'sensor.b_soc',
          capacity: 13.5,
        },
        {
          type: 'battery',
          power_config: { stat_rate_from: 'sensor.c_out', stat_rate_to: 'sensor.c_in' },
          stat_soc: 'sensor.c_soc',
        },
        { type: 'battery', stat_energy_from: 'sensor.old_out', stat_soc: 'sensor.old_soc' },
        { type: 'battery', stat_energy_from: 'sensor.bare' },
      ],
    });
    expect(list).toEqual([
      { power: 'sensor.b', level: 'sensor.b_soc', capacity: 13.5 },
      { import: 'sensor.c_out', export: 'sensor.c_in', level: 'sensor.c_soc' },
      { level: 'sensor.old_soc' },
    ]);
  });

  it('is none when energy was never set up', () => {
    expect(prefBatteries(null)).toEqual([]);
    expect(prefBatteries({ energy_sources: [] })).toEqual([]);
  });
});
