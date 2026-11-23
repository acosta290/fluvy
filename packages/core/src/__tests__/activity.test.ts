import { describe, expect, it } from 'vitest';
import type { HomeAssistant } from '../ha/types.js';
import {
  accountsOf,
  categoryOf,
  causeOf,
  density,
  isQuiet,
  peopleByUser,
  subscribeActivity,
  toRows,
  toSections,
  whoOf,
  withPrevious,
  type ActivityAccount,
  type ActivityEvent,
} from '../activity/index.js';
import {
  applySourceFilters,
  sourceEntities,
  targetEntities,
  targetFromSearch,
} from '../sources.js';

const state = (entity_id: string, attributes: Record<string, unknown> = {}) => ({
  entity_id,
  state: 'on',
  attributes,
  last_changed: '',
  last_updated: '',
  context: { id: '', user_id: null, parent_id: null },
});

const hass = {
  states: {
    'light.sofa': state('light.sofa', { friendly_name: 'Sofa' }),
    'binary_sensor.door': state('binary_sensor.door', { device_class: 'door' }),
    'binary_sensor.plug_problem': state('binary_sensor.plug_problem', { device_class: 'problem' }),
    'sensor.clock': state('sensor.clock', { device_class: 'timestamp' }),
    'sensor.power': state('sensor.power', { unit_of_measurement: 'W' }),
    'switch.led': state('switch.led'),
    'automation.night': state('automation.night', { friendly_name: 'Night' }),
    'person.ana': state('person.ana', { friendly_name: 'Ana', user_id: 'u1' }),
    'update.core': state('update.core'),
  },
  entities: {
    'light.sofa': { entity_id: 'light.sofa', device_id: 'd1', platform: 'hue' },
    'switch.led': {
      entity_id: 'switch.led',
      area_id: 'kitchen',
      platform: 'zha',
      labels: ['xmas'],
    },
    'binary_sensor.door': { entity_id: 'binary_sensor.door', device_id: 'd2', platform: 'zha' },
    'switch.config': { entity_id: 'switch.config', entity_category: 'config' },
  },
  devices: {
    d1: { id: 'd1', name: 'Bulb', name_by_user: null, area_id: 'living' },
    d2: { id: 'd2', name: 'Door', name_by_user: null, area_id: 'hall', labels: ['safe'] },
  },
  areas: {
    living: { area_id: 'living', name: 'Living', floor_id: 'ground' },
    kitchen: { area_id: 'kitchen', name: 'Kitchen', floor_id: 'ground' },
    hall: { area_id: 'hall', name: 'Hall', floor_id: 'first' },
  },
} as unknown as HomeAssistant;

const at = (
  when: number,
  entity_id?: string,
  extra: Partial<ActivityEvent> = {},
): ActivityEvent => ({
  when,
  ...(entity_id ? { entity_id, state: 'on' } : {}),
  ...extra,
});

describe('what an entry is', () => {
  it('files a group with what it holds, and what reports on Home Assistant itself under the system', () => {
    const house = {
      ...hass,
      states: {
        ...hass.states,
        'group.lamps': state('group.lamps', { entity_id: ['light.sofa', 'light.desk'] }),
        'sensor.backup_state': state('sensor.backup_state', { device_class: 'enum' }),
      },
      entities: {
        ...hass.entities,
        'sensor.backup_state': { entity_id: 'sensor.backup_state', platform: 'backup' },
      },
    } as unknown as HomeAssistant;
    expect(categoryOf(at(1, 'group.lamps'), house)).toBe('lights');
    expect(categoryOf(at(1, 'sensor.backup_state'), house)).toBe('system');
    expect(isQuiet(at(1, 'sensor.backup_state'), house)).toBe(true);
  });

  it('files entries by what people look for, a configuration entity under the system', () => {
    expect(categoryOf(at(1, 'light.sofa'), hass)).toBe('lights');
    expect(categoryOf(at(1, 'binary_sensor.door'), hass)).toBe('security');
    expect(categoryOf(at(1, 'binary_sensor.plug_problem'), hass)).toBe('devices');
    expect(categoryOf(at(1, 'sensor.clock'), hass)).toBe('system');
    expect(categoryOf(at(1, 'switch.config'), hass)).toBe('system');
    expect(categoryOf(at(1, 'person.ana'), hass)).toBe('people');
    expect(categoryOf(at(1, undefined, { domain: 'automation' }), hass)).toBe('automations');
  });

  it('calls the system noise, but never a restart', () => {
    expect(isQuiet(at(1, 'update.core'), hass)).toBe(true);
    expect(isQuiet(at(1, undefined, { domain: 'homeassistant' }), hass)).toBe(false);
    expect(isQuiet(at(1, 'light.sofa'), hass)).toBe(false);
  });
});

