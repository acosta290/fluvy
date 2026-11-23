import { describe, expect, it } from 'vitest';
import {
  activityOf,
  cabinOf,
  chargeOf,
  chargeWord,
  convertDistance,
  convertPressure,
  energyOf,
  isDistance,
  lineOf,
  lowAdBlue,
  lowRange,
  lowTank,
  oilToCheck,
  plugged,
  pluggedWord,
  serviceDue,
  serviceWord,
} from './state.js';

describe('a car’s charge', () => {
  it.each([
    // Tesla's six
    ['charging', 'charging'],
    ['complete', 'complete'],
    ['stopped', 'stopped'],
    ['starting', 'waiting'],
    ['disconnected', 'unplugged'],
    ['no_power', 'stopped'],
    // Renault's
    ['charge_in_progress', 'charging'],
    ['waiting_for_a_planned_charge', 'waiting'],
    ['charge_ended', 'complete'],
    ['not_in_charge', 'idle'],
    ['charge_error', 'error'],
    // Volvo's and Polestar's
    ['done', 'complete'],
    ['scheduled', 'waiting'],
    ['idle', 'idle'],
    ['Smart Charging', 'charging'],
    ['Smart Charging Paused', 'waiting'],
    ['Fault', 'error'],
    // Škoda's
    ['connect_cable', 'unplugged'],
    ['ready_for_charging', 'stopped'],
    ['conserving', 'complete'],
    ['charging_interrupted', 'stopped'],
    // MG's
    ['Charging (AC)', 'charging'],
    ['Charging Finished', 'complete'],
    ['Charging Stopped', 'stopped'],
    ['Scheduled Charging', 'waiting'],
    ['Unplugged', 'unplugged'],
    // Volkswagen's two, in words and run together
    ['Charge purpose reached and conservation charging', 'complete'],
    ['chargePurposeReachedAndNotConservationCharging', 'complete'],
    ['readyForCharging', 'stopped'],
    ['Ready', 'stopped'],
    ['Off', 'idle'],
    // BMW's CarData
    ['NOCHARGING', 'idle'],
    ['CHARGINGACTIVE', 'charging'],
    ['CHARGINGENDED', 'complete'],
    ['INITIALIZATION', 'waiting'],
  ])('reads “%s” as %s', (word, charge) => {
    expect(chargeWord(word)).toBe(charge);
  });

  it('says nothing of a word it does not know', () => {
    expect(chargeWord('Unsupported')).toBeNull();
    expect(chargeWord('')).toBeNull();
  });

  it('reads a charging binary sensor and the cable beside it (Kia’s, Nissan’s)', () => {
    expect(chargeOf({ state: { word: 'on', binary: true }, plugged: true })).toBe('charging');
    expect(chargeOf({ state: { word: 'off', binary: true }, plugged: true })).toBe('stopped');
    expect(chargeOf({ state: { word: 'off', binary: true }, plugged: false })).toBe('unplugged');
  });

  it('is complete where it stops at its limit, plugged in', () => {
    expect(chargeOf({ state: { word: 'stopped', binary: false }, level: 80, limit: 80 })).toBe(
      'complete',
    );
    expect(chargeOf({ plugged: true, level: 90, limit: 80 })).toBe('complete');
  });

  it('lets the cable say what an idle word does not, and the power where nothing else speaks', () => {
    expect(chargeOf({ state: { word: 'idle', binary: false }, plugged: true })).toBe('stopped');
    expect(chargeOf({ state: { word: 'idle', binary: false }, plugged: false })).toBe('unplugged');
    expect(chargeOf({ state: { word: 'idle', binary: false } })).toBe('idle');
    expect(chargeOf({ watts: 7200, plugged: true })).toBe('charging');
    expect(chargeOf({ watts: 20, plugged: true })).toBe('stopped');
    expect(chargeOf({})).toBeNull();
  });

  it('is told unplugged by the cable, whatever an older word said, but a failure stays one', () => {
    expect(chargeOf({ state: { word: 'stopped', binary: false }, plugged: false })).toBe(
      'unplugged',
    );
    expect(chargeOf({ state: { word: 'error', binary: false }, plugged: false })).toBe('error');
  });

  it('says the cable is in only where the charge needs one', () => {
    expect(plugged('stopped')).toBe(true);
    expect(plugged('idle')).toBe(false);
    expect(plugged('unplugged')).toBe(false);
    expect(plugged(null)).toBe(false);
  });

  it('reads a plug state’s words', () => {
    expect(pluggedWord('plugged')).toBe(true);
    expect(pluggedWord('Connected')).toBe(true);
    expect(pluggedWord('disconnected')).toBe(false);
    expect(pluggedWord('plug_unknown')).toBeNull();
  });
});

