import type { WallSettings } from '../settings/schema.js';

/*
 * A wall's day and night: always dark, Home Assistant's own mode, the sun (dark below the horizon) or a pair of
 * hours — and when the answer next changes, so the wall re-derives its look at that moment and not a minute later.
 */

/** `sun.sun` as Home Assistant keeps it: its state and the next rising and setting (ISO strings). */
export interface SunLike {
  readonly state?: string;
  readonly attributes?: {
    readonly next_rising?: string;
    readonly next_setting?: string;
  };
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const minutesOf = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Whether `now` (minutes into the day) falls in the night `[from, to)`, which may cross midnight; `from === to` is no night. */
export function inNight(nowMinutes: number, from: string, to: string): boolean {
  const start = minutesOf(from);
  const end = minutesOf(to);
  if (start === end) return false;
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

const localMinutes = (now: Date): number => now.getHours() * 60 + now.getMinutes();

/**
 * Whether the wall is dark now: `dark` always, `follow` leaves it to Home Assistant (undefined), `sun` follows
 * `sun.sun` (undefined without it), `hours` the night between `from` and `to`.
 */
export function wallDark(
  wall: Pick<WallSettings, 'theme' | 'from' | 'to'>,
  now: Date,
  sun: SunLike | undefined,
): boolean | undefined {
  switch (wall.theme) {
    case 'dark':
      return true;
    case 'follow':
      return undefined;
    case 'sun':
      return sun?.state ? sun.state === 'below_horizon' : undefined;
    case 'hours':
      return inNight(localMinutes(now), wall.from, wall.to);
  }
}

/** A wall-clock time today (or tomorrow when it has passed), as a date. */
function nextAt(now: Date, hhmm: string): Date {
  const at = new Date(now);
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  at.setHours(h, m, 0, 0);
  if (at.getTime() <= now.getTime()) at.setTime(at.getTime() + DAY);
  return at;
}

/**
 * Milliseconds until the answer of `wallDark` may change: the next of `from` / `to` for hours, the next rising or
 * setting for the sun; undefined when it never does (dark, follow, no sun).
 */
export function nextChange(
  wall: Pick<WallSettings, 'theme' | 'from' | 'to'>,
  now: Date,
  sun: SunLike | undefined,
): number | undefined {
  if (wall.theme === 'hours') {
    if (minutesOf(wall.from) === minutesOf(wall.to)) return undefined;
    const soonest = Math.min(nextAt(now, wall.from).getTime(), nextAt(now, wall.to).getTime());
    return soonest - now.getTime();
  }
  if (wall.theme === 'sun') {
    const times = [sun?.attributes?.next_rising, sun?.attributes?.next_setting]
      .map((iso) => (iso ? Date.parse(iso) : NaN))
      .filter((t) => Number.isFinite(t) && t > now.getTime());
    return times.length ? Math.min(...times) - now.getTime() : undefined;
  }
  return undefined;
}
