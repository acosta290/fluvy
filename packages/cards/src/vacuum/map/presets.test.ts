import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import { actionOf, type Action } from '../drive.js';
import { waysOf } from './calls.js';
import type { Preset } from './config.js';
import { areaPresets, presetCall, presetChips } from './presets.js';

/*
 * The card's presets (#265): the call each one is, the house's areas as presets, and what each one's chip says.
 */

const ROBOT = 'vacuum.robot';

const preset = (extra: Partial<Preset>): Preset => ({
  name: 'Preset',
  zones: [],
  rooms: [],
  areas: [],
  repeats: 1,
  onMap: true,
  ...extra,
});

/** A Xiaomi Miio robot in a house that offers what `services` lists. */
function house(
  services: Readonly<Record<string, readonly string[]>>,
  robot = ROBOT,
): HomeAssistant {
  return {
    states: { [robot]: { entity_id: robot, state: 'docked', attributes: {} } },
    entities: { [robot]: { entity_id: robot, platform: 'xiaomi_miio' } },
    devices: {},
    services: Object.fromEntries(
      Object.entries(services).map(([domain, names]) => [
        domain,
        Object.fromEntries(names.map((name) => [name, { target: {} }])),
      ]),
    ),
  } as unknown as HomeAssistant;
}

const MIIO = { xiaomi_miio: ['vacuum_clean_zone', 'vacuum_clean_segment', 'vacuum_goto'] };

describe('the call a preset is', () => {
  const hass = house({ ...MIIO, vacuum: ['start', 'send_command'] });
  const ways = waysOf(hass, ROBOT);
  const call = (one: Preset, picked?: Parameters<typeof presetCall>[4]) => {
    const found = presetCall(hass, ways, ROBOT, one, picked);
    return found && { action: `${found.domain}.${found.service}`, data: found.data };
  };

  it('its integration’s for what it names, its own times over', () => {
    expect(call(preset({ zones: [[1, 2, 3, 4]], repeats: 2 }))).toEqual({
      action: 'xiaomi_miio.vacuum_clean_zone',
      data: { zone: [[1, 2, 3, 4]], repeats: 2 },
    });
    expect(call(preset({ rooms: [16, 17] }))?.action).toBe('xiaomi_miio.vacuum_clean_segment');
    expect(call(preset({ point: [5, 6] }))?.data).toEqual({ x_coord: 5, y_coord: 6 });
  });

  it('a start where it names nothing, a mower’s for a mower', () => {
    expect(call(preset({}))).toEqual({ action: 'vacuum.start', data: {} });
    const lawn = house({ lawn_mower: ['start_mowing'] }, 'lawn_mower.robot');
    const found = presetCall(lawn, {}, 'lawn_mower.robot', preset({}));
    expect(found && `${found.domain}.${found.service}`).toBe('lawn_mower.start_mowing');
  });

  it('none where the robot has no way for it', () => {
    expect(call(preset({ areas: ['kitchen'] }))).toBeUndefined();
    const bare = house({});
    expect(presetCall(bare, waysOf(bare, ROBOT), ROBOT, preset({}))).toBeUndefined();
  });

  const own = (data: Record<string, unknown>): Action =>
    actionOf({ perform_action: 'vacuum.send_command', data }, 'presets[0].tap_action') as Action;

  it('its own, with the numbers of what it names', () => {
    const table = preset({
      zones: [[1, 2, 3, 4]],
      repeats: 2,
      tap: {
        call: own({ command: 'app_zoned_clean', params: '[[selection]]', times: '[[repeats]]' }),
      },
    });
    expect(call(table)).toEqual({
      action: 'vacuum.send_command',
      data: { command: 'app_zoned_clean', params: [[1, 2, 3, 4]], times: 2 },
    });
  });

  it('its own, with the numbers of what is picked on the map where it names nothing', () => {
    const picked = preset({
      tap: { call: own({ command: 'app_zoned_clean', params: '[[selection]]' }) },
    });
    expect(call(picked)).toBeUndefined();
    expect(call(picked, { zones: [[9, 9, 10, 10]], repeats: 1 })?.data).toEqual({
      command: 'app_zoned_clean',
      params: [[9, 9, 10, 10]],
    });
    const there = preset({
      tap: { call: own({ command: 'go', x: '[[point_x]]', y: '[[point_y]]' }) },
    });
    expect(call(there, { zones: [[9, 9, 10, 10]], repeats: 1 })).toBeUndefined();
    expect(call(there, { point: [3, 4], repeats: 1 })?.data).toEqual({ command: 'go', x: 3, y: 4 });
  });

  it('its own that asks for no number runs as it is written', () => {
    expect(call(preset({ tap: { call: own({ command: 'app_start_wash' }) } }))).toEqual({
      action: 'vacuum.send_command',
      data: { command: 'app_start_wash' },
    });
  });

  it('its own is none where the house does not offer it', () => {
    const gone = actionOf({ perform_action: 'script.gone' }, 'x') as Action;
    expect(call(preset({ tap: { call: gone } }))).toBeUndefined();
  });

  it('an action of another kind is no call; a still press’s or a double tap’s own is what the person wrote', () => {
    const elsewhere = preset({
      zones: [[1, 2, 3, 4]],
      tap: { action: { action: 'navigate', navigation_path: '/robot' } },
      hold: { call: own({ command: 'app_zoned_clean', params: '[[selection]]' }) },
    });
    expect(call(elsewhere)).toBeUndefined();
    const held = presetCall(hass, ways, ROBOT, elsewhere, undefined, elsewhere.hold);
    expect(held?.data).toEqual({ command: 'app_zoned_clean', params: [[1, 2, 3, 4]] });
  });
});

