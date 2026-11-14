import {
  ensureLanguage,
  resolveEntity,
  setLanguageOverride,
  type HassEntity,
  type HomeAssistant,
} from '@fluvy/core';
import { afterAll, describe, expect, it } from 'vitest';
import { doing, doingLine, opening, setpoint, type DoingAsk } from './doing.js';

/*
 * What a thermostat is doing (#185), as its card, its tile, its sheet and a room's row all read it: out of reach, a
 * window open, what holds the heating back, the action, the mode.
 */

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed: '2026-11-14T08:00:00Z',
  last_updated: '2026-11-14T08:00:00Z',
});

const house = (states: readonly HassEntity[], more: Partial<HomeAssistant> = {}): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    ...more,
  }) as unknown as HomeAssistant;

const TRV = 'climate.bedroom';
const trv = (state: string, attributes: Record<string, unknown> = {}): HassEntity =>
  entity(TRV, state, { temperature: 21.5, target_temp_step: 0.5, ...attributes });

/** The reading of the first entity of a house, in the heat's tone where it says its mode. */
const read = (hass: HomeAssistant, ask?: DoingAsk, id = TRV) => {
  const view = resolveEntity(hass, id);
  return doing({ hass, rawHass: hass }, view, view.state, 'heat', ask);
};

afterAll(() => setLanguageOverride(undefined));

describe('what a thermostat is doing', () => {
  it('says the action in the action’s tone, the mode in the mode’s where it says none', () => {
    expect(read(house([trv('heat', { hvac_action: 'heating' })]))).toEqual({
      text: 'Heating',
      tone: 'heat',
    });
    expect(read(house([trv('heat', { hvac_action: 'idle' })]))).toEqual({
      text: 'Idle',
      tone: 'neutral',
    });
    expect(read(house([trv('heat')]))).toEqual({ text: 'Heat', tone: 'heat' });
    expect(read(house([trv('unavailable')]))).toEqual({ text: 'Unavailable', tone: 'off' });
  });

  it('says a window open only where it is asked, and only while the thermostat is on', () => {
    const open = trv('heat', { hvac_action: 'idle', window_open: true });
    // not asked: the action, as before
    expect(read(house([open]))).toEqual({ text: 'Idle', tone: 'neutral' });
    expect(read(house([open]), { show_window: true })).toEqual({
      text: 'Window open',
      tone: 'warning',
    });
    expect(read(house([{ ...open, state: 'off' }]), { show_window: true }).text).toBe('Idle');
    const off = trv('off', { window_open: true });
    expect(read(house([off]), { show_window: true })).toEqual({ text: 'Off', tone: 'heat' });
  });

  it('reads the window where the thermostat says it, a named sensor says it, or one on its device does', () => {
    const hass = house(
      [
        trv('heat', { hvac_action: 'heating' }),
        entity('binary_sensor.bedroom_window', 'on', { device_class: 'window' }),
        entity('binary_sensor.patio_door', 'on', { device_class: 'door' }),
        entity('climate.study', 'heat', { heating_blocked_by: 'door', door_open: true }),
        entity('climate.loft', 'heat', { hvac_action: 'heating' }),
      ],
      {
        entities: {
          [TRV]: { entity_id: TRV, device_id: 'valve' },
          'binary_sensor.bedroom_window': {
            entity_id: 'binary_sensor.bedroom_window',
            device_id: 'valve',
          },
        },
      } as unknown as Partial<HomeAssistant>,
    );
    // the valve's own sensor, found on its device
    expect(read(hass, { show_window: true }).text).toBe('Window open');
    // a sensor named: a door's says a door
    expect(read(hass, { window_entity: 'binary_sensor.patio_door' }, 'climate.loft').text).toBe(
      'Door open',
    );
    // Better Thermostat's own word for what holds it back
    expect(read(hass, { show_window: true }, 'climate.study').text).toBe('Door open');
    // nothing to read: nothing said
    expect(read(hass, { show_window: true }, 'climate.loft').text).toBe('Heating');
    expect(opening(hass, resolveEntity(hass, 'climate.loft'))).toBeUndefined();
    expect(opening(hass, resolveEntity(hass, TRV))).toBe('window');
    expect(
      opening(
        house([trv('heat', { window_open: false })]),
        resolveEntity(house([trv('heat', { window_open: false })]), TRV),
      ),
    ).toBe(false);
  });

  it('says what else Better Thermostat holds the heating back for, in its word, Fluvy’s Idle its short form', () => {
    const held = trv('heat', { hvac_action: 'idle', heating_blocked_by: 'no_call_for_heat' });
    expect(read(house([held]), { show_window: true })).toEqual({
      text: 'No call for heat',
      short: 'Idle',
      tone: 'neutral',
    });
    const says = {
      formatEntityAttributeValue: (_: HassEntity, attribute: string, value: unknown) =>
        attribute === 'heating_blocked_by' ? 'Valve maintenance' : String(value),
    } as unknown as Partial<HomeAssistant>;
    expect(
      read(
        house(
          [trv('heat', { hvac_action: 'idle', heating_blocked_by: 'valve_maintenance' })],
          says,
        ),
        { show_window: true },
      ).text,
    ).toBe('Valve maintenance');
    // not asked, or the thermostat itself off: the action
    expect(read(house([held])).text).toBe('Idle');
    expect(
      read(house([trv('heat', { hvac_action: 'idle', heating_blocked_by: 'hvac_off' })]), {
        show_window: true,
      }).text,
    ).toBe('Idle');
  });

  it('reads the action from another entity where one is named: an action, a switch, never one out of reach', () => {
    const plain = trv('heat');
    const by = (state: string, mode = 'heat') =>
      read(house([{ ...plain, state: mode }, entity('switch.heater', state)]), {
        state_entity: 'switch.heater',
      });
    expect(by('on')).toEqual({ text: 'Heating', tone: 'heat' });
    expect(by('off')).toEqual({ text: 'Idle', tone: 'neutral' });
    expect(by('on', 'cool')).toEqual({ text: 'Cooling', tone: 'cool' });
    expect(by('Defrosting')).toEqual({ text: 'Defrosting', tone: 'heat' });
    // it says nothing of the kind: the thermostat's own
    expect(by('unavailable')).toEqual({ text: 'Heat', tone: 'heat' });
    expect(read(house([plain]), { state_entity: 'switch.gone' }).text).toBe('Heat');
  });

  it('says Home Assistant’s word where Fluvy speaks the page’s language, Fluvy’s own as its short form', async () => {
    await ensureLanguage('de');
    const german = {
      language: 'de',
      locale: { language: 'de', number_format: 'language', time_format: '24' },
      formatEntityAttributeValue: () => 'Leerlauf',
    } as unknown as Partial<HomeAssistant>;
    expect(read(house([trv('heat', { hvac_action: 'idle' })], german))).toEqual({
      text: 'Leerlauf',
      short: 'Bereit',
      tone: 'neutral',
    });
  });
});