describe('a day made legible', () => {
  it('gives each change the state it came from', () => {
    const events = [
      at(30, 'light.sofa', { state: 'off' }),
      at(20, 'switch.led', { state: 'on' }),
      at(10, 'light.sofa', { state: 'on' }),
    ];
    const items = withPrevious(events);
    expect(items[0]!.from).toBe('on');
    expect(items[2]!.from).toBeUndefined();
  });

  it('reads a storm of entries as one burst, a restart when Home Assistant started in it', () => {
    const storm = Array.from({ length: 40 }, (_, i) => at(1000 - i, `switch.s${i}`));
    storm.splice(
      10,
      0,
      at(990, undefined, { domain: 'homeassistant', name: 'Home Assistant', message: 'started' }),
    );
    const rows = toRows(withPrevious([at(5000, 'light.sofa'), ...storm, at(100, 'light.sofa')]));
    expect(rows.map((row) => row.kind)).toEqual(['event', 'burst', 'event']);
    const burst = rows[1]!;
    expect(burst.kind === 'burst' && burst.items.length).toBe(41);
    expect(burst.kind === 'burst' && burst.restart).toBe(true);
  });

  it('gathers a restart: its stop, its start, and what came back over the next minutes, not what people did', () => {
    const home = (when: number, message: string): ActivityEvent =>
      at(when, undefined, { domain: 'homeassistant', name: 'Home Assistant', message });
    const rows = toRows(
      withPrevious([
        at(3000, 'light.sofa', { state: 'off' }), // long after: its own row
        at(1500, 'switch.s3', { state: 'on' }), // back 8 minutes later, after a quiet minute
        at(1300, 'light.sofa', { state: 'on', context_user_id: 'u1' }), // someone did it: its own row
        at(1100, 'switch.s2', { state: 'on' }),
        at(1030, 'switch.s1', { state: 'off' }),
        home(1000, 'started'),
        at(980, 'switch.s1', { state: 'unavailable' }),
        at(975, 'switch.s2', { state: 'unavailable' }),
        at(974, 'switch.s3', { state: 'unavailable' }),
        home(960, 'stopped'),
        at(10, 'light.sofa', { state: 'off' }),
      ]),
    );
    expect(rows.map((row) => row.kind)).toEqual(['event', 'event', 'burst', 'event']);
    const restart = rows[2]!;
    expect(restart.when).toBe(1000);
    expect(restart.kind === 'burst' && restart.restart).toBe(true);
    expect(restart.kind === 'burst' && restart.items.map((item) => item.event.when)).toEqual([
      1500, 1100, 1030, 1000, 980, 975, 974, 960,
    ]);
    expect(rows[1]!.kind === 'event' && rows[1]!.item.event.when).toBe(1300);
  });

  it('reads one device changing again and again as one row', () => {
    const rows = toRows(
      withPrevious([
        at(400, 'light.sofa', { state: 'off' }),
        at(300, 'light.sofa', { state: 'on' }),
        at(200, 'light.sofa', { state: 'off' }),
        at(100, 'switch.led'),
      ]),
    );
    expect(rows.map((row) => row.kind)).toEqual(['repeat', 'event']);
  });

  it('sorts rows into their hours, counting what a burst holds', () => {
    const hour = new Date(2026, 8, 19, 13, 0, 0).getTime() / 1000;
    const rows = toRows(
      withPrevious([
        at(hour + 600, 'light.sofa'),
        at(hour + 60, 'switch.led'),
        at(hour - 60, 'switch.led'),
      ]),
    );
    const sections = toSections(rows);
    expect(sections.map((section) => section.count)).toEqual([2, 1]);
    expect(sections[0]!.start).toBe(hour * 1000);
  });

  it('counts entries per quarter hour over the window', () => {
    const start = Date.UTC(2026, 8, 19);
    const buckets = density(
      [at(start / 1000 + 60), at(start / 1000 + 20 * 60), at(start / 1000 + 21 * 60)],
      start,
      start + 3600 * 1000,
    );
    expect(buckets).toEqual([1, 2, 0, 0]);
  });
});

