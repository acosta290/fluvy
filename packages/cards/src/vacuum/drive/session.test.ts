// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveCall, DriveProfile } from '../drive.js';
import { DriveSession, HOLD_MS, IDLE_MS, REPEAT_MS } from './session.js';

/*
 * A robot's remote control from its start to its end, on a clock the test runs: one step a tap, a held arrow that
 * repeats and stops the robot when let go, and every way the session ends (asked to, ten seconds without a press,
 * the page hidden, a call refused), each telling the robot to stop once.
 */

const call = (service: string, data: Record<string, unknown> = {}): DriveCall => ({
  domain: 'robot',
  service,
  data,
});

const PROFILE: DriveProfile = {
  start: () => call('start'),
  move: (velocity, rotation, seq) => call('move', { velocity, rotation, seq }),
  stop: () => call('stop'),
};

/** A session on a house that answers at once, or as the test says: its calls in order, and how it ended. */
function drive(
  answer: (call: DriveCall) => Promise<unknown> = () => Promise.resolve(),
  profile: DriveProfile = PROFILE,
) {
  const calls: DriveCall[] = [];
  const ended: boolean[] = [];
  const session = new DriveSession(profile, {
    call: (made) => {
      calls.push(made);
      return answer(made);
    },
    ended: (failed) => ended.push(failed),
  });
  return { session, calls, ended, said: () => calls.map((made) => made.service) };
}

/** The moves made, each as its velocity and its rotation. */
const moves = (calls: readonly DriveCall[]) =>
  calls
    .filter((made) => made.service === 'move')
    .map((made) => [made.data['velocity'], made.data['rotation']]);

const hide = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  hide(false);
  vi.useRealTimers();
});

describe('a robot’s remote control', () => {
  it('starts once, and nothing moves before it has', () => {
    const { session, said } = drive();
    session.press('forward');
    expect(said()).toEqual([]);
    session.start();
    session.start();
    expect(said()).toEqual(['start']);
  });

  it('makes one step of a tap, each way, the moves numbered from the start', () => {
    const { session, calls } = drive();
    session.start();
    for (const direction of ['forward', 'back', 'left', 'right'] as const) {
      session.press(direction);
      session.release();
    }
    expect(calls.slice(1).map((made) => made.data)).toEqual([
      { velocity: 1, rotation: 0, seq: 1 },
      { velocity: -1, rotation: 0, seq: 2 },
      { velocity: 0, rotation: 1, seq: 3 },
      { velocity: 0, rotation: -1, seq: 4 },
    ]);
  });

  it('repeats an arrow held, and stops the robot as it is let go', async () => {
    const { session, calls } = drive();
    session.start();
    session.press('forward');
    await vi.advanceTimersByTimeAsync(HOLD_MS + REPEAT_MS * 3);
    expect(moves(calls)).toEqual([
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]);
    session.release();
    // a move that goes nowhere: the robot stands still at once
    expect(moves(calls).at(-1)).toEqual([0, 0]);
    await vi.advanceTimersByTimeAsync(REPEAT_MS * 4);
    expect(moves(calls)).toHaveLength(5);
  });

  it('lets a tap’s step run out by itself: no stop follows it', async () => {
    const { session, calls } = drive();
    session.start();
    session.press('left');
    await vi.advanceTimersByTimeAsync(HOLD_MS - 1);
    session.release();
    expect(moves(calls)).toEqual([[0, 1]]);
  });

  it('never sends a held arrow’s next move while the last one is unanswered', async () => {
    const answers: Array<() => void> = [];
    const { session, calls } = drive((made) =>
      made.service === 'move'
        ? new Promise<void>((resolve) => answers.push(resolve))
        : Promise.resolve(),
    );
    session.start();
    session.press('forward');
    await vi.advanceTimersByTimeAsync(HOLD_MS + REPEAT_MS * 5);
    expect(moves(calls)).toHaveLength(1);
    answers.shift()?.();
    await vi.advanceTimersByTimeAsync(REPEAT_MS);
    expect(moves(calls)).toHaveLength(2);
  });

  it('takes a key’s step without a finger, and stops the robot on Stop', () => {
    const { session, calls } = drive();
    session.start();
    session.step('right');
    session.halt();
    expect(moves(calls)).toEqual([
      [0, -1],
      [0, 0],
    ]);
  });

  it('ends after ten seconds without a press, telling the robot once', async () => {
    const { session, said, ended } = drive();
    session.start();
    await vi.advanceTimersByTimeAsync(IDLE_MS - 1);
    expect(ended).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(said()).toEqual(['start', 'stop']);
    expect(ended).toEqual([false]);
    // over: no press moves it, no second end tells it again
    session.press('forward');
    session.end();
    expect(said()).toEqual(['start', 'stop']);
    expect(ended).toEqual([false]);
  });

  it('counts its ten seconds from the last press, and not at all while an arrow is held', async () => {
    const { session, ended } = drive();
    session.start();
    await vi.advanceTimersByTimeAsync(IDLE_MS - 1000);
    session.press('forward');
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2);
    expect(ended).toEqual([]);
    session.release();
    await vi.advanceTimersByTimeAsync(IDLE_MS - 1);
    expect(ended).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(ended).toEqual([false]);
  });

  it('ends when it is asked to (Done, the card leaving the page)', async () => {
    const { session, said, ended } = drive();
    session.start();
    session.press('forward');
    session.end();
    expect(said()).toEqual(['start', 'move', 'stop']);
    expect(ended).toEqual([false]);
    // the arrow that was held repeats no more
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2);
    expect(said()).toEqual(['start', 'move', 'stop']);
  });

  it('ends when the page is hidden, and listens no more after', () => {
    const { session, said, ended } = drive();
    session.start();
    hide(true);
    expect(said()).toEqual(['start', 'stop']);
    expect(ended).toEqual([false]);
    hide(false);
    hide(true);
    expect(ended).toEqual([false]);
  });

  it('ends failed when a call is refused, and still tells the robot to stop', async () => {
    const { session, said, ended } = drive((made) =>
      made.service === 'move' ? Promise.reject(new Error('refused')) : Promise.resolve(),
    );
    session.start();
    session.press('forward');
    await vi.advanceTimersByTimeAsync(0);
    expect(said()).toEqual(['start', 'move', 'stop']);
    expect(ended).toEqual([true]);
  });

  it('ends failed when its start is refused, a stop refused after it saying nothing', async () => {
    const { session, said, ended } = drive(() => Promise.reject(new Error('refused')));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(said()).toEqual(['start', 'stop']);
    expect(ended).toEqual([true]);
  });

  it('drives a robot with no start and no stop of its own', async () => {
    const { session, said, ended } = drive(undefined, { move: PROFILE.move });
    session.start();
    session.press('back');
    session.release();
    session.end();
    expect(said()).toEqual(['move']);
    expect(ended).toEqual([false]);
  });
});
