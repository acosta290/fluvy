import type { DriveCall, DriveProfile } from '../drive.js';

/** The four ways the pad moves the robot. */
export type Direction = 'forward' | 'back' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = ['forward', 'right', 'back', 'left'];

/** A direction as a move: its `velocity` forward and its `rotation` to the left. */
const MOVES: Readonly<Record<Direction, readonly [velocity: number, rotation: number]>> = {
  forward: [1, 0],
  back: [-1, 0],
  left: [0, 1],
  right: [0, -1],
};

/** Remote control ends by itself after this long without a press. */
export const IDLE_MS = 10_000;
/** An arrow held this long repeats, a move each this long: none while the last one is still unanswered. */
export const HOLD_MS = 400;
export const REPEAT_MS = 400;

/** What a session asks of whoever runs it: its calls made, and to be told when it is over. */
export interface DriveHost {
  /** Makes a call: settles as Home Assistant answers, rejects where it refuses. */
  call(call: DriveCall): Promise<unknown>;
  /** The session is over (Done, ten seconds without a press, a hidden page); `failed` where a call was refused. */
  ended(failed: boolean): void;
}

/**
 * A robot's remote control from its start to its end: the profile's start, a move for each press — a tap is one step,
 * an arrow held repeats and stops the robot as it is let go — and the profile's stop when it is over: asked to end,
 * ten seconds without a press, the page hidden, or a call refused. It holds no element: whoever draws the pad runs
 * it.
 */
export class DriveSession {
  private live = false;
  private seq = 0;
  /** A move Home Assistant has not answered yet: a held arrow waits for it. */
  private unanswered = false;
  /** The arrow held has repeated: letting it go stops the robot where it is. */
  private repeated = false;
  private idleTimer = 0;
  private holdTimer = 0;
  private repeatTimer = 0;

  constructor(
    private readonly profile: DriveProfile,
    private readonly host: DriveHost,
  ) {}

  /** A page that is hidden drives no robot. */
  private readonly hidden = (): void => {
    if (document.hidden) this.end();
  };

  /** Remote control starts, and its ten seconds with it. */
  start(): void {
    if (this.live) return;
    this.live = true;
    this.seq = 0;
    document.addEventListener('visibilitychange', this.hidden);
    const start = this.profile.start?.();
    if (start) this.send(start);
    this.rest();
  }

  /** An arrow under a finger: a move at once, and held, the next ones. */
  press(direction: Direction): void {
    if (!this.live) return;
    this.lift();
    clearTimeout(this.idleTimer);
    this.move(direction);
    this.holdTimer = window.setTimeout(() => {
      this.repeatTimer = window.setInterval(() => {
        this.repeated = true;
        if (!this.unanswered) this.move(direction);
      }, REPEAT_MS);
    }, HOLD_MS);
  }

  /** The finger off its arrow: one that repeated stops the robot; a tap's step runs out by itself. */
  release(): void {
    if (!this.live) return;
    const repeated = this.repeated;
    this.lift();
    if (repeated) this.send(this.profile.move(0, 0, ++this.seq));
    this.rest();
  }

  /** One step with no finger to hold it (a key of the keyboard). */
  step(direction: Direction): void {
    if (!this.live) return;
    this.lift();
    this.move(direction);
    this.rest();
  }

  /** Stop: the robot stands still, remote control goes on. */
  halt(): void {
    if (!this.live) return;
    this.lift();
    this.send(this.profile.move(0, 0, ++this.seq));
    this.rest();
  }

  /** Remote control ends, however it ends: the robot is told once, and whoever runs the session after it. */
  end(failed = false): void {
    if (!this.live) return;
    this.live = false;
    this.lift();
    clearTimeout(this.idleTimer);
    document.removeEventListener('visibilitychange', this.hidden);
    const stop = this.profile.stop?.();
    // a stop refused after a call was (the robot never started) says nothing more
    if (stop) this.host.call(stop).catch(() => undefined);
    this.host.ended(failed);
  }

  private move(direction: Direction): void {
    const [velocity, rotation] = MOVES[direction];
    this.unanswered = true;
    this.send(this.profile.move(velocity, rotation, ++this.seq), () => {
      this.unanswered = false;
    });
  }

  /** A call made; refused, the session is over. */
  private send(call: DriveCall, answered?: () => void): void {
    this.host.call(call).then(answered, () => {
      answered?.();
      this.end(true);
    });
  }

  /** No arrow is held any more. */
  private lift(): void {
    clearTimeout(this.holdTimer);
    clearInterval(this.repeatTimer);
    this.holdTimer = this.repeatTimer = 0;
    this.repeated = false;
  }

  /** The ten seconds without a press start again. */
  private rest(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.end(), IDLE_MS);
  }
}
