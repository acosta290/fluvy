import { isEntityId, type ActionConfig, type HomeAssistant } from '@fluvy/core';
import { imageEntity, isControl } from '../../shared/picture.js';
import { actionOf, isBag, type Action } from '../drive.js';
import {
  calibrationOf,
  PICTURE,
  type Calibration,
  type CalibrationPair,
  type Point,
  type Rect,
} from './calibration.js';
import type { OwnWays, RoomId } from './calls.js';

/*
 * The card's `map` and `presets` as its config writes them (#265), read: what is wrong with them in words (the card
 * says it in its place), else what the map draws and what each preset cleans. What the house says beside them (the
 * map entity's own calibration and rooms) is read tolerantly: an attribute this cannot read is none, never a fault.
 */

/** What a hand does on the map beside tapping what is drawn: mark a zone, or pick a point to go to. */
export type MapMode = 'zone' | 'point';
/**
 * What stands on the map over its picture (`controls`, a subset in its order; all of them where the config says
 * none): the rooms' and the zones' names (else their dots), and a round for each mode.
 */
const CONTROLS: readonly unknown[] = ['names', 'zone', 'point'];

/** The most times a robot cleans what it is asked. */
export const MOST_REPEATS = 3;

/** A room of the map: its robot's id for it, or Home Assistant's area, its name, its outline as the robot counts. */
export interface Room {
  /** What tells it from the others on the card: its id, else its area. */
  readonly key: string;
  readonly id?: RoomId;
  readonly area?: string;
  readonly name: string;
  /** Its corners in turn; none where only its name is known. */
  readonly outline: readonly Point[];
  readonly color?: string;
}

/** The card's `map`, read. */
export interface RobotMap {
  /** A camera, an image entity, or a picture's address. */
  readonly image: string;
  /** The entity's own (`auto`), an entity's, the picture's own measure (`image`), or the pairs themselves. */
  readonly calibration: 'auto' | 'image' | string | readonly CalibrationPair[];
  /** The rooms the config lists; none where it leaves them to the map's entity. */
  readonly rooms?: readonly Partial<Room>[];
  readonly modes: readonly MapMode[];
  readonly names: boolean;
  /** How many times a zone or a room picked on the map is cleaned. */
  readonly repeats: number;
  /** A robot's calls where its integration's are not known: Valetudo's topic, the person's own actions. */
  readonly own: OwnWays;
}

/**
 * What a preset answers with where the person writes it (its `tap_action`, `hold_action`, `double_tap_action`): a
 * call, checked, which may ask the selection's numbers; or a card's action of another kind, as written.
 */
export interface Own {
  readonly call?: Action;
  readonly action?: ActionConfig;
  readonly confirmation?: ActionConfig['confirmation'];
}

/** The answers a preset's chip gives, by the config's key for each. */
const ANSWERS = { tap: 'tap_action', hold: 'hold_action', double: 'double_tap_action' } as const;
export type Answer = keyof typeof ANSWERS;

/** A preset, read: what it cleans (zones, rooms, areas) or where it goes; nothing of them is a full clean. */
export interface Preset extends Readonly<Partial<Record<Answer, Own>>> {
  readonly name: string;
  readonly icon?: string;
  readonly color?: string;
  readonly zones: readonly Rect[];
  readonly rooms: readonly RoomId[];
  readonly areas: readonly string[];
  readonly point?: Point;
  readonly repeats: number;
  readonly confirmation?: ActionConfig['confirmation'];
  /** Drawn on the map, where it has a zone or a point. */
  readonly onMap: boolean;
}

