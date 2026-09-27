import { domainOf } from '../entity.js';
import type { HomeAssistant } from '../ha/types.js';
import type { ActivityCategory, ActivityEvent } from './types.js';

const BY_DOMAIN: Readonly<Record<string, ActivityCategory>> = {
  light: 'lights',
  climate: 'climate',
  fan: 'climate',
  humidifier: 'climate',
  water_heater: 'climate',
  weather: 'climate',
  media_player: 'media',
  remote: 'media',
  lock: 'security',
  alarm_control_panel: 'security',
  camera: 'security',
  siren: 'security',
  person: 'people',
  device_tracker: 'people',
  zone: 'people',
  automation: 'automations',
  script: 'automations',
  scene: 'automations',
  homeassistant: 'system',
  update: 'system',
  number: 'system',
  select: 'system',
  text: 'system',
  button: 'system',
  input_number: 'system',
  input_select: 'system',
  input_text: 'system',
  input_datetime: 'system',
  input_button: 'system',
  image: 'system',
  sun: 'system',
  event: 'devices',
};

/** Binary sensors that keep a house safe (an open door, smoke, a leak) — the rest are devices. */
const SECURITY_CLASSES = new Set([
  'door',
  'window',
  'garage_door',
  'opening',
  'motion',
  'occupancy',
  'presence',
  'smoke',
  'gas',
  'carbon_monoxide',
  'moisture',
  'safety',
  'tamper',
  'vibration',
  'sound',
  'lock',
]);

/** Integrations that report on Home Assistant itself (backups, the supervisor, updates, the sun): the system's. */
const SYSTEM_PLATFORMS = new Set([
  'backup',
  'hassio',
  'hacs',
  'sun',
  'version',
  'uptime',
  'systemmonitor',
  'speedtestdotnet',
  'fastdotcom',
]);

export const eventDomain = (event: ActivityEvent): string =>
  event.domain ?? (event.entity_id ? domainOf(event.entity_id) : '');

/** The category an entry belongs to; a configuration or diagnostic entity is the system's, whatever its domain. */
export function categoryOf(event: ActivityEvent, hass: HomeAssistant): ActivityCategory {
  const id = event.entity_id;
  const entry = id ? hass.entities?.[id] : undefined;
  if (entry?.entity_category || SYSTEM_PLATFORMS.has(entry?.platform ?? '')) return 'system';
  let domain = eventDomain(event);
  // a group is filed with what it holds (all the lamps: the lights)
  const members = id && domain === 'group' ? hass.states[id]?.attributes['entity_id'] : undefined;
  if (Array.isArray(members) && typeof members[0] === 'string') domain = domainOf(members[0]);
  const deviceClass = id ? hass.states[id]?.attributes.device_class : undefined;
  if (domain === 'binary_sensor')
    return typeof deviceClass === 'string' && SECURITY_CLASSES.has(deviceClass)
      ? 'security'
      : 'devices';
  if (domain === 'sensor') return deviceClass === 'timestamp' ? 'system' : 'devices';
  return BY_DOMAIN[domain] ?? 'devices';
}

/**
 * Noise to someone asking "what happened today": the system's settings, updates and diagnostics. The highlights
 * leave it out; a restart of Home Assistant itself is never noise.
 */
export const isQuiet = (event: ActivityEvent, hass: HomeAssistant): boolean =>
  categoryOf(event, hass) === 'system' && eventDomain(event) !== 'homeassistant';
