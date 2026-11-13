import type { HomeAssistant } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driveProfile, ownDrive, STEP_MS, type DriveCall, type DriveProfile } from './drive.js';

/*
 * How each integration's robot is driven: the calls a profile makes, with their exact data, for a start, a move each
 * way and a stop, as the integration's own sources take them (`drive.ts`); which robots have one; the person's own.
 */

/** The case's robot: one of its own for every case, since a profile once found is kept by the robot's id. */
let ROBOT = '';
let robots = 0;
beforeEach(() => {
  ROBOT = `vacuum.robot_${++robots}`;
});

interface House {
  readonly platform?: string;
  readonly services?: Readonly<Record<string, readonly string[]>>;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly model?: string;
}

/** A house with one robot: its integration, what the house offers, what the robot says of itself, its model. */
function house({ platform, services = {}, attributes = {}, model }: House): HomeAssistant {
  return {
    states: { [ROBOT]: { entity_id: ROBOT, state: 'docked', attributes } },
    entities: platform
      ? { [ROBOT]: { entity_id: ROBOT, platform, ...(model ? { device_id: 'd1' } : {}) } }
      : {},
    devices: model ? { d1: { id: 'd1', model } } : {},
    services: Object.fromEntries(
      Object.entries(services).map(([domain, names]) => [
        domain,
        Object.fromEntries(names.map((name) => [name, {}])),
      ]),
    ),
  } as unknown as HomeAssistant;
}

/** A call as `domain.service` with its data and where it goes. */
const said = (call: DriveCall | undefined) =>
  call && { action: `${call.domain}.${call.service}`, data: call.data, target: call.target };

/** A profile's whole vocabulary: start, forward, back, left, right, stop. */
const speak = (profile: DriveProfile | undefined) => ({
  start: said(profile?.start?.()),
  forward: said(profile?.move(1, 0, 1)),
  back: said(profile?.move(-1, 0, 2)),
  left: said(profile?.move(0, 1, 3)),
  right: said(profile?.move(0, -1, 4)),
  stop: said(profile?.stop?.()),
});

const MIIO = [
  'vacuum_remote_control_start',
  'vacuum_remote_control_move',
  'vacuum_remote_control_stop',
];

afterEach(() => vi.restoreAllMocks());