/** What the card's config asks of its map and its presets. */
export interface Setup {
  readonly map?: RobotMap;
  /** The presets written, or `areas`: one for each area the robot has mapped in Home Assistant. */
  readonly presets: readonly Preset[] | 'areas';
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A list of `count` finite numbers. */
const numbers = (value: unknown, count: number): value is number[] =>
  Array.isArray(value) && value.length === count && value.every(finite);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** A point as a config or an attribute writes it: `[x, y]`, or `{ x, y }`. */
const pointOf = (raw: unknown): Point | undefined =>
  numbers(raw, 2)
    ? [raw[0] as number, raw[1] as number]
    : isBag(raw) && finite(raw['x']) && finite(raw['y'])
      ? [raw['x'], raw['y']]
      : undefined;

/** A room's id: a whole number, or a word of the person's own. */
const idOf = (raw: unknown): RoomId | undefined =>
  finite(raw) ? raw : (text(raw) as RoomId | undefined);

/** How many times over, 1 to 3; 1 where the config says none. */
const repeatsOf = (raw: unknown): number | undefined =>
  raw === undefined
    ? 1
    : Number.isInteger(raw) && (raw as number) >= 1 && (raw as number) <= MOST_REPEATS
      ? (raw as number)
      : undefined;

/** The pairs a calibration is written in, as the config or the map's entity says them; none where it is not pairs. */
function pairsOf(raw: unknown): readonly CalibrationPair[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pairs = raw.map((item) => {
    const [map, vacuum] = isBag(item) ? [pointOf(item['map']), pointOf(item['vacuum'])] : [];
    return map && vacuum ? { map, vacuum } : undefined;
  });
  return pairs.every((pair) => pair !== undefined) ? (pairs as CalibrationPair[]) : undefined;
}

/** A topic Valetudo answers on, as one publishes to it: no wildcard, no control character, no `/` at its ends. */
const topicOf = (raw: unknown): string | undefined => {
  const topic = text(raw)?.replace(/^\/+|\/+$/g, '');
  return topic && !/[+#]/.test(topic) && ![...topic].some(isControl) ? topic : undefined;
};

/** A room the config lists, or what is wrong with it. */
function roomOf(raw: unknown, at: string): Partial<Room> | string {
  if (!isBag(raw)) return `"${at}" must be a room (id, name, outline)`;
  const id = idOf(raw['id']);
  const area = text(raw['area']);
  if (id === undefined && !area) return `"${at}" needs an id or an area`;
  const outline = raw['outline'];
  if (outline !== undefined && !(Array.isArray(outline) && outline.length >= 3))
    return `"${at}.outline" must be three points or more`;
  const corners = ((outline as unknown[] | undefined) ?? []).map(pointOf);
  if (!corners.every((corner) => corner !== undefined))
    return `"${at}.outline" must be points ([x, y])`;
  const name = text(raw['name']);
  const color = text(raw['color']);
  return {
    key: id === undefined ? `area:${area}` : String(id),
    ...(id === undefined ? {} : { id }),
    ...(area ? { area } : {}),
    ...(name ? { name } : {}),
    ...(corners.length ? { outline: corners as Point[] } : {}),
    ...(color ? { color } : {}),
  };
}

/** The config's `map`, read, or what is wrong with it; nothing where the config has none. */
function mapOf(raw: unknown): RobotMap | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isBag(raw)) return '"map" must be a map (image, calibration, rooms)';
  const image = text(raw['image']);
  if (!image) return '"map.image" is required: a camera, an image entity or a picture’s address';
  const asked = raw['calibration'] ?? 'auto';
  const calibration =
    asked === 'auto' || asked === 'image' || isEntityId(asked) ? asked : pairsOf(asked);
  if (!calibration || (typeof calibration !== 'string' && calibration.length < 3))
    return '"map.calibration" must be auto, image, an entity or three or four points';
  const listed: unknown = raw['rooms'];
  if (listed !== undefined && !Array.isArray(listed)) return '"map.rooms" must be a list';
  const rooms = (listed as unknown[] | undefined)?.map((room, index) =>
    roomOf(room, `map.rooms[${index}]`),
  );
  const fault = rooms?.find((room): room is string => typeof room === 'string');
  if (fault) return fault;
  const controls: unknown = raw['controls'] ?? CONTROLS;
  if (!Array.isArray(controls) || !controls.every((control) => CONTROLS.includes(control)))
    return '"map.controls" must list names, zone and point, or fewer';
  const repeats = repeatsOf(raw['repeats']);
  if (!repeats) return `"map.repeats" must be 1 to ${MOST_REPEATS}`;
  const topic = raw['topic'] === undefined ? undefined : topicOf(raw['topic']);
  if (raw['topic'] !== undefined && !topic) return '"map.topic" must be a plain MQTT topic';
  const actions: Partial<Record<'room_action' | 'zone_action' | 'point_action', Action>> = {};
  for (const key of ['room_action', 'zone_action', 'point_action'] as const) {
    const action = actionOf(raw[key], `map.${key}`);
    if (typeof action === 'string') return action;
    if (action) actions[key] = action;
  }
  return {
    image,
    calibration,
    ...(rooms ? { rooms: rooms as Partial<Room>[] } : {}),
    modes: controls.filter((control) => control !== 'names') as MapMode[],
    names: controls.includes('names'),
    repeats,
    own: { ...actions, ...(topic ? { topic } : {}) },
  };
}

