import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { changeOf, costStats, currencySymbol, moneyOf } from './costs.js';
import { readPrefs } from './prefs.js';

const house = readPrefs({
  energy_sources: [
    {
      type: 'grid',
      stat_energy_from: 'sensor.in',
      stat_energy_to: 'sensor.out',
      stat_cost: 'sensor.grid_cost',
      stat_compensation: null,
    },
    { type: 'solar', stat_energy_from: 'sensor.sun' },
  ],
});

describe('what the grid cost', () => {
  it('reads a connection’s own statistics, and the sensors Home Assistant made for a price', () => {
    expect(costStats(house.sources, null)).toEqual({
      cost: ['sensor.grid_cost'],
      compensation: [],
    });
    expect(
      costStats(house.sources, { cost_sensors: { 'sensor.out': 'sensor.out_compensation' } }),
    ).toEqual({ cost: ['sensor.grid_cost'], compensation: ['sensor.out_compensation'] });
  });

  it('is what importing cost less what exporting paid; nothing when there is no statistic', () => {
    const stats = { cost: ['a'], compensation: ['b'] };
    expect(
      moneyOf(
        stats,
        new Map([
          ['a', 1.27],
          ['b', 0.1],
        ]),
      ),
    ).toEqual({
      cost: 1.27,
      feedIn: 0.1,
      net: 1.27 - 0.1,
    });
    expect(moneyOf({ cost: [], compensation: [] }, new Map())).toBeNull();
  });

  it('sums the money as recorded: an hour at a negative price takes money off', () => {
    const change = changeOf(
      {
        a: [
          { start: 0, change: 0.6 },
          { start: 1, change: -0.2 },
          { start: 2, change: null },
        ],
      },
      ['a', 'missing'],
    );
    expect(change.get('a')).toBeCloseTo(0.4, 10);
    expect(change.get('missing')).toBe(0);
  });

  it('is written in the house’s currency', () => {
    const hass = (currency?: string): HomeAssistant =>
      ({ language: 'en', config: { currency } }) as unknown as HomeAssistant;
    expect(currencySymbol(hass('EUR'))).toBe('€');
    expect(currencySymbol(hass('USD'))).toBe('$');
    expect(currencySymbol(hass(undefined))).toBe('');
  });
});
