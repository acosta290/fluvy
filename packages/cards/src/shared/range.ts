/**
 * A period a page shows (the Activity page's day, the History page's window), in milliseconds, and the ways it moves.
 */
/** A period of the view, in ms: a day by default, or the dates someone chose. */
export interface ActivityRange {
  readonly start: number;
  readonly end: number;
}

/** A day in milliseconds (a calendar day may be 23 or 25 hours long: the helpers below walk the calendar). */
export const DAY = 86_400_000;

/** The local day `date` falls in (a day is not always 24 h: the clocks change). */
export function dayRange(date: Date): ActivityRange {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** The same length of time before (−1) or after (+1), day by day (a day stays a day across a clock change). */
export function shiftRange(range: ActivityRange, direction: 1 | -1): ActivityRange {
  const days = Math.max(1, Math.round((range.end - range.start) / DAY));
  const start = new Date(range.start);
  start.setDate(start.getDate() + direction * days);
  const end = new Date(range.end);
  end.setDate(end.getDate() + direction * days);
  return { start: start.getTime(), end: end.getTime() };
}

export const sameRange = (a: ActivityRange, b: ActivityRange): boolean =>
  a.start === b.start && a.end === b.end;
