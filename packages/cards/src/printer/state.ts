/*
 * What a printer is doing, whatever its integration calls it: OctoPrint's nineteen states, PrusaLink's, Bambu Lab's
 * gcode states and Moonraker's print states, each folded into the few a card draws. The words a card writes stay Home
 * Assistant's (the state as it translates it); the phase decides the tone, the progress bar and the buttons.
 */

export type PrinterPhase =
  'printing' | 'preparing' | 'paused' | 'finished' | 'stopped' | 'error' | 'idle' | 'offline';

const PHASES: ReadonlyArray<readonly [PrinterPhase, readonly string[]]> = [
  ['printing', ['printing', 'printing_sd', 'printing_streaming', 'running', 'busy', 'resuming']],
  [
    'preparing',
    [
      'prepare',
      'slicing',
      'init',
      'starting',
      'starting_sd',
      'starting_streaming',
      'transferring_file',
      'finishing',
    ],
  ],
  ['paused', ['paused', 'pausing', 'pause', 'attention']],
  ['finished', ['finished', 'finish', 'complete']],
  ['stopped', ['stopped', 'cancelled', 'cancelling']],
  ['error', ['error', 'failed', 'offline_after_error']],
  [
    'offline',
    ['offline', 'unavailable', 'connecting', 'detect_serial', 'open_serial', 'disconnected'],
  ],
];

/**
 * The phase of a status (a printer's state as its integration reports it), lower-cased; a binary "printing" sensor
 * where there is no status. Anything else — operational, idle, ready, standby, unknown — is idle.
 */
export function printerPhase(status: string | undefined, printing?: boolean): PrinterPhase {
  const state = (status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (state) for (const [phase, states] of PHASES) if (states.includes(state)) return phase;
  if (!state && printing) return 'printing';
  return 'idle';
}

/** A job is under way: there is progress to draw and something to pause or stop. */
export const busy = (phase: PrinterPhase): boolean =>
  phase === 'printing' || phase === 'preparing' || phase === 'paused';

/** Seconds a duration sensor holds, by its unit (Bambu Lab counts minutes, Moonraker seconds); null when unknown. */
export function durationSeconds(value: number | null, unit: string | undefined): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  switch ((unit ?? 's').toLowerCase()) {
    case 'd':
      return value * 86_400;
    case 'h':
      return value * 3600;
    case 'min':
    case 'm':
      return value * 60;
    case 'ms':
      return value / 1000;
    default:
      return value;
  }
}

/**
 * The time left and the time it ends. The finish time the integration reports wins for when (it does not drift a
 * minute between updates as now + whole minutes left does), its remaining time for how long; each stands in for the
 * other where it is missing. Null where neither is known.
 */
export function timeLeft(
  remaining: number | null,
  finish: number | null,
  now: number,
): { readonly left: number | null; readonly at: number | null } {
  return {
    left: remaining ?? (finish !== null ? Math.max(0, (finish - now) / 1000) : null),
    at: finish ?? (remaining !== null ? now + remaining * 1000 : null),
  };
}

/**
 * When a finished job finished: the finish time the integration reports (in the past by now), else when the printer
 * said so (its status's last change). Never now: a printer reports nothing left once done.
 */
export function finishedAt(
  finish: number | null,
  changed: number | null,
  now: number,
): number | null {
  if (finish !== null && finish <= now + 60_000) return finish;
  return changed;
}

/** How long the job has run: the integration's own count (Moonraker's), else since it started, while it runs. */
export function elapsedSeconds(
  counted: number | null,
  start: number | null,
  now: number,
): number | null {
  if (counted !== null) return counted;
  return start !== null && start <= now ? (now - start) / 1000 : null;
}
