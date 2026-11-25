import type { HomeAssistant } from '@fluvy/core';
import {
  call,
  entryOf,
  modelOf,
  offers,
  said,
  type Action,
  type Bag,
  type DriveCall,
} from '../drive.js';
import type { Point, Rect } from './calibration.js';

/*
 * How a robot is sent to its rooms, to a zone or to a point (#265), as each integration takes it, read from its own
 * sources (2026-11) and tried on no robot: the table is the reader's to correct, and a map's own `room_action`,
 * `zone_action` and `point_action` say a robot's calls where it knows none. Home Assistant's own `vacuum.clean_area`
 * (2026.3; its areas mapped to the robot's segments in the entity's settings) wherever the robot says it takes it.
 * Xiaomi Miio's services (core's `xiaomi_miio/services.yaml`: a zone's repeats are required there). Core's Roborock
 * through `vacuum.send_command` (python-roborock's `app_segment_clean`, `app_zoned_clean` and `app_goto_target`, as
 * python-miio writes their parameters: the times a zone is cleaned ride as its fifth number), its own
 * `roborock.set_vacuum_goto_position` for a point and `roborock.set_vacuum_zoned_cleaning` for one zone cleaned once,
 * which its newer robots take where they take no command by name. Dreame's (Tasshack's `dreame_vacuum/services.yaml`).
 * A Roborock set up with Xiaomi Miot Auto through `xiaomi_miot.send_command`. Valetudo through `mqtt.publish` to its
 * capabilities' topics (its `docs/pages/integrations/mqtt.md`), the JSON built here from numbers alone.
 */

/** A room as its robot counts it: a number, or a word where the person's own config writes one. */
export type RoomId = number | string;

/** What a robot is asked: rooms, Home Assistant's areas, zones or a point to go to, and how many times over. */
export interface Job {
  readonly rooms?: readonly RoomId[];
  readonly areas?: readonly string[];
  readonly zones?: readonly Rect[];
  readonly point?: Point;
  readonly repeats: number;
}

/** What a robot can be asked, each as the call that asks it; a way it has not is not there. */
export interface Ways {
  readonly rooms?: (ids: readonly RoomId[], repeats: number) => DriveCall | undefined;
  readonly zones?: (zones: readonly Rect[], repeats: number) => DriveCall | undefined;
  readonly point?: (point: Point) => DriveCall | undefined;
  readonly areas?: (areas: readonly string[]) => DriveCall | undefined;
}

/** The kinds of thing picked on a map. */
export type Kind = 'rooms' | 'zones' | 'point';

/** What a map's config says of its robot's calls: Valetudo's topic, and the person's own actions. */
export interface OwnWays {
  readonly topic?: string;
  readonly room_action?: Action;
  readonly zone_action?: Action;
  readonly point_action?: Action;
}

/** Home Assistant's `VacuumEntityFeature`: a robot that takes commands by name, and one that cleans by area. */
const SEND_COMMAND = 256;
const CLEAN_AREA = 16384;

const supports = (hass: HomeAssistant, id: string, bit: number): boolean =>
  (Number(hass.states[id]?.attributes['supported_features']) & bit) !== 0;

/** Rooms as the robots that count them in whole numbers take them. */
const whole = (ids: readonly RoomId[]): number[] => ids.map(Number).filter(Number.isInteger);

/** Only the ways `known` says Home Assistant offers. */
const offered = (ways: Ways, known: Readonly<Partial<Record<keyof Ways, boolean>>>): Ways =>
  Object.fromEntries(Object.entries(ways).filter(([way]) => known[way as keyof Ways])) as Ways;

/** Roborock's own commands, each handed to `send` by its name with its parameters. */
const roborock = (send: (command: string, params: readonly unknown[]) => DriveCall): Ways => ({
  rooms: (ids, repeats) => send('app_segment_clean', [{ segments: whole(ids), repeat: repeats }]),
  zones: (zones, repeats) =>
    send(
      'app_zoned_clean',
      zones.map((zone) => [...zone, repeats]),
    ),
  point: (point) => send('app_goto_target', [...point]),
});

