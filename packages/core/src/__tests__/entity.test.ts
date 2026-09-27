import { describe, expect, it } from 'vitest';
import { domainOf, isActive, resolveEntity } from '../entity.js';
import type { HomeAssistant } from '../ha/types.js';

const hass = (
  states: Record<string, { state: string; attributes?: Record<string, unknown> }>,
  extra: Partial<HomeAssistant> = {},
): HomeAssistant =>
  ({
    states: Object.fromEntries(
      Object.entries(states).map(([id, s]) => [
        id,
        {
          entity_id: id,
          state: s.state,
          attributes: s.attributes ?? {},
          last_changed: '',
          last_updated: '',
        },
      ]),
    ),
    entities: {},
    devices: {},
    areas: {},
    ...extra,
  }) as unknown as HomeAssistant;

describe('resolveEntity', () => {
  it('treats missing, unavailable and unknown as first-class states', () => {
    const h = hass({
      'light.a': { state: 'unavailable' },
      'sensor.b': { state: 'unknown' },
      'switch.c': { state: 'on' },
    });
    expect(resolveEntity(h, 'light.ghost').status).toBe('missing');
    expect(resolveEntity(h, 'light.a').status).toBe('unavailable');
    expect(resolveEntity(h, 'sensor.b').status).toBe('unknown');
    expect(resolveEntity(h, 'switch.c').status).toBe('ok');
    expect(resolveEntity(undefined, undefined).status).toBe('missing');
  });

  it('never assumes a registry entry exists (group.*, sun.sun, zone.* have none)', () => {
    const view = resolveEntity(hass({ 'sun.sun': { state: 'above_horizon' } }), 'sun.sun');
    expect(view.name).toBe('Sun');
    expect(view.areaName).toBe('');
  });

  it('finds the area through the device when the entity has none', () => {
    const h = hass(
      { 'light.a': { state: 'on' } },
      {
        entities: { 'light.a': { entity_id: 'light.a', device_id: 'd1' } },
        devices: { d1: { id: 'd1', name: 'Lamp', name_by_user: null, area_id: 'living' } },
        areas: { living: { area_id: 'living', name: 'Living room' } },
      },
    );
    expect(resolveEntity(h, 'light.a').areaName).toBe('Living room');
  });

  it('parses numbers only when they are finite', () => {
    const h = hass({
      'sensor.t': { state: '21.5' },
      'sensor.d': { state: "{'a': 1}" },
      'sensor.u': { state: 'unavailable' },
      'sensor.e': { state: '' },
      'sensor.s': { state: '  ' },
      'sensor.n': { state: '-3' },
      'sensor.i': { state: 'Infinity' },
    });
    expect(resolveEntity(h, 'sensor.t').number).toBe(21.5);
    expect(resolveEntity(h, 'sensor.d').number).toBeNull();
    expect(resolveEntity(h, 'sensor.u').number).toBeNull();
    expect(resolveEntity(h, 'sensor.e').number).toBeNull(); // Number('') is 0, and 0 is a lie here
    expect(resolveEntity(h, 'sensor.s').number).toBeNull();
    expect(resolveEntity(h, 'sensor.n').number).toBe(-3);
    expect(resolveEntity(h, 'sensor.i').number).toBeNull();
  });

  it('survives null attributes and a null registry name', () => {
    const h = hass(
      {
        'sensor.t': {
          state: '1',
          attributes: {
            friendly_name: null,
            unit_of_measurement: null,
            device_class: null,
            supported_features: null,
          },
        },
      },
      {
        entities: { 'sensor.t': { entity_id: 'sensor.t', name: null as unknown as string } },
      },
    );
    const view = resolveEntity(h, 'sensor.t');
    expect(view.name).toBe('T');
    expect(view.unit).toBe('');
    expect(view.deviceClass).toBe('');
    expect(view.supports(1)).toBe(false);
    expect(view.attr('nothing')).toBeUndefined();
  });

  it('reads supported features as a bitmask and survives their absence', () => {
    const h = hass({
      'cover.a': { state: 'open', attributes: { supported_features: 15 } },
      'cover.b': { state: 'open' },
    });
    expect(resolveEntity(h, 'cover.a').supports(4)).toBe(true);
    expect(resolveEntity(h, 'cover.a').supports(128)).toBe(false);
    expect(resolveEntity(h, 'cover.b').supports(1)).toBe(false);
  });
});

describe('isActive', () => {
  it('knows what "on" means per domain', () => {
    const h = hass({
      'light.a': { state: 'on' },
      'cover.a': { state: 'closed' },
      'climate.a': { state: 'heat' },
      'climate.b': { state: 'off' },
      'lock.a': { state: 'locked' },
      'vacuum.a': { state: 'docked' },
      'light.b': { state: 'unavailable' },
    });
    expect(isActive(resolveEntity(h, 'light.a'))).toBe(true);
    expect(isActive(resolveEntity(h, 'cover.a'))).toBe(false);
    expect(isActive(resolveEntity(h, 'climate.a'))).toBe(true);
    expect(isActive(resolveEntity(h, 'climate.b'))).toBe(false);
    expect(isActive(resolveEntity(h, 'lock.a'))).toBe(false);
    expect(isActive(resolveEntity(h, 'vacuum.a'))).toBe(false);
    expect(isActive(resolveEntity(h, 'light.b'))).toBe(false);
  });
});

describe('domainOf', () => {
  it('splits on the first dot', () => {
    expect(domainOf('sensor.a_b.c')).toBe('sensor');
    expect(domainOf('')).toBe('');
  });
});
