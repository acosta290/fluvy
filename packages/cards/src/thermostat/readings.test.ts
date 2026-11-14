import { resolveEntity, type HassEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { batteryLevel, humidityOf, valveOf, windowBy, type ReadingsAsk } from './readings.js';

/*
 * What a thermostat reads beside its target where its card asks (#185): nothing until asked, the entity or the
 * attribute named, else what is found on the climate, on its device, or on the valves a Better Thermostat drives.
 */

type Seed = readonly [id: string, state: string, attributes?: Record<string, unknown>];

/** A house of the entities given, those of `devices` on the device each is listed under. */
function house(
  seeds: readonly Seed[],
  devices: Readonly<Record<string, readonly string[]>> = {},
  registry: Readonly<Record<string, Record<string, unknown>>> = {},
): HomeAssistant {
  const states = Object.fromEntries(
    seeds.map(([entity_id, state, attributes = {}]): [string, HassEntity] => [
      entity_id,
      {
        entity_id,
        state,
        attributes,
        last_changed: '2026-11-14T08:00:00Z',
        last_updated: '2026-11-14T08:00:00Z',
      },
    ]),
  );
  const entities = Object.fromEntries(
    Object.entries(devices).flatMap(([device_id, ids]) =>
      ids.map((entity_id) => [entity_id, { entity_id, device_id, ...registry[entity_id] }]),
    ),
  );
  return { language: 'en', states, entities, devices: {}, areas: {} } as unknown as HomeAssistant;
}

const TRV = 'climate.bedroom';
const percent = { unit_of_measurement: '%' };
const read = <T>(
  of: (hass: HomeAssistant, view: ReturnType<typeof resolveEntity>, ask: ReadingsAsk) => T,
  hass: HomeAssistant,
  ask: ReadingsAsk,
  id = TRV,
): T => of(hass, resolveEntity(hass, id), ask);

describe('how far the valve is open', () => {
  it('is read from nothing until it is asked for', () => {
    const hass = house([[TRV, 'heat', { valve_position: 42 }]]);
    expect(read(valveOf, hass, {})).toBeUndefined();
    expect(read(valveOf, hass, { show_valve: true })).toEqual({ value: 42, entity: TRV });
  });

  it('is the entity named, then the attribute named, whatever is found', () => {
    const hass = house([
      [TRV, 'heat', { valve_position: 42, opening: 17.6 }],
      ['sensor.radiator', '63.4', percent],
      ['sensor.asleep', 'unavailable', percent],
    ]);
    expect(read(valveOf, hass, { valve_entity: 'sensor.radiator', show_valve: true })).toEqual({
      value: 63,
      entity: 'sensor.radiator',
    });
    expect(read(valveOf, hass, { valve_attribute: 'opening' })).toEqual({ value: 18 });
    // named and unread: nothing, never what would be found in its place
    expect(
      read(valveOf, hass, { valve_entity: 'sensor.asleep', show_valve: true }),
    ).toBeUndefined();
    expect(read(valveOf, hass, { valve_attribute: 'none_such', show_valve: true })).toBeUndefined();
  });

  it('is found on the climate itself: generic, ZHA’s demand, Netatmo’s request', () => {
    const found = (attributes: Record<string, unknown>) =>
      read(valveOf, house([[TRV, 'heat', attributes]]), { show_valve: true })?.value;
    expect(found({ valve_position: 30 })).toBe(30);
    expect(found({ pi_heating_demand: 55 })).toBe(55);
    expect(found({ heating_power_request: 100 })).toBe(100);
    expect(found({ valve_position: 140 })).toBe(100);
    expect(found({ valve_position: null })).toBeUndefined();
  });

  it('is found on the climate’s device: a percentage that reads the valve, the likeliest first', () => {
    const device = { valve: [TRV, 'sensor.bedroom_position', 'sensor.bedroom_pi_heating_demand'] };
    const hass = house(
      [
        [TRV, 'heat'],
        ['sensor.bedroom_position', '12', percent],
        ['sensor.bedroom_pi_heating_demand', '37', percent],
      ],
      device,
    );
    expect(read(valveOf, hass, { show_valve: true })).toEqual({
      value: 37,
      entity: 'sensor.bedroom_pi_heating_demand',
    });
    // Tado's heating, on the zone's device
    const tado = house(
      [
        [TRV, 'heat'],
        ['sensor.bedroom_heating', '64', percent],
      ],
      { zone: [TRV, 'sensor.bedroom_heating'] },
    );
    expect(read(valveOf, tado, { show_valve: true })?.value).toBe(64);
  });

  it('is never a setting, a reading in another unit, nor another device’s', () => {
    const hass = house(
      [
        [TRV, 'heat'],
        // how far a Sonoff valve may open: a setting of the device, not its opening
        ['number.bedroom_valve_opening_degree', '100', percent],
        ['sensor.bedroom_position', '3', { unit_of_measurement: 'mm' }],
        ['sensor.hall_valve_position', '80', percent],
      ],
      {
        valve: [TRV, 'number.bedroom_valve_opening_degree', 'sensor.bedroom_position'],
        other: ['sensor.hall_valve_position'],
      },
      { 'number.bedroom_valve_opening_degree': { entity_category: 'config' } },
    );
    expect(read(valveOf, hass, { show_valve: true })).toBeUndefined();
  });

  it('is the most open of the valves a Better Thermostat drives', () => {
    const hass = house(
      [
        [
          'climate.living',
          'heat',
          {
            batteries: JSON.stringify({
              'climate.living_left': { battery_id: 'sensor.left_battery', battery: 64 },
              'climate.living_right': { battery_id: 'sensor.right_battery', battery: '23' },
              'binary_sensor.living_window': { battery_id: null, battery: null },
            }),
          },
        ],
        ['climate.living_left', 'heat', { valve_position: 15 }],
        ['climate.living_right', 'heat'],
        ['sensor.living_right_position', '40', percent],
      ],
      { right: ['climate.living_right', 'sensor.living_right_position'] },
    );
    expect(read(valveOf, hass, { show_valve: true }, 'climate.living')).toEqual({
      value: 40,
      entity: 'sensor.living_right_position',
    });
    // and its battery the lowest of theirs
    expect(read(batteryLevel, hass, { show_battery: true }, 'climate.living')).toEqual({
      value: 23,
      entity: undefined,
    });
  });
});

describe('the battery, the window and the humidity', () => {
  const hass = house(
    [
      [TRV, 'heat', { current_humidity: 46 }],
      ['sensor.bedroom_battery', '8', { device_class: 'battery', ...percent }],
      ['sensor.spare_battery', '91', { device_class: 'battery', ...percent }],
      ['binary_sensor.bedroom_window', 'off', { device_class: 'window' }],
      ['binary_sensor.balcony_door', 'on', { device_class: 'door' }],
      ['sensor.landing_humidity', '58.2', percent],
      ['humidifier.nursery', 'on', { current_humidity: 44 }],
    ],
    { valve: [TRV, 'sensor.bedroom_battery', 'binary_sensor.bedroom_window'] },
  );

  it('reads the battery on the device where asked, the one named before it', () => {
    expect(read(batteryLevel, hass, {})).toBeUndefined();
    expect(read(batteryLevel, hass, { show_battery: true })).toEqual({
      value: 8,
      entity: 'sensor.bedroom_battery',
    });
    expect(read(batteryLevel, hass, { battery_entity: 'sensor.spare_battery' })?.value).toBe(91);
    expect(batteryLevel(house([]), resolveEntity(house([]), TRV), { show_battery: true })).toBe(
      undefined,
    );
  });

  it('reads the window where asked: shut or open, a door where it is one, the sensor that says so', () => {
    expect(read(windowBy, hass, {})).toBeUndefined();
    expect(read(windowBy, hass, { show_window: true })).toEqual({
      open: false,
      door: false,
      entity: 'binary_sensor.bedroom_window',
    });
    expect(read(windowBy, hass, { window_entity: 'binary_sensor.balcony_door' })).toEqual({
      open: true,
      door: true,
      entity: 'binary_sensor.balcony_door',
    });
    // nothing to read: no window to say anything of
    expect(read(windowBy, hass, { show_window: true }, 'humidifier.nursery')).toBeUndefined();
  });

  it('reads a climate’s humidity as before, another sensor’s where one is named, never a humidifier’s', () => {
    expect(read(humidityOf, hass, {})).toEqual({ value: 46, entity: undefined });
    expect(read(humidityOf, hass, { humidity_entity: 'sensor.landing_humidity' })).toEqual({
      value: 58.2,
      entity: 'sensor.landing_humidity',
    });
    expect(read(humidityOf, hass, {}, 'humidifier.nursery')).toBeUndefined();
  });
});
