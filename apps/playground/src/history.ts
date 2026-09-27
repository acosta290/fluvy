import '@fluvy/cards/history';
import type { HassEntity, HomeAssistant } from '@fluvy/core';

/**
 * `?history=1`: Fluvy's History page outside Home Assistant, on a house made up for it — three thermometers, the
 * humidity, the house's power, a phone's battery, and the things whose states come and go (the washer, the front
 * door, the television, a lamp) — answered the way Home Assistant answers: `history/stream` in chunks for a short
 * window, `recorder/statistics_during_period` for a long one. `&live=0` stops the live readings (stable shots).
 */

type Words = Record<'en' | 'es', string>;

export type HistoryMoment =
  | 'plain'
  | 'week'
  | 'month'
  | 'states'
  | 'many'
  | 'empty'
  | 'loading'
  | 'sources'
  | 'dates'
  | 'scrub';

interface Measure {
  readonly id: string;
  readonly name: Words;
  readonly unit: string;
  readonly deviceClass: string;
  readonly area: string;
  /** Its shape through a day: a base, how far it swings, and where its day peaks (0 … 1). */
  readonly base: number;
  readonly swing: number;
  readonly peak: number;
  /** Spikes instead of a curve (a washer's power). */
  readonly spiky?: boolean;
  /** Only ever falls (a battery). */
  readonly drains?: boolean;
}

const AREAS: Record<string, Words> = {
  living: { en: 'Living room', es: 'Salón' },
  bedroom: { en: 'Bedroom', es: 'Dormitorio' },
  terrace: { en: 'Terrace', es: 'Terraza' },
  laundry: { en: 'Laundry', es: 'Lavadero' },
  entrance: { en: 'Entrance', es: 'Entrada' },
};

