// @vitest-environment happy-dom
import type { ReactiveControllerHost } from 'lit';
import { describe, expect, it } from 'vitest';

import { ScrubController } from './scrub.js';

/** A controller on a host that draws nothing: what the keys read is its value. */
const reader = (snap?: (fraction: number) => number): ScrubController => {
  const host = {
    addController: () => undefined,
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
  } as ReactiveControllerHost;
  return new ScrubController(host, snap);
};
const press = (
  scrubber: ScrubController,
  key: string,
  o: { readonly step?: number; readonly rest?: number; readonly shiftKey?: boolean } = {},
): boolean =>
  scrubber.key(
    new KeyboardEvent('keydown', { key, shiftKey: o.shiftKey === true }),
    o.step,
    o.rest,
  );

describe('the keys that read a chart', () => {
  it('start from the end of a chart that ends at now: ← a step back from it', () => {
    const scrubber = reader();
    expect(press(scrubber, 'ArrowLeft')).toBe(true);
    expect(scrubber.value).toBeCloseTo(0.98, 9);
    press(scrubber, 'ArrowRight');
    expect(scrubber.value).toBeCloseTo(1, 9);
  });

  it('start from where a chart that runs past now rests, and step back in time from there', () => {
    // today at noon, read in half hours: the first ← reads 11:30, not tonight's 23:30
    const scrubber = reader();
    const day = { step: 1 / 48, rest: 0.5 };
    press(scrubber, 'ArrowLeft', day);
    expect(scrubber.value).toBeCloseTo(23 / 48, 9);
    // once read, the keys go on from where it is read; Shift five steps
    press(scrubber, 'ArrowLeft', day);
    expect(scrubber.value).toBeCloseTo(22 / 48, 9);
    press(scrubber, 'ArrowLeft', { ...day, shiftKey: true });
    expect(scrubber.value).toBeCloseTo(17 / 48, 9);
    // let go, the next key starts from where the chart rests again; → reads what is to come
    press(scrubber, 'Escape', day);
    expect(scrubber.value).toBeNull();
    press(scrubber, 'ArrowRight', day);
    expect(scrubber.value).toBeCloseTo(25 / 48, 9);
  });

  it('take Home and End to the chart’s ends wherever it rests, and leave other keys alone', () => {
    const scrubber = reader();
    press(scrubber, 'End', { rest: 0.5 });
    expect(scrubber.value).toBe(1);
    press(scrubber, 'Home', { rest: 0.5 });
    expect(scrubber.value).toBe(0);
    expect(press(scrubber, 'a', { rest: 0.5 })).toBe(false);
    expect(scrubber.value).toBe(0);
  });

  it('land where the chart snaps a reading: a bar’s middle', () => {
    // four bars; the one that holds now rests in the third's middle: ← reads the second
    const scrubber = reader((fraction) => (Math.min(3, Math.floor(fraction * 4)) + 0.5) / 4);
    press(scrubber, 'ArrowLeft', { step: 1 / 4, rest: 2.5 / 4 });
    expect(scrubber.value).toBe(1.5 / 4);
  });
});
