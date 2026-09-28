import { describe, expect, it } from 'vitest';
import {
  areaClimate,
  areaEntities,
  areaIndex,
  areaOf,
  areasInOrder,
  areaSummary,
  floorsInOrder,
  usableEntity,
  type Registries,
} from '../areas.js';

const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => [
  id,
  { entity_id: id, state: value, attributes, last_changed: '', last_updated: '' },
];

function house(): Registries {
  return {
    states: Object.fromEntries([
      state('light.sofa', 'on'),
      state('light.desk', 'off'),
      state('switch.fan_plug', 'on'),
      state('cover.blind', 'open'),
      state('sensor.room_temperature', '21', { device_class: 'temperature' }),
      state('sensor.room_humidity', '48', { device_class: 'humidity' }),
      state('sensor.hidden_power', '3'),
      state('sensor.diagnostic_rssi', '-60'),
      state('switch.config_led', 'on'),
      state('light.hall', 'on'),
    ]) as Registries['states'],
    entities: {
      'light.sofa': { entity_id: 'light.sofa', device_id: 'd1' },
      'light.desk': { entity_id: 'light.desk', area_id: 'office', device_id: 'd1' },
      'switch.fan_plug': { entity_id: 'switch.fan_plug', device_id: 'd1' },
      'cover.blind': { entity_id: 'cover.blind', area_id: 'living' },
      'sensor.room_temperature': { entity_id: 'sensor.room_temperature', area_id: 'living' },
      'sensor.room_humidity': { entity_id: 'sensor.room_humidity', area_id: 'living' },
      'sensor.hidden_power': { entity_id: 'sensor.hidden_power', area_id: 'living', hidden: true },
      'sensor.diagnostic_rssi': {
        entity_id: 'sensor.diagnostic_rssi',
        area_id: 'living',
        entity_category: 'diagnostic',
      },
      'switch.config_led': {
        entity_id: 'switch.config_led',
        area_id: 'living',
        entity_category: 'config',
      },
      'light.hall': { entity_id: 'light.hall', area_id: 'hall' },
    },
    devices: { d1: { id: 'd1', name: 'Hub', name_by_user: null, area_id: 'living' } },
    areas: {
      living: { area_id: 'living', name: 'Living room', floor_id: 'ground' },
      office: {
        area_id: 'office',
        name: 'Office',
        floor_id: 'upstairs',
        temperature_entity_id: 'sensor.room_temperature',
      },
      hall: { area_id: 'hall', name: 'Hall', floor_id: 'ground' },
      attic: { area_id: 'attic', name: 'Attic' },
    },
    floors: {
      upstairs: { floor_id: 'upstairs', name: 'Upstairs', level: 1 },
      ground: { floor_id: 'ground', name: 'Ground', level: 0 },
      roof: { floor_id: 'roof', name: 'Roof' },
    },
  };
}

describe('the house by its rooms', () => {
  it("puts an entity in its own area, else its device's", () => {
    const hass = house();
    expect(areaOf(hass, 'light.sofa')).toBe('living');
    expect(areaOf(hass, 'light.desk')).toBe('office');
    expect(areaOf(hass, 'sensor.nowhere')).toBeUndefined();
    expect(areaOf(undefined, 'light.sofa')).toBeUndefined();
  });

  it('shows what a dashboard should: hidden and config out, diagnostic on request', () => {
    const hass = house();
    expect(areaEntities(hass, 'living')).toEqual([
      'cover.blind',
      'light.sofa',
      'sensor.room_humidity',
      'sensor.room_temperature',
      'switch.fan_plug',
    ]);
    expect(areaEntities(hass, 'living', { diagnostic: true })).toContain('sensor.diagnostic_rssi');
    expect(areaEntities(hass, 'living', { hidden: true })).toContain('sensor.hidden_power');
    expect(areaEntities(hass, 'living', { domains: ['light'] })).toEqual(['light.sofa']);
    expect(usableEntity(hass, 'switch.config_led')).toBe(false);
    expect(usableEntity(hass, 'sensor.nowhere')).toBe(false);
  });

  it('indexes once per registries and again when they are new objects', () => {
    const hass = house();
    const first = areaIndex(hass);
    expect(areaIndex(hass)).toBe(first);
    expect(areaIndex({ ...hass, devices: { ...hass.devices } })).not.toBe(first);
    expect(areaIndex({ ...hass, entities: { ...hass.entities } })).not.toBe(first);
  });

  it('counts what a room holds and leads with its lights', () => {
    expect(areaSummary(house(), 'living')).toEqual({
      total: 5,
      on: 3,
      controls: ['light.sofa', 'switch.fan_plug', 'cover.blind'],
    });
  });

  it("finds a room's climate by the registry, else by class", () => {
    const hass = house();
    expect(areaClimate(hass, 'living')).toEqual({
      temperature: 'sensor.room_temperature',
      humidity: 'sensor.room_humidity',
    });
    expect(areaClimate(hass, 'office')).toEqual({ temperature: 'sensor.room_temperature' });
    expect(areaClimate(hass, 'hall')).toEqual({});
  });

  it('orders floors by level and areas floor by floor, the unplaced last', () => {
    const hass = house();
    expect(floorsInOrder(hass).map((floor) => floor.floor_id)).toEqual([
      'ground',
      'upstairs',
      'roof',
    ]);
    expect(areasInOrder(hass).map((area) => area.area_id)).toEqual([
      'hall',
      'living',
      'office',
      'attic',
    ]);
    const { states, entities, devices, areas } = hass;
    expect(floorsInOrder({ states, entities, devices, areas })).toEqual([]);
  });
});
