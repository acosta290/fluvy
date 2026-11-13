import { isEntityId, type HomeAssistant } from '@fluvy/core';

/*
 * The robots a hand can drive (1.20, #178) and what each integration takes for it, read from its own sources
 * (2026-11) and tried on no robot: the table is the reader's to correct, and `drive:` in the config says a robot's
 * calls where it knows none. Two protocols are behind them. Roborock's (`app_rc_start`, `app_rc_move` with a speed
 * in m/s, a turn in rad/s, a duration and a sequence number, `app_rc_end`: python-miio's `manual_control`) through
 * Xiaomi Miio's own services (Home Assistant core's `xiaomi_miio/services.py`), through `vacuum.send_command` on
 * core's Roborock (python-roborock's `RoborockCommand`; its vacuum hands a command's name on as it is), and through
 * `xiaomi_miot.send_command` on a Roborock set up with Xiaomi Miot Auto. Dreame's (a JSON text, `spdv` and `spdw`,
 * written to the `remote-state` property, service 4, property 15: Tasshack's `remote_control_move_step`, Valetudo's
 * manual control) through `dreame_vacuum.vacuum_remote_control_move_step`, and through `xiaomi_miot.set_miot_property`
 * on a robot whose MIoT spec has that service (miot-spec.org: 75 of Dreame's and four of Xiaomi's, the X20+ among
 * them).
 */

/** A call the pad makes: the action, its data and the entity it goes to (none: its data names it). */
export interface DriveCall {
  readonly domain: string;
  readonly service: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly target?: readonly string[];
}

/**
 * How a robot is driven: what starts and what ends its remote control, where it has either, and a move — `velocity`
 * forward (negative: back) and `rotation` to the left (negative: to the right), each −1, 0 or 1 of the pace chosen;
 * `seq` counts the moves since the start.
 */
export interface DriveProfile {
  readonly start?: () => DriveCall;
  readonly move: (velocity: number, rotation: number, seq: number) => DriveCall;
  readonly stop?: () => DriveCall;
}

export type DriveSpeed = 'slow' | 'normal' | 'fast';
export const DRIVE_SPEEDS: readonly DriveSpeed[] = ['slow', 'normal', 'fast'];
const PACE: Readonly<Record<DriveSpeed, number>> = { slow: 0.5, normal: 1, fast: 1.5 };

/** Where the pad opens: in the card where its ring fits (else its sheet), or always in its sheet. */
export type DriveStyle = 'card' | 'sheet';
export const DRIVE_STYLES: readonly DriveStyle[] = ['card', 'sheet'];

/** How long a move lasts where the robot is told, in ms: a tap's step; a held arrow sends the next before it ends. */
export const STEP_MS = 600;

/** What makes a robot's profile at a pace, once the robot is known to be driven so. */
type Maker = (pace: number) => DriveProfile;

type Bag = Readonly<Record<string, unknown>>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A table's entry by a key of its own: a word the house or a config hands over is never read off its makings. */
const entryOf = <T>(table: Readonly<Record<string, T>>, key: unknown): T | undefined =>
  typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined;

const call = (domain: string, service: string, data: Bag, id?: string): DriveCall => ({
  domain,
  service,
  data,
  ...(id ? { target: [id] } : {}),
});

/** Whether Home Assistant offers every one of a domain's `actions`. */
const offers = (hass: HomeAssistant, domain: string, ...actions: readonly string[]): boolean =>
  actions.every((action) => hass.services?.[domain]?.[action] !== undefined);

const held = (value: number, limit: number): number => Math.min(limit, Math.max(-limit, value));
const round = (value: number, digits: number): number => Number(value.toFixed(digits));

/** A Roborock's pace: 0.19 m/s and 60° a second at `normal`, never past what it takes (0.29 m/s, 179°). */
const metres = (velocity: number, pace: number): number =>
  round(held(0.19 * pace * velocity, 0.29), 2);
const degrees = (rotation: number, pace: number): number =>
  Math.round(held(60 * pace * rotation, 179));

/** A Dreame's pace: 200 of its 300 and a turn of 60 at `normal`. */
const dreame = (velocity: number, rotation: number, pace: number): readonly [number, number] => [
  Math.round(200 * pace * velocity),
  Math.round(60 * pace * rotation),
];

/** A number no two writes share: a Dreame takes a write for a new one by it. */
const nonce = (): number => Math.floor(Math.random() * 65535);

/** Roborock's own commands, each handed to `send` by its name with its parameters. */
const roborock =
  (send: (command: string, params?: readonly unknown[]) => DriveCall): Maker =>
  (pace) => ({
    start: () => send('app_rc_start'),
    move: (velocity, rotation, seq) =>
      send('app_rc_move', [
        {
          omega: round((degrees(rotation, pace) * Math.PI) / 180, 2),
          velocity: metres(velocity, pace),
          duration: STEP_MS,
          seqnum: seq,
        },
      ]),
    stop: () => send('app_rc_end'),
  });

