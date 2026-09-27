import '@fluvy/cards/activity';
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import type { ActivityEvent } from '@fluvy/core/activity';

/**
 * `?activity=1`: Fluvy's Activity page outside Home Assistant, on a house made up for it — rooms, people, a morning
 * routine, a restart burst, a TV changing again and again, the evening coming home — streamed the way Home Assistant
 * streams its logbook (history in two chunks, then each new entry live). Every day is the same house on a different
 * day (a seeded shuffle), so ‹ › has something to show. `&live=0` stops the live entries (stable screenshots).
 */

type Words = Record<'en' | 'es', string>;

interface Thing {
  readonly id: string;
  readonly name: Words;
  readonly area?: string;
  readonly device?: string;
  readonly config?: boolean;
  readonly attributes?: Record<string, unknown>;
}

const AREAS: Record<string, Words> = {
  living: { en: 'Living room', es: 'Salón' },
  kitchen: { en: 'Kitchen', es: 'Cocina' },
  bedroom: { en: 'Bedroom', es: 'Dormitorio' },
  hall: { en: 'Hallway', es: 'Pasillo' },
  entrance: { en: 'Entrance', es: 'Entrada' },
  office: { en: 'Office', es: 'Despacho' },
  laundry: { en: 'Laundry', es: 'Lavadero' },
};

const THINGS: readonly Thing[] = [
  {
    id: 'light.living_ceiling',
    name: { en: 'Living room ceiling', es: 'Techo del salón' },
    area: 'living',
  },
  {
    id: 'light.living_lamp',
    name: { en: 'Reading lamp', es: 'Lámpara de lectura' },
    area: 'living',
  },
  {
    id: 'light.kitchen',
    name: { en: 'Kitchen lights', es: 'Luces de la cocina' },
    area: 'kitchen',
  },
  { id: 'light.hallway', name: { en: 'Hallway', es: 'Pasillo' }, area: 'hall' },
  { id: 'light.bedroom', name: { en: 'Bedside lamp', es: 'Lámpara de noche' }, area: 'bedroom' },
  {
    id: 'switch.coffee',
    name: { en: 'Coffee machine', es: 'Cafetera' },
    area: 'kitchen',
    attributes: { device_class: 'outlet' },
  },
  {
    id: 'switch.washer',
    name: { en: 'Washing machine', es: 'Lavadora' },
    area: 'laundry',
    attributes: { device_class: 'outlet' },
  },
  {
    id: 'climate.living',
    name: { en: 'Thermostat', es: 'Termostato' },
    area: 'living',
    attributes: { hvac_action: 'heating' },
  },
  {
    id: 'media_player.living_tv',
    name: { en: 'Living room TV', es: 'TV del salón' },
    area: 'living',
  },
  {
    id: 'media_player.kitchen_radio',
    name: { en: 'Kitchen speaker', es: 'Altavoz de la cocina' },
    area: 'kitchen',
  },
  {
    id: 'cover.living_blinds',
    name: { en: 'Living room blinds', es: 'Persianas del salón' },
    area: 'living',
  },
  {
    id: 'lock.front_door',
    name: { en: 'Front door lock', es: 'Cerradura de la entrada' },
    area: 'entrance',
  },
  {
    id: 'binary_sensor.front_door',
    name: { en: 'Front door', es: 'Puerta de la entrada' },
    area: 'entrance',
    attributes: { device_class: 'door' },
  },
  {
    id: 'binary_sensor.bedroom_window',
    name: { en: 'Bedroom window', es: 'Ventana del dormitorio' },
    area: 'bedroom',
    attributes: { device_class: 'window' },
  },
  {
    id: 'binary_sensor.hall_motion',
    name: { en: 'Hallway motion', es: 'Movimiento del pasillo' },
    area: 'hall',
    attributes: { device_class: 'motion' },
  },
  { id: 'alarm_control_panel.house', name: { en: 'Alarm', es: 'Alarma' }, area: 'entrance' },
  { id: 'vacuum.robot', name: { en: 'Robot vacuum', es: 'Robot aspirador' }, area: 'living' },
  { id: 'person.marta', name: { en: 'Marta', es: 'Marta' }, attributes: { user_id: 'u1' } },
  { id: 'person.leo', name: { en: 'Leo', es: 'Leo' }, attributes: { user_id: 'u2' } },
  {
    id: 'automation.morning',
    name: { en: 'Good morning', es: 'Buenos días' },
    attributes: { id: '1001' },
  },
  {
    id: 'automation.welcome',
    name: { en: 'Welcome home', es: 'Bienvenida a casa' },
    attributes: { id: '1002' },
  },
  {
    id: 'automation.night',
    name: { en: 'Good night', es: 'Buenas noches' },
    attributes: { id: '1003' },
  },
  { id: 'scene.evening', name: { en: 'Evening', es: 'Tarde' } },
  {
    id: 'event.doorbell',
    name: { en: 'Doorbell', es: 'Timbre' },
    area: 'entrance',
    attributes: { device_class: 'doorbell' },
  },
  { id: 'update.router', name: { en: 'Router firmware', es: 'Firmware del router' }, config: true },
  {
    id: 'update.core',
    name: { en: 'Home Assistant Core update', es: 'Actualización de Home Assistant Core' },
  },
  ...Array.from({ length: 24 }, (_, i): Thing => ({
    id: `switch.plug_${i + 1}_child_lock`,
    name: { en: `Plug ${i + 1} child lock`, es: `Bloqueo infantil del enchufe ${i + 1}` },
    area: Object.keys(AREAS)[i % 7]!,
    config: true,
  })),
  ...Array.from({ length: 18 }, (_, i): Thing => ({
    id: `select.bulb_${i + 1}_power_on`,
    name: { en: `Bulb ${i + 1} power-on behaviour`, es: `Encendido de la bombilla ${i + 1}` },
    area: Object.keys(AREAS)[(i + 3) % 7]!,
    config: true,
  })),
];

