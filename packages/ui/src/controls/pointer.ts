import { zoomOf } from './zoom.js';

/**
 * Pointer tracking shared by the ruler, the dial and every control dragged along a track. Pointer Events (not a
 * gesture library): no 10 px dead zone, pointer capture, coalesced moves. Scroll keeps working: the control declares
 * `touch-action: pan-y` (or pan-x), and a finger or a pen claims the drag only once it has moved along the control's
 * own axis more than across it; one that sets off across it is the page's scroll, and the control lets go of it. A
 * gesture the browser takes for itself (`pointercancel`), or whose capture goes without a release, is cancelled, never
 * released: the control puts back what it showed and sends nothing.
 */
export interface DragSample {
  /** Where the pointer is, in viewport pixels (what a `getBoundingClientRect()` compares with). */
  readonly x: number;
  readonly y: number;
  /** How far it has travelled since the press, in the target's OWN pixels: a zoomed control moves by its own length. */
  readonly dx: number;
  readonly dy: number;
  readonly event: PointerEvent;
}

/** The axis a control slides along: `x` across the page, `y` up and down it. */
export type DragAxis = 'x' | 'y';

export interface DragCallbacks {
  /**
   * The control's own axis, read at each press (a ruler may stand vertical). None: any direction drags (a knob on a
   * ring, a surface that keeps the page's scroll off with `touch-action: none`).
   */
  axis?(): DragAxis;
  /** Return false to ignore the gesture (disabled, wrong button…). */
  start(sample: DragSample): boolean;
  move(sample: DragSample): void;
  /** The release. `moved` is false for a tap: the pointer never travelled past the intent threshold. */
  end(sample: DragSample, moved: boolean): void;
  /**
   * The gesture was taken away before its release: the browser took it for a scroll (`pointercancel`), its capture went
   * without one, or a finger set off across the axis. Nothing was chosen: the control goes back to its settled value,
   * sends nothing and taps nothing.
   */
  cancel(): void;
}

const INTENT = 4;

/**
 * Whether a press that has travelled past the intent threshold claims the gesture as a drag: a mouse's always does, as
 * does any pointer on a control with no axis; a finger's or a pen's only once it has moved along the axis more than
 * across it — one that sets off across it is the page's scroll. Where a drag is claimed is decided here alone.
 */
function claims(s: DragSample, axis: DragAxis | undefined): boolean {
  if (!axis || s.event.pointerType === 'mouse') return true;
  const along = Math.abs(axis === 'x' ? s.dx : s.dy);
  const across = Math.abs(axis === 'x' ? s.dy : s.dx);
  return along > across;
}

export function trackDrag(target: HTMLElement, callbacks: DragCallbacks): () => void {
  let id = -1;
  let ox = 0;
  let oy = 0;
  let zoom = 1;
  let moved = false;
  let axis: DragAxis | undefined;

  const sample = (event: PointerEvent): DragSample => ({
    x: event.clientX,
    y: event.clientY,
    dx: (event.clientX - ox) / zoom,
    dy: (event.clientY - oy) / zoom,
    event,
  });

  /** Nothing more of this gesture reaches the control. */
  const free = (pointerId: number): void => {
    id = -1;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  };

  const down = (event: PointerEvent): void => {
    if (id !== -1 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    ox = event.clientX;
    oy = event.clientY;
    zoom = zoomOf(target); // read once: the size cannot change under a finger
    moved = false;
    axis = callbacks.axis?.();
    if (!callbacks.start(sample(event))) return;
    id = event.pointerId;
    try {
      target.setPointerCapture(id);
    } catch {
      /* the pointer is already gone */
    }
  };
  // The browser took the gesture (a scroll), or the capture went without a release (the element is moved in the DOM,
  // another script releases it, the OS takes the pointer): the gesture is cancelled instead of sticking.
  const cancel = (event: PointerEvent): void => {
    if (event.pointerId !== id) return;
    free(event.pointerId);
    callbacks.cancel();
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== id) return;
    const s = sample(event);
    if (!moved) {
      if (Math.hypot(s.dx, s.dy) < INTENT) return;
      // a finger setting off across the axis is the page's scroll: the control lets go, untouched
      if (!claims(s, axis)) {
        cancel(event);
        return;
      }
      moved = true;
    }
    callbacks.move(s);
  };
  const up = (event: PointerEvent): void => {
    if (event.pointerId !== id) return;
    free(event.pointerId);
    callbacks.end(sample(event), moved);
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('lostpointercapture', cancel);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
    target.removeEventListener('lostpointercapture', cancel);
    if (id !== -1) {
      id = -1;
    }
  };
}