/** Valetudo's capabilities by MQTT under its `topic`: rooms as words, a zone by its four corners, in turn. */
const valetudo = (topic: string): Ways => {
  const publish = (capability: string, payload: Bag): DriveCall =>
    call('mqtt', 'publish', {
      topic: `${topic}/${capability}/set`,
      payload: JSON.stringify(payload),
    });
  return {
    rooms: (ids, repeats) =>
      publish('MapSegmentationCapability/clean', {
        segment_ids: ids.map(String),
        iterations: repeats,
        customOrder: true,
      }),
    zones: (zones, repeats) =>
      publish('ZoneCleaningCapability/start', {
        zones: zones.map(([x1, y1, x2, y2]) => ({
          points: {
            pA: { x: x1, y: y1 },
            pB: { x: x2, y: y1 },
            pC: { x: x2, y: y2 },
            pD: { x: x1, y: y2 },
          },
        })),
        iterations: repeats,
      }),
    point: ([x, y]) => publish('GoToLocationCapability/go', { coordinates: { x, y } }),
  };
};

/** The integrations a robot is sent through, by its entity's `platform`: the ways each has, where it has them. */
const INTEGRATIONS: Readonly<Record<string, (id: string, hass: HomeAssistant) => Ways>> = {
  xiaomi_miio: (id, hass) =>
    offered(
      {
        rooms: (ids) => call('xiaomi_miio', 'vacuum_clean_segment', { segments: whole(ids) }, id),
        zones: (zones, repeats) =>
          call('xiaomi_miio', 'vacuum_clean_zone', { zone: zones, repeats }, id),
        point: ([x, y]) => call('xiaomi_miio', 'vacuum_goto', { x_coord: x, y_coord: y }, id),
      },
      {
        rooms: offers(hass, 'xiaomi_miio', 'vacuum_clean_segment'),
        zones: offers(hass, 'xiaomi_miio', 'vacuum_clean_zone'),
        point: offers(hass, 'xiaomi_miio', 'vacuum_goto'),
      },
    ),
  dreame_vacuum: (id, hass) =>
    offered(
      {
        rooms: (ids, repeats) =>
          call('dreame_vacuum', 'vacuum_clean_segment', { segments: whole(ids), repeats }, id),
        zones: (zones, repeats) =>
          call('dreame_vacuum', 'vacuum_clean_zone', { zone: zones, repeats }, id),
        point: ([x, y]) => call('dreame_vacuum', 'vacuum_goto', { x, y }, id),
      },
      {
        rooms: offers(hass, 'dreame_vacuum', 'vacuum_clean_segment'),
        zones: offers(hass, 'dreame_vacuum', 'vacuum_clean_zone'),
        point: offers(hass, 'dreame_vacuum', 'vacuum_goto'),
      },
    ),
  roborock: (id, hass) => {
    // `vacuum.send_command` is the robot's own to take (its `supported_features` bit 256)
    const named =
      offers(hass, 'vacuum', 'send_command') && supports(hass, id, SEND_COMMAND)
        ? roborock((command, params) => call('vacuum', 'send_command', { command, params }, id))
        : {};
    const zoned = offers(hass, 'roborock', 'set_vacuum_zoned_cleaning');
    const goto = offers(hass, 'roborock', 'set_vacuum_goto_position');
    return {
      ...named,
      ...(zoned
        ? {
            // its own action takes one zone, and counts the times after the first
            zones: (zones, repeats) => {
              const [x1, y1, x2, y2] = zones[0] ?? [];
              return zones.length === 1 && repeats === 1
                ? call('roborock', 'set_vacuum_zoned_cleaning', { x1, y1, x2, y2, repeats: 0 }, id)
                : named.zones?.(zones, repeats);
            },
          }
        : {}),
      ...(goto
        ? { point: ([x, y]) => call('roborock', 'set_vacuum_goto_position', { x, y }, id) }
        : {}),
    };
  },
  xiaomi_miot: (id, hass) =>
    /^(roborock|rockrobo)\.vacuum\./.test(modelOf(hass, id)) &&
    offers(hass, 'xiaomi_miot', 'send_command')
      ? roborock((method, params) => call('xiaomi_miot', 'send_command', { method, params }, id))
      : {},
};

