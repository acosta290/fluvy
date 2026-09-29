// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdle } from '../wall/idle.js';

describe('idleness on a wall', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('goes idle after the minutes, wakes on a touch, and counts a motion sensor as a touch', () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    let motion: (() => void) | undefined;
    const unwake = vi.fn();
    const idle = createIdle(document, {
      after: 2,
      onIdle,
      onActive,
      wake: (onMotion) => {
        motion = onMotion;
        return unwake;
      },
    });
    vi.advanceTimersByTime(119_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(idle.idle).toBe(true);
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onActive).toHaveBeenCalledTimes(1);
    expect(idle.idle).toBe(false);
    // a touch while awake only restarts the count
    vi.advanceTimersByTime(90_000);
    document.dispatchEvent(new Event('keydown', { bubbles: true }));
    vi.advanceTimersByTime(90_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(onIdle).toHaveBeenCalledTimes(2);
    motion?.();
    expect(onActive).toHaveBeenCalledTimes(2);
    idle.stop();
    expect(unwake).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onActive).toHaveBeenCalledTimes(2);
  });

  it('never goes idle with no minutes set', () => {
    const onIdle = vi.fn();
    const idle = createIdle(document, { after: 0, onIdle, onActive: () => undefined });
    vi.advanceTimersByTime(60 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    expect(idle.idle).toBe(false);
    idle.stop();
  });
});
