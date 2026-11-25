import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { actionOf, type Action, type DriveCall } from '../drive.js';
import { callOf, ownCall, waysOf, type Job, type OwnWays } from './calls.js';

/*
 * How each integration's robot is sent to its rooms, to a zone and to a point (#265): the calls a robot's ways make,
 * with their exact data, as the integration's own sources take them (`calls.ts`); which robots have which; the
 * person's own, with numbers alone in the place of what they ask for.
 */

const ROBOT = 'vacuum.robot';
/* SEND_COMMAND 256 · CLEAN_AREA 16384 */
const COMMANDS = 256;
const AREAS = 16384;

interface House {
  readonly platform?: string;
  readonly services?: Readonly<Record<string, readonly string[]>>;
  /** The actions that take entities, as Home Assistant describes them. */
  readonly targeted?: readonly string[];
  readonly features?: number;
  readonly model?: string;
}

/** A house with one robot: its integration, what the house offers, what the robot does, its model. */
function house({ platform, services = {}, targeted = [], features = 0, model }: House) {
  return {
    states: {
      [ROBOT]: { entity_id: ROBOT, state: 'docked', attributes: { supported_features: features } },
    },
    entities: platform
      ? { [ROBOT]: { entity_id: ROBOT, platform, ...(model ? { device_id: 'd1' } : {}) } }
      : {},
    devices: model ? { d1: { id: 'd1', model } } : {},
    services: Object.fromEntries(
      Object.entries(services).map(([domain, names]) => [
        domain,
        Object.fromEntries(
          names.map((name) => [name, targeted.includes(`${domain}.${name}`) ? { target: {} } : {}]),
        ),
      ]),
    ),
  } as unknown as HomeAssistant;
}

/** A call as `domain.service` with its data and where it goes. */
const said = (call: DriveCall | undefined) =>
  call && { action: `${call.domain}.${call.service}`, data: call.data, target: call.target };

const ask = (hass: HomeAssistant, job: Job, own?: OwnWays) =>
  said(callOf(waysOf(hass, ROBOT, own), job));

const KITCHEN = [25500, 25000, 26500, 26500] as const;
const HALL = [24245, 25190, 27495, 27940] as const;

describe('Xiaomi Miio', () => {
  const hass = house({
    platform: 'xiaomi_miio',
    services: { xiaomi_miio: ['vacuum_clean_zone', 'vacuum_clean_segment', 'vacuum_goto'] },
  });

  it('cleans zones by its own action, the times beside them (they are required there)', () => {
    expect(ask(hass, { zones: [KITCHEN, HALL], repeats: 2 })).toEqual({
      action: 'xiaomi_miio.vacuum_clean_zone',
      data: { zone: [KITCHEN, HALL], repeats: 2 },
      target: [ROBOT],
    });
    expect(ask(hass, { zones: [KITCHEN], repeats: 1 })?.data).toEqual({
      zone: [KITCHEN],
      repeats: 1,
    });
  });

  it('cleans rooms by their numbers, which take no times', () => {
    expect(ask(hass, { rooms: [16, '17'], repeats: 3 })).toEqual({
      action: 'xiaomi_miio.vacuum_clean_segment',
      data: { segments: [16, 17] },
      target: [ROBOT],
    });
  });

  it('goes to a point', () => {
    expect(ask(hass, { point: [25500, 26000], repeats: 1 })).toEqual({
      action: 'xiaomi_miio.vacuum_goto',
      data: { x_coord: 25500, y_coord: 26000 },
      target: [ROBOT],
    });
  });

  it('has only the ways the house offers', () => {
    const some = waysOf(
      house({ platform: 'xiaomi_miio', services: { xiaomi_miio: ['vacuum_goto'] } }),
      ROBOT,
    );
    expect(Object.keys(some)).toEqual(['point']);
  });
});