/** The kinds of action a card runs that are a call: what a preset's own may ask the selection of. */
const CALLS: ReadonlySet<unknown> = new Set(['perform-action', 'call-service']);

/** One of a preset's own answers, or what is wrong with it; nothing where the config writes none. */
function ownOf(raw: unknown, at: string): Own | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isBag(raw)) return `"${at}" must be an action`;
  const call = CALLS.has(raw['action']) ? actionOf(raw, at) : undefined;
  if (typeof call === 'string') return call;
  const asks = raw['confirmation'] as Own['confirmation'];
  return {
    ...(call ? { call } : { action: raw as unknown as ActionConfig }),
    ...(asks === undefined ? {} : { confirmation: asks }),
  };
}

/** A preset the config lists, or what is wrong with it. */
function presetOf(raw: unknown, at: string): Preset | string {
  if (!isBag(raw)) return `"${at}" must be a preset (name, zone, rooms…)`;
  const one = raw['zone'];
  const more: unknown = raw['zones'] ?? [];
  if (one !== undefined && !numbers(one, 4)) return `"${at}.zone" must be four numbers`;
  if (!Array.isArray(more) || !more.every((zone) => numbers(zone, 4)))
    return `"${at}.zones" must be a list of four numbers each`;
  const rooms: unknown = raw['rooms'] ?? [];
  const ids = Array.isArray(rooms) ? rooms.map(idOf) : [undefined];
  if (!ids.every((id) => id !== undefined)) return `"${at}.rooms" must be a list of room ids`;
  const areas: unknown = raw['areas'] ?? [];
  if (!Array.isArray(areas) || !areas.every(text)) return `"${at}.areas" must be a list of areas`;
  const point = raw['point'] === undefined ? undefined : pointOf(raw['point']);
  if (raw['point'] !== undefined && !point) return `"${at}.point" must be two numbers`;
  const repeats = repeatsOf(raw['repeats']);
  if (!repeats) return `"${at}.repeats" must be 1 to ${MOST_REPEATS}`;
  const answers: Partial<Record<Answer, Own>> = {};
  for (const [answer, key] of Object.entries(ANSWERS) as [Answer, string][]) {
    const own = ownOf(raw[key], `${at}.${key}`);
    if (typeof own === 'string') return own;
    if (own) answers[answer] = own;
  }
  const name = text(raw['name']);
  if (!name) return `"${at}.name" is required`;
  const icon = text(raw['icon']);
  const color = text(raw['color']);
  // a rectangle is its lesser corner first, however it was written
  const zones = [...(one ? [one] : []), ...(more as number[][])].map(
    ([x1 = 0, y1 = 0, x2 = 0, y2 = 0]): Rect => [
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    ],
  );
  const asks: unknown = raw['confirmation'];
  return {
    name,
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
    zones,
    rooms: ids as RoomId[],
    areas: (areas as string[]).map((area) => area.trim()),
    ...(point ? { point } : {}),
    repeats,
    ...(asks === undefined ? {} : { confirmation: asks as NonNullable<Preset['confirmation']> }),
    onMap: raw['on_map'] !== false,
    ...answers,
  };
}

/** The config's `presets`, read, or what is wrong with them. */
function presetsOf(raw: unknown): readonly Preset[] | 'areas' | string {
  if (raw === undefined || raw === null) return [];
  if (raw === 'areas') return raw;
  if (!Array.isArray(raw)) return '"presets" must be a list, or the word areas';
  const presets = raw.map((preset, index) => presetOf(preset, `presets[${index}]`));
  return (
    presets.find((preset): preset is string => typeof preset === 'string') ?? (presets as Preset[])
  );
}

