import { resolveEntity, type EntityView, type HomeAssistant } from '@fluvy/core';
import { stateIcon } from '@fluvy/ui';
import { describe, expect, it } from 'vitest';
import { glyphFor, glyphForClass, glyphKnown, iconOf } from './domain.js';

/**
 * A house of the given states (`id: [state, attributes]`) and registry entries (`id: { icon, translation_key }`: the
 * icon the person set, the key the integration names it by).
 */
const house = (
  states: Record<string, readonly [string, Record<string, unknown>?]>,
  registry: Record<string, { icon?: string; translation_key?: string }> = {},
): HomeAssistant =>
  ({
    states: Object.fromEntries(
      Object.entries(states).map(([id, [state, attributes = {}]]) => [
        id,
        { entity_id: id, state, attributes, last_changed: '', last_updated: '' },
      ]),
    ),
    entities: Object.fromEntries(
      Object.entries(registry).map(([id, entry]) => [id, { entity_id: id, ...entry }]),
    ),
    devices: {},
    areas: {},
  }) as unknown as HomeAssistant;

/** The view of one entity in the given state, of the given device class. */
const view = (id: string, state: string, deviceClass?: string): EntityView =>
  resolveEntity(house({ [id]: [state, deviceClass ? { device_class: deviceClass } : {}] }), id);

describe('glyphFor', () => {
  it('draws a cover that opens and shuts open while it is open or opening, shut otherwise', () => {
    const forms = {
      door: ['door', 'doorOpen'],
      gate: ['gate', 'gateOpen'],
      garage: ['garage', 'garageOpen'],
      window: ['window', 'windowOpen'],
    } as const;
    for (const [dc, [shut, open]] of Object.entries(forms)) {
      expect(glyphFor(view('cover.a', 'closed', dc)), `${dc} closed`).toBe(shut);
      expect(glyphFor(view('cover.a', 'closing', dc)), `${dc} closing`).toBe(shut);
      expect(glyphFor(view('cover.a', 'open', dc)), `${dc} open`).toBe(open);
      expect(glyphFor(view('cover.a', 'opening', dc)), `${dc} opening`).toBe(open);
      expect(glyphFor(view('cover.a', 'unavailable', dc)), `${dc} unavailable`).toBe(shut);
    }
  });

  it('draws a damper as the fan, and whatever rolls or folds as the blinds, open or not', () => {
    for (const state of ['open', 'closed']) {
      expect(glyphFor(view('cover.a', state, 'damper'))).toBe('fan');
      for (const dc of ['shutter', 'blind', 'curtain', 'awning', 'shade', undefined])
        expect(glyphFor(view('cover.a', state, dc)), `${dc} ${state}`).toBe('blinds');
    }
  });

  it('draws an opening sensor open while it is on, and what a fill says on in one glyph', () => {
    const forms = {
      door: ['door', 'doorOpen'],
      opening: ['door', 'doorOpen'],
      garage_door: ['garage', 'garageOpen'],
      window: ['window', 'windowOpen'],
    } as const;
    for (const [dc, [shut, open]] of Object.entries(forms)) {
      expect(glyphFor(view('binary_sensor.a', 'off', dc)), `${dc} off`).toBe(shut);
      expect(glyphFor(view('binary_sensor.a', 'on', dc)), `${dc} on`).toBe(open);
    }
    const one = { motion: 'motion', occupancy: 'motion', moisture: 'drop', smoke: 'warn' };
    for (const [dc, glyph] of Object.entries(one))
      for (const state of ['on', 'off'])
        expect(glyphFor(view('binary_sensor.a', state, dc)), `${dc} ${state}`).toBe(glyph);
  });

  it('draws what is not there as the ban glyph, whatever it was', () => {
    expect(glyphFor(resolveEntity(house({}), 'cover.gone'))).toBe('ban');
  });

  it('draws a lawn mower as the leaf, as the vacuum card does', () => {
    expect(glyphFor(view('lawn_mower.a', 'mowing'))).toBe('leaf');
  });
});

describe('glyphForClass', () => {
  it('draws an opening shut: a chart has no state to open it', () => {
    expect(glyphForClass('cover', 'garage')).toBe('garage');
    expect(glyphForClass('cover', 'gate')).toBe('gate');
    expect(glyphForClass('binary_sensor', 'window')).toBe('window');
    expect(glyphForClass('binary_sensor', 'opening')).toBe('door');
    expect(glyphForClass('sensor', 'temperature')).toBe('thermo');
  });
});