describe('Roborock (core)', () => {
  const named = house({
    platform: 'roborock',
    services: { vacuum: ['send_command'] },
    features: COMMANDS,
  });
  const whole = house({
    platform: 'roborock',
    services: {
      vacuum: ['send_command'],
      roborock: ['set_vacuum_zoned_cleaning', 'set_vacuum_goto_position'],
    },
    features: COMMANDS,
  });

  it('cleans zones by name, the times as each zone’s fifth number', () => {
    expect(ask(named, { zones: [KITCHEN, HALL], repeats: 2 })).toEqual({
      action: 'vacuum.send_command',
      data: {
        command: 'app_zoned_clean',
        params: [
          [...KITCHEN, 2],
          [...HALL, 2],
        ],
      },
      target: [ROBOT],
    });
  });

  it('cleans rooms by name, their numbers and the times in one', () => {
    expect(ask(named, { rooms: [16, 17], repeats: 2 })).toEqual({
      action: 'vacuum.send_command',
      data: { command: 'app_segment_clean', params: [{ segments: [16, 17], repeat: 2 }] },
      target: [ROBOT],
    });
  });

  it('goes to a point by name where the integration has no action for it', () => {
    expect(ask(named, { point: [25500, 26000], repeats: 1 })).toEqual({
      action: 'vacuum.send_command',
      data: { command: 'app_goto_target', params: [25500, 26000] },
      target: [ROBOT],
    });
  });

  it('cleans one zone once by the integration’s own action, which counts the times after the first', () => {
    expect(ask(whole, { zones: [KITCHEN], repeats: 1 })).toEqual({
      action: 'roborock.set_vacuum_zoned_cleaning',
      data: { x1: 25500, y1: 25000, x2: 26500, y2: 26500, repeats: 0 },
      target: [ROBOT],
    });
  });

  it('…and several zones, or more times, by name', () => {
    expect(ask(whole, { zones: [KITCHEN, HALL], repeats: 1 })?.action).toBe('vacuum.send_command');
    expect(ask(whole, { zones: [KITCHEN], repeats: 2 })?.data).toEqual({
      command: 'app_zoned_clean',
      params: [[...KITCHEN, 2]],
    });
  });

  it('goes to a point by the integration’s own action', () => {
    expect(ask(whole, { point: [25500, 26000], repeats: 1 })).toEqual({
      action: 'roborock.set_vacuum_goto_position',
      data: { x: 25500, y: 26000 },
      target: [ROBOT],
    });
  });

  it('a robot that takes no command by name keeps the integration’s own actions alone', () => {
    const newer = house({
      platform: 'roborock',
      services: {
        vacuum: ['send_command'],
        roborock: ['set_vacuum_zoned_cleaning', 'set_vacuum_goto_position'],
      },
    });
    expect(ask(newer, { zones: [KITCHEN], repeats: 1 })?.action).toBe(
      'roborock.set_vacuum_zoned_cleaning',
    );
    expect(ask(newer, { zones: [KITCHEN, HALL], repeats: 1 })).toBeUndefined();
    expect(ask(newer, { rooms: [16], repeats: 1 })).toBeUndefined();
  });
});

describe('Dreame (Tasshack)', () => {
  const hass = house({
    platform: 'dreame_vacuum',
    services: { dreame_vacuum: ['vacuum_clean_zone', 'vacuum_clean_segment', 'vacuum_goto'] },
  });

  it('cleans zones and rooms with their times, and goes to a point', () => {
    expect(ask(hass, { zones: [[819, -263, 4424, 2105]], repeats: 2 })).toEqual({
      action: 'dreame_vacuum.vacuum_clean_zone',
      data: { zone: [[819, -263, 4424, 2105]], repeats: 2 },
      target: [ROBOT],
    });
    expect(ask(hass, { rooms: [3, 5], repeats: 1 })).toEqual({
      action: 'dreame_vacuum.vacuum_clean_segment',
      data: { segments: [3, 5], repeats: 1 },
      target: [ROBOT],
    });
    expect(ask(hass, { point: [819, -263], repeats: 1 })).toEqual({
      action: 'dreame_vacuum.vacuum_goto',
      data: { x: 819, y: -263 },
      target: [ROBOT],
    });
  });
});

describe('Xiaomi Miot Auto', () => {
  it('sends a Roborock its own commands by their method', () => {
    const hass = house({
      platform: 'xiaomi_miot',
      model: 'roborock.vacuum.a01',
      services: { xiaomi_miot: ['send_command'] },
    });
    expect(ask(hass, { zones: [KITCHEN], repeats: 1 })).toEqual({
      action: 'xiaomi_miot.send_command',
      data: { method: 'app_zoned_clean', params: [[...KITCHEN, 1]] },
      target: [ROBOT],
    });
    expect(ask(hass, { rooms: [16], repeats: 1 })?.data).toEqual({
      method: 'app_segment_clean',
      params: [{ segments: [16], repeat: 1 }],
    });
    expect(ask(hass, { point: [25500, 26000], repeats: 1 })?.data).toEqual({
      method: 'app_goto_target',
      params: [25500, 26000],
    });
  });

  it('knows no way for another maker’s robot', () => {
    const hass = house({
      platform: 'xiaomi_miot',
      model: 'dreame.vacuum.p2028',
      services: { xiaomi_miot: ['send_command', 'call_action'] },
    });
    expect(waysOf(hass, ROBOT)).toEqual({});
  });
});