/** What a call of the person's own may ask the card for: the selection as lists of numbers, and numbers. */
function asked(job: Job, id: string): Readonly<Record<string, unknown>> {
  const selection = job.point ?? job.zones ?? job.rooms ?? job.areas ?? [];
  return {
    selection,
    repeats: job.repeats,
    entity_id: id,
    ...(job.point ? { point_x: job.point[0], point_y: job.point[1] } : {}),
  };
}

/**
 * A call of the person's own for a job: its data with what it asks for said (`said`: numbers the card computed and
 * the card's own robot, never a word the house wrote), to its own target, else to the robot where the action takes
 * entities (as Home Assistant describes it) and its data names none.
 */
export function ownCall(hass: HomeAssistant, action: Action, id: string, job: Job): DriveCall {
  const data = said(action.data, asked(job, id)) as Bag;
  const described = hass.services?.[action.domain]?.[action.service];
  const takes = typeof described === 'object' && described !== null && 'target' in described;
  const target = action.target.length ? action.target : takes && !('entity_id' in data) ? [id] : [];
  const { domain, service } = action;
  return { domain, service, data, ...(target.length ? { target } : {}) };
}

/**
 * The ways the card's robot has: the person's own action for each first, where Home Assistant offers it; else
 * Valetudo's by its topic; else its integration's; and Home Assistant's own areas where the robot cleans by area.
 */
export function waysOf(hass: HomeAssistant | undefined, id: string, own: OwnWays = {}): Ways {
  if (!hass) return {};
  const found: Ways =
    own.topic && offers(hass, 'mqtt', 'publish')
      ? valetudo(own.topic)
      : (entryOf(INTEGRATIONS, hass.entities?.[id]?.platform)?.(id, hass) ?? {});
  const written = (action: Action | undefined): action is Action =>
    action !== undefined && offers(hass, action.domain, action.service);
  const { room_action: room, zone_action: zone, point_action: point } = own;
  return {
    ...found,
    ...(written(room)
      ? { rooms: (rooms, repeats) => ownCall(hass, room, id, { rooms, repeats }) }
      : {}),
    ...(written(zone)
      ? { zones: (zones, repeats) => ownCall(hass, zone, id, { zones, repeats }) }
      : {}),
    ...(written(point)
      ? { point: (at) => ownCall(hass, point, id, { point: at, repeats: 1 }) }
      : {}),
    ...(offers(hass, 'vacuum', 'clean_area') && supports(hass, id, CLEAN_AREA)
      ? { areas: (areas) => call('vacuum', 'clean_area', { cleaning_area_id: [...areas] }, id) }
      : {}),
  };
}

/**
 * The call a job is: a point's, zones', or rooms' — by Home Assistant's areas where the job names them, the robot
 * cleans by area and once is asked (that action takes no repeats) or it has no other way, else by their ids;
 * nothing where the robot has no way for it.
 */
export function callOf(ways: Ways, job: Job): DriveCall | undefined {
  const { rooms, areas, repeats } = job;
  if (job.point) return ways.point?.(job.point);
  if (job.zones?.length) return ways.zones?.(job.zones, repeats);
  if (areas?.length && ways.areas && (repeats === 1 || !rooms?.length || !ways.rooms))
    return ways.areas(areas);
  return rooms?.length ? ways.rooms?.(rooms, repeats) : undefined;
}
