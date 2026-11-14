import {
  formatNumber,
  isUsable,
  localize,
  numberAttr,
  stateText,
  type EntityView,
  type HomeAssistant,
  type MessageKey,
} from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import { onItsDevice } from '../shared/battery.js';
import { haWord, pretty } from '../shared/mode-words.js';

/*
 * What a thermostat is doing (1.21, #185), read once for everything that says it: the Thermostat card's head, its
 * details sheet, a climate's tile and a room's climate row. It travels with the card (the `climate` chunk): the tile
 * and the room, which every page carries, reach it where they are asked to say it (`climate-family.ts`).
 */

/** What may be asked of the reading beyond the action, each off until asked. */
export interface DoingAsk {
  /** Another entity whose state says the action, for an integration that sends no `hvac_action`. */
  state_entity?: string;
  /**
   * "Window open" while a window or a door is: as the thermostat says so itself, as the sensor named says
   * (`window_entity`), else as one on its own device does; and what else Better Thermostat says holds the heating back.
   */
  show_window?: boolean;
  window_entity?: string;
}

/** What a thermostat is doing, as a head says it. */
export interface Doing {
  /** The word: Home Assistant's own (the integration's) where Fluvy speaks the page's language, else Fluvy's. */
  readonly text: string;
  /** Fluvy's word where another is said: what a line too narrow for that one says. */
  readonly short?: string;
  /** The tone the word wears: its action's, never its mode's — idle and off are quiet, an open window a warning. */
  readonly tone: Tone;
}

/** Who reads: the house in the language Fluvy speaks, and as the page has it (Home Assistant's own words). */
export interface DoingHost {
  readonly hass: HomeAssistant | undefined;
  readonly rawHass: HomeAssistant | undefined;
}

/**
 * The tone an action's word wears, by what Home Assistant calls it (a climate's `hvac_action`, a humidifier's
 * `action`): what the device is doing, whatever mode it is in. Idle and off are quiet.
 */
const ACTION_TONE: ReadonlyMap<string, Tone> = new Map([
  ['preheating', 'heat'],
  ['heating', 'heat'],
  ['defrosting', 'heat'],
  ['cooling', 'cool'],
  ['drying', 'dry'],
  ['fan', 'fan'],
  ['humidifying', 'water'],
  ['idle', 'neutral'],
  ['off', 'neutral'],
]);
/** What a mode does while it runs: what a switch that is on says of a thermostat in it (heating in any other). */
const RUNS: Readonly<Record<string, string>> = { cool: 'cooling', dry: 'drying', fan_only: 'fan' };

/** The window or door sensor on a thermostat's own device: a valve that senses an open window says so by one. */
export const windowSensor = onItsDevice(
  (id, hass) =>
    id.startsWith('binary_sensor.') &&
    /^(window|door|opening)$/.test(String(hass.states[id]?.attributes.device_class)),
);

/**
 * Whether a window or a door stands open by a thermostat, as it says so itself (Better Thermostat's
 * `heating_blocked_by`, a climate's `window_open` and `door_open`) or as a sensor does (`named`, else the one on its
 * own device): which of the two is open, `false` where all it reads is shut, undefined where it has nothing to read.
 */
export function opening(
  hass: HomeAssistant | undefined,
  view: EntityView,
  named?: string,
): 'window' | 'door' | false | undefined {
  const blocked = view.attr<unknown>('heating_blocked_by');
  if (blocked === 'window' || blocked === 'door') return blocked;
  const [window, door] = [view.attr<unknown>('window_open'), view.attr<unknown>('door_open')];
  if (window === true) return 'window';
  if (door === true) return 'door';
  const sensor = hass?.states[named || windowSensor(hass, view.id) || ''];
  if (sensor?.state === 'on') return sensor.attributes.device_class === 'door' ? 'door' : 'window';
  return sensor || window === false || door === false ? false : undefined;
}

/**
 * What another entity's state says a thermostat is doing (`state_entity`): one of Home Assistant's actions as it is;
 * a switch that is on, what the thermostat's mode does; off, idle. None where it says nothing of the kind.
 */
function stated(
  hass: HomeAssistant | undefined,
  id: string | undefined,
  state: string,
): string | undefined {
  const said = hass?.states[id ?? '']?.state.toLowerCase();
  if (said === 'on') return RUNS[state] ?? 'heating';
  if (said === 'off') return state === 'off' ? 'off' : 'idle';
  return said && ACTION_TONE.has(said) ? said : undefined;
}