describe('Valetudo', () => {
  const hass = house({ platform: 'mqtt', services: { mqtt: ['publish'] } });
  const own = { topic: 'valetudo/robot' };

  it('publishes a zone’s four corners in turn to its capability’s topic, to no entity', () => {
    const call = ask(hass, { zones: [[50, 60, 100, 120]], repeats: 2 }, own);
    expect(call?.action).toBe('mqtt.publish');
    expect(call?.target).toBeUndefined();
    expect(call?.data['topic']).toBe('valetudo/robot/ZoneCleaningCapability/start/set');
    expect(JSON.parse(String(call?.data['payload']))).toEqual({
      zones: [
        {
          points: {
            pA: { x: 50, y: 60 },
            pB: { x: 100, y: 60 },
            pC: { x: 100, y: 120 },
            pD: { x: 50, y: 120 },
          },
        },
      ],
      iterations: 2,
    });
  });

  it('publishes rooms as words, in the order picked', () => {
    const call = ask(hass, { rooms: [20, '18'], repeats: 1 }, own);
    expect(call?.data['topic']).toBe('valetudo/robot/MapSegmentationCapability/clean/set');
    expect(JSON.parse(String(call?.data['payload']))).toEqual({
      segment_ids: ['20', '18'],
      iterations: 1,
      customOrder: true,
    });
  });

  it('publishes a point to go to', () => {
    const call = ask(hass, { point: [50, 60], repeats: 1 }, own);
    expect(call?.data['topic']).toBe('valetudo/robot/GoToLocationCapability/go/set');
    expect(JSON.parse(String(call?.data['payload']))).toEqual({ coordinates: { x: 50, y: 60 } });
  });

  it('has no way without its topic, or where the house cannot publish', () => {
    expect(waysOf(hass, ROBOT)).toEqual({});
    expect(waysOf(house({ platform: 'mqtt' }), ROBOT, own)).toEqual({});
  });
});

describe('Home Assistant’s own areas', () => {
  const hass = house({
    platform: 'ecovacs',
    services: { vacuum: ['clean_area'] },
    features: AREAS,
  });

  it('cleans by area a robot that says it can', () => {
    expect(ask(hass, { areas: ['kitchen', 'hall'], repeats: 1 })).toEqual({
      action: 'vacuum.clean_area',
      data: { cleaning_area_id: ['kitchen', 'hall'] },
      target: [ROBOT],
    });
  });

  it('…and none that does not, or where the house has no such action', () => {
    expect(
      ask(house({ platform: 'ecovacs', services: { vacuum: ['clean_area'] } }), {
        areas: ['kitchen'],
        repeats: 1,
      }),
    ).toBeUndefined();
    expect(
      ask(house({ platform: 'ecovacs', features: AREAS }), { areas: ['kitchen'], repeats: 1 }),
    ).toBeUndefined();
  });

  it('rooms that name their areas are cleaned by area once, and by their numbers more times', () => {
    const both = house({
      platform: 'roborock',
      services: { vacuum: ['clean_area', 'send_command'] },
      features: AREAS + COMMANDS,
    });
    const job = { rooms: [16, 17], areas: ['hall', 'kitchen'] };
    expect(ask(both, { ...job, repeats: 1 })?.action).toBe('vacuum.clean_area');
    expect(ask(both, { ...job, repeats: 2 })?.data).toEqual({
      command: 'app_segment_clean',
      params: [{ segments: [16, 17], repeat: 2 }],
    });
    // a robot with no way by numbers is cleaned by area whatever the times
    expect(ask(hass, { ...job, repeats: 2 })?.action).toBe('vacuum.clean_area');
  });
});

describe('a robot no integration is known for', () => {
  it('has no way, and a job is no call', () => {
    const hass = house({ platform: 'tuya', services: { vacuum: ['send_command'] } });
    expect(waysOf(hass, ROBOT)).toEqual({});
    expect(ask(hass, { zones: [KITCHEN], repeats: 1 })).toBeUndefined();
    expect(waysOf(undefined, ROBOT)).toEqual({});
  });

  it('a job that asks nothing is no call', () => {
    const hass = house({
      platform: 'xiaomi_miio',
      services: { xiaomi_miio: ['vacuum_clean_zone', 'vacuum_clean_segment'] },
    });
    expect(ask(hass, { repeats: 1 })).toBeUndefined();
    expect(ask(hass, { zones: [], rooms: [], repeats: 1 })).toBeUndefined();
  });
});

