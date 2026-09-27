import { resolveEntity } from '../entity.js';
import type { HomeAssistant } from '../ha/types.js';
import type { Band, Group, HistoryWindow, Line, Point, RawHistory, Span, Track } from './types.js';

/** A statistic period as the recorder sends it (`recorder/statistics_during_period`). Times are milliseconds. */
export interface StatisticPeriodRow {
  readonly start: number;
  readonly end: number;
  readonly mean?: number | null;
  readonly min?: number | null;
  readonly max?: number | null;
  readonly state?: number | null;
}

export type Statistics = Record<string, readonly StatisticPeriodRow[]>;

const number = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** What an entity measures: its unit and device class, from the entity itself or from the states the recorder kept. */
function measures(
  hass: HomeAssistant | undefined,
  entityId: string,
  attributes: Record<string, unknown> | undefined,
): { unit: string; deviceClass: string; name: string; domain: string } {
  const view = resolveEntity(hass, entityId);
  const unit =
    view.unit ||
    (typeof attributes?.['unit_of_measurement'] === 'string'
      ? (attributes['unit_of_measurement'] as string)
      : '');
  const deviceClass =
    view.deviceClass ||
    (typeof attributes?.['device_class'] === 'string'
      ? (attributes['device_class'] as string)
      : '');
  return { unit, deviceClass, name: view.name, domain: view.domain };
}

/** Everything a track says about itself, from its points: its ends, and the average of the time it spent at each. */
function summarise(
  points: readonly Point[],
  end: number,
): Pick<Track, 'min' | 'max' | 'average' | 'last'> {
  if (points.length === 0) return { min: 0, max: 0, average: 0, last: null };
  let min = Infinity;
  let max = -Infinity;
  let weighted = 0;
  let time = 0;
  for (const [index, point] of points.entries()) {
    if (point.v < min) min = point.v;
    if (point.v > max) max = point.v;
    const until = points[index + 1]?.t ?? end;
    const span = Math.max(0, until - point.t);
    weighted += point.v * span;
    time += span;
  }
  const last = points[points.length - 1]?.v ?? null;
  const average = time > 0 ? weighted / time : (last ?? 0);
  return { min, max, average, last };
}

/** The numbers an entity's kept states hold, in the window (a state that is not a number is a hole, never a zero). */
function pointsOf(rows: RawHistory[string], start: number, end: number): Point[] {
  const points: Point[] = [];
  for (const row of rows) {
    const value = number(row.s);
    if (value === null) continue;
    const t = Math.max(start, row.lu * 1000);
    if (t > end) break;
    if (points.length && (points[points.length - 1] as Point).t === t) points.pop(); // two readings on one instant: the later one
    points.push({ t, v: value });
  }
  return points;
}

/** The stretches an entity spent in each state; a run of the same state is one stretch. */
function spansOf(rows: RawHistory[string], start: number, end: number): Span[] {
  const spans: Span[] = [];
  for (const row of rows) {
    const from = Math.max(start, row.lu * 1000);
    if (from > end) break;
    const previous = spans[spans.length - 1];
    if (previous && previous.state === row.s) continue;
    if (previous) spans[spans.length - 1] = { ...previous, to: from };
    spans.push({ from, to: end, state: row.s });
  }
  return spans;
}

export interface WindowOptions {
  readonly start: number;
  readonly end: number;
  readonly entityIds: readonly string[];
  /** The recorder's long-term statistics for the same window, when the window is read that way. */
  readonly statistics?: Statistics;
}

/**
 * The window the page draws: every entity's numbers as a track (grouped with everything in the same unit) or its
 * states as a line, in the order they were asked for. An entity the recorder kept nothing of is named in `empty`.
 */
export function buildWindow(
  hass: HomeAssistant | undefined,
  states: RawHistory,
  o: WindowOptions,
): HistoryWindow {
  const groups = new Map<string, { unit: string; deviceClass: string; tracks: Track[] }>();
  const lines: Line[] = [];
  const empty: string[] = [];

  for (const entityId of o.entityIds) {
    const rows = states[entityId] ?? [];
    const stats = o.statistics?.[entityId] ?? [];
    const { unit, deviceClass, name, domain } = measures(hass, entityId, rows[0]?.a);
    const fromStats = stats.length > 0;
    const points = fromStats ? statPoints(stats, o.start, o.end) : pointsOf(rows, o.start, o.end);
    if (points.length === 0 && rows.length === 0) {
      empty.push(entityId);
      continue;
    }
    if (points.length > 0) {
      const band = fromStats ? statBand(stats, o.start, o.end) : undefined;
      const read = summarise(points, o.end);
      // a summarised track's points are its means; what it actually reached is in its band, and that is what a
      // card's Min, Max and scale marks must say — never a range the drawing itself crosses
      const reached =
        band && band.length
          ? {
              min: band.reduce((least, one) => Math.min(least, one.low), read.min),
              max: band.reduce((most, one) => Math.max(most, one.high), read.max),
            }
          : {};
      const track: Track = {
        entityId,
        name,
        unit,
        deviceClass,
        points,
        ...(band && band.length ? { band } : {}),
        ...read,
        ...reached,
        summarised: fromStats,
      };
      const key = `${unit}|${deviceClass}`;
      const group = groups.get(key) ?? { unit, deviceClass, tracks: [] };
      group.tracks.push(track);
      groups.set(key, group);
      continue;
    }
    const spans = spansOf(rows, o.start, o.end);
    if (spans.length === 0) {
      empty.push(entityId);
      continue;
    }
    lines.push({ entityId, name, domain, spans, changes: spans.length - 1 });
  }

  return {
    start: o.start,
    end: o.end,
    groups: [...groups.values()].map((group): Group => ({
      unit: group.unit,
      deviceClass: group.deviceClass,
      tracks: group.tracks,
      min: Math.min(...group.tracks.map((track) => track.min)),
      max: Math.max(...group.tracks.map((track) => track.max)),
    })),
    lines,
    empty,
  };
}

/** A statistic's means as points: one per period, at the period's start. */
function statPoints(rows: readonly StatisticPeriodRow[], start: number, end: number): Point[] {
  const points: Point[] = [];
  for (const row of rows) {
    const value = number(row.mean ?? row.state);
    if (value === null) continue;
    const t = Math.max(start, row.start);
    if (t > end) break;
    points.push({ t, v: value });
  }
  return points;
}

/** The band a statistic's value moved in, drawn behind its mean; empty when the recorder kept no ends. */
function statBand(rows: readonly StatisticPeriodRow[], start: number, end: number): Band[] {
  const band: Band[] = [];
  for (const row of rows) {
    const low = number(row.min);
    const high = number(row.max);
    if (low === null || high === null) continue;
    const t = Math.max(start, row.start);
    if (t > end) break;
    band.push({ t, low, high });
  }
  return band;
}