const MEASURES: readonly Measure[] = [
  {
    id: 'sensor.living_temperature',
    name: { en: 'Living room', es: 'Salón' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 21.4,
    swing: 1.6,
    peak: 0.62,
  },
  {
    id: 'sensor.bedroom_temperature',
    name: { en: 'Bedroom', es: 'Dormitorio' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'bedroom',
    base: 20.1,
    swing: 1.1,
    peak: 0.55,
  },
  {
    id: 'sensor.terrace_temperature',
    name: { en: 'Terrace', es: 'Terraza' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'terrace',
    base: 16.8,
    swing: 6.4,
    peak: 0.6,
  },
  {
    id: 'sensor.living_humidity',
    name: { en: 'Living room', es: 'Salón' },
    unit: '%',
    deviceClass: 'humidity',
    area: 'living',
    base: 48,
    swing: 7,
    peak: 0.25,
  },
  {
    id: 'sensor.house_power',
    name: { en: 'House power', es: 'Potencia de la casa' },
    unit: 'W',
    deviceClass: 'power',
    area: 'living',
    base: 320,
    swing: 900,
    peak: 0.78,
    spiky: true,
  },
  {
    id: 'sensor.phone_battery',
    name: { en: 'Marta’s phone', es: 'Móvil de Marta' },
    unit: '%',
    deviceClass: 'battery',
    area: 'bedroom',
    base: 82,
    swing: 40,
    peak: 0.3,
    drains: true,
  },
];

/** The measures a wide house adds (`&moment=many`): a chart then draws its six and counts the rest. */
const MORE: readonly Measure[] = [
  {
    id: 'sensor.office_temperature',
    name: { en: 'Office', es: 'Despacho' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 22.2,
    swing: 0.8,
    peak: 0.5,
  },
  {
    id: 'sensor.kitchen_temperature',
    name: { en: 'Kitchen', es: 'Cocina' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 23.1,
    swing: 2.2,
    peak: 0.7,
  },
  {
    id: 'sensor.hall_temperature',
    name: { en: 'Hallway', es: 'Pasillo' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 20.8,
    swing: 0.6,
    peak: 0.4,
  },
  {
    id: 'sensor.attic_temperature',
    name: { en: 'Attic', es: 'Buhardilla' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 18.4,
    swing: 4.2,
    peak: 0.66,
  },
  {
    id: 'sensor.cellar_temperature',
    name: { en: 'Cellar', es: 'Bodega' },
    unit: '°C',
    deviceClass: 'temperature',
    area: 'living',
    base: 14.2,
    swing: 0.4,
    peak: 0.5,
  },
];

interface Thing {
  readonly id: string;
  readonly name: Words;
  readonly area: string;
  readonly on: string;
  readonly off: string;
  /** Roughly how many times a day it changes. */
  readonly changes: number;
  /**
   * What it does between on and off — paused, idle, docked, returning: a state that is neither, which the page
   * draws in its own quiet tone. Every third stretch takes it.
   */
  readonly between?: string;
  /** Stretches where the recorder knew nothing (the thing was away). */
  readonly away?: boolean;
  readonly attributes?: Record<string, unknown>;
}

const THINGS: readonly Thing[] = [
  {
    id: 'switch.washer',
    name: { en: 'Washing machine', es: 'Lavadora' },
    area: 'laundry',
    on: 'on',
    off: 'off',
    changes: 4,
  },
  {
    id: 'binary_sensor.front_door',
    name: { en: 'Front door', es: 'Puerta de entrada' },
    area: 'entrance',
    on: 'on',
    off: 'off',
    changes: 9,
    attributes: { device_class: 'door' },
  },
  {
    id: 'media_player.tv',
    name: { en: 'Living room TV', es: 'TV del salón' },
    area: 'living',
    on: 'playing',
    off: 'off',
    between: 'paused',
    changes: 6,
  },
  {
    id: 'light.living_ceiling',
    name: { en: 'Living room ceiling', es: 'Techo del salón' },
    area: 'living',
    on: 'on',
    off: 'off',
    changes: 7,
  },
  {
    id: 'vacuum.robot',
    name: { en: 'Robot vacuum', es: 'Robot aspirador' },
    area: 'living',
    on: 'cleaning',
    off: 'docked',
    between: 'returning',
    changes: 3,
  },
  {
    id: 'binary_sensor.garage_door',
    name: { en: 'Garage door', es: 'Puerta del garaje' },
    area: 'entrance',
    on: 'on',
    off: 'off',
    changes: 5,
    away: true,
    attributes: { device_class: 'garage_door' },
  },
];

/** A house with more things than a card draws: what "+N more" is for. */
const MORE_THINGS: readonly Thing[] = Array.from({ length: 10 }, (_, index) => ({
  id: `binary_sensor.window_${index + 1}`,
  name: { en: `Window ${index + 1}`, es: `Ventana ${index + 1}` },
  area: 'living',
  on: 'on',
  off: 'off',
  changes: 2 + (index % 4),
  attributes: { device_class: 'window' },
}));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A repeatable wobble: the same house on the same day always draws the same curve. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43_758.545_3;
  return x - Math.floor(x) - 0.5;
}

/** What a measure reads at an instant: its daily shape, a little wobble, and the shapes that are not curves. */
function reading(measure: Measure, t: number): number {
  const day = Math.floor(t / DAY);
  const through = (t % DAY) / DAY;
  const wobble = noise(day * 97 + through * 53) * (measure.swing / 12);
  if (measure.drains) {
    const level =
      measure.base - measure.swing * through + (through > 0.92 ? measure.swing * 0.8 : 0);
    return Math.round(Math.max(4, Math.min(100, level + wobble)));
  }
  if (measure.spiky) {
    const spike = noise(day * 31 + Math.floor(through * 96)) > 0.34 ? measure.swing : 0;
    const evening = through > 0.72 && through < 0.95 ? measure.swing * 0.35 : 0;
    return Math.round(Math.max(40, measure.base + spike + evening + wobble * 10));
  }
  const shape = Math.cos((through - measure.peak) * 2 * Math.PI);
  const value = measure.base + (measure.swing / 2) * shape + wobble;
  return Math.round(value * 10) / 10;
}

/** A thing's changes through a day: alternating stretches, the same ones every time. */
function stretches(thing: Thing, from: number, to: number): { t: number; state: string }[] {
  const out: { t: number; state: string }[] = [];
  for (let day = Math.floor(from / DAY); day * DAY < to; day++) {
    for (let index = 0; index < thing.changes; index++) {
      const at = day * DAY + (0.3 + (index + noise(day * 17 + index) * 0.4) / thing.changes) * DAY;
      if (at < from || at > to) continue;
      // on, then what it does between, then off: a media player pauses, a vacuum returns before it docks
      const state =
        index % 2 === 0 ? thing.on : thing.between && index % 4 === 1 ? thing.between : thing.off;
      out.push({ t: at, state });
      // a thing that goes away leaves the recorder with nothing for a while
      if (thing.away && index % 3 === 2 && at + DAY / 24 < to)
        out.push({ t: at + DAY / 48, state: 'unavailable' });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

interface Mode {
  readonly live: boolean;
  readonly slow: boolean;
  readonly empty: boolean;
  readonly many: boolean;
  readonly statesOnly: boolean;
}

/** The things a house shows: its own, and the ten more that make a card count what it cannot draw. */
const thingsOf = (mode: Pick<Mode, 'many' | 'statesOnly'>): readonly Thing[] =>
  mode.many || mode.statesOnly ? [...THINGS, ...MORE_THINGS] : THINGS;

/** A house that answers the History page's questions the way Home Assistant does. */
export function historyHass(base: HomeAssistant, lang: 'en' | 'es', mode: Mode): HomeAssistant {
  const measures = mode.statesOnly ? [] : [...MEASURES, ...(mode.many ? MORE : [])];
  const states: Record<string, HassEntity> = { ...base.states };
  const entities: Record<string, unknown> = {};
  const devices: Record<string, unknown> = {};
  const areas: Record<string, unknown> = {};
  for (const [id, name] of Object.entries(AREAS)) areas[id] = { area_id: id, name: name[lang] };
  const register = (
    id: string,
    name: string,
    area: string,
    attributes: Record<string, unknown>,
    state: string,
  ): void => {
    const device = `dev-${id.split('.')[1]}`;
    states[id] = {
      entity_id: id,
      state,
      attributes: { friendly_name: name, ...attributes },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };
    devices[device] ??= { id: device, name, name_by_user: null, area_id: area };
    entities[id] = {
      entity_id: id,
      device_id: device,
      area_id: null,
      platform: 'demo',
      entity_category: null,
    };
  };
  for (const measure of measures)
    register(
      measure.id,
      measure.name[lang],
      measure.area,
      {
        unit_of_measurement: measure.unit,
        device_class: measure.deviceClass,
        state_class: 'measurement',
      },
      String(reading(measure, Date.now())),
    );
  for (const thing of thingsOf(mode))
    register(thing.id, thing.name[lang], thing.area, thing.attributes ?? {}, thing.off);

  const rows = (
    id: string,
    start: number,
    end: number,
    step: number,
  ): { s: string; lu: number }[] => {
    const measure = measures.find((m) => m.id === id);
    if (measure)
      return Array.from({ length: Math.max(2, Math.ceil((end - start) / step)) }, (_, index) => {
        const t = Math.min(end, start + index * step);
        return { s: String(reading(measure, t)), lu: t / 1000 };
      });
    const thing = thingsOf(mode).find((t) => t.id === id);
    if (!thing) return [];
    const changes = stretches(thing, start, end);
    return [
      { s: thing.off, lu: start / 1000 },
      ...changes.map((c) => ({ s: c.state, lu: c.t / 1000 })),
    ];
  };

  const subscribe = async <T>(
    callback: (message: T) => void,
    message: { type: string; [key: string]: unknown },
  ): Promise<() => void> => {
    if (message.type !== 'history/stream')
      return base.connection.subscribeMessage(callback, message);
    const start = Date.parse(String(message['start_time']));
    const end = Math.min(Date.parse(String(message['end_time'])), Date.now());
    const wanted = (message['entity_ids'] as readonly string[] | undefined) ?? [];
    const step = Math.max(60_000, Math.round((end - start) / 240));
    const send = callback as (message: {
      states: Record<string, { s: string; lu: number }[]>;
      start_time?: number;
    }) => void;
    let timer = 0;
    const answer = (): void => {
      if (mode.empty) {
        send({ states: {}, start_time: start / 1000 });
        return;
      }
      const chunk: Record<string, { s: string; lu: number }[]> = {};
      for (const id of wanted) {
        const kept = rows(id, start, end, step);
        if (kept.length) chunk[id] = kept;
      }
      send({ states: chunk, start_time: start / 1000 });
      if (mode.live && end >= Date.now() - HOUR)
        timer = window.setInterval(() => {
          const live: Record<string, { s: string; lu: number }[]> = {};
          for (const id of wanted) {
            const measure = measures.find((m) => m.id === id);
            if (measure)
              live[id] = [{ s: String(reading(measure, Date.now())), lu: Date.now() / 1000 }];
          }
          if (Object.keys(live).length) send({ states: live });
        }, 5000);
    };
    if (mode.slow) setTimeout(answer, 60_000);
    else setTimeout(answer, 220);
    return () => clearInterval(timer);
  };

  const callWS = async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
    if (message.type === 'recorder/statistics_during_period') {
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time'] ?? new Date().toISOString()));
      const period = String(message['period'] ?? 'hour');
      const step = period === 'day' ? DAY : HOUR;
      const ids = (message['statistic_ids'] as readonly string[] | undefined) ?? [];
      const out: Record<string, unknown[]> = {};
      for (const id of ids) {
        const measure = measures.find((m) => m.id === id);
        if (!measure) continue;
        const periods: unknown[] = [];
        for (let t = Math.ceil(start / step) * step; t < Math.min(end, Date.now()); t += step) {
          const inside = Array.from({ length: 6 }, (_, index) =>
            reading(measure, t + (index * step) / 6),
          );
          periods.push({
            start: t,
            end: t + step,
            mean: Math.round((inside.reduce((sum, v) => sum + v, 0) / inside.length) * 10) / 10,
            min: Math.min(...inside),
            max: Math.max(...inside),
          });
        }
        out[id] = periods;
      }
      return out as T;
    }
    if (message.type === 'entity/source') return {} as T;
    return base.callWS<T>(message as never);
  };

  return {
    ...base,
    states,
    entities: entities as HomeAssistant['entities'],
    devices: devices as HomeAssistant['devices'],
    areas: areas as HomeAssistant['areas'],
    callWS,
    connection: { ...base.connection, subscribeMessage: subscribe } as HomeAssistant['connection'],
  };
}

interface View extends HTMLElement {
  hass?: HomeAssistant;
  narrow?: boolean;
  range?: { start: number; end: number };
  goTo?: (range: { start: number; end: number }) => void;
  layers?: { show(which: 'picking' | 'sourcing'): void };
  scrubber?: { value: number | null };
  requestUpdate?: () => void;
  setTarget?: (target: Record<string, string[]>) => void;
}

/** The moment a screenshot wants: a window, what is picked, and a layer open. */
async function reach(view: View, moment: HistoryMoment): Promise<void> {
  const now = Date.now();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  if (moment === 'week') view.goTo?.({ start: midnight - 6 * DAY, end: midnight + DAY });
  if (moment === 'month') view.goTo?.({ start: midnight - 29 * DAY, end: midnight + DAY });
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (moment === 'sources') view.layers?.show('sourcing');
  if (moment === 'dates') view.layers?.show('picking');
  // a finger held two thirds of the way through the window: every chart reads that instant
  if (moment === 'scrub' && view.scrubber) {
    view.scrubber.value = 0.66;
    view.requestUpdate?.();
  }
}

export function mountHistory(
  stage: HTMLElement,
  base: HomeAssistant,
  lang: string,
  live: boolean,
  moment?: HistoryMoment,
): void {
  const language = lang === 'es' ? 'es' : 'en';
  const hass = historyHass(base, language, {
    live,
    slow: moment === 'loading',
    empty: moment === 'empty',
    many: moment === 'many',
    statesOnly: moment === 'states',
  });
  const view = document.createElement('fluvy-history') as View;
  view.hass = hass;
  view.narrow = window.innerWidth < 870;
  stage.classList.add('pg-panel');
  stage.append(view);
  window.addEventListener('resize', () => {
    view.narrow = window.innerWidth < 870;
  });
  // the page starts on what the house picked last: here, the whole made-up house
  const ids = [...MEASURES, ...(moment === 'many' ? MORE : [])].map((m) => m.id);
  const things = thingsOf({ many: moment === 'many', statesOnly: moment === 'states' }).map(
    (t) => t.id,
  );
  view.setTarget?.({ entity_id: moment === 'states' ? things : [...ids, ...things] });
  if (moment) setTimeout(() => void reach(view, moment), 500);
}