/** Precision gain: the further the finger drifts away from the control's axis, the finer the drag (down to 10×). */
export const precisionGain = (offAxis: number): number =>
  Math.min(1, Math.max(0.1, 1 / (1 + Math.max(0, Math.abs(offAxis) - 24) / 48)));

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Snaps to the step grid anchored at `min`, without accumulating float error. `max` is always reachable
 * even when it is off the grid (0–100 by 3, 5–35 by 50): the top of a scale must mean the top.
 * A non-finite value lands on `min`.
 */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  if (!(step > 0)) return clamp(value, min, max);
  const decimals = decimalsOf(step);
  const lower = Number((min + Math.floor((value - min) / step) * step).toFixed(decimals));
  const upper = Number((lower + step).toFixed(decimals));
  if (upper > max) return clamp(value - lower < max - value ? lower : max, min, max);
  return clamp(value - lower < upper - value ? lower : upper, min, max);
}

/** Decimal places a step needs (0.5 → 1, 0.25 → 2, 1e-7 → 6): keeps snapped values free of float noise. */
export function decimalsOf(step: number): number {
  if (!(step > 0)) return 0;
  for (let d = 0; d < 6; d++)
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  return 6;
}

/**
 * A usable [min, max] out of whatever a card passed: NaN falls back, a reversed pair is swapped and an
 * empty range stays empty (the control draws inert instead of dividing by zero).
 */
export function saneRange(
  min: number,
  max: number,
  fallbackMin = 0,
  fallbackMax = 100,
): readonly [number, number] {
  const a = Number.isFinite(min) ? min : fallbackMin;
  const b = Number.isFinite(max) ? max : Number.isFinite(min) ? min : fallbackMax;
  return a <= b ? [a, b] : [b, a];
}

/** The step a control moves by: the card's, or a hundredth of the range when it passed none (0, NaN, negative). */
export function stepOf(step: number, min: number, max: number): number {
  if (step > 0) return step;
  const span = max - min;
  return span > 0 ? span / 100 : 1;
}

/**
 * The value a key asks of a slider-like control (the ARIA slider's keys) from `current`: the arrows a step (five with
 * Shift), Page Up / Down a tenth of the range (at least a step), Home / End its ends. `undefined`: a key the control
 * does not answer, or a chord with Alt, Ctrl or Meta (the page's).
 */
export function keyValue(
  event: KeyboardEvent,
  current: number,
  min: number,
  max: number,
  inc: number,
): number | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  const steps = event.shiftKey ? 5 : 1;
  const big = Math.max(inc, (max - min) / 10);
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return current + inc * steps;
    case 'ArrowLeft':
    case 'ArrowDown':
      return current - inc * steps;
    case 'PageUp':
      return current + big;
    case 'PageDown':
      return current - big;
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return undefined;
  }
}

/* ---------- stepper buttons rendered by templates ---------- */

/** A stepper half as the template renders it: Lit refreshes `fvStep` on every render. */
export interface StepButton extends HTMLElement {
  fvStep?: (direction: 1 | -1) => void;
}

let stepDelay = 0;
let stepInterval = 0;
/** A finger's or a pen's first step, still to take: at its release, or as the repeat starts. */
let stepPending: (() => void) | undefined;

export function stopStepRepeat(): void {
  clearTimeout(stepDelay);
  clearInterval(stepInterval);
  stepDelay = 0;
  stepInterval = 0;
  stepPending = undefined;
}

/** Takes the step a finger's or a pen's press still owes, once. */
function takeStep(): void {
  const step = stepPending;
  stepPending = undefined;
  step?.();
}

/** The release of a stepper half (its `pointerup`): a finger's or a pen's press that has not repeated takes its step. */
export function releaseStepRepeat(): void {
  takeStep();
  stopStepRepeat();
}

/**
 * Press-and-hold repeat for stepper halves rendered by a template. Three things make it safe:
 * the repeat always calls the button's CURRENT handler (the element's `fvStep` property, which the
 * template refreshes on every render — a closure captured at press time would count from a stale
 * value); there is ONE repeat for the whole page, stopped by any pointer end, by the button
 * leaving the document, or by the next press; and a finger or a pen steps only once its press is one —
 * at its release (`releaseStepRepeat`) or as the repeat starts — so a scroll that sets off on a stepper
 * (the browser's `pointercancel`) steps nothing. A mouse steps at the press. A repeat can never outlive
 * its press.
 */
