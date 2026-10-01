import { describe, expect, it } from 'vitest';
import { carFlow, clockOf, dueOf, readyByOf, statusCharging, targetOf } from './charger.js';

describe('the charger’s power', () => {
  it('charges the car when positive, feeds the house when negative, rests below 10 W', () => {
    expect(carFlow(7400)).toEqual({ way: 'charging', watts: 7400 });
    expect(carFlow(-2400)).toEqual({ way: 'feeding', watts: 2400 });
    expect(carFlow(4)).toEqual({ way: 'idle', watts: 4 });
    expect(carFlow(0)).toEqual({ way: 'idle', watts: 0 });
  });

  it('reads a meter signed the other way when told to', () => {
    expect(carFlow(-7400, true)).toEqual({ way: 'charging', watts: 7400 });
    expect(carFlow(2400, true)).toEqual({ way: 'feeding', watts: 2400 });
  });

  it('is unknown when the sensor cannot be read', () => {
    expect(carFlow(null)).toBeNull();
    expect(carFlow(Number.NaN)).toBeNull();
  });
});

describe('the target', () => {
  it('is a percentage, written as a number or as text', () => {
    expect(targetOf(80)).toEqual({ percent: 80 });
    expect(targetOf('80')).toEqual({ percent: 80 });
    expect(targetOf('80 %')).toEqual({ percent: 80 });
    expect(targetOf('92,5')).toEqual({ percent: 92.5 });
    expect(targetOf(120)).toEqual({ percent: 100 });
  });

  it('or an entity that holds one', () => {
    expect(targetOf('number.car_charge_limit')).toEqual({ entity: 'number.car_charge_limit' });
  });

  it('is nothing otherwise', () => {
    expect(targetOf(undefined)).toBeUndefined();
    expect(targetOf('')).toBeUndefined();
    expect(targetOf('soon')).toBeUndefined();
    expect(targetOf(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('ready by', () => {
  it('reads a time of day as a clock and an entity as itself', () => {
    expect(clockOf('07:00')).toEqual({ hours: 7, minutes: 0 });
    expect(clockOf('7:30')).toEqual({ hours: 7, minutes: 30 });
    expect(clockOf('06:45:00')).toEqual({ hours: 6, minutes: 45 });
    expect(clockOf('25:00')).toBeNull();
    expect(readyByOf('07:00')).toEqual({ due: { kind: 'clock', hours: 7, minutes: 0 } });
    expect(readyByOf('sensor.departure')).toEqual({ entity: 'sensor.departure' });
    expect(readyByOf('')).toBeUndefined();
    expect(readyByOf(700)).toBeUndefined();
  });

  it('reads an entity’s state: a time, a timestamp, or nothing readable', () => {
    expect(dueOf('07:30:00')).toEqual({ kind: 'clock', hours: 7, minutes: 30 });
    const moment = dueOf('2026-09-18T05:30:00+00:00');
    expect(moment?.kind === 'moment' && moment.at.toISOString()).toBe('2026-09-18T05:30:00.000Z');
    expect(dueOf('unknown')).toBeNull();
    expect(dueOf('1726637400')).toBeNull();
  });
});

describe('a status that says the car is charging', () => {
  it('is a charging binary sensor that is on, or words that say charging and nothing against it', () => {
    expect(statusCharging('binary_sensor', 'on', 'battery_charging')).toBe(true);
    expect(statusCharging('binary_sensor', 'on', 'plug')).toBe(false);
    expect(statusCharging('binary_sensor', 'off', 'battery_charging')).toBe(false);
    expect(statusCharging('sensor', 'charging', '')).toBe(true);
    expect(statusCharging('sensor', 'Charging', '')).toBe(true);
    expect(statusCharging('sensor', 'not_charging', '')).toBe(false);
    expect(statusCharging('sensor', 'charging_completed', '')).toBe(false);
    expect(statusCharging('sensor', 'discharging', '')).toBe(false);
    expect(statusCharging('sensor', 'connected', '')).toBe(false);
  });
});