/** What the card's config asks of its map and its presets, or what is wrong with it in words. */
export function setupOf(config: {
  readonly map?: unknown;
  readonly presets?: unknown;
}): Setup | string {
  const map = mapOf(config.map);
  if (typeof map === 'string') return map;
  const presets = presetsOf(config.presets);
  if (typeof presets === 'string' && presets !== 'areas') return presets;
  return { ...(map ? { map } : {}), presets };
}

/* ---------- what the house says beside the config ---------- */

/** A list or a map an attribute may hold as JSON text (a calibration kept in a sensor's state). */
function parsed(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The map's calibration: the picture's own measure, the pairs written, or those an entity holds (the map's own where
 * the config says `auto`: its `calibration_points`, as Xiaomi Cloud Map Extractor, Dreame's and Valetudo's cameras
 * write them; another's in that attribute, else in its state as JSON). Nothing where none can be read.
 */
export function calibrationFor(
  hass: HomeAssistant | undefined,
  map: RobotMap,
): Calibration | undefined {
  const { calibration } = map;
  if (calibration === 'image') return PICTURE;
  if (typeof calibration !== 'string') return calibrationOf(calibration);
  const id = calibration === 'auto' ? imageEntity(map.image) : calibration;
  const held = id ? hass?.states[id] : undefined;
  const pairs = pairsOf(parsed(held?.attributes['calibration_points'] ?? held?.state));
  return pairs && calibrationOf(pairs);
}

/**
 * The rooms a map's entity says of itself (`rooms`), as far as this reads them: each under its number (a key that is
 * no whole number names no room: nothing the house writes is sent on but numbers), its name, and its outline where it
 * has one, else its box's four corners (Xiaomi Cloud Map Extractor and Dreame say `x0, y0, x1, y1`; Valetudo's camera
 * an `outline`).
 */
function ownRooms(raw: unknown): readonly Room[] {
  const entries: ReadonlyArray<readonly [unknown, unknown]> = Array.isArray(raw)
    ? raw.map((room: unknown) => [isBag(room) ? (room['id'] ?? room['number']) : undefined, room])
    : isBag(raw)
      ? Object.entries(raw)
      : [];
  return entries.flatMap(([key, room]): Room[] => {
    const id = typeof key === 'boolean' || key === '' || key === null ? NaN : Number(key);
    if (!isBag(room) || !Number.isInteger(id)) return [];
    const written = Array.isArray(room['outline']) ? room['outline'].map(pointOf) : [];
    const box = [room['x0'], room['y0'], room['x1'], room['y1']];
    const outline =
      written.length >= 3 && written.every((corner) => corner !== undefined)
        ? (written as Point[])
        : numbers(box, 4)
          ? ([
              [box[0], box[1]],
              [box[2], box[1]],
              [box[2], box[3]],
              [box[0], box[3]],
            ] as Point[])
          : [];
    return [
      {
        key: String(id),
        id,
        name: text(room['custom_name']) ?? text(room['name']) ?? String(id),
        outline,
      },
    ];
  });
}

/**
 * The map's rooms: those the config lists, in its order, each completed by what the map's entity says of the same id
 * (its name, its outline); where it lists none, the entity's own.
 */
export function roomsFor(hass: HomeAssistant | undefined, map: RobotMap): readonly Room[] {
  const id = imageEntity(map.image);
  const own = ownRooms(parsed(id ? hass?.states[id]?.attributes['rooms'] : undefined));
  if (!map.rooms) return own;
  return map.rooms.map((room): Room => {
    const said = own.find((other) => other.key === room.key);
    return {
      key: room.key ?? '',
      name: room.name ?? said?.name ?? hass?.areas?.[room.area ?? '']?.name ?? room.key ?? '',
      outline: room.outline ?? said?.outline ?? [],
      ...(room.id === undefined ? {} : { id: room.id }),
      ...(room.area ? { area: room.area } : {}),
      ...(room.color ? { color: room.color } : {}),
    };
  });
}
