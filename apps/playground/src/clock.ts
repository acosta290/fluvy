/**
 * Pins the page's clock: `Date` starts at `at` and runs on from there, so what says "today" or "5 min ago" reads the
 * same whatever the day it is looked at (the playground's `?at=`, the demo's fixed evening). Returns false when
 * `at` is not a date, leaving the clock alone.
 */
export function pinClock(at: string): boolean {
  if (!Number.isFinite(Date.parse(at))) return false;
  const Real = Date;
  const offset = Date.parse(at) - Real.now();
  class Clock extends Real {
    constructor(...args: [] | ConstructorParameters<DateConstructor>) {
      if (args.length === 0) super(Real.now() + offset);
      else super(...(args as ConstructorParameters<DateConstructor>));
    }
    static override now(): number {
      return Real.now() + offset;
    }
  }
  globalThis.Date = Clock as DateConstructor;
  return true;
}
