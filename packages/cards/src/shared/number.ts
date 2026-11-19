import { formatNumber, numberAttr, type EntityView, type HomeAssistant } from '@fluvy/core';
import type { ControlHost } from './base.js';

/*
 * A number of Home Assistant's (an `input_number`, a `number`, a `counter`) as a control sets it: its range and its
 * step, the figure it shows, and one step from it. The Helpers card's value and stepper; the controls that set one in
 * place (a row's on the Entities card, a figure typed, #218) are a chunk of their own (`number-controls.ts`).
 */

/** The domains of a number a control sets. */
export const NUMBERS: ReadonlySet<string> = new Set(['input_number', 'number', 'counter']);

export interface NumberModel {
  readonly counter: boolean;
  /** Null = unbounded (a counter without a minimum or a maximum). */
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number;
  readonly digits: number;
  /** The value to draw: under the finger, else expected, else reported. Null when there is none. */
  readonly value: number | null;
  readonly unusable: boolean;
}

const decimals = (step: number): number => {
  if (Number.isInteger(step)) return 0;
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : Math.min(3, text.length - dot - 1);
};

/**
 * A number as its control sees it: `shown` the state on screen (the one asked for until the house answers), `preview`
 * the value under the finger while a ruler is dragged.
 */
export function numberModel(
  view: EntityView,
  shown: string,
  unusable: boolean,
  preview?: number,
): NumberModel {
  const counter = view.domain === 'counter';
  const step = Math.abs(numberAttr(view, 'step') ?? 1) || 1;
  const expected = Number(shown);
  return {
    counter,
    min: numberAttr(view, counter ? 'minimum' : 'min') ?? (counter ? null : 0),
    max: numberAttr(view, counter ? 'maximum' : 'max') ?? (counter ? null : 100),
    step,
    digits: decimals(step),
    value: unusable ? null : (preview ?? (Number.isFinite(expected) ? expected : view.number)),
    unusable,
  };
}

/** Past this many stops a scale stops being a slider (Home Assistant's own rule for `mode: auto`). */
const MAX_STOPS = 256;

/** What says whether a number draws its ruler: its domain's kind, the mode it asks for, its range and its step. */
export interface RulerShape {
  readonly counter: boolean;
  readonly mode: unknown;
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number;
}

/**
 * Whether a number draws its ruler under its figure and stepper: never a counter (a figure stepped), nor one that asks
 * for a box, nor a range a ruler cannot resolve (none, or past 256 stops unless it asks for a slider). The Helpers card
 * draws by it and the house's heights count by it.
 */
export const drawsRuler = ({ counter, mode, min, max, step }: RulerShape): boolean => {
  if (counter || mode === 'box' || min === null || max === null) return false;
  const span = max - min;
  return span > 0 && (mode === 'slider' || span / step <= MAX_STOPS);
};

/** A figure in the number's own digits (its step's), "—" for none. */
export const numberText = (
  hass: HomeAssistant | undefined,
  m: NumberModel,
  value: number | null = m.value,
): string =>
  value === null ? '—' : formatNumber(hass, value, { digits: m.digits, minDigits: m.digits });

/** Sets the number to `value`, shown at once: a held stepper counts on from it, not from the last report. */
export function send(host: ControlHost, view: EntityView, value: number): void {
  host.expect(view.id, String(value));
  host.call(view.domain, 'set_value', { value }, view.id);
}

/** One step from the value on screen, on the number's own grid and inside its range. */
export function nudge(
  host: ControlHost,
  view: EntityView,
  m: NumberModel,
  direction: 1 | -1,
): void {
  const from = m.value ?? m.min ?? 0;
  const origin = m.min ?? 0;
  const stepped = Math.round((from + direction * m.step - origin) / m.step) * m.step + origin;
  const next = Number(
    Math.min(m.max ?? Infinity, Math.max(m.min ?? -Infinity, stepped)).toFixed(m.digits),
  );
  if (next === m.value) return; // already at the end of the range
  if (!m.counter) send(host, view, next);
  else {
    host.expect(view.id, String(next));
    host.call('counter', direction > 0 ? 'increment' : 'decrement', {}, view.id);
  }
}

export type NumberControls = typeof import('./number-controls.js');
let controls: NumberControls | null | undefined;
let fetching: Promise<unknown> | undefined;

const landing = (): Promise<void> =>
  (fetching ??= import('./number-controls.js').then(
    (module) => (controls = module),
    () => (controls = null),
  )).then(() => undefined);

/**
 * The controls that set a number in place (`number-controls.ts`, a chunk of its own, #218), once the first card that
 * asks for them has fetched them: none while they are on their way — `card` draws again as they land — and `null` where
 * they cannot be fetched: its numbers then say their values, as before.
 */
export function numberControls(card: { requestUpdate(): void }): NumberControls | null | undefined {
  if (controls === undefined) void landing().then(() => card.requestUpdate());
  return controls;
}

/** The controls' fetch, the first frame of a card that asks for them waiting on it (`wearing`); none once it is over. */
export const numbersLanding = (): Promise<void> | undefined =>
  controls === undefined ? landing() : undefined;