describe('the person’s own actions', () => {
  const action = (raw: unknown): Action => actionOf(raw, 'map.zone_action') as Action;
  const hass = house({
    platform: 'tuya',
    services: { script: ['clean_spot'], vacuum: ['send_command'], mqtt: ['publish'] },
    targeted: ['vacuum.send_command'],
  });

  it('take the selection as lists of numbers, and the times, in the place of what they ask for', () => {
    const zone_action = action({
      action: 'perform-action',
      perform_action: 'script.clean_spot',
      data: { zones: '[[selection]]', times: '[[ repeats ]]', robot: '{{ entity_id }}' },
    });
    expect(ask(hass, { zones: [KITCHEN], repeats: 2 }, { zone_action })).toEqual({
      action: 'script.clean_spot',
      data: { zones: [KITCHEN], times: 2, robot: ROBOT },
      target: undefined,
    });
  });

  it('a point is its two numbers, each alone or together', () => {
    const point_action = action({
      perform_action: 'script.clean_spot',
      data: { x: '[[point_x]]', y: '[[point_y]]', at: '[[selection]]' },
    });
    expect(ask(hass, { point: [120, 80], repeats: 1 }, { point_action })?.data).toEqual({
      x: 120,
      y: 80,
      at: [120, 80],
    });
  });

  it('inside other words a number is its digits, a list its JSON', () => {
    const room_action = action({
      perform_action: 'mqtt.publish',
      data: {
        topic: 'robot/custom_command',
        payload:
          '{"command":"segmented_cleanup","segment_ids":[[selection]],"repeats":[[repeats]]}',
      },
    });
    const call = ask(hass, { rooms: [16, 17], repeats: 2 }, { room_action });
    expect(call?.data['payload']).toBe(
      '{"command":"segmented_cleanup","segment_ids":[16,17],"repeats":2}',
    );
    // an action that takes no entity is sent to none
    expect(call?.target).toBeUndefined();
  });

  it('go to the robot where the action takes entities and its data names none', () => {
    const zone_action = action({
      perform_action: 'vacuum.send_command',
      data: { command: 'app_zoned_clean', params: '[[selection]]' },
    });
    expect(ask(hass, { zones: [KITCHEN], repeats: 1 }, { zone_action })).toEqual({
      action: 'vacuum.send_command',
      data: { command: 'app_zoned_clean', params: [KITCHEN] },
      target: [ROBOT],
    });
  });

  it('…and to their own target where they write one', () => {
    const zone_action = action({
      perform_action: 'vacuum.send_command',
      data: { command: 'app_zoned_clean', params: '[[selection]]' },
      target: { entity_id: 'vacuum.other' },
    });
    expect(ask(hass, { zones: [KITCHEN], repeats: 1 }, { zone_action })?.target).toEqual([
      'vacuum.other',
    ]);
  });

  it('stand in the integration’s place, each for its own kind', () => {
    const miio = house({
      platform: 'xiaomi_miio',
      services: {
        xiaomi_miio: ['vacuum_clean_zone', 'vacuum_clean_segment'],
        script: ['clean_spot'],
      },
    });
    const zone_action = action({ perform_action: 'script.clean_spot', data: {} });
    const ways = waysOf(miio, ROBOT, { zone_action });
    expect(said(ways.zones?.([KITCHEN], 1))?.action).toBe('script.clean_spot');
    expect(said(ways.rooms?.([16], 1))?.action).toBe('xiaomi_miio.vacuum_clean_segment');
  });

  it('are no way where the house does not offer them', () => {
    const zone_action = action({ perform_action: 'script.gone', data: {} });
    expect(waysOf(hass, ROBOT, { zone_action })).toEqual({});
  });

  it('a name the card does not say goes as it is written, and nothing but numbers is ever said', () => {
    const written = action({
      perform_action: 'script.clean_spot',
      data: { keep: '[[variables]] {{ states("sensor.x") }}', list: ['[[selection]]', 7] },
    });
    const call = ownCall(hass, written, ROBOT, { zones: [KITCHEN], repeats: 1 });
    expect(call.data).toEqual({
      keep: '[[variables]] {{ states("sensor.x") }}',
      list: [[KITCHEN], 7],
    });
  });
});