describe('glyphKnown', () => {
  it('knows the kinds Fluvy draws, and not those whose icon only Home Assistant knows', () => {
    expect(glyphKnown(view('light.a', 'on'))).toBe(true);
    expect(glyphKnown(view('cover.a', 'open', 'gate'))).toBe(true);
    expect(glyphKnown(view('binary_sensor.a', 'on', 'window'))).toBe(true);
    expect(glyphKnown(view('sensor.a', '21', 'temperature'))).toBe(true);
    // what is not there is drawn as such: the ban glyph is Fluvy's
    expect(glyphKnown(resolveEntity(house({}), 'sensor.gone'))).toBe(true);
    // a sensor or a binary sensor of a class Fluvy does not draw, a domain it does not know
    expect(glyphKnown(view('sensor.a', '12', 'pm25'))).toBe(false);
    expect(glyphKnown(view('binary_sensor.a', 'on', 'vibration'))).toBe(false);
    expect(glyphKnown(view('zone.home', '2'))).toBe(false);
  });

  it('keeps its stand-in for what has no class, unless Home Assistant knows better', () => {
    expect(glyphKnown(view('sensor.a', 'x'))).toBe(true);
    expect(glyphKnown(view('binary_sensor.a', 'on'))).toBe(true);
    // its integration gives it an icon, or may declare one by the key it names it by
    const hass = house(
      {
        'sensor.pollen': ['3', { icon: 'mdi:flower-pollen' }],
        'sensor.phase': ['waxing', {}],
        'binary_sensor.cloud': ['on', {}],
      },
      {
        'sensor.phase': { translation_key: 'moon_phase' },
        'binary_sensor.cloud': { translation_key: 'remote_ui' },
      },
    );
    expect(glyphKnown(resolveEntity(hass, 'sensor.pollen'))).toBe(false);
    expect(glyphKnown(resolveEntity(hass, 'sensor.phase'))).toBe(false);
    expect(glyphKnown(resolveEntity(hass, 'binary_sensor.cloud'))).toBe(false);
  });
});

describe('iconOf', () => {
  const hass = house(
    {
      // Home Assistant writes the person's icon into the state too
      'cover.gate': ['open', { device_class: 'gate', icon: 'mdi:gate-arrow-right' }],
      'cover.drive': ['open', { device_class: 'gate', icon: 'mdi:boom-gate' }],
      'cover.garage': ['closed', { device_class: 'garage' }],
      'sensor.pollen': ['3', { icon: 'mdi:flower-pollen' }],
      'sensor.air': ['12', { device_class: 'pm25' }],
      'sensor.phase': ['waxing', {}],
      'sensor.count': ['4', {}],
      // a helper's own settings hold the icon the person gives it
      'input_boolean.guests': ['on', { icon: 'mdi:account-group' }],
    },
    {
      'cover.gate': { icon: 'mdi:gate-arrow-right' },
      'sensor.phase': { translation_key: 'moon_phase' },
    },
  );
  const of = (id: string): EntityView => resolveEntity(hass, id);

  it('takes the card’s own icon first, whatever the entity has', () => {
    expect(iconOf(of('cover.gate'), 'fluvy:door')).toBe('fluvy:door');
    expect(iconOf(of('sensor.air'), 'mdi:air-filter')).toBe('mdi:air-filter');
    expect(iconOf(resolveEntity(hass, 'cover.gone'), 'mdi:gate')).toBe('mdi:gate');
  });

  it('then the icon the person set in Home Assistant, in the registry or a helper’s settings', () => {
    expect(iconOf(of('cover.gate'))).toBe('mdi:gate-arrow-right');
    expect(iconOf(of('input_boolean.guests'))).toBe('mdi:account-group');
  });

  it('then Fluvy’s glyph for the kind, as it stands, before its integration’s', () => {
    expect(iconOf(of('cover.drive'))).toBe('gateOpen');
    expect(iconOf(of('cover.garage'))).toBe('garage');
  });

  it('then its integration’s, then Home Assistant’s own for its state', () => {
    expect(iconOf(of('sensor.pollen'))).toBe('mdi:flower-pollen');
    expect(iconOf(of('sensor.air'))).toBe(stateIcon('sensor.air', '12'));
    expect(stateIcon('sensor.air', '12')).toBe('ha-state:sensor.air=12');
  });

  it('draws what has no class with Fluvy’s stand-in, unless its integration may declare an icon for it', () => {
    expect(iconOf(of('sensor.count'))).toBe('trendUp');
    expect(iconOf(of('sensor.phase'))).toBe(stateIcon('sensor.phase', 'waxing'));
  });

  it('asks Home Assistant for its icon in the state the view stands in, one it had too', () => {
    expect(iconOf({ ...of('sensor.air'), state: '40' })).toBe(stateIcon('sensor.air', '40'));
  });

  it('draws an entity that is not there as the ban glyph', () => {
    expect(iconOf(resolveEntity(hass, 'cover.gone'))).toBe('ban');
    expect(iconOf(resolveEntity(hass, 'sensor.gone'))).toBe('ban');
  });

  it('ends at the dots for a view of no state at all', () => {
    expect(iconOf({ ...of('sensor.air'), stateObj: undefined })).toBe('dots');
  });
});
