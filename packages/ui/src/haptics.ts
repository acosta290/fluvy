/**
 * Haptics: one place for every control that buzzes (rulers, dials, the time rail, cards). The companion apps turn the
 * `haptic` event into a real vibration; browsers ignore it. A person can turn them off (Fluvy's preferences), and a
 * fast drag must not machine-gun the phone: ticks of the same source closer than 60 ms are one.
 */
export type HapticKind =
  'success' | 'warning' | 'failure' | 'light' | 'medium' | 'heavy' | 'selection';

let enabled = true;
const lastTick = new WeakMap<EventTarget, number>();
/** Ticks closer than this, from one source, are felt as one. */
const TICK_GAP = 60;

/** Fluvy's preference: haptics on or off, for everything. */
export function setHaptics(on: boolean): void {
  enabled = on;
}

export const hapticsEnabled = (): boolean => enabled;

/** A buzz from `node`; `selection` ticks are thinned to one per 60 ms per source. */
export function haptic(node: EventTarget, kind: HapticKind = 'light'): void {
  if (!enabled) return;
  if (kind === 'selection') {
    const now = performance.now();
    if (now - (lastTick.get(node) ?? -Infinity) < TICK_GAP) return;
    lastTick.set(node, now);
  }
  node.dispatchEvent(new CustomEvent('haptic', { detail: kind, bubbles: true, composed: true }));
}