describe('who did it', () => {
  it('names the automation, the person, or the entity behind an entry', () => {
    const people = peopleByUser(hass);
    expect(
      causeOf(
        at(1, 'light.sofa', {
          context_domain: 'automation',
          context_entity_id: 'automation.night',
        }),
        hass,
        people,
      ),
    ).toEqual({ kind: 'automation', name: 'Night', entityId: 'automation.night' });
    expect(causeOf(at(1, 'light.sofa', { context_user_id: 'u1' }), hass, people)).toEqual({
      kind: 'person',
      name: 'Ana',
    });
    expect(
      causeOf(
        at(1, 'light.sofa', { context_entity_id: 'binary_sensor.door', context_name: 'Door' }),
        hass,
        people,
      ),
    ).toEqual({ kind: 'entity', name: 'Door', entityId: 'binary_sensor.door' });
    expect(causeOf(at(1, 'light.sofa'), hass, people)).toBeUndefined();
  });

  describe('whoOf (1.25)', () => {
    /** The house as Leo (u2, a person with a picture) reads it, or an administrator (Ana, u1). */
    const as = (user: { id: string; name: string; is_admin: boolean }) =>
      ({
        ...hass,
        states: {
          ...hass.states,
          'person.leo': state('person.leo', {
            friendly_name: 'Leo',
            user_id: 'u2',
            entity_picture: '/api/image/serve/leo/512x512',
          }),
        },
        user,
      }) as unknown as HomeAssistant;
    const ana = as({ id: 'u1', name: 'Ana', is_admin: true });
    const leo = as({ id: 'u2', name: 'Leo', is_admin: false });
    const accounts = new Map<string, ActivityAccount>([
      ['u1', { name: 'Ana', system: false }],
      ['u3', { name: 'Node-RED', system: false }],
      ['u4', { name: 'Home Assistant Cloud', system: true }],
    ]);
    const by = (user: string, extra: Partial<ActivityEvent> = {}) =>
      at(1, 'light.sofa', { context_user_id: user, ...extra });

    it('names the person whose user did it, with their entity and picture', () => {
      expect(whoOf(by('u2'), ana, peopleByUser(ana), accounts)).toEqual({
        kind: 'person',
        userId: 'u2',
        name: 'Leo',
        entityId: 'person.leo',
        picture: '/api/image/serve/leo/512x512',
        you: false,
      });
    });

    it('names the person behind a run their tap fired (the run carries their user)', () => {
      const run = by('u2', {
        context_event_type: 'script_started',
        context_domain: 'script',
        context_entity_id: 'script.movie',
        context_name: 'Movie time',
      });
      expect(causeOf(run, ana, peopleByUser(ana))).toMatchObject({ kind: 'script' });
      expect(whoOf(run, ana, peopleByUser(ana), accounts)).toMatchObject({
        kind: 'person',
        name: 'Leo',
      });
    });

    it('names an account no person stands for to an administrator: a sign-in, or an integration’s', () => {
      expect(whoOf(by('u3'), ana, peopleByUser(ana), accounts)).toEqual({
        kind: 'account',
        userId: 'u3',
        name: 'Node-RED',
        picture: '',
        you: false,
      });
      expect(whoOf(by('u4'), ana, peopleByUser(ana), accounts)).toMatchObject({
        kind: 'integration',
        name: 'Home Assistant Cloud',
      });
    });

    it('names no account to anyone else, even one they were handed', () => {
      expect(whoOf(by('u3'), leo, peopleByUser(leo), accounts)).toBeUndefined();
      // a person is anyone's to read
      expect(whoOf(by('u1'), leo, peopleByUser(leo), new Map())).toMatchObject({ name: 'Ana' });
    });

    it('invents nobody: an entry with no user, or a user nobody knows', () => {
      expect(whoOf(at(1, 'light.sofa'), ana, peopleByUser(ana), accounts)).toBeUndefined();
      expect(whoOf(by('u9'), ana, peopleByUser(ana), accounts)).toBeUndefined();
    });

    it('says when it is the one reading, even without a person or an administrator’s list', () => {
      expect(whoOf(by('u2'), leo, peopleByUser(leo), new Map())).toMatchObject({
        kind: 'person',
        you: true,
      });
      const guest = { ...leo, states: hass.states } as HomeAssistant;
      expect(whoOf(by('u2'), guest, peopleByUser(guest), new Map())).toEqual({
        kind: 'account',
        userId: 'u2',
        name: 'Leo',
        picture: '',
        you: true,
      });
    });

    it('reads the accounts for an administrator only, each with a name, and none when the answer fails', async () => {
      const asked: unknown[] = [];
      const answering = (base: HomeAssistant, answer: () => Promise<unknown>) =>
        ({
          ...base,
          callWS: (message: unknown) => (asked.push(message), answer()),
        }) as unknown as HomeAssistant;
      const users = [
        { id: 'u3', name: 'Node-RED', system_generated: false },
        { id: 'u4', name: 'Home Assistant Cloud', system_generated: true },
        { id: 'u5', name: '', system_generated: false },
        { id: 7, name: 'Broken' },
      ];
      expect(await accountsOf(answering(ana, async () => users))).toEqual(
        new Map([
          ['u3', { name: 'Node-RED', system: false }],
          ['u4', { name: 'Home Assistant Cloud', system: true }],
        ]),
      );
      expect(asked).toEqual([{ type: 'config/auth/list' }]);
      expect((await accountsOf(answering(leo, async () => users))).size).toBe(0);
      expect(asked.length).toBe(1);
      const refused = answering(ana, () => Promise.reject(new Error('unauthorized')));
      expect((await accountsOf(refused)).size).toBe(0);
    });
  });
});

