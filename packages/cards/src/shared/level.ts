import type { RulerWindowDetail } from '@fluvy/ui';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Labels } from './axis.js';

/** How long a choice is held for a device that has not reported it yet. */
const HOLD_MS = 5000;
/** A stepper's burst of taps is one call once they stop: longer than the 530 ms before a held button repeats. */
const BURST_MS = 650;
/** A drag sent as it moves (`live_update`) is sent no more often than this. */
const LIVE_MS = 200;

/**
 * The level a card sets with its ruler and its stepper — the light card's brightness, the Slider card's value: the
 * choice is shown until the device reports it (slow lamps take seconds) or five seconds pass; the value under the
 * finger while a drag is in flight; the ruler's fine scale while it is up. A ruler's choice is sent at once, a
 * stepper's taps as one call once they stop, a drag as it moves where the card asks. One per card:
 * `private readonly level = new Level(this, (value) => …)`.
 */
export class Level implements ReactiveController {
  /** The value under the finger while a drag is in flight. */
  preview: number | null = null;
  /** The ruler's fine scale while it is up: its labels are its majors (`fineLabels`). */
  window: RulerWindowDetail | null = null;
  private held: { readonly value: number; readonly expires: number } | null = null;
  private heldTimer = 0;
  private sendTimer = 0;
  private lastSend = 0;
  private drawn = 0;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly send: (value: number) => void,
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    clearTimeout(this.heldTimer);
    clearTimeout(this.sendTimer);
  }

  /**
   * The level to draw for the one reported: the choice held until the device reports it exactly — a ±1 tolerance would
   * swallow every single step — or its time is up.
   */
  read(reported: number): number {
    if (this.held && (this.held.value === reported || Date.now() > this.held.expires))
      this.held = null;
    this.drawn = this.held ? this.held.value : reported;
    return this.drawn;
  }

  /** The choice held, while it is: what the device is about to report. */
  get chosen(): number | null {
    return this.held?.value ?? null;
  }

  /** The level on screen right now: the stepper counts from here, never from a value captured at render time. */
  get current(): number {
    return this.drawn;
  }

  /** From the ruler: the choice is final, sent now. */
  set(value: number): void {
    this.preview = null;
    this.pin(value);
    clearTimeout(this.sendTimer);
    this.send(value);
  }

  /** From the stepper: every tap counts from what is on screen (`current`), and a burst of taps is one call. */
  step(next: number): void {
    this.pin(next);
    clearTimeout(this.sendTimer);
    this.sendTimer = window.setTimeout(() => this.send(next), BURST_MS);
  }

  /** While the finger moves: the value under it, sent as it moves where the card asks (`live`). */
  input(value: number, live: boolean): void {
    this.preview = value;
    this.host.requestUpdate();
    if (!live) return;
    const now = performance.now();
    if (now - this.lastSend <= LIVE_MS) return;
    this.lastSend = now;
    this.pin(value);
    clearTimeout(this.sendTimer);
    this.send(value);
  }

  /** The ruler's fine scale came up, or went away. */
  zoom(detail: RulerWindowDetail): void {
    this.window = detail.fine ? detail : null;
    this.host.requestUpdate();
  }

  /** The fine scale's labels — its majors, those too close to an end left out — or null on the full scale. */
  fineLabels(format: (value: number) => string): Labels | null {
    return this.window
      ? this.window.marks
          .filter(([f]) => f > 0.06 && f < 0.94)
          .map(([f, value]) => [f, format(value)] as const)
      : null;
  }

  /** Shows `value` for five seconds — what the finger set — while Home Assistant catches up. */
  private pin(value: number): void {
    this.held = { value, expires: Date.now() + HOLD_MS };
    clearTimeout(this.heldTimer);
    this.heldTimer = window.setTimeout(() => {
      this.held = null;
      this.host.requestUpdate();
    }, HOLD_MS);
    this.host.requestUpdate();
  }
}
