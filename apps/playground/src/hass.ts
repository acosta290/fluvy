import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { simulate } from '@fluvy/demo-home/simulate';

/**
 * A small, honest stand-in for Home Assistant's `hass`: a state store, service calls that change it
 * after a network-like delay, the formatting hooks, and canned answers for the WebSocket reads the
 * cards make (history, statistics, forecasts, to-do items, calendar events).
 */

/** A sample of Home Assistant's Spanish state words (its `es` translations), by domain, device class and state. */
const SPANISH: Record<string, string> = {
  on: 'Encendido',
  off: 'Apagado',
  'light.on': 'Encendida',
  'light.off': 'Apagada',
  'binary_sensor.door.on': 'Abierta',
  'binary_sensor.door.off': 'Cerrada',
  'binary_sensor.window.on': 'Abierta',
  'binary_sensor.window.off': 'Cerrada',
  'binary_sensor.motion.on': 'Detectado',
  'binary_sensor.motion.off': 'Despejado',
  'alarm_control_panel.disarmed': 'Desarmada',
  'alarm_control_panel.armed_night': 'Armada noche',
  'alarm_control_panel.armed_home': 'Armada en casa',
  'alarm_control_panel.armed_away': 'Armada ausente',
  'media_player.playing': 'Reproduciendo',
  'media_player.paused': 'En pausa',
  'media_player.idle': 'Inactivo',
  'cover.open': 'Abierta',
  'cover.closed': 'Cerrada',
  'cover.opening': 'Abriendo',
  'cover.closing': 'Cerrando',
  'lock.locked': 'Bloqueada',
  'lock.unlocked': 'Desbloqueada',
  'vacuum.cleaning': 'Limpiando',
  'vacuum.docked': 'En la base',
  'vacuum.returning': 'Volviendo a la base',
  'person.home': 'En casa',
  'person.not_home': 'Fuera',
  'climate.heat': 'Calor',
  'climate.off': 'Apagado',
};
export type StateSeed = [entityId: string, state: string, attributes?: Record<string, unknown>];

type Listener = (hass: HomeAssistant) => void;

const LATENCY = 140;

export interface MockOptions {
  readonly dark?: boolean;
  readonly language?: string;
  readonly now?: Date;
  /** The registries a sheet needs beyond its states (areas, floors, devices, entity entries). */
  readonly registry?: Partial<Pick<HomeAssistant, 'entities' | 'devices' | 'areas' | 'floors'>>;
  readonly history?: Record<string, readonly number[]>;
  readonly ws?: Record<string, (message: Record<string, unknown>) => unknown>;
  readonly api?: (method: string, path: string) => unknown;
}

const iso = (date: Date): string => date.toISOString();

export function createHass(
  seeds: readonly StateSeed[],
  options: MockOptions = {},
): {
  hass: () => HomeAssistant;
  subscribe: (l: Listener) => () => void;
  calls: Array<{ domain: string; service: string; data: unknown; target: unknown }>;
  /** Changes a state (and attributes) at once and tells every listener, as a recorder update would. */
  set: (id: string, state?: string, attributes?: Record<string, unknown>) => void;
} {
  const now = options.now ?? new Date();
  const states: Record<string, HassEntity> = {};
  for (const [entity_id, state, attributes] of seeds) {
    states[entity_id] = {
      entity_id,
      state,
      attributes: { friendly_name: entity_id, ...attributes },
      last_changed: iso(new Date(now.getTime() - 2 * 3600_000)),
      last_updated: iso(now),
    };
  }
  const listeners = new Set<Listener>();
  const calls: Array<{ domain: string; service: string; data: unknown; target: unknown }> = [];
  let current: HomeAssistant;

  const set = (
    id: string,
    state: string | undefined,
    attrs: Record<string, unknown> = {},
  ): void => {
    const previous = states[id];
    if (!previous) return;
    states[id] = {
      ...previous,
      state: state ?? previous.state,
      attributes: { ...previous.attributes, ...attrs },
      last_changed: iso(new Date()),
      last_updated: iso(new Date()),
    };
  };

  const build = (): HomeAssistant =>
    ({
      states: { ...states },
      entities: options.registry?.entities ?? {},
      devices: options.registry?.devices ?? {},
      areas: options.registry?.areas ?? {},
      ...(options.registry?.floors ? { floors: options.registry.floors } : {}),
      themes: {
        default_theme: 'Fluvy',
        themes: {},
        darkMode: options.dark ?? false,
        theme: 'Fluvy',
      },
      locale: { language: options.language ?? 'en', number_format: 'language', time_format: '24' },
      language: options.language ?? 'en',
      config: {
        unit_system: { temperature: '°C', length: 'km' },
        currency: 'EUR',
        time_zone: 'Europe/Madrid',
      },
      user: { id: 'u1', name: 'Marta', is_admin: true },
      connection: {
        subscribeMessage: async <T>(
          callback: (message: T) => void,
          message: { type: string; [k: string]: unknown },
        ) => {
          const handler = options.ws?.[message.type];
          if (handler) setTimeout(() => callback(handler(message) as T), 30);
          return () => undefined;
        },
      },
      callService: async (domain, service, data = {}, target) => {
        calls.push({ domain, service, data, target });
        const ids = ([] as string[]).concat(
          (target?.entity_id as string | string[] | undefined) ??
            (data['entity_id'] as string | string[] | undefined) ??
            [],
        );
        setTimeout(() => {
          Object.assign(
            states,
            simulate(states, { domain, service, data, target: { entity_id: ids } }, new Date()),
          );
          current = build();
          listeners.forEach((l) => l(current));
        }, LATENCY);
        return undefined;
      },
      callWS: async <T>(message: { type: string; [k: string]: unknown }): Promise<T> => {
        if (message.type === 'history/history_during_period') {
          const id = (message['entity_ids'] as string[])[0] ?? '';
          const series = options.history?.[id] ?? [];
          const start = new Date(String(message['start_time'])).getTime();
          const end = new Date(String(message['end_time'])).getTime();
          return {
            [id]: series.map((v, i) => ({
              s: String(v),
              lu: (start + (i / Math.max(1, series.length - 1)) * (end - start)) / 1000,
            })),
          } as T;
        }
        const handler = options.ws?.[message.type];
        if (handler) return handler(message) as T;
        throw new Error(`mock hass: unhandled WS message ${message.type}`);
      },
      callApi: async <T>(method: string, path: string): Promise<T> =>
        options.api ? (options.api(method, path) as T) : ([] as unknown as T),
      hassUrl: (path = '') => path,
      localize: (key) => key,
      formatEntityState: (stateObj) => {
        const raw = stateObj.state;
        const unit = stateObj.attributes.unit_of_measurement;
        if (unit && Number.isFinite(Number(raw))) return `${raw} ${unit}`;
        // Home Assistant's own words in Spanish (the longest of them are what a pill has to hold)
        if ((options.language ?? 'en') === 'es') {
          const domain = stateObj.entity_id.split('.')[0] ?? '';
          const kind = stateObj.attributes['device_class'];
          const word =
            SPANISH[`${domain}.${String(kind)}.${raw}`] ??
            SPANISH[`${domain}.${raw}`] ??
            SPANISH[raw];
          if (word) return word;
        }
        const text = raw.replace(/_/g, ' ');
        return text.charAt(0).toUpperCase() + text.slice(1);
      },
    }) as HomeAssistant;

  current = build();
  return {
    hass: () => current,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    calls,
    set: (id, state, attributes) => {
      set(id, state, attributes);
      current = build();
      listeners.forEach((l) => l(current));
    },
  };
}
