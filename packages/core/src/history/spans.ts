import type { RawState, Span } from './types.js';

/*
 * A thing's states through time as stretches: what the History page's state lines, the details dialog's band and the
 * Chart card's strips (#228) are laid from. Imported as `@fluvy/core/spans`, never through the history's index: it
 * travels with the chart engine, which all three reach, and never brings the History page's chunk to a dashboard.
 */

/** The state a thing is in now, and since when (its `last_changed`): what the recorder may not have sent yet. */
export interface LiveState {
  readonly state: string;
  readonly since: number;
}

/**
 * The stretches a thing spent in each state over a window: a run of one state is one stretch, the first clipped to
 * the window's start, the last running to its end — brought up to the state now (`live`), where it changed after the
 * recorder's last row.
 */
export function spansOf(
  rows: ReadonlyArray<Pick<RawState, 's' | 'lu'>>,
  start: number,
  end: number,
  live?: LiveState,
): Span[] {
  const changes = rows.map((row) => ({ state: row.s, at: row.lu * 1000 }));
  const latest = changes[changes.length - 1];
  if (live && (!latest || (live.since > latest.at && live.state !== latest.state)))
    changes.push({ state: live.state, at: live.since });
  const spans: Span[] = [];
  for (const { state, at } of changes) {
    const from = Math.max(start, at);
    if (from >= end) break;
    const previous = spans[spans.length - 1];
    if (previous?.state === state) continue;
    if (previous) spans[spans.length - 1] = { ...previous, to: from };
    spans.push({ from, to: end, state });
  }
  return spans;
}

/** The stretch `t` falls in, with its ends — what a scrubbed state line reads out ("Running · 09:12 → 11:40"). */
export function spanAt(spans: readonly Span[], t: number): Span | null {
  for (const span of spans) if (t >= span.from && t <= span.to) return span;
  return null;
}
