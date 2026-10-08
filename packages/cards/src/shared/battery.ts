import type { HomeAssistant } from '@fluvy/core';

/*
 * The battery of what an entity belongs to: the `battery` sensor on the entity's own device — a robot's, a phone's
 * tracker's (Home Assistant keeps a device's battery in a sensor of its own). A sensor found is remembered per entity
 * registry (a new object whenever it changes); one not found is looked for again half a minute later, since a battery
 * whose state arrives after the first look is still to be found, and a card asks on every update.
 */

const found = new WeakMap<object, Map<string, string>>();
const missed = new WeakMap<object, Map<string, number>>();
const LOOK_AGAIN = 30_000;

/** The `battery` sensor on the device `entityId` belongs to, if it has one. */
export function batteryOf(hass: HomeAssistant | undefined, entityId: string): string | undefined {
  const registry = hass?.entities;
  if (!registry || !entityId) return undefined;
  let byEntity = found.get(registry);
  if (!byEntity) found.set(registry, (byEntity = new Map()));
  const known = byEntity.get(entityId);
  if (known) return known;
  let misses = missed.get(registry);
  if (!misses) missed.set(registry, (misses = new Map()));
  const last = misses.get(entityId);
  if (last !== undefined && Date.now() - last < LOOK_AGAIN) return undefined;
  const device = registry[entityId]?.device_id;
  const battery = device
    ? Object.values(registry).find(
        (entry) =>
          entry.device_id === device &&
          entry.entity_id.startsWith('sensor.') &&
          hass.states[entry.entity_id]?.attributes.device_class === 'battery',
      )?.entity_id
    : undefined;
  if (battery) byEntity.set(entityId, battery);
  else misses.set(entityId, Date.now());
  return battery;
}

/** Where a charge is read: a battery sensor's state, or a tracker's own `battery_level` attribute. */
export interface BatterySource {
  readonly entity: string;
  readonly attribute?: 'battery_level';
}

/**
 * A phone's battery, for a person or one tracker: the battery sensor of the tracker they are seen by now (`source`),
 * else of any of their trackers (`device_trackers`); where none has one, a tracker's own `battery_level` (the mobile
 * app's, Life360's, iCloud3's).
 */
export function personBattery(
  hass: HomeAssistant | undefined,
  entityId: string,
): BatterySource | undefined {
  const attributes = hass?.states[entityId]?.attributes ?? {};
  const source = attributes['source'];
  const trackers = attributes['device_trackers'];
  const candidates = entityId.startsWith('person.')
    ? [
        ...(typeof source === 'string' ? [source] : []),
        ...(Array.isArray(trackers)
          ? trackers.filter((t): t is string => typeof t === 'string')
          : []),
      ]
    : [entityId];
  for (const tracker of candidates) {
    const battery = batteryOf(hass, tracker);
    if (battery) return { entity: battery };
  }
  const reporting = candidates.find(
    (tracker) => typeof hass?.states[tracker]?.attributes['battery_level'] === 'number',
  );
  return reporting ? { entity: reporting, attribute: 'battery_level' } : undefined;
}

/** Each device's charging sensor, found once per entity registry: a person's card asks on every update. */
const chargers = new WeakMap<object, Map<string, string | null>>();

/**
 * Whether that battery is charging: its device's charging sensor (a `battery_charging` binary sensor, as Android's
 * companion app has), its battery-state sensor ("Charging", as iOS's has), or the tracker's own word for it.
 */
export function charging(hass: HomeAssistant | undefined, battery: BatterySource): boolean {
  const said = (value: unknown): boolean =>
    typeof value === 'string' && /^charging$/i.test(value.trim());
  if (said(hass?.states[battery.entity]?.attributes['battery_status'])) return true;
  const registry = hass?.entities;
  const device = registry?.[battery.entity]?.device_id;
  if (!registry || !device) return false;
  let byDevice = chargers.get(registry);
  if (!byDevice) chargers.set(registry, (byDevice = new Map()));
  if (!byDevice.has(device))
    byDevice.set(
      device,
      Object.values(registry).find(
        (entry) =>
          entry.device_id === device &&
          ((entry.entity_id.startsWith('binary_sensor.') &&
            hass.states[entry.entity_id]?.attributes.device_class === 'battery_charging') ||
            entry.entity_id.endsWith('_battery_state')),
      )?.entity_id ?? null,
    );
  const sensor = byDevice.get(device);
  const state = sensor ? hass.states[sensor] : undefined;
  if (!sensor || !state) return false;
  return sensor.startsWith('binary_sensor.') ? state.state === 'on' : said(state.state);
}