describe('what a thermostat is set to, beside the word', () => {
  const set = (state: HassEntity, hass = house([state])): string =>
    setpoint(hass, resolveEntity(hass, state.entity_id), state.state);

  it('is its target, its range while it holds one, a humidifier’s humidity, none where it has none', () => {
    expect(set(trv('heat'))).toBe('21.5°');
    expect(set(entity(TRV, 'heat', { temperature: 21 }))).toBe('21.0°');
    expect(set(entity(TRV, 'heat', { temperature: 21, target_temp_step: 1 }))).toBe('21°');
    expect(
      set(
        entity(TRV, 'heat_cool', { target_temp_low: 20, target_temp_high: 24, temperature: null }),
      ),
    ).toBe('20–24°');
    expect(set(entity('humidifier.nursery', 'on', { humidity: 50 }))).toBe('50 %');
    expect(set(entity(TRV, 'heat', { temperature: null }))).toBe('');
  });

  it('is said after the word on a line, but while a window is open or the thermostat is off', () => {
    const line = (state: HassEntity) => {
      const hass = house([state]);
      return doingLine({ hass, rawHass: hass }, resolveEntity(hass, state.entity_id), state.state);
    };
    expect(line(trv('heat', { hvac_action: 'heating' }))).toEqual({
      line: 'Heating · 21.5°',
      forms: ['Heat'],
    });
    expect(line(trv('heat', { hvac_action: 'idle' })).line).toBe('Idle · 21.5°');
    expect(line(trv('heat', { hvac_action: 'idle', window_open: true })).line).toBe('Window open');
    expect(line(trv('off', { hvac_action: 'off' })).line).toBe('Off');
    expect(
      line(entity('humidifier.nursery', 'on', { humidity: 50, action: 'humidifying' })),
    ).toEqual({ line: 'Humidifying · 50 %', forms: ['On'] });
  });
});