const STATES: Record<string, string> = {
  'light.living_ceiling': 'on',
  'light.living_lamp': 'on',
  'light.kitchen': 'off',
  'light.hallway': 'off',
  'light.bedroom': 'off',
  'switch.coffee': 'off',
  'switch.washer': 'off',
  'climate.living': 'heat',
  'media_player.living_tv': 'playing',
  'media_player.kitchen_radio': 'idle',
  'cover.living_blinds': 'closed',
  'lock.front_door': 'locked',
  'binary_sensor.front_door': 'off',
  'binary_sensor.bedroom_window': 'off',
  'binary_sensor.hall_motion': 'off',
  'alarm_control_panel.house': 'disarmed',
  'vacuum.robot': 'docked',
  'person.marta': 'home',
  'person.leo': 'home',
  'automation.morning': 'on',
  'automation.welcome': 'on',
  'automation.night': 'on',
  'scene.evening': '2026-09-17T18:31:00+00:00',
  'event.doorbell': '2026-09-17T19:12:00+00:00',
  'update.router': 'off',
  'update.core': 'on',
};

/** A seeded shuffle: the same day always tells the same story. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

interface Draft {
  at: number; // minutes after midnight (fractions allowed)
  id: string;
  state?: string;
  by?: { automation?: string; user?: string };
  message?: string;
  source?: string;
  domain?: string;
}

/** One day of the house, in minutes after midnight. */
function story(day: number): Draft[] {
  const r = random(day);
  const jitter = (spread: number): number => (r() - 0.5) * spread;
  const d: Draft[] = [];
  const add = (at: number, id: string, state?: string, extra: Partial<Draft> = {}): void => {
    d.push({
      at: Math.max(0, Math.min(1439.9, at + jitter(4))),
      id,
      ...(state !== undefined ? { state } : {}),
      ...extra,
    });
  };
  const morning = { automation: 'automation.morning' };
  const welcome = { automation: 'automation.welcome' };
  const night = { automation: 'automation.night' };
  // the night
  add(0 * 60 + 34, 'binary_sensor.hall_motion', 'on');
  add(0 * 60 + 36, 'light.hallway', 'on', { by: { automation: 'automation.night' } });
  add(0 * 60 + 38, 'binary_sensor.hall_motion', 'off');
  add(0 * 60 + 41, 'light.hallway', 'off', { by: night });
  add(3 * 60 + 12, 'binary_sensor.hall_motion', 'on');
  add(3 * 60 + 14, 'binary_sensor.hall_motion', 'off');
  // the morning
  add(6 * 60 + 45, 'alarm_control_panel.house', 'disarmed', { by: { user: 'u1' } });
  add(7 * 60, 'automation.morning', undefined, { message: 'triggered by time', source: 'time' });
  add(7 * 60 + 0.2, 'light.kitchen', 'on', { by: morning });
  add(7 * 60 + 0.3, 'cover.living_blinds', 'opening', { by: morning });
  add(7 * 60 + 1.2, 'cover.living_blinds', 'open', { by: morning });
  add(7 * 60 + 0.4, 'climate.living', 'heat', { by: morning });
  add(7 * 60 + 6, 'switch.coffee', 'on', { by: { user: 'u1' } });
  add(7 * 60 + 11, 'switch.coffee', 'off');
  add(7 * 60 + 12, 'media_player.kitchen_radio', 'playing', { by: { user: 'u2' } });
  add(7 * 60 + 38, 'media_player.kitchen_radio', 'paused', { by: { user: 'u2' } });
  add(7 * 60 + 52, 'light.kitchen', 'off', { by: { user: 'u1' } });
  add(8 * 60 + 9, 'binary_sensor.front_door', 'on');
  add(8 * 60 + 10, 'binary_sensor.front_door', 'off');
  add(8 * 60 + 10.5, 'person.marta', 'not_home');
  add(8 * 60 + 11, 'lock.front_door', 'locked', { by: { user: 'u1' } });
  // a restart: dozens of settings report themselves in under a minute
  const restart = 8 * 60 + 56 + jitter(6);
  d.push({ at: restart, id: 'homeassistant', domain: 'homeassistant', message: 'started' });
  THINGS.filter((thing) => thing.config).forEach((thing, i) => {
    d.push({ at: restart + 0.01 + (i * 0.6) / 60, id: thing.id, state: 'unavailable' });
    d.push({
      at: restart + 0.3 + (i * 0.4) / 60,
      id: thing.id,
      state: thing.id.startsWith('switch') ? 'off' : 'on',
    });
  });
  // the day
  add(9 * 60 + 30, 'vacuum.robot', 'cleaning', { by: { user: 'u2' } });
  add(10 * 60 + 42, 'vacuum.robot', 'returning');
  add(10 * 60 + 49, 'vacuum.robot', 'docked');
  add(11 * 60 + 5, 'switch.washer', 'on', { by: { user: 'u2' } });
  add(12 * 60 + 20, 'media_player.living_tv', 'playing', { by: { user: 'u2' } });
  d.push({ at: 12 * 60 + 27, id: 'media_player.living_tv', state: 'paused', by: { user: 'u2' } });
  d.push({ at: 12 * 60 + 31, id: 'media_player.living_tv', state: 'playing', by: { user: 'u2' } });
  d.push({ at: 12 * 60 + 44, id: 'media_player.living_tv', state: 'off', by: { user: 'u2' } });
  // a speaker drops off the network for a while (the dashed pill, both ways)
  add(13 * 60 + 10, 'media_player.kitchen_radio', 'unavailable');
  add(13 * 60 + 26, 'media_player.kitchen_radio', 'idle');
  add(12 * 60 + 58, 'switch.washer', 'off');
  add(13 * 60 + 31, 'update.router', 'on');
  add(15 * 60 + 2, 'binary_sensor.bedroom_window', 'on');
  add(16 * 60 + 40, 'binary_sensor.bedroom_window', 'off');
  // the evening
  add(18 * 60 + 29, 'person.marta', 'home');
  add(18 * 60 + 30, 'lock.front_door', 'unlocked', { by: { user: 'u1' } });
  add(18 * 60 + 30.3, 'binary_sensor.front_door', 'on');
  add(18 * 60 + 30.8, 'binary_sensor.front_door', 'off');
  add(18 * 60 + 31, 'automation.welcome', undefined, {
    message: 'triggered by state of person.marta',
    source: 'state of person.marta',
  });
  add(18 * 60 + 31.1, 'light.living_ceiling', 'on', { by: welcome });
  add(18 * 60 + 31.2, 'light.hallway', 'on', { by: welcome });
  add(18 * 60 + 32, 'scene.evening', '2026-09-17T18:32:00+00:00', { by: { user: 'u1' } });
  add(19 * 60 + 12, 'event.doorbell', '2026-09-17T19:12:00+00:00');
  add(19 * 60 + 40, 'media_player.living_tv', 'playing', { by: { user: 'u1' } });
  add(20 * 60 + 5, 'light.living_lamp', 'on', { by: { user: 'u1' } });
  add(20 * 60 + 6, 'light.living_ceiling', 'off', { by: { user: 'u1' } });
  add(21 * 60 + 30, 'automation.night', undefined, {
    message: 'triggered by time',
    source: 'time',
  });
  add(21 * 60 + 30.2, 'alarm_control_panel.house', 'armed_night', { by: night });
  add(21 * 60 + 30.3, 'light.hallway', 'off', { by: night });
  add(22 * 60 + 15, 'media_player.living_tv', 'off', { by: { user: 'u1' } });
  add(22 * 60 + 16, 'light.living_lamp', 'off', { by: { user: 'u1' } });
  add(23 * 60 + 5, 'light.bedroom', 'on', { by: { user: 'u2' } });
  add(23 * 60 + 40, 'light.bedroom', 'off', { by: { user: 'u2' } });
  // some days Leo is out in the afternoon
  if (r() > 0.4) {
    add(16 * 60 + 5, 'person.leo', 'not_home');
    add(17 * 60 + 50, 'person.leo', 'home');
  }
  return d;
}