describe('the house’s areas as presets', () => {
  it('are one for each area the robot has mapped that the house still has, read once', async () => {
    const callWS = vi.fn(() =>
      Promise.resolve({
        options: { vacuum: { area_mapping: { kitchen: ['0_17'], hall: ['0_16'], gone: ['0_9'] } } },
      }),
    );
    const hass = {
      callWS,
      areas: {
        hall: { area_id: 'hall', name: 'Hall', icon: 'mdi:door' },
        kitchen: { area_id: 'kitchen', name: 'Kitchen' },
      },
    } as unknown as HomeAssistant;
    const read = vi.fn();
    expect(areaPresets(hass, 'vacuum.mapped', read)).toEqual([]);
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(areaPresets(hass, 'vacuum.mapped', read)).toEqual([
      preset({ name: 'Kitchen', areas: ['kitchen'] }),
      preset({ name: 'Hall', icon: 'mdi:door', areas: ['hall'] }),
    ]);
    expect(callWS).toHaveBeenCalledTimes(1);
    expect(callWS).toHaveBeenCalledWith({
      type: 'config/entity_registry/get',
      entity_id: 'vacuum.mapped',
    });
  });

  it('are none for a robot with no mapping, or one the house will not say', async () => {
    const read = vi.fn();
    const bare = { callWS: () => Promise.resolve({ options: {} }), areas: {} };
    expect(areaPresets(bare as unknown as HomeAssistant, 'vacuum.bare', read)).toEqual([]);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    expect(areaPresets(bare as unknown as HomeAssistant, 'vacuum.bare', read)).toEqual([]);
    const refused = { callWS: () => Promise.reject(new Error('no')), areas: {} };
    expect(areaPresets(refused as unknown as HomeAssistant, 'vacuum.refused', read)).toEqual([]);
    expect(areaPresets(undefined, 'vacuum.none', read)).toEqual([]);
  });
});

describe('the presets’ chips', () => {
  const PRESETS = [
    preset({ name: 'Cooker', icon: 'mdi:stove', color: 'teal' }),
    preset({ name: 'Table' }),
    preset({ name: 'Bin' }),
  ];
  const look = {
    accent: (colour: string | undefined) => (colour ? `#${colour}` : undefined),
    shown: (_: Preset, index: number) => index === 1,
    runs: (_: Preset, index: number) => index !== 2,
    hold: (_: Preset, index: number) => (index === 0 ? () => undefined : undefined),
    still: false,
  };

  it('say each one’s name, icon and colour, lit while the map shows it, still where it cannot run', () => {
    const chips = presetChips(PRESETS, look);
    expect(chips.map((chip) => [chip.key, chip.label, chip.name])).toEqual([
      ['0', 'Cooker', true],
      ['1', 'Table', true],
      ['2', 'Bin', true],
    ]);
    expect(chips[0]).toMatchObject({ glyph: 'mdi:stove', accent: '#teal', tone: 'accent' });
    expect(chips[0]?.onHold).toBeTypeOf('function');
    expect(chips[1]).toMatchObject({ active: true });
    expect(chips[1]?.onHold).toBeUndefined();
    expect(chips[1]?.accent).toBeUndefined();
    expect(chips[2]).toMatchObject({ disabled: true, active: false });
  });

  it('are all in the dashed skin, none lit and none held, while the robot is out of reach', () => {
    const chips = presetChips(PRESETS, { ...look, still: true });
    expect(chips.every((chip) => chip.unavailable && !chip.active && !chip.onHold)).toBe(true);
  });
});