/** The device's model as its integration registers it (`xiaomi.vacuum.c102gl`). */
const modelOf = (hass: HomeAssistant, id: string): string =>
  hass.devices?.[hass.entities?.[id]?.device_id ?? '']?.model ?? '';

/**
 * Xiaomi's own robots whose spec carries Dreame's `remote-state` (the X20+ and its kin); Dreame's are told by their
 * attributes.
 */
const XIAOMI_DREAME = /^xiaomi\.vacuum\.(c102(cn|gl)|d103cn|d110ch)$/;

/** The integrations a robot is driven through, by its entity's `platform`: what makes its profile, where it can. */
const INTEGRATIONS: Readonly<
  Record<string, (id: string, hass: HomeAssistant) => Maker | undefined>
> = {
  xiaomi_miio: (id, hass) => {
    const action = (name: string): string => `vacuum_remote_control_${name}`;
    return offers(hass, 'xiaomi_miio', action('start'), action('move'), action('stop'))
      ? (pace) => ({
          start: () => call('xiaomi_miio', action('start'), {}, id),
          move: (velocity, rotation) =>
            call(
              'xiaomi_miio',
              action('move'),
              {
                velocity: metres(velocity, pace),
                rotation: degrees(rotation, pace),
                duration: STEP_MS,
              },
              id,
            ),
          stop: () => call('xiaomi_miio', action('stop'), {}, id),
        })
      : undefined;
  },
  dreame_vacuum: (id, hass) => {
    const step = (velocity: number, rotation: number, pace: number): DriveCall => {
      const [spdv, spdw] = dreame(velocity, rotation, pace);
      return call(
        'dreame_vacuum',
        'vacuum_remote_control_move_step',
        { velocity: spdv, rotation: spdw },
        id,
      );
    };
    return offers(hass, 'dreame_vacuum', 'vacuum_remote_control_move_step')
      ? (pace) => ({
          start: () => step(0, 0, pace),
          move: (velocity, rotation) => step(velocity, rotation, pace),
          stop: () => call('vacuum', 'stop', {}, id),
        })
      : undefined;
  },
  // `vacuum.send_command` is the robot's own to take (its `supported_features` bit 256)
  roborock: (id, hass) =>
    offers(hass, 'vacuum', 'send_command') &&
    Number(hass.states[id]?.attributes['supported_features']) & 256
      ? roborock((command, params) =>
          call('vacuum', 'send_command', params ? { command, params } : { command }, id),
        )
      : undefined,
  xiaomi_miot: (id, hass) => {
    const model = modelOf(hass, id);
    if (/^(roborock|rockrobo)\.vacuum\./.test(model))
      return offers(hass, 'xiaomi_miot', 'send_command')
        ? roborock((method, params = []) =>
            call('xiaomi_miot', 'send_command', { method, params }, id),
          )
        : undefined;
    const attributes = hass.states[id]?.attributes ?? {};
    if (
      !('vacuum_extend.work_mode' in attributes || XIAOMI_DREAME.test(model)) ||
      !offers(hass, 'xiaomi_miot', 'set_miot_property')
    )
      return undefined;
    // the robot says "remote control" aloud as it starts, and nothing with each move
    const write = (velocity: number, rotation: number, pace: number, audio: boolean): DriveCall => {
      const [spdv, spdw] = dreame(velocity, rotation, pace);
      return call(
        'xiaomi_miot',
        'set_miot_property',
        {
          siid: 4,
          piid: 15,
          value: JSON.stringify({ spdv, spdw, audio: String(audio), random: nonce() }),
        },
        id,
      );
    };
    return (pace) => ({
      start: () => write(0, 0, pace, true),
      move: (velocity, rotation) => write(velocity, rotation, pace, false),
      stop: () => call('vacuum', 'stop', {}, id),
    });
  },
};

/* ---------- a profile of the person's own ---------- */

/** An action as YAML writes it: `action` (or the older `service`), its `data`, its `target`. */
interface Action {
  readonly domain: string;
  readonly service: string;
  readonly data: Bag;
  readonly target: readonly string[];
}

/** A robot's calls as the config says them, each scaled by what a full `velocity` and `rotation` are to it. */
interface OwnDrive {
  readonly start?: Action;
  readonly move: Action;
  readonly stop?: Action;
  readonly velocity: number;
  readonly rotation: number;
}

const ACTION = /^([a-z0-9_]+)\.([a-z0-9_]+)$/;

/** One of `drive`'s actions, or what is wrong with it; nothing where the config names none. */
function actionOf(raw: unknown, name: string): Action | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isBag(raw)) return `"drive.${name}" must be an action`;
  const named = ACTION.exec(String(raw['action'] ?? raw['service'] ?? ''));
  if (!named) return `"drive.${name}" needs an action (domain.name)`;
  const data = raw['data'] ?? {};
  if (!isBag(data)) return `"drive.${name}.data" must be a map`;
  const target = isBag(raw['target']) ? raw['target']['entity_id'] : undefined;
  const ids = target === undefined ? [] : [target].flat();
  if (!ids.every(isEntityId)) return `"drive.${name}.target" must name entities`;
  return { domain: named[1] ?? '', service: named[2] ?? '', data, target: ids };
}