describe('what a car does', () => {
  it('drives in a gear, at a speed, or by its sensor; sleeps by its state; is out of reach where nothing reads', () => {
    expect(activityOf({ shift: 'd', reachless: false })).toBe('driving');
    expect(activityOf({ shift: 'p', speed: 0, reachless: false })).toBe('parked');
    expect(activityOf({ speed: 40, reachless: false })).toBe('driving');
    expect(activityOf({ moving: true, reachless: false })).toBe('driving');
    expect(activityOf({ state: 'asleep', reachless: false })).toBe('asleep');
    expect(activityOf({ state: 'likely_asleep', reachless: false })).toBe('asleep');
    expect(activityOf({ state: 'power_saving_mode', reachless: false })).toBe('asleep');
    expect(activityOf({ state: 'car_in_use', reachless: false })).toBe('driving');
    expect(activityOf({ state: 'unreachable', reachless: false })).toBe('offline');
    expect(activityOf({ shift: 'd', reachless: true })).toBe('offline');
  });
});

describe('the line under the battery', () => {
  it('is low under the card’s range, else at a fifth of its charge', () => {
    expect(lowRange(40, 60, 50)).toBe(true);
    expect(lowRange(80, 10, 50)).toBe(false);
    expect(lowRange(null, 20, undefined)).toBe(true);
    expect(lowRange(null, 21, undefined)).toBe(false);
    expect(lowRange(null, null, undefined)).toBe(false);
  });

  it('finds a cabin too cold or too hot, in either unit', () => {
    expect(cabinOf(2, '°C')).toBe('cold');
    expect(cabinOf(38, '°C')).toBe('hot');
    expect(cabinOf(20, '°C')).toBeNull();
    expect(cabinOf(39, '°F')).toBe('cold');
    expect(cabinOf(70, '°F')).toBeNull();
    expect(cabinOf(null, '°C')).toBeNull();
  });

  it('says the most pressing first', () => {
    const at = (o: Partial<Parameters<typeof lineOf>[0]>) =>
      lineOf({ charge: null, low: false, open: null, cabin: null, ...o });
    expect(at({ charge: 'error', low: true })).toBe('error');
    expect(at({ charge: 'charging', low: true, open: 'windows' })).toBe('charging');
    expect(at({ low: true, open: 'windows' })).toBe('low');
    expect(at({ open: 'trunk', charge: 'complete' })).toBe('open');
    expect(at({ charge: 'complete', cabin: 'cold' })).toBe('complete');
    expect(at({ charge: 'waiting' })).toBe('waiting');
    expect(at({ charge: 'stopped', cabin: 'hot' })).toBe('stopped');
    expect(at({ charge: 'unplugged', cabin: 'cold' })).toBe('cabin');
    expect(at({ charge: 'unplugged' })).toBe('unplugged');
    expect(at({ charge: 'idle' })).toBe('none');
  });

  it('says a tank’s calls after a charge’s, before what stands open (#207)', () => {
    const calm = { low: false, adblue: false, oil: false, service: false };
    const at = (tank: Partial<typeof calm>, o: Partial<Parameters<typeof lineOf>[0]> = {}) =>
      lineOf({
        charge: null,
        low: false,
        open: null,
        cabin: null,
        tank: { ...calm, ...tank },
        ...o,
      });
    expect(at({ low: true }, { charge: 'charging' })).toBe('charging');
    expect(at({ low: true, adblue: true, oil: true, service: true })).toBe('low_fuel');
    expect(at({ adblue: true, oil: true, service: true })).toBe('adblue');
    expect(at({ oil: true, service: true }, { open: 'doors' })).toBe('oil');
    expect(at({ service: true }, { open: 'doors', tyre: true })).toBe('service');
    expect(at({}, { open: 'frunk', tyre: true })).toBe('tyre');
    expect(at({}, { open: 'frunk' })).toBe('open');
    expect(at({}, { cabin: 'cold' })).toBe('cabin');
    expect(at({})).toBe('none');
  });
});

