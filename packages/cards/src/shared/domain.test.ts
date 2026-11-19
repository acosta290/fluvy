import { resolveEntity, setLevelGlyphs, type EntityView, type HomeAssistant } from '@fluvy/core';
import { levelOf } from '@fluvy/core/levels';
import { isGlyph, stateIcon } from '@fluvy/ui';
import { afterEach, describe, expect, it } from 'vitest';
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

/** A sensor of the class reading `state` in `unit`. */
const reading = (deviceClass: string, state: string, unit: string): EntityView =>
  resolveEntity(
    house({ 'sensor.a': [state, { device_class: deviceClass, unit_of_measurement: unit }] }),
    'sensor.a',
  );

describe('glyphFor, where the house shows levels (1.23, #226)', () => {
  afterEach(() => setLevelGlyphs(undefined));

  it('draws one glyph of each kind until the house turns the levels on: nothing changes on upgrade', () => {
    expect(glyphFor(reading('battery', '5', '%'))).toBe('battery');
    expect(glyphFor(reading('signal_strength', '-50', 'dBm'))).toBe('signal');
    expect(glyphFor(view('valve.a', 'closed'))).toBe('drop');
    expect(glyphFor(view('binary_sensor.a', 'on', 'battery_charging'))).toBe('check');
  });

  it('draws a battery by its charge: empty to 10 %, low to 35, half to 70, full above', () => {
    setLevelGlyphs(levelOf);
    const ladder = {
      0: 'batteryEmpty',
      5: 'batteryEmpty',
      10: 'batteryEmpty',
      11: 'batteryLow',
      25: 'batteryLow',
    };
    const rest = {
      35: 'batteryLow',
      36: 'batteryHalf',
      60: 'batteryHalf',
      70: 'batteryHalf',
      71: 'batteryFull',
    };
    for (const [level, glyph] of Object.entries({
      ...ladder,
      ...rest,
      95: 'batteryFull',
      100: 'batteryFull',
    }))
      expect(glyphFor(reading('battery', level, '%')), `${level} %`).toBe(glyph);
    // a reading that says no charge keeps the battery
    for (const state of ['unknown', 'unavailable'])
      expect(glyphFor(reading('battery', state, '%')), state).toBe('battery');
    // a binary battery on is low, off is the battery; one charging is charging, and the battery when it is not
    expect(glyphFor(view('binary_sensor.a', 'on', 'battery'))).toBe('batteryLow');
    expect(glyphFor(view('binary_sensor.a', 'off', 'battery'))).toBe('battery');
    expect(glyphFor(view('binary_sensor.a', 'on', 'battery_charging'))).toBe('batteryCharging');
    expect(glyphFor(view('binary_sensor.a', 'off', 'battery_charging'))).toBe('battery');
    // what the house draws by itself is drawn by Fluvy, over Home Assistant's level-aware icon
    expect(glyphKnown(view('binary_sensor.a', 'on', 'battery_charging'))).toBe(true);
    expect(iconOf(reading('battery', '25', '%'))).toBe('batteryLow');
    expect(isGlyph('batteryLow')).toBe(true);
  });

  it('draws a signal by its bars, in dBm as a phone counts them and in percent by the quarter', () => {
    setLevelGlyphs(levelOf);
    const dbm = {
      '-40': 'signalStrong',
      '-55': 'signalStrong',
      '-60': 'signalGood',
      '-70': 'signalFair',
    };
    for (const [level, glyph] of Object.entries({
      ...dbm,
      '-80': 'signalWeak',
      '-95': 'signalNone',
    }))
      expect(glyphFor(reading('signal_strength', level, 'dBm')), `${level} dBm`).toBe(glyph);
    const percent = {
      0: 'signalNone',
      10: 'signalWeak',
      30: 'signalFair',
      60: 'signalGood',
      90: 'signalStrong',
    };
    for (const [level, glyph] of Object.entries(percent))
      expect(glyphFor(reading('signal_strength', level, '%')), `${level} %`).toBe(glyph);
    // a unit that says no strength (a ratio in dB) keeps the signal
    expect(glyphFor(reading('signal_strength', '30', 'dB'))).toBe('signal');
  });

  it('draws a valve open or shut as it stands, and the drop while it says neither', () => {
    setLevelGlyphs(levelOf);
    expect(glyphFor(view('valve.a', 'open'))).toBe('valveOpen');
    expect(glyphFor(view('valve.a', 'opening'))).toBe('valveOpen');
    expect(glyphFor(view('valve.a', 'closed'))).toBe('valveShut');
    expect(glyphFor(view('valve.a', 'closing'))).toBe('valveShut');
    expect(glyphFor(view('valve.a', 'unavailable'))).toBe('drop');
    // a chart's head reads no level: its kind's one glyph
    expect(glyphForClass('sensor', 'battery')).toBe('battery');
    expect(glyphForClass('valve', '')).toBe('drop');
    // what is not there is still the ban
    expect(glyphFor(resolveEntity(house({}), 'sensor.gone'))).toBe('ban');
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