describe('sources', () => {
  it('covers what a floor, an area, a device or a label holds', () => {
    expect([...targetEntities(hass, { floor_id: 'ground' })].sort()).toEqual([
      'light.sofa',
      'switch.led',
    ]);
    expect([...targetEntities(hass, { device_id: 'd2' })]).toEqual(['binary_sensor.door']);
    expect([...targetEntities(hass, { label_id: 'safe' })]).toEqual(['binary_sensor.door']);
    expect([...targetEntities(hass, { label_id: 'xmas' })]).toEqual(['switch.led']);
  });

  it('keeps what the type and integration filters ask for', () => {
    const ids = ['light.sofa', 'switch.led', 'binary_sensor.door'];
    expect(applySourceFilters(hass, ids, { integrations: ['zha'] })).toEqual([
      'switch.led',
      'binary_sensor.door',
    ]);
    expect(applySourceFilters(hass, ids, { types: ['binary_sensor/door'] })).toEqual([
      'binary_sensor.door',
    ]);
  });

  it('asks the stream for everything when nothing narrows it, and leaves continuous sensors out when it is', () => {
    expect(sourceEntities(hass, {}, {})).toBeUndefined();
    expect(sourceEntities(hass, {}, { types: ['sensor'] })).toEqual(['sensor.clock']);
  });

  it('reads a target from the address Home Assistant links to', () => {
    expect(targetFromSearch('?entity_id=light.a,light.b&area_id=hall')).toEqual({
      entity_id: ['light.a', 'light.b'],
      area_id: ['hall'],
    });
  });
});

describe('the stream', () => {
  it('merges history and live entries newest first, drops repeats, and starts over when the connection returns', async () => {
    const listeners: Record<string, () => void> = {};
    let send: ((message: unknown) => void) | undefined;
    let requests = 0;
    const live = {
      ...hass,
      connection: {
        subscribeMessage: async (callback: (message: unknown) => void) => {
          requests += 1;
          send = callback;
          return () => undefined;
        },
        addEventListener: (event: string, listener: () => void) => (listeners[event] = listener),
        removeEventListener: () => undefined,
      },
    } as unknown as HomeAssistant;
    const seen: { events: readonly ActivityEvent[]; loading: boolean }[] = [];
    const stop = subscribeActivity(
      live,
      { start: new Date(0), end: new Date(10_000_000) },
      (events, loading) => seen.push({ events, loading }),
    );
    await Promise.resolve();
    send!({ events: [at(10, 'light.sofa'), at(30, 'switch.led')], partial: true });
    send!({ events: [at(5, 'light.sofa')] });
    send!({ events: [at(50, 'light.sofa'), at(30, 'switch.led')] });
    const last = seen[seen.length - 1]!;
    expect(last.loading).toBe(false);
    expect(last.events.map((event) => event.when)).toEqual([50, 30, 10, 5]);
    listeners['ready']!();
    await Promise.resolve();
    expect(requests).toBe(2);
    expect(seen[seen.length - 1]!.events).toEqual([]);
    stop();
  });
});
