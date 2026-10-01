import { describe, expect, it } from 'vitest';
import { gridHeight } from '../energy-family.js';
import { readPrefs } from '../energy-model/prefs.js';
import { connectionOf, gridWay, meanOf } from './grid.js';

describe('the grid', () => {
  it('imports, exports, or both at once; below the threshold it rests', () => {
    expect(gridWay({ in: 1900, out: 400 })).toBe('both');
    expect(gridWay({ in: 1500, out: 0 })).toBe('in');
    expect(gridWay({ in: 0, out: 1800 })).toBe('out');
    expect(gridWay({ in: 4, out: 3 })).toBeNull();
    expect(gridWay({ in: null, out: null })).toBeNull();
  });

  it('claims a mean voltage only when every phase can be read', () => {
    expect(meanOf([229.2, 231.8, 231])).toBeCloseTo(230.67, 2);
    expect(meanOf([229.2, null, 231])).toBeNull();
    expect(meanOf([])).toBeNull();
  });

  it('is the Energy dashboard’s connection it shares sensors with, the only one, or the first', () => {
    const two = readPrefs({
      energy_sources: [
        { type: 'grid', stat_energy_from: 'sensor.a_in', stat_rate: 'sensor.a_power' },
        {
          type: 'grid',
          stat_energy_from: 'sensor.b_in',
          power_config: { stat_rate_from: 'sensor.b_import', stat_rate_to: 'sensor.b_export' },
        },
      ],
    }).sources;
    expect(connectionOf(two, [])?.energyIn).toEqual(['sensor.a_in']);
    expect(connectionOf(two, ['sensor.b_export'])?.energyIn).toEqual(['sensor.b_in']);
    // sensors of its own that no connection shares: only a house with one grid is that grid
    expect(connectionOf(two, ['sensor.l1', 'sensor.l2'])).toBeUndefined();
    expect(connectionOf(two.slice(0, 1), ['sensor.l1'])?.energyIn).toEqual(['sensor.a_in']);
  });

  it('is as tall as the approved drawing at a 360 column: three phases, the price, today 452', () => {
    expect(
      gridHeight({
        type: 'custom:fluvy-grid-card',
        phases: ['sensor.l1', 'sensor.l2', 'sensor.l3'],
        price: 'sensor.price',
      }),
    ).toBe(452);
    expect(gridHeight({ type: 'custom:fluvy-grid-card' })).toBe(224);
  });
});
