import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { distanceFromHome, groupByZone, haversine, whereIs } from './zones.js';

const hass = {
  states: {
    'zone.home': {
      entity_id: 'zone.home',
      state: '1',
      attributes: { friendly_name: 'Home', latitude: 41.39, longitude: 2.16 },
      last_changed: '',
      last_updated: '',
    },
    'zone.school': {
      entity_id: 'zone.school',
      state: '1',
      attributes: { friendly_name: 'School' },
      last_changed: '',
      last_updated: '',
    },
    'person.a': {
      entity_id: 'person.a',
      state: 'home',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
    'person.b': {
      entity_id: 'person.b',
      state: 'School',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
    'person.c': {
      entity_id: 'person.c',
      state: 'not_home',
      attributes: { latitude: 41.6, longitude: 2.3, gps_accuracy: 20 },
      last_changed: '',
      last_updated: '',
    },
    'person.d': {
      entity_id: 'person.d',
      state: 'not_home',
      attributes: { latitude: 41.6, longitude: 2.3, gps_accuracy: 5000 },
      last_changed: '',
      last_updated: '',
    },
    'person.e': {
      entity_id: 'person.e',
      state: 'unknown',
      attributes: {},
      last_changed: '',
      last_updated: '',
    },
  },
  config: { unit_system: { temperature: '°C', length: 'km' } },
} as unknown as HomeAssistant;
const view = (id: string) => resolveEntity(hass, id);
const zones = [view('zone.home'), view('zone.school')];

describe('where people are', () => {
  it('reads home, a zone by its name, away and unknown', () => {
    expect(whereIs(view('person.a'), zones).where).toBe('home');
    expect(whereIs(view('person.b'), zones)).toMatchObject({ where: 'zone', zone: 'zone.school' });
    expect(whereIs(view('person.c'), zones).where).toBe('away');
    expect(whereIs(view('person.e'), zones).where).toBe('unknown');
    expect(whereIs(view('person.missing'), zones).where).toBe('unknown');
  });

  it('groups them home first, the zones by name, then away and unknown, an empty zone only when kept', () => {
    const people = ['person.a', 'person.b', 'person.c', 'person.e'].map((id) =>
      whereIs(view(id), zones),
    );
    expect(groupByZone(people, zones).map((g) => g.key)).toEqual([
      'home',
      'zone.school',
      'away',
      'unknown',
    ]);
    expect(groupByZone(people.slice(0, 1), zones).map((g) => g.key)).toEqual(['home']);
    expect(groupByZone(people.slice(0, 1), zones, [], true).map((g) => g.key)).toEqual([
      'home',
      'zone.school',
    ]);
    expect(groupByZone(people, zones, [{ entity: 'zone.school' }]).map((g) => g.key)).toEqual([
      'home',
      'zone.school',
      'away',
      'unknown',
    ]);
  });

  it('measures the distance from home, rounded as said, and never from a fuzzy fix', () => {
    expect(haversine({ lat: 41.39, lon: 2.16 }, { lat: 41.39, lon: 2.16 })).toBe(0);
    const away = whereIs(view('person.c'), zones);
    const km = distanceFromHome(hass, away, view('zone.home'));
    expect(km?.unit).toBe('km');
    expect(km?.value).toBeGreaterThan(20);
    expect(Number.isInteger(km?.value)).toBe(true);
    expect(distanceFromHome(hass, whereIs(view('person.d'), zones), view('zone.home'))).toBeNull();
    expect(distanceFromHome(hass, whereIs(view('person.a'), zones), view('zone.home'))).toBeNull();
    const miles = {
      ...hass,
      config: { unit_system: { temperature: '°F', length: 'mi' } },
    } as HomeAssistant;
    expect(distanceFromHome(miles, away, view('zone.home'))?.unit).toBe('mi');
  });
});