/** Home Assistant's word for a value of an attribute, where Fluvy speaks the page's language and it has one. */
const haSaid = (
  host: DoingHost,
  view: EntityView,
  attribute: string,
  value: string,
): string | undefined => {
  const stateObj = view.stateObj;
  return stateObj
    ? haWord(host.rawHass, value, (h) => h.formatEntityAttributeValue?.(stateObj, attribute, value))
    : undefined;
};

/**
 * What a thermostat is doing — a climate, a water heater or a humidifier, in the state it shows (`state`: the expected
 * one while a change is in flight): out of reach; then, where asked (`show_window`, `window_entity`) and while it is
 * on, a window or a door open and what else Better Thermostat says holds the heating back, in its word; then its
 * action — another entity's (`state_entity`), else its own `hvac_action` or a humidifier's `action` — in Home
 * Assistant's word where Fluvy speaks the page's language, else Fluvy's for the nine Home Assistant knows, else the
 * action, tidied, in the action's tone; else the mode it is in, in the mode's (`tone`).
 */
export function doing(
  host: DoingHost,
  view: EntityView,
  state: string,
  tone: Tone,
  ask: DoingAsk = {},
): Doing {
  if (!isUsable(view)) return { text: stateText(host.hass, view), tone: 'off' };
  const off = state === 'off';
  if (!off && (ask.show_window || ask.window_entity)) {
    const open = opening(host.hass, view, ask.window_entity);
    if (open) return { text: localize(host.hass, `climate.${open}_open`), tone: 'warning' };
    const held = view.attr<unknown>('heating_blocked_by');
    if (typeof held === 'string' && held && held !== 'hvac_off')
      return {
        text: haSaid(host, view, 'heating_blocked_by', held) ?? pretty(held),
        short: localize(host.hass, 'climate.action.idle'),
        tone: 'neutral',
      };
  }
  const attribute = view.domain === 'humidifier' ? 'action' : 'hvac_action';
  const action = stated(host.hass, ask.state_entity, state) ?? view.attr<unknown>(attribute);
  if (typeof action === 'string' && action) {
    const known = ACTION_TONE.get(action);
    const short = known
      ? localize(host.hass, `climate.action.${action}` as MessageKey)
      : pretty(action);
    const said = haSaid(host, view, attribute, action);
    return {
      text: said ?? short,
      ...(said && said !== short ? { short } : {}),
      tone: known ?? tone,
    };
  }
  return {
    text:
      off && view.domain === 'climate'
        ? localize(host.hass, 'climate.mode.off')
        : stateText(host.hass, view),
    tone,
  };
}

/** Degrees as a thermostat writes a target: a tenth where its step is under one. */
export function degrees(
  hass: HomeAssistant | undefined,
  value: number | null | undefined,
  step: number,
): string {
  if (value === undefined || value === null) return '';
  const digits = step < 1 ? 1 : 0;
  return `${formatNumber(hass, value, { digits, minDigits: digits })}°`;
}

/**
 * What a thermostat is set to, as a line says it beside the word: a climate's target ("21.5°": a whole degree in
 * Fahrenheit, a half in Celsius, where the entity says no step), its low and its high while it holds a range
 * ("20–24°"), a humidifier's humidity ("50 %"); none where it is set to nothing.
 */
export function setpoint(hass: HomeAssistant | undefined, view: EntityView, state: string): string {
  if (view.domain === 'humidifier') {
    const humidity = numberAttr(view, 'humidity');
    return humidity === null ? '' : `${formatNumber(hass, humidity, { digits: 0 })} %`;
  }
  const [low, high] = [numberAttr(view, 'target_temp_low'), numberAttr(view, 'target_temp_high')];
  if ((state === 'heat_cool' || state === 'auto') && low !== null && high !== null)
    return `${degrees(hass, low, 1).replace('°', '')}–${degrees(hass, high, 1)}`;
  const step =
    numberAttr(view, 'target_temp_step') ??
    (hass?.config.unit_system.temperature === '°F' ? 1 : 0.5);
  return degrees(hass, numberAttr(view, 'temperature'), step);
}

/**
 * What a line says of a thermostat beside its name (a climate's tile, a room's climate row, where asked): the word and
 * what it is set to ("Heating · 21.5°", "Idle · 21.5°"), the word alone while a window is open or it is off; and the
 * words it gives way to, in order, where a line holds not even its first — Fluvy's own, then the mode.
 */
export function doingLine(
  host: DoingHost,
  view: EntityView,
  state: string,
): { readonly line: string; readonly forms: readonly string[] } {
  const said = doing(host, view, state, 'neutral', { show_window: true });
  const set = said.tone === 'warning' || state === 'off' ? '' : setpoint(host.hass, view, state);
  return {
    line: set ? `${said.text} · ${set}` : said.text,
    forms: [...(said.short ? [said.short] : []), stateText(host.hass, view)],
  };
}
