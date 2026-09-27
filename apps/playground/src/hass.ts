import type { HassEntity, HomeAssistant } from '@fluvy/core';

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

  const apply = (
    domain: string,
    service: string,
    data: Record<string, unknown>,
    ids: string[],
  ): void => {
    for (const id of ids) {
      const s = states[id];
      if (!s) continue;
      const a = s.attributes;
      switch (`${domain}.${service}`) {
        case 'homeassistant.turn_on':
        case 'switch.turn_on':
        case 'input_boolean.turn_on':
        case 'fan.turn_on':
        case 'humidifier.turn_on':
          set(id, 'on');
          break;
        case 'homeassistant.turn_off':
        case 'switch.turn_off':
        case 'input_boolean.turn_off':
        case 'fan.turn_off':
        case 'light.turn_off':
        case 'humidifier.turn_off':
          set(id, 'off');
          break;
        case 'light.turn_on':
          set(id, 'on', {
            ...(data['brightness_pct'] !== undefined
              ? { brightness: Math.round((Number(data['brightness_pct']) / 100) * 255) }
              : a['brightness']
                ? {}
                : { brightness: 178 }),
            ...(data['color_temp_kelvin'] !== undefined
              ? { color_temp_kelvin: data['color_temp_kelvin'] }
              : {}),
          });
          break;
        case 'cover.open_cover':
          set(id, 'open', { current_position: 100 });
          break;
        case 'cover.close_cover':
          set(id, 'closed', { current_position: 0 });
          break;
        case 'cover.stop_cover':
          break;
        case 'cover.set_cover_position':
          set(id, Number(data['position']) > 0 ? 'open' : 'closed', {
            current_position: data['position'],
          });
          break;
        case 'cover.set_cover_tilt_position':
          set(id, undefined, { current_tilt_position: data['tilt_position'] });
          break;
        case 'cover.open_cover_tilt':
          set(id, undefined, { current_tilt_position: 100 });
          break;
        case 'cover.close_cover_tilt':
          set(id, undefined, { current_tilt_position: 0 });
          break;
        case 'fan.set_percentage':
          set(id, Number(data['percentage']) > 0 ? 'on' : 'off', {
            percentage: data['percentage'],
          });
          break;
        case 'fan.oscillate':
          set(id, undefined, { oscillating: data['oscillating'] });
          break;
        case 'fan.set_preset_mode':
          set(id, undefined, { preset_mode: data['preset_mode'] });
          break;
        case 'fan.set_direction':
          set(id, undefined, { direction: data['direction'] });
          break;
        case 'climate.set_temperature':
          set(id, undefined, {
            ...(data['temperature'] !== undefined ? { temperature: data['temperature'] } : {}),
            ...(data['target_temp_low'] !== undefined
              ? {
                  target_temp_low: data['target_temp_low'],
                  target_temp_high: data['target_temp_high'],
                }
              : {}),
          });
          break;
        case 'climate.set_hvac_mode':
          set(id, String(data['hvac_mode']), {
            hvac_action:
              data['hvac_mode'] === 'off'
                ? 'off'
                : data['hvac_mode'] === 'cool'
                  ? 'cooling'
                  : data['hvac_mode'] === 'heat'
                    ? 'heating'
                    : 'idle',
          });
          break;
        case 'climate.set_preset_mode':
          set(id, undefined, { preset_mode: data['preset_mode'] });
          break;
        case 'climate.set_fan_mode':
          set(id, undefined, { fan_mode: data['fan_mode'] });
          break;
        case 'water_heater.set_temperature':
          set(id, undefined, { temperature: data['temperature'] });
          break;
        case 'water_heater.set_operation_mode':
          set(id, String(data['operation_mode']));
          break;
        case 'humidifier.set_humidity':
          set(id, undefined, { humidity: data['humidity'] });
          break;
        case 'media_player.media_play_pause':
          set(id, s.state === 'playing' ? 'paused' : 'playing');
          break;
        case 'media_player.media_play':
          set(id, 'playing');
          break;
        case 'media_player.media_pause':
          set(id, 'paused');
          break;
        case 'media_player.volume_set':
          set(id, undefined, { volume_level: data['volume_level'] });
          break;
        case 'media_player.volume_mute':
          set(id, undefined, { is_volume_muted: data['is_volume_muted'] });
          break;
        case 'media_player.select_source':
          set(id, undefined, { source: data['source'] });
          break;
        case 'media_player.shuffle_set':
          set(id, undefined, { shuffle: data['shuffle'] });
          break;
        case 'media_player.repeat_set':
          set(id, undefined, { repeat: data['repeat'] });
          break;
        case 'media_player.media_next_track':
        case 'media_player.media_previous_track':
          set(id, undefined, { media_position: 0, media_position_updated_at: iso(new Date()) });
          break;
        case 'media_player.media_seek':
          set(id, undefined, {
            media_position: Number(data['seek_position']),
            media_position_updated_at: iso(new Date()),
          });
          break;
        case 'media_player.turn_on':
          set(id, 'idle');
          break;
        case 'media_player.turn_off':
          set(id, 'off');
          break;
        case 'vacuum.start':
          set(id, 'cleaning');
          break;
        case 'vacuum.pause':
          set(id, 'paused');
          break;
        case 'vacuum.stop':
          set(id, 'idle');
          break;
        case 'vacuum.return_to_base':
          set(id, 'returning');
          break;
        case 'vacuum.set_fan_speed':
          set(id, undefined, { fan_speed: data['fan_speed'] });
          break;
        case 'lawn_mower.start_mowing':
          set(id, 'mowing');
          break;
        case 'lawn_mower.pause':
          set(id, 'paused');
          break;
        case 'lawn_mower.dock':
          set(id, 'docked');
          break;
        case 'lock.lock':
          set(id, 'locked');
          break;
        case 'lock.unlock':
          set(id, 'unlocked');
          break;
        case 'lock.open':
          set(id, 'open');
          break;
        case 'alarm_control_panel.alarm_disarm':
          set(id, 'disarmed');
          break;
        case 'alarm_control_panel.alarm_arm_home':
          set(id, 'armed_home');
          break;
        case 'alarm_control_panel.alarm_arm_away':
          set(id, 'armed_away');
          break;
        case 'alarm_control_panel.alarm_arm_night':
          set(id, 'armed_night');
          break;
        case 'alarm_control_panel.alarm_arm_vacation':
          set(id, 'armed_vacation');
          break;
        case 'alarm_control_panel.alarm_arm_custom_bypass':
          set(id, 'armed_custom_bypass');
          break;
        case 'input_number.set_value':
        case 'number.set_value':
          set(id, String(data['value']));
          break;
        case 'input_select.select_option':
        case 'select.select_option':
          set(id, String(data['option']));
          break;
        case 'input_text.set_value':
        case 'text.set_value':
          set(id, String(data['value']));
          break;
        case 'timer.start':
          set(id, 'active');
          break;
        case 'timer.pause':
          set(id, 'paused');
          break;
        case 'timer.cancel':
          set(id, 'idle');
          break;
        case 'scene.turn_on':
        case 'script.turn_on':
        case 'button.press':
        case 'input_button.press':
          set(id, iso(new Date()));
          break;
        case 'timer.finish':
          set(id, 'idle', { remaining: '0:00:00' });
          break;
        case 'counter.increment':
          set(id, String(Number(s.state || 0) + Number(a['step'] ?? 1)));
          break;
        case 'counter.decrement':
          set(id, String(Number(s.state || 0) - Number(a['step'] ?? 1)));
          break;
        case 'counter.reset':
          set(id, String(Number(a['initial'] ?? 0)));
          break;
        case 'automation.trigger':
          set(id, undefined, { last_triggered: iso(new Date()) });
          break;
        case 'update.install':
          set(id, undefined, { in_progress: true, update_percentage: 0 });
          break;
        case 'todo.add_item':
          set(id, String(Number(s.state || 0) + 1));
          break;
        case 'todo.update_item':
          set(
            id,
            String(Math.max(0, Number(s.state || 0) + (data['status'] === 'completed' ? -1 : 1))),
          );
          break;
        case 'todo.remove_item':
          set(id, undefined);
          break;
        case 'valve.open_valve':
          set(id, 'open');
          break;
        case 'valve.close_valve':
          set(id, 'closed');
          break;
        case 'valve.set_valve_position':
          set(id, Number(data['position']) > 0 ? 'open' : 'closed', {
            current_position: data['position'],
          });
          break;
        case 'input_datetime.set_datetime':
        case 'time.set_value':
          if (data['time'] !== undefined) set(id, String(data['time']));
          break;
        default:
          break;
      }
    }
  };

  const build = (): HomeAssistant =>
    ({
      states: { ...states },
      entities: {},
      devices: {},
      areas: {},
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
          apply(domain, service, data, ids);
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
  };
}