function toEvent(draft: Draft, midnight: number, lang: 'en' | 'es'): ActivityEvent {
  const when = (midnight + draft.at * 60_000) / 1000;
  const thing = THINGS.find((item) => item.id === draft.id);
  const automation = draft.by?.automation;
  const context = automation
    ? {
        context_id: `c-${Math.round(when)}`,
        context_event_type: 'automation_triggered',
        context_domain: 'automation',
        context_entity_id: automation,
        context_name: THINGS.find((item) => item.id === automation)?.name[lang] ?? automation,
      }
    : draft.by?.user
      ? { context_id: `u-${Math.round(when)}`, context_user_id: draft.by.user }
      : {};
  if (draft.domain === 'homeassistant')
    return {
      when,
      name: 'Home Assistant',
      message: draft.message ?? 'started',
      domain: 'homeassistant',
      icon: 'mdi:home-assistant',
    };
  return {
    when,
    entity_id: draft.id,
    ...(draft.state !== undefined ? { state: draft.state } : {}),
    ...(draft.message ? { message: draft.message, name: thing?.name[lang] ?? draft.id } : {}),
    ...(draft.source ? { source: draft.source } : {}),
    ...(draft.id.startsWith('automation.') ? { domain: 'automation' } : {}),
    ...context,
  };
}

