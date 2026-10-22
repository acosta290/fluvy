import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionOf } from './motion.js';

/*
 * A camera's motion sensor, read off its device: a binary sensor of motion, occupancy or presence on the same device,
 * never one of another class or on another device; found once per registry, looked for again after half a minute.
 */

const entry = (entity_id: string, device_id: string) => ({ entity_id, device_id });
const house = (classes: Record<string, string>, devices: Record<string, string>): HomeAssistant =>
  ({
    entities: Object.fromEntries(
      Object.entries(devices).map(([id, device]) => [id, entry(id, device)]),
    ),
    states: Object.fromEntries(
      Object.entries(classes).map(([id, device_class]) => [
        id,
        { entity_id: id, state: 'off', attributes: { device_class } },
      ]),
    ),
  }) as unknown as HomeAssistant;

afterEach(() => vi.useRealTimers());

describe('a camera’s motion sensor', () => {
  it('is the motion, occupancy or presence sensor on its own device', () => {
    for (const cls of ['motion', 'occupancy', 'presence']) {
      const hass = house(
        { 'binary_sensor.porch_door': 'door', 'binary_sensor.porch_seen': cls },
        {
          'camera.porch': 'd1',
          'binary_sensor.porch_door': 'd1',
          'binary_sensor.porch_seen': 'd1',
        },
      );
      expect(motionOf(hass, 'camera.porch')).toBe('binary_sensor.porch_seen');
    }
  });

  it('is none of another device’s, of another class, nor a sensor that is not binary', () => {
    const hass = house(
      {
        'binary_sensor.hall_motion': 'motion',
        'binary_sensor.porch_door': 'door',
        'sensor.porch_motion': 'motion',
      },
      {
        'camera.porch': 'd1',
        'binary_sensor.hall_motion': 'd2',
        'binary_sensor.porch_door': 'd1',
        'sensor.porch_motion': 'd1',
      },
    );
    expect(motionOf(hass, 'camera.porch')).toBeUndefined();
    expect(motionOf(hass, 'camera.unknown')).toBeUndefined();
  });

  it('is looked for again half a minute after it was not found, its state come since', () => {
    vi.useFakeTimers();
    const hass = house({}, { 'camera.gate': 'd3', 'binary_sensor.gate_person': 'd3' });
    expect(motionOf(hass, 'camera.gate')).toBeUndefined();
    (hass.states as Record<string, unknown>)['binary_sensor.gate_person'] = {
      entity_id: 'binary_sensor.gate_person',
      state: 'on',
      attributes: { device_class: 'occupancy' },
    };
    expect(motionOf(hass, 'camera.gate')).toBeUndefined();
    vi.advanceTimersByTime(30_000);
    expect(motionOf(hass, 'camera.gate')).toBe('binary_sensor.gate_person');
  });
});
