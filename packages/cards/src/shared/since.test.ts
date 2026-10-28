import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { changedAt, sinceIds, sinceOf } from './since.js';

/*
 * The real last change (#67): where a row reads it from (`since`, the card's `since_pattern`), what reads as a moment
 * (ISO, an epoch in seconds or milliseconds, a sensor's state or an attribute), and what falls back to Home
 * Assistant's own `last_changed`.
 */

const CHANGED = '2026-10-26T08:00:00.000Z';
const HELPER = '2026-10-26T04:00:00+00:00';
const OPENED = '2026-10-25T14:00:00Z';
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id,
  state: value,
  attributes,
  last_changed: CHANGED,
  last_updated: CHANGED,
});
const hass = {
  language: 'en',
  states: {
    'binary_sensor.door': state('binary_sensor.door', 'off', {
      device_class: 'door',
      opened_at: Date.parse(OPENED) / 1000,
      opened_ms: Date.parse(OPENED),
      note: 'a while ago',
    }),
    'sensor.door_real_last_changed': state('sensor.door_real_last_changed', HELPER, {
      device_class: 'timestamp',
    }),
    'sensor.seconds': state('sensor.seconds', String(Date.parse(OPENED) / 1000)),
    'sensor.millis': state('sensor.millis', String(Date.parse(OPENED))),
    'sensor.blank': state('sensor.blank', 'unknown'),
    'sensor.gone': state('sensor.gone', 'unavailable'),
    'sensor.words': state('sensor.words', 'yesterday'),
  },
} as unknown as HomeAssistant;
const view = (id: string) => resolveEntity(hass, id);
const door = { entity: 'binary_sensor.door' };

describe('sinceOf', () => {
  it('is the row’s own, else the card’s pattern filled in for the row, else none', () => {
    expect(sinceOf({ ...door, since: 'sensor.when' }, 'sensor.{id}_x')).toBe('sensor.when');
    expect(sinceOf(door, 'sensor.{id}_real_last_changed')).toBe('sensor.door_real_last_changed');
    expect(sinceOf(door, '{entity}_at')).toBe('binary_sensor.door_at');
    expect(sinceOf(door)).toBeUndefined();
    expect(sinceOf({ since: '' }, 'sensor.{id}_x')).toBeUndefined();
  });
});

describe('changedAt', () => {
  const iso = (date: Date | null) => date?.toISOString();

  it('is Home Assistant’s own last change without a since, and none for an entity the house has not got', () => {
    expect(iso(changedAt(hass, view('binary_sensor.door')))).toBe(CHANGED);
    expect(changedAt(hass, view('binary_sensor.missing'), 'sensor.door_real_last_changed')).toBe(
      null,
    );
  });

  it('reads a timestamp sensor’s state: ISO, or an epoch in seconds or milliseconds', () => {
    expect(iso(changedAt(hass, view('binary_sensor.door'), 'sensor.door_real_last_changed'))).toBe(
      new Date(HELPER).toISOString(),
    );
    expect(iso(changedAt(hass, view('binary_sensor.door'), 'sensor.seconds'))).toBe(
      new Date(OPENED).toISOString(),
    );
    expect(iso(changedAt(hass, view('binary_sensor.door'), 'sensor.millis'))).toBe(
      new Date(OPENED).toISOString(),
    );
  });

  it('reads an attribute of the row’s own entity (attribute:name), as an epoch too', () => {
    expect(iso(changedAt(hass, view('binary_sensor.door'), 'attribute:opened_at'))).toBe(
      new Date(OPENED).toISOString(),
    );
    expect(iso(changedAt(hass, view('binary_sensor.door'), 'attribute:opened_ms'))).toBe(
      new Date(OPENED).toISOString(),
    );
  });

  it('falls back to Home Assistant’s own where the since does not read: empty, unknown, unavailable, words, missing', () => {
    for (const since of [
      '',
      'sensor.blank',
      'sensor.gone',
      'sensor.words',
      'sensor.missing',
      'attribute:note',
      'attribute:missing',
    ])
      expect(iso(changedAt(hass, view('binary_sensor.door'), since)), since).toBe(CHANGED);
  });
});

describe('sinceIds', () => {
  it('lists the sensors the rows read, their own and the pattern’s, never an attribute', () => {
    expect(
      sinceIds(
        [
          { entity: 'binary_sensor.door', since: 'sensor.when' },
          { entity: 'binary_sensor.window' },
          { entity: 'binary_sensor.gate', since: 'attribute:opened_at' },
        ],
        'sensor.{id}_real_last_changed',
      ),
    ).toEqual(['sensor.when', 'sensor.window_real_last_changed']);
    expect(sinceIds([{ entity: 'binary_sensor.door' }])).toEqual([]);
  });
});