/** The house's day `midnight` as Home Assistant's logbook would stream it, oldest first, up to `until`. */
export function dayEvents(midnight: number, until: number, lang: 'en' | 'es'): ActivityEvent[] {
  const day = Math.round(midnight / 86_400_000);
  return story(day)
    .map((draft) => toEvent(draft, midnight, lang))
    .filter((event) => event.when * 1000 < until)
    .sort((a, b) => a.when - b.when);
}

/** The made-up house as `hass` sees it: states, registries (areas, devices, what is configuration), people. */
/** How the made-up stream answers: live entries or not, slowly (a loading page), or with nothing (an empty day). */
export interface StreamMode {
  readonly live: boolean;
  readonly slow?: boolean;
  readonly empty?: boolean;
}

/** Senders of the open streams: a moment of the playground pushes a live entry through them. */
const streams = new Set<(message: { events: ActivityEvent[] }) => void>();

/** A live entry, now (the playground's `drop` and `fresh` moments). */
export function pushLive(entity_id: string, state: string): void {
  const event: ActivityEvent = { when: Date.now() / 1000, entity_id, state, context_user_id: 'u1' };
  for (const send of streams) send({ events: [event] });
}

export function activityHass(
  base: HomeAssistant,
  lang: 'en' | 'es',
  mode: StreamMode,
): HomeAssistant {
  const live = mode.live;
  const states: Record<string, HassEntity> = { ...base.states };
  const entities: Record<string, unknown> = {};
  const devices: Record<string, unknown> = {};
  const areas: Record<string, unknown> = {};
  for (const [id, name] of Object.entries(AREAS)) areas[id] = { area_id: id, name: name[lang] };
  for (const thing of THINGS) {
    const device = `dev-${thing.id.split('.')[1]!.replace(/_(child_lock|power_on)$/, '')}`;
    states[thing.id] = {
      entity_id: thing.id,
      state: STATES[thing.id] ?? (thing.id.startsWith('switch') ? 'off' : 'on'),
      attributes: { friendly_name: thing.name[lang], ...thing.attributes },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };
    if (thing.area)
      devices[device] ??= {
        id: device,
        name: thing.name[lang],
        name_by_user: null,
        area_id: thing.area,
      };
    entities[thing.id] = {
      entity_id: thing.id,
      device_id: thing.area ? device : null,
      area_id: null,
      platform: thing.id.startsWith('select') || thing.id.includes('child_lock') ? 'zha' : 'demo',
      entity_category: thing.config ? 'config' : null,
    };
  }
  const subscribe = async <T>(
    callback: (message: T) => void,
    message: { type: string; [key: string]: unknown },
  ): Promise<() => void> => {
    if (message.type !== 'logbook/event_stream')
      return base.connection.subscribeMessage(callback, message);
    const start = Date.parse(String(message['start_time']));
    const end = Date.parse(String(message['end_time']));
    const wanted = message['entity_ids'] as readonly string[] | undefined;
    const keep = (event: ActivityEvent): boolean =>
      !wanted || (!!event.entity_id && wanted.includes(event.entity_id));
    const history: ActivityEvent[] = [];
    for (let midnight = new Date(start).setHours(0, 0, 0, 0); midnight < end;) {
      history.push(
        ...dayEvents(midnight, Math.min(end, Date.now()), lang).filter(
          (event) => event.when * 1000 >= start,
        ),
      );
      const next = new Date(midnight);
      next.setDate(next.getDate() + 1);
      midnight = next.getTime();
    }
    const kept = mode.empty ? [] : history.filter(keep);
    const recent = kept.filter((event) => Date.now() - event.when * 1000 < 3 * 3600_000);
    const older = kept.filter((event) => Date.now() - event.when * 1000 >= 3 * 3600_000);
    const send = callback as (message: { events: ActivityEvent[]; partial?: boolean }) => void;
    const timers: number[] = [];
    // the recent past first (it shows at once), then the rest of the day
    const late = mode.slow ? 600_000 : 0;
    timers.push(window.setTimeout(() => send({ events: recent, partial: true }), 160 + late));
    timers.push(window.setTimeout(() => send({ events: older }), 420 + late));
    const live_ = (message: { events: ActivityEvent[] }): void =>
      send({ events: message.events.filter(keep) });
    streams.add(live_);
    if (live && end > Date.now()) {
      const pool = [
        'binary_sensor.hall_motion',
        'light.hallway',
        'light.kitchen',
        'media_player.kitchen_radio',
      ];
      let turn = 0;
      timers.push(
        window.setInterval(() => {
          const id = pool[turn % pool.length]!;
          turn += 1;
          const on = turn % 2 === 1;
          const state = id.startsWith('media') ? (on ? 'playing' : 'paused') : on ? 'on' : 'off';
          const event: ActivityEvent = {
            when: Date.now() / 1000,
            entity_id: id,
            state,
            context_user_id: 'u1',
          };
          if (keep(event)) send({ events: [event] });
        }, 9000),
      );
    }
    return () => {
      streams.delete(live_);
      timers.forEach((timer) => (window.clearTimeout(timer), window.clearInterval(timer)));
    };
  };
  return {
    ...base,
    states,
    entities,
    devices,
    areas,
    localize: (key: string) => key,
    user: { id: 'u1', name: 'Marta', is_admin: true },
    connection: { ...base.connection, subscribeMessage: subscribe },
    callWS: async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
      if (message.type === 'entity/source')
        return Object.fromEntries(THINGS.map((thing) => [thing.id, { domain: 'demo' }])) as T;
      return base.callWS(message);
    },
  } as unknown as HomeAssistant;
}

