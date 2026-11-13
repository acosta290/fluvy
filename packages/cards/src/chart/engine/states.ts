import { isActiveState } from '@fluvy/core';

/**
 * A thing's states through time — the History page's state lines, the details dialog's band — painted by one rule
 * (the engine's sheet, `.fv-stretch`): a stretch spent on takes the accent, so a glance reads the day; one doing
 * something that is not on (paused, idle, returning, docked) the neutral ink; one the recorder knew nothing of that
 * ink striped; a resting one the track's own fill.
 */

/** The plain resting states: a thing in one of these is simply not doing anything. */
const RESTING = new Set(['off', 'closed', 'unlocked', 'not_home', 'disarmed', 'normal', 'clear']);

/** How a stretch of `state` is painted: `is-on`, `is-quiet`, `is-away`, or '' (resting). */
export function stretchTone(domain: string, state: string): string {
  if (state === 'unavailable' || state === 'unknown' || !state) return 'is-away';
  if (isActiveState(domain, state)) return 'is-on';
  return RESTING.has(state) ? '' : 'is-quiet';
}