describe('the robots a hand can drive', () => {
  it('Xiaomi Miio: its own start, move and stop, a speed in m/s, a turn in degrees, a step in ms', () => {
    const hass = house({ platform: 'xiaomi_miio', services: { xiaomi_miio: MIIO } });
    const move = (velocity: number, rotation: number) => ({
      action: 'xiaomi_miio.vacuum_remote_control_move',
      data: { velocity, rotation, duration: STEP_MS },
      target: [ROBOT],
    });
    expect(speak(driveProfile(hass, { entity: ROBOT }))).toEqual({
      start: { action: 'xiaomi_miio.vacuum_remote_control_start', data: {}, target: [ROBOT] },
      forward: move(0.19, 0),
      back: move(-0.19, 0),
      left: move(0, 60),
      right: move(0, -60),
      stop: { action: 'xiaomi_miio.vacuum_remote_control_stop', data: {}, target: [ROBOT] },
    });
  });

  it('keeps a Roborock inside what it takes at any speed: 0.29 m/s, 179 degrees', () => {
    const hass = house({ platform: 'xiaomi_miio', services: { xiaomi_miio: MIIO } });
    const fast = driveProfile(hass, { entity: ROBOT, drive_speed: 'fast' });
    expect(fast?.move(1, 0, 1).data).toMatchObject({ velocity: 0.29, rotation: 0 });
    expect(fast?.move(0, -1, 2).data).toMatchObject({ velocity: 0, rotation: -90 });
    const slow = driveProfile(hass, { entity: ROBOT, drive_speed: 'slow' });
    expect(slow?.move(-1, 0, 1).data).toMatchObject({ velocity: -0.1, rotation: 0 });
    expect(slow?.move(0, 1, 2).data).toMatchObject({ velocity: 0, rotation: 30 });
    // a speed the config does not know is the usual one
    expect(driveProfile(hass, { entity: ROBOT, drive_speed: 'warp' })?.move(1, 0, 1).data).toEqual({
      velocity: 0.19,
      rotation: 0,
      duration: STEP_MS,
    });
  });

  it('Roborock: the robot’s own commands through vacuum.send_command, a turn in rad/s, each move numbered', () => {
    const hass = house({
      platform: 'roborock',
      services: { vacuum: ['send_command'] },
      attributes: { supported_features: 256 + 8192 },
    });
    const command = (name: string, params?: unknown) => ({
      action: 'vacuum.send_command',
      data: params ? { command: name, params } : { command: name },
      target: [ROBOT],
    });
    const move = (velocity: number, omega: number, seqnum: number) =>
      command('app_rc_move', [{ omega, velocity, duration: STEP_MS, seqnum }]);
    expect(speak(driveProfile(hass, { entity: ROBOT }))).toEqual({
      start: command('app_rc_start'),
      forward: move(0.19, 0, 1),
      back: move(-0.19, 0, 2),
      left: move(0, 1.05, 3),
      right: move(0, -1.05, 4),
      stop: command('app_rc_end'),
    });
  });

  it('offers a Roborock none where the robot takes no command, or the house offers none', () => {
    const services = { vacuum: ['send_command'] };
    expect(
      driveProfile(
        house({ platform: 'roborock', services, attributes: { supported_features: 8192 } }),
        { entity: ROBOT },
      ),
    ).toBeUndefined();
    expect(
      driveProfile(house({ platform: 'roborock', attributes: { supported_features: 256 } }), {
        entity: ROBOT,
      }),
    ).toBeUndefined();
  });

  it('Dreame: one step a call, its start a step that goes nowhere, its stop the robot’s own', () => {
    const hass = house({
      platform: 'dreame_vacuum',
      services: { dreame_vacuum: ['vacuum_remote_control_move_step'] },
    });
    const step = (velocity: number, rotation: number) => ({
      action: 'dreame_vacuum.vacuum_remote_control_move_step',
      data: { velocity, rotation },
      target: [ROBOT],
    });
    expect(speak(driveProfile(hass, { entity: ROBOT }))).toEqual({
      start: step(0, 0),
      forward: step(200, 0),
      back: step(-200, 0),
      left: step(0, 60),
      right: step(0, -60),
      stop: { action: 'vacuum.stop', data: {}, target: [ROBOT] },
    });
  });

  it('Xiaomi Miot: a Dreame-made robot by its remote-state property, service 4, property 15', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hass = house({
      platform: 'xiaomi_miot',
      services: { xiaomi_miot: ['set_miot_property'] },
      attributes: { 'vacuum_extend.work_mode': 0 },
    });
    const write = (spdv: number, spdw: number, audio: string) => ({
      action: 'xiaomi_miot.set_miot_property',
      data: {
        siid: 4,
        piid: 15,
        value: `{"spdv":${spdv},"spdw":${spdw},"audio":"${audio}","random":32767}`,
      },
      target: [ROBOT],
    });
    expect(speak(driveProfile(hass, { entity: ROBOT }))).toEqual({
      // the robot says it is driven as it starts, and nothing with each move
      start: write(0, 0, 'true'),
      forward: write(200, 0, 'false'),
      back: write(-200, 0, 'false'),
      left: write(0, 60, 'false'),
      right: write(0, -60, 'false'),
      stop: { action: 'vacuum.stop', data: {}, target: [ROBOT] },
    });
  });

  it('Xiaomi Miot: a Xiaomi robot of Dreame’s make by its model, whatever its attributes say', () => {
    const services = { xiaomi_miot: ['set_miot_property'] };
    for (const model of ['xiaomi.vacuum.c102gl', 'xiaomi.vacuum.c102cn', 'xiaomi.vacuum.d110ch'])
      expect(
        driveProfile(house({ platform: 'xiaomi_miot', services, model }), { entity: ROBOT }),
        model,
      ).toBeDefined();
  });

  it('Xiaomi Miot: no profile for a robot whose spec keeps another service under that name, or none', () => {
    const services = { xiaomi_miot: ['set_miot_property'] };
    for (const model of ['xiaomi.vacuum.b108gl', 'ijai.vacuum.v19', 'dreame.vacuum.r2312'])
      expect(
        driveProfile(house({ platform: 'xiaomi_miot', services, model }), { entity: ROBOT }),
        model,
      ).toBeUndefined();
  });

  it('Xiaomi Miot: a Roborock by its own commands, sent as miio', () => {
    const hass = house({
      platform: 'xiaomi_miot',
      services: { xiaomi_miot: ['send_command', 'set_miot_property'] },
      model: 'roborock.vacuum.a15',
    });
    const profile = driveProfile(hass, { entity: ROBOT });
    expect(said(profile?.start?.())).toEqual({
      action: 'xiaomi_miot.send_command',
      data: { method: 'app_rc_start', params: [] },
      target: [ROBOT],
    });
    expect(said(profile?.move(1, 0, 7))).toEqual({
      action: 'xiaomi_miot.send_command',
      data: {
        method: 'app_rc_move',
        params: [{ omega: 0, velocity: 0.19, duration: STEP_MS, seqnum: 7 }],
      },
      target: [ROBOT],
    });
    expect(profile?.stop?.().data).toEqual({ method: 'app_rc_end', params: [] });
  });

  it('knows none for an integration with no remote control, a robot with no entry, or a house without its actions', () => {
    expect(driveProfile(house({ platform: 'ecovacs' }), { entity: ROBOT })).toBeUndefined();
    expect(driveProfile(house({}), { entity: ROBOT })).toBeUndefined();
    expect(driveProfile(house({ platform: 'xiaomi_miio' }), { entity: ROBOT })).toBeUndefined();
    expect(driveProfile(undefined, { entity: ROBOT })).toBeUndefined();
    expect(driveProfile(house({ platform: 'xiaomi_miio' }), {})).toBeUndefined();
    // an integration is never read off the table's own makings
    expect(driveProfile(house({ platform: 'constructor' }), { entity: ROBOT })).toBeUndefined();
  });

  it('drives the robot the config names where it is another', () => {
    const hass = {
      ...house({ platform: 'ecovacs', services: { xiaomi_miio: MIIO } }),
      entities: {
        [ROBOT]: { entity_id: ROBOT, platform: 'ecovacs' },
        'vacuum.twin': { entity_id: 'vacuum.twin', platform: 'xiaomi_miio' },
      },
    } as unknown as HomeAssistant;
    const profile = driveProfile(hass, { entity: ROBOT, drive_entity: 'vacuum.twin' });
    expect(profile?.start?.().target).toEqual(['vacuum.twin']);
  });

  it('keeps a robot’s profile once found, as the page last read it, while it is out of reach', () => {
    const id = 'vacuum.kept';
    const reach = {
      ...house({ services: { xiaomi_miot: ['set_miot_property'] } }),
      states: {
        [id]: { entity_id: id, state: 'idle', attributes: { 'vacuum_extend.work_mode': 0 } },
      },
      entities: { [id]: { entity_id: id, platform: 'xiaomi_miot' } },
    } as unknown as HomeAssistant;
    expect(driveProfile(reach, { entity: id })).toBeDefined();
    // unavailable, its attributes gone; then gone from the house
    const away = {
      ...reach,
      states: { [id]: { entity_id: id, state: 'unavailable', attributes: {} } },
    };
    expect(driveProfile(away as unknown as HomeAssistant, { entity: id })).toBeDefined();
    expect(
      driveProfile({ ...reach, states: {}, entities: {} } as unknown as HomeAssistant, {
        entity: id,
      }),
    ).toBeDefined();
  });
});