/** A moment of the page to look at (`&moment=`): a row unfolded, the restart unfolded, the dates, the sources, a filter. */
export type ActivityMoment =
  | 'detail'
  | 'burst'
  | 'dates'
  | 'sources'
  | 'lights'
  | 'week'
  | 'nomatch'
  | 'fresh'
  | 'drop'
  | 'loading'
  | 'empty'
  | 'end';

type View = HTMLElement & {
  hass: HomeAssistant;
  narrow: boolean;
  filter: string;
  picking: boolean;
  sourcing: boolean;
  updateComplete: Promise<boolean>;
};

async function reach(view: View, moment: ActivityMoment): Promise<void> {
  const root = view.shadowRoot as ShadowRoot;
  const rows = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('.av-row')];
  if (moment === 'dates') view.picking = true;
  if (moment === 'sources') view.sourcing = true;
  if (moment === 'lights') view.filter = 'lights';
  if (moment === 'detail') rows()[1]?.click();
  if (moment === 'week') {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    (view as unknown as { goTo(range: { start: number; end: number }, way: string): void }).goTo(
      { start: start.getTime(), end: end.getTime() },
      'prev',
    );
  }
  if (moment === 'nomatch') {
    const input = root.querySelector<HTMLInputElement>('#av-search')!;
    input.value = 'garage';
    input.dispatchEvent(new InputEvent('input'));
  }
  // further down the day, three things happen: they wait behind "3 new"
  if (moment === 'fresh') {
    root.querySelector<HTMLElement>('.av-scroll')!.scrollTop = 1400;
    await new Promise((resolve) => setTimeout(resolve, 300));
    pushLive('light.kitchen', 'on');
    pushLive('binary_sensor.front_door', 'on');
    pushLive('media_player.kitchen_radio', 'playing');
  }
  // at the top, one thing happens: it opens its place, with its ring
  if (moment === 'drop') pushLive('light.kitchen', 'on');
  // the end of the day, as the rail's End key leaves it
  if (moment === 'end')
    view.shadowRoot
      ?.querySelector('fluvy-time-rail')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  if (moment === 'burst') {
    view.filter = 'all';
    await view.updateComplete;
    const row = rows().find(
      (node) =>
        node.querySelector('.av-chevron') &&
        node.dataset['t'] &&
        /:5[56]/.test(node.textContent ?? ''),
    );
    if (!row) return;
    row.closest<HTMLElement>('.av-section')!.style.contentVisibility = 'visible';
    row.click();
    await view.updateComplete;
    const scroller = root.querySelector<HTMLElement>('.av-scroll')!;
    scroller.scrollTop +=
      row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 44;
  }
}

/** Mounts the page, full screen, as Home Assistant gives it the content area beside its sidebar. */
export function mountActivity(
  stage: HTMLElement,
  base: HomeAssistant,
  lang: string,
  live: boolean,
  moment?: ActivityMoment,
): void {
  const language = lang === 'es' ? 'es' : 'en';
  const hass = activityHass(base, language, {
    live,
    slow: moment === 'loading',
    empty: moment === 'empty',
  });
  const view = document.createElement('fluvy-activity') as View;
  view.hass = hass;
  view.narrow = window.innerWidth < 870;
  stage.classList.add('pg-panel');
  stage.append(view);
  window.addEventListener('resize', () => {
    view.narrow = window.innerWidth < 870;
  });
  // once the day has arrived (the stream answers within half a second)
  if (moment && moment !== 'loading' && moment !== 'empty')
    setTimeout(() => void reach(view, moment), 700);
}
