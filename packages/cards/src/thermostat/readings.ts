import { numberAttr, type EntityView, type HassEntity, type HomeAssistant } from '@fluvy/core';
import { batteryOf, onItsDevice } from '../shared/battery.js';
import { opening, windowSensor, type DoingAsk } from './doing.js';

/*
 * What a thermostat reads beside its target where its card asks (1.21, #185): how far its valve is open, its battery,
 * the window by it, the room's humidity. Each is the entity or the attribute the config names, else found: on the
 * climate itself, on its own device, or on the valves a Better Thermostat drives. Nothing found, nothing said.
 */

/** What a Thermostat card may ask to be read, each off until asked. */
export interface ReadingsAsk extends DoingAsk {
  /**
   * The valve's opening beside the word ("Heating · 42 %"): the entity named (`valve_entity`), the climate's attribute
   * named (`valve_attribute`), else found.
   */
  show_valve?: boolean;
  valve_entity?: string;
  valve_attribute?: string;
  /** A low battery (20 % or less) as the line's first words ("Battery 8 %"): the sensor named, else found. */
  show_battery?: boolean;
  battery_entity?: string;
  /** The room's humidity from another sensor, where the climate measures none or another one. */
  humidity_entity?: string;
}

/** A reading, and the entity whose state holds it where it is not the thermostat's own: its change draws the card. */
export interface Reading {
  readonly value: number;
  readonly entity?: string | undefined;
}

/** A finite number out of what an integration writes: a figure, or one in a text (a sensor's state). */
const finite = (raw: unknown): number | undefined => {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? +raw : NaN;
  return Number.isFinite(value) ? value : undefined;
};
const numberOf = (state: HassEntity | undefined): number | undefined => finite(state?.state);

/** What an integration writes a valve's opening under on the climate itself: generic, ZHA's, Netatmo's. */
const VALVE_ATTRIBUTES = ['valve_position', 'pi_heating_demand', 'heating_power_request'];
/**
 * What a valve's own sensor or number is called on the climate's device, the likeliest first: ZHA's and Zigbee2MQTT's
 * `pi_heating_demand`, `valve_position` and `position`, Tado's `heating`, then `valve_opening_degree`. Each a
 * percentage that reads the valve, never one that sets it: a number among the device's settings (a Sonoff valve's
 * `valve_opening_degree` is how far it may open) is not how far it is open.
 */
const VALVE_SIBLINGS = [
  '_pi_heating_demand',
  '_valve_position',
  '_position',
  '_heating',
  '_valve_opening_degree',
].map((suffix) =>
  onItsDevice(
    (id, hass) =>
      /^(sensor|number)\./.test(id) &&
      id.endsWith(suffix) &&
      hass.entities?.[id]?.entity_category !== 'config' &&
      hass.states[id]?.attributes.unit_of_measurement === '%' &&
      numberOf(hass.states[id]) !== undefined,
  ),
);

/** A percentage as a card writes it: whole, never under 0 nor over 100. */
const percent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

/**
 * The entities a Better Thermostat drives and reads, each with its battery: its `batteries`, a JSON of them by entity
 * id. None for any other thermostat.
 */
function driven(view: EntityView): Readonly<Record<string, { readonly battery?: unknown }>> {
  const raw = view.attr<unknown>('batteries');
  try {
    const read: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return read && typeof read === 'object' ? (read as ReturnType<typeof driven>) : {};
  } catch {
    return {};
  }
}

/** A climate's own valve: the attribute it writes it under, else its sensor or number on the same device. */
function ownValve(hass: HomeAssistant | undefined, id: string): Reading | undefined {
  const attributes = hass?.states[id]?.attributes ?? {};
  for (const key of VALVE_ATTRIBUTES) {
    const value = finite(attributes[key]);
    if (value !== undefined) return { value, entity: id };
  }
  for (const sibling of VALVE_SIBLINGS) {
    const entity = sibling(hass, id);
    const value = numberOf(hass?.states[entity ?? '']);
    if (value !== undefined) return { value, entity };
  }
  return undefined;
}

/**
 * How far the valve is open, in percent: the entity named, the climate's attribute named, else (`show_valve`) the
 * climate's own (`ownValve`), else the most open of the valves a Better Thermostat drives. None where nothing is
 * asked, or nothing found.
 */
export function valveOf(
  hass: HomeAssistant | undefined,
  view: EntityView,
  ask: ReadingsAsk,
): Reading | undefined {
  const named = ask.valve_entity
    ? { value: numberOf(hass?.states[ask.valve_entity]), entity: ask.valve_entity }
    : ask.valve_attribute
      ? { value: finite(view.attr(ask.valve_attribute)) }
      : undefined;
  if (named)
    return named.value === undefined ? undefined : { ...named, value: percent(named.value) };
  if (!ask.show_valve) return undefined;
  const found =
    ownValve(hass, view.id) ??
    Object.keys(driven(view))
      .filter((id) => id.startsWith('climate.') && id !== view.id)
      .map((id) => ownValve(hass, id))
      .filter((valve) => valve !== undefined)
      .sort((a, b) => b.value - a.value)[0];
  return found && { ...found, value: percent(found.value) };
}

/**
 * The battery's charge, in percent: the sensor named, else (`show_battery`) the battery sensor on the climate's own
 * device, else the lowest of those a Better Thermostat reads. None where nothing is asked, or nothing found.
 */
export function batteryLevel(
  hass: HomeAssistant | undefined,
  view: EntityView,
  ask: ReadingsAsk,
): Reading | undefined {
  if (!ask.battery_entity && !ask.show_battery) return undefined;
  const entity = ask.battery_entity || batteryOf(hass, view.id);
  const value = entity
    ? numberOf(hass?.states[entity])
    : Object.values(driven(view))
        .map((device) => finite(device?.battery))
        .filter((level) => level !== undefined)
        .sort((a, b) => a - b)[0];
  return value === undefined ? undefined : { value: percent(value), entity };
}

/**
 * The window by the thermostat where its card asks about it (`show_window`, `window_entity`): open or shut, whether it
 * is a door, and the sensor that says so where one does. None where nothing is asked, or it has nothing to read.
 */
export function windowBy(
  hass: HomeAssistant | undefined,
  view: EntityView,
  ask: ReadingsAsk,
):
  | { readonly open: boolean; readonly door: boolean; readonly entity?: string | undefined }
  | undefined {
  if (!ask.window_entity && !ask.show_window) return undefined;
  const open = opening(hass, view, ask.window_entity);
  if (open === undefined) return undefined;
  const entity = ask.window_entity || windowSensor(hass, view.id);
  return {
    open: open !== false,
    door: open ? open === 'door' : hass?.states[entity ?? '']?.attributes.device_class === 'door',
    entity,
  };
}

/** The room's humidity by a climate: the sensor named (`humidity_entity`), else what it measures; none where neither. */
export function humidityOf(
  hass: HomeAssistant | undefined,
  view: EntityView,
  ask: ReadingsAsk,
): Reading | undefined {
  if (view.domain !== 'climate') return undefined;
  const value = ask.humidity_entity
    ? numberOf(hass?.states[ask.humidity_entity])
    : (numberAttr(view, 'current_humidity') ?? undefined);
  return value === undefined ? undefined : { value, entity: ask.humidity_entity };
}