describe('a robot’s own calls', () => {
  const services = { script: ['drive', 'park'], mqtt: ['publish'] };
  let hass: HomeAssistant;
  beforeEach(() => {
    hass = house({ platform: 'mqtt', services });
  });

  it('says each call as written, the speed and the turn where it asks for them, as numbers', () => {
    const profile = driveProfile(hass, {
      entity: ROBOT,
      drive: {
        start: { action: 'script.drive', data: { mode: 'start' } },
        move: {
          action: 'script.drive',
          data: { velocity: '{{ velocity }}', rotation: '{{rotation}}', step: '{{ seq }}' },
        },
        stop: { action: 'script.park' },
        velocity: 0.2,
        rotation: 45,
      },
    });
    expect(speak(profile)).toEqual({
      start: { action: 'script.drive', data: { mode: 'start' }, target: [ROBOT] },
      forward: {
        action: 'script.drive',
        data: { velocity: 0.2, rotation: 0, step: 1 },
        target: [ROBOT],
      },
      back: {
        action: 'script.drive',
        data: { velocity: -0.2, rotation: 0, step: 2 },
        target: [ROBOT],
      },
      left: {
        action: 'script.drive',
        data: { velocity: 0, rotation: 45, step: 3 },
        target: [ROBOT],
      },
      right: {
        action: 'script.drive',
        data: { velocity: 0, rotation: -45, step: 4 },
        target: [ROBOT],
      },
      stop: { action: 'script.park', data: {}, target: [ROBOT] },
    });
  });

  it('writes a number inside other words as its digits, deep in the data: a Dreame’s JSON, a list', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const profile = driveProfile(hass, {
      entity: ROBOT,
      drive_speed: 'slow',
      drive: {
        move: {
          service: 'mqtt.publish',
          data: {
            topic: 'robot/drive',
            payload: '{"spdv":{{ velocity }},"spdw":{{ rotation }},"random":{{ random }}}',
            nested: { list: ['{{ velocity }}', 'kept {{ unknown }}', 7] },
          },
        },
        velocity: 300,
        rotation: 90,
      },
    });
    expect(said(profile?.move(1, -1, 5))).toEqual({
      action: 'mqtt.publish',
      data: {
        topic: 'robot/drive',
        payload: '{"spdv":150,"spdw":-45,"random":16383}',
        nested: { list: [150, 'kept {{ unknown }}', 7] },
      },
      target: [ROBOT],
    });
    // no start and no stop where the config names none
    expect(profile?.start).toBeUndefined();
    expect(profile?.stop).toBeUndefined();
  });

  it('sends a call to its own target, or to the entity its data names, never to the card’s robot too', () => {
    const profile = driveProfile(hass, {
      entity: ROBOT,
      drive: {
        move: { action: 'script.drive', target: { entity_id: 'script.drive' } },
        stop: { action: 'script.park', data: { entity_id: 'vacuum.other' } },
      },
    });
    expect(profile?.move(1, 0, 1).target).toEqual(['script.drive']);
    expect(profile?.stop?.().target).toBeUndefined();
  });

  it('is a profile only while the house offers each of its actions, and comes before the integration’s', () => {
    const drive = { move: { action: 'script.drive' }, stop: { action: 'script.gone' } };
    expect(driveProfile(hass, { entity: ROBOT, drive })).toBeUndefined();
    const miio = house({ platform: 'xiaomi_miio', services: { ...services, xiaomi_miio: MIIO } });
    expect(
      driveProfile(miio, { entity: ROBOT, drive: { move: { action: 'script.drive' } } })?.move(
        1,
        0,
        1,
      ).service,
    ).toBe('drive');
  });

  it('says what is wrong with a config it cannot read, in words', () => {
    expect(ownDrive(undefined)).toBeUndefined();
    expect(ownDrive(null)).toBeUndefined();
    expect(ownDrive('script.drive')).toBe('"drive" must be a map of start, move and stop');
    // a map left empty is none; one that names anything needs its move
    expect(ownDrive({})).toBeUndefined();
    expect(ownDrive({ stop: { action: 'script.park' } })).toBe('"drive.move" is required');
    expect(ownDrive({ move: 'script.drive' })).toBe('"drive.move" must be an action');
    expect(ownDrive({ move: { action: 'drive' } })).toBe(
      '"drive.move" needs an action (domain.name)',
    );
    expect(ownDrive({ move: { action: 'script.drive; rm' } })).toBe(
      '"drive.move" needs an action (domain.name)',
    );
    expect(ownDrive({ move: { action: 'script.drive', data: [1] } })).toBe(
      '"drive.move.data" must be a map',
    );
    expect(
      ownDrive({
        move: { action: 'script.drive', target: { entity_id: ['vacuum.a', 'not an id'] } },
      }),
    ).toBe('"drive.move.target" must name entities');
    expect(ownDrive({ move: { action: 'script.drive' }, stop: 7 })).toBe(
      '"drive.stop" must be an action',
    );
    expect(ownDrive({ move: { action: 'script.drive' }, velocity: '0.2' })).toBe(
      '"drive.velocity" must be a number',
    );
    expect(ownDrive({ move: { action: 'script.drive' }, rotation: Number.NaN })).toBe(
      '"drive.rotation" must be a number',
    );
  });
});