/** What a full `velocity` or `rotation` is to the robot: a number, 1 where the config says none. */
function scaleOf(raw: unknown, name: string): number | string {
  if (raw === undefined) return 1;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : `"drive.${name}" must be a number`;
}

/**
 * The config's `drive` read: the robot's own calls, what is wrong with them in words (the card says it in its
 * place), or nothing where the config has none.
 */
export function ownDrive(raw: unknown): OwnDrive | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isBag(raw)) return '"drive" must be a map of start, move and stop';
  // a map left empty (the editor's field, cleared) is none
  if (!Object.keys(raw).length) return undefined;
  const start = actionOf(raw['start'], 'start');
  if (typeof start === 'string') return start;
  const move = actionOf(raw['move'], 'move');
  if (typeof move === 'string') return move;
  const stop = actionOf(raw['stop'], 'stop');
  if (typeof stop === 'string') return stop;
  const velocity = scaleOf(raw['velocity'], 'velocity');
  if (typeof velocity === 'string') return velocity;
  const rotation = scaleOf(raw['rotation'], 'rotation');
  if (typeof rotation === 'string') return rotation;
  if (!move) return '"drive.move" is required';
  return { move, velocity, rotation, ...(start ? { start } : {}), ...(stop ? { stop } : {}) };
}

/** `{{ velocity }}`, `{{ rotation }}`, `{{ seq }}` and `{{ random }}`: what a call's data may ask the card for. */
const ASKED = /\{\{\s*(velocity|rotation|seq|random)\s*\}\}/g;
const ASKED_ALONE = /^\{\{\s*(velocity|rotation|seq|random)\s*\}\}$/;

/**
 * A call's data with what it asks for said, numbers only: a text that is one placeholder becomes its number, one
 * inside other words its digits (a Dreame's JSON); everything else goes as it is written.
 */
function said(value: unknown, numbers: Readonly<Record<string, number>>): unknown {
  if (typeof value === 'string') {
    const alone = ASKED_ALONE.exec(value)?.[1];
    return alone
      ? numbers[alone]
      : value.replace(ASKED, (_, name: string) => String(numbers[name]));
  }
  if (Array.isArray(value)) return value.map((item) => said(item, numbers));
  if (isBag(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, said(item, numbers)]),
    );
  return value;
}

/** The person's own profile: each call as written, to its own target, else to the robot where its data names none. */
const own =
  (drive: OwnDrive, id: string): Maker =>
  (pace) => {
    const say = (action: Action, velocity = 0, rotation = 0, seq = 0): DriveCall => {
      const data = said(action.data, {
        velocity: round(velocity * drive.velocity * pace, 4),
        rotation: round(rotation * drive.rotation * pace, 4),
        seq,
        random: nonce(),
      }) as Bag;
      const target = action.target.length ? action.target : 'entity_id' in data ? [] : [id];
      const { domain, service } = action;
      return { domain, service, data, ...(target.length ? { target } : {}) };
    };
    const { start, stop } = drive;
    return {
      move: (velocity, rotation, seq) => say(drive.move, velocity, rotation, seq),
      ...(start ? { start: () => say(start) } : {}),
      ...(stop ? { stop: () => say(stop) } : {}),
    };
  };

/* ---------- which robot, how ---------- */

/** What a card's config says of its drive pad. */
export interface DriveConfig {
  readonly entity?: unknown;
  readonly drive_entity?: unknown;
  readonly drive_speed?: unknown;
  readonly drive?: unknown;
}

/**
 * The robots found driven through an integration since the page opened: one out of reach (its attributes gone, its
 * entry too) keeps its Drive command as the page last read it, disabled, so its card keeps its anatomy.
 */
const known = new Map<string, Maker>();

/**
 * How the card's robot is driven (`drive_entity`, else its own), at the pace it asks (`drive_speed`): by the
 * config's own calls where it writes them and Home Assistant offers each, else as its integration takes it; nothing
 * where no way is known, so no Drive command is drawn.
 */
export function driveProfile(
  hass: HomeAssistant | undefined,
  config: DriveConfig,
): DriveProfile | undefined {
  const id = [config.drive_entity, config.entity].find(isEntityId);
  if (!hass || !id) return undefined;
  const pace = entryOf(PACE, config.drive_speed) ?? 1;
  const written = ownDrive(config.drive);
  if (typeof written === 'object') {
    const { start, move, stop } = written;
    return [start, move, stop].every(
      (action) => !action || offers(hass, action.domain, action.service),
    )
      ? own(written, id)(pace)
      : undefined;
  }
  const found = entryOf(INTEGRATIONS, hass.entities?.[id]?.platform)?.(id, hass);
  if (found) known.set(id, found);
  return (found ?? known.get(id))?.(pace);
}