describe('what it runs on (#207)', () => {
  it('is the card’s energy, else its tank where it has no battery, else its battery', () => {
    expect(energyOf(undefined, { battery: true, tank: false })).toBe('electric');
    expect(energyOf('auto', { battery: false, tank: true })).toBe('fuel');
    // a plug-in hybrid stays drawn as its battery, as before the card knew a tank
    expect(energyOf(undefined, { battery: true, tank: true })).toBe('electric');
    expect(energyOf(undefined, { battery: false, tank: false })).toBe('electric');
    expect(energyOf('hybrid', { battery: true, tank: false })).toBe('hybrid');
    expect(energyOf('fuel', { battery: true, tank: false })).toBe('fuel');
    expect(energyOf('diesel', { battery: false, tank: true })).toBe('fuel');
  });

  it('is low by its warning, else under the card’s range, else at 15 % where it has no warning to ask', () => {
    const at = (o: Partial<Parameters<typeof lowTank>[0]>) =>
      lowTank({ warning: undefined, range: null, level: null, threshold: undefined, ...o });
    expect(at({ warning: true, level: 80 })).toBe(true);
    expect(at({ warning: false, level: 10 })).toBe(false);
    expect(at({ level: 15 })).toBe(true);
    expect(at({ level: 16 })).toBe(false);
    expect(at({ range: 40, level: 60, threshold: 50 })).toBe(true);
    expect(at({ range: 60, level: 5, threshold: 50 })).toBe(false);
    expect(at({ warning: null, level: 12 })).toBe(true);
  });

  it('finds AdBlue low, the oil to check and a service due by what each says', () => {
    expect(lowAdBlue({ kind: 'distance', km: 850 })).toBe(true);
    expect(lowAdBlue({ kind: 'distance', km: 2400 })).toBe(false);
    expect(lowAdBlue({ kind: 'level', percent: 15 })).toBe(true);
    expect(lowAdBlue({ kind: 'warning', on: true })).toBe(true);
    expect(lowAdBlue(null)).toBe(false);
    expect(oilToCheck({ kind: 'level', percent: 12 })).toBe(true);
    expect(oilToCheck({ kind: 'level', percent: 80 })).toBe(false);
    expect(oilToCheck({ kind: 'warning', on: true })).toBe(true);
    expect(oilToCheck({ kind: 'distance', km: 0 })).toBe(false);
    expect(serviceDue({ kind: 'distance', km: 4200 }, { kind: 'days', days: 63 })).toBe(false);
    expect(serviceDue({ kind: 'distance', km: 4200 }, { kind: 'days', days: -2 })).toBe(true);
    expect(serviceDue({ kind: 'distance', km: 0 }, null)).toBe(true);
    expect(serviceDue({ kind: 'warning', on: true })).toBe(true);
    expect(serviceDue(null, null)).toBe(false);
  });

  it('reads a service warning’s words: due when its time has come or gone, not when it is almost here', () => {
    expect(serviceWord('regular_maintenance_time_for_service')).toBe(true);
    expect(serviceWord('distance_driven_overdue_for_service')).toBe(true);
    expect(serviceWord('engine_hours_almost_time_for_service')).toBe(false);
    expect(serviceWord('no_warning')).toBe(false);
    expect(serviceWord('unknown_warning')).toBeNull();
    expect(serviceWord('Bluetooth')).toBeNull();
  });
});

describe('a distance', () => {
  it('goes from kilometres to miles and back; a unit it does not know stays', () => {
    expect(convertDistance(160.9344, 'km', 'mi')).toBeCloseTo(100);
    expect(convertDistance(100, 'mi', 'km')).toBeCloseTo(160.9344);
    expect(convertDistance(5, 'km', 'km')).toBe(5);
    expect(convertDistance(5, 'furlong', 'km')).toBe(5);
    expect(isDistance('mi')).toBe(true);
    expect(isDistance('d')).toBe(false);
  });
});

describe('a pressure', () => {
  it('goes between bar, psi and kPa; a unit it does not know stays', () => {
    expect(convertPressure(2.5, 'bar', 'psi')).toBeCloseTo(36.26, 2);
    expect(convertPressure(36, 'psi', 'kPa')).toBeCloseTo(248.21, 2);
    expect(convertPressure(250, 'kPa', 'bar')).toBeCloseTo(2.5);
    expect(convertPressure(2.3, 'бар', 'psi')).toBe(2.3);
  });
});