export function startStepRepeat(event: PointerEvent, direction: 1 | -1): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const button = event.currentTarget as StepButton;
  stopStepRepeat();
  const fire = (): void => {
    if (!button.isConnected || (button as unknown as HTMLButtonElement).disabled) {
      stopStepRepeat();
      return;
    }
    button.fvStep?.(direction);
  };
  if (event.pointerType === 'mouse') fire();
  else stepPending = fire;
  stepDelay = window.setTimeout(() => {
    stepInterval = window.setInterval(fire, 110);
    takeStep();
  }, 420);
  window.addEventListener('pointerup', stopStepRepeat, { once: true });
  window.addEventListener('pointercancel', stopStepRepeat, { once: true });
  window.addEventListener('blur', stopStepRepeat, { once: true });
}

/** A tappable surface as the template renders it: Lit refreshes `fvTap` / `fvHold` on every render. */
export interface PressTarget extends HTMLElement {
  fvTap?: () => void;
  fvHold?: () => void;
}

const HOLD_MS = 500;
const HOLD_SLOP = 8; // px of travel that turns a press into a scroll

let pressTarget: PressTarget | null = null;
let pressTimer = 0;
let pressHeld = false;
/** A mouse or pen press that travelled: a drag (a selection, a scroll by hand), whose click is no tap. */
let pressMoved = false;
let pressX = 0;
let pressY = 0;

function cancelHold(): void {
  clearTimeout(pressTimer);
  pressTimer = 0;
}

function movePress(event: PointerEvent): void {
  if (Math.hypot(event.clientX - pressX, event.clientY - pressY) <= HOLD_SLOP) return;
  cancelHold();
  // a finger's pan is the browser's to tell from a tap, and it cancels the click itself; a mouse's drag it does not
  if (event.pointerType !== 'touch') pressMoved = true;
}

function endPress(): void {
  cancelHold();
  window.removeEventListener('pointermove', movePress);
}

/**
 * Tap-or-hold for a whole tile. The hold fires after 500 ms without travel and calls the element's
 * CURRENT `fvHold`; the click that follows is then swallowed, so a hold never also taps — nor does a
 * mouse or pen press that travelled more than 8 px (a drag). One press for the whole page, like the
 * stepper repeat; a new press always starts clean, so a hold whose click never came (touch long-press)
 * cannot swallow the next tap.
 */
export function startPress(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const target = event.currentTarget as PressTarget;
  endPress();
  pressTarget = target;
  pressHeld = false;
  pressMoved = false;
  pressX = event.clientX;
  pressY = event.clientY;
  if (target.fvHold) {
    pressTimer = window.setTimeout(() => {
      pressTimer = 0;
      if (!target.isConnected) return;
      pressHeld = true;
      target.fvHold?.();
    }, HOLD_MS);
  }
  window.addEventListener('pointermove', movePress);
  window.addEventListener('pointerup', endPress, { once: true });
  window.addEventListener('pointercancel', endPress, { once: true });
  window.addEventListener('blur', endPress, { once: true });
}

/**
 * The click of a pressable surface: the tap, unless this press was held (its hold already ran) or dragged. A
 * keyboard's click (Enter, Space: `detail` 0) always taps, whatever press came before — a held touch press whose
 * click never came, a press on a control whose click landed beside it, cannot swallow it. A press on a control inside
 * the surface that holds too (a room's quick action in a head that is the card's button) is the control's: the
 * surface's click, which comes first, leaves it to the control's.
 */
export function clickPress(event: MouseEvent): void {
  const target = event.currentTarget as PressTarget;
  const pressed = event.detail !== 0;
  if (pressed && pressTarget && pressTarget !== target && target.contains(pressTarget)) return;
  const spent = pressed && pressTarget === target && (pressHeld || pressMoved);
  pressHeld = false;
  pressMoved = false;
  pressTarget = null;
  if (spent) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  target.fvTap?.();
}

/** A long press must not open the browser's menu on the tile. */
export function preventMenu(event: Event): void {
  event.preventDefault();
}

/**
 * The keyboard's hold on a surface that holds: the menu key, or Shift+F10 (a still press of 500 ms is a pointer's).
 * The browser's own menu does not open over it.
 */
export const holdKey =
  (hold: (() => void) | undefined) =>
  (event: KeyboardEvent): void => {
    if (hold && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) {
      event.preventDefault();
      hold();
    }
  };
