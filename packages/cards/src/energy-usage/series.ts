import { houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import { niceTicks, type Ticks } from '../chart/engine/index.js';
import { allocate, type Totals } from '../energy-model/allocate.js';
import type { Range, StatRow, Step } from '../energy-model/period.js';
import type { SourceKind } from '../energy-model/prefs.js';
import { midnightOf } from '../energy-period/picker.js';
import { unitClass } from '../shared/units.js';

/**
 * The Energy usage card's figures, pure: a range in its slots (a day's hours, a week's or a month's days, a year's
 * months), each slot's energy by where the house took it from and where it went — Home Assistant's own series, from
 * the dashboard's own arithmetic (`allocate`, bucket by bucket) — or by what each source's meter measured, and the
 * series a card draws of them, in the order and the colours it asks for, the sources past `max_sources` folded into
 * one, on a scale that hugs them. A water or a gas card draws its meters instead, each what it measured in a slot.
 */

/** What a card charts: the house's electricity by its sources, or its water or its gas by their meters. */
export type Charted = 'energy' | 'water' | 'gas';
export const CHARTED: readonly Charted[] = ['energy', 'water', 'gas'];
/** Water or gas: what a card draws its meters of. */
export type Metered = Exclude<Charted, 'energy'>;

/** A slot's grain: the buckets the range is read in (Home Assistant's `getSuggestedPeriod`). */
export type Grain = Exclude<Step, '5minute'>;

/** The sources an Energy dashboard meters (its preferences name no generator and no car): the usage graph's three. */
export type UsageKind = Extract<SourceKind, 'solar' | 'battery' | 'grid'>;

/** The sources from the bottom of the stack up: the sun (the house's own), the battery, the grid on top. */
export const USAGE_KINDS: readonly UsageKind[] = ['solar', 'battery', 'grid'];

/**
 * What the columns stand for above the line: what the house used from each source (`usage`, the default), or what
 * each source's meter measured (`flows`: the sun's production, the battery's discharge, the grid's import), whatever
 * of it the house used, stored or exported.
 */
export type UsageMode = 'usage' | 'flows';

/**
 * A slot's energy (kWh): what the house used from each origin, what each origin's meter measured, and what went into
 * the battery and out to the grid.
 */
export interface SlotEnergy {
  readonly used: Readonly<Record<UsageKind, number>>;
  readonly metered: Readonly<Record<UsageKind, number>>;
  readonly charged: number;
  readonly exported: number;
}

const HOUR = 3_600_000;

/**
 * Where each slot of a range starts, on the house's clock: its hours (23 or 25 on the day the clocks change), its
 * days from midnight to midnight, its months from the first. An open range runs to `now`.
 */
export function slotsOf(
  hass: HomeAssistant | undefined,
  range: Range,
  grain: Grain,
  now = new Date(),
): number[] {
  const end = (range.end ?? now).getTime();
  const out: number[] = [];
  if (grain === 'hour') {
    for (let at = range.start.getTime(); at < end; at += HOUR) out.push(at);
    return out;
  }
  const first = wallClock(range.start, houseZone(hass));
  for (let i = 0; ; i++) {
    const at = midnightOf(
      hass,
      grain === 'day'
        ? { year: first.year, month: first.month, day: first.day + i }
        : { year: first.year, month: first.month + i, day: 1 },
    ).getTime();
    if (at >= end) return out;
    out.push(at);
  }
}

/** The slot a bucket starting at `start` lands in: the last that starts at or before it (-1 before the first). */
function slotOf(slots: readonly number[], start: number): number {
  let index = slots.length - 1;
  while (index >= 0 && (slots[index] as number) > start) index--;
  return index;
}

/**
 * Each slot's energy from the statistics' buckets: every bucket allocated on its own (an hour's import never netted
 * against another hour's export) and added into the slot it starts in; a bucket outside the slots is not drawn.
 * Above the line, `allocate`'s use by origin, and beside it what the sun's, the battery's and the grid's meters gave
 * (Home Assistant's `solar`, `from_battery` and `from_grid`); below it, what the battery's and the grid's meters took
 * (its `to_battery` and `to_grid`).
 */
export function slotEnergy(
  buckets: ReadonlyArray<{ readonly start: number; readonly totals: Totals }>,
  slots: readonly number[],
  end: number,
): SlotEnergy[] {
  const out = slots.map(() => ({
    used: { solar: 0, battery: 0, grid: 0 },
    metered: { solar: 0, battery: 0, grid: 0 },
    charged: 0,
    exported: 0,
  }));
  for (const { start, totals } of buckets) {
    if (start >= end) continue;
    const slot = out[slotOf(slots, start)];
    if (!slot) continue;
    const a = allocate(totals);
    slot.used.solar += a.usedSolar;
    slot.used.battery += a.usedBattery;
    slot.used.grid += a.usedGrid;
    slot.metered.solar += Math.max(0, totals.solar);
    slot.metered.battery += Math.max(0, totals.fromBattery);
    slot.metered.grid += Math.max(0, totals.fromGrid);
    slot.charged += Math.max(0, totals.toBattery);
    slot.exported += Math.max(0, totals.toGrid);
  }
  return out;
}

/** A source as the card's `sources` lists it: its kind, shown or not, its name and its colour. */
export interface UsageSource {
  type: UsageKind;
  /** Drawn (default true): false leaves the kind and what went out through it out. */
  show?: boolean;
  name?: string;
  color?: string;
}

/**
 * What a series is: a source above the line, the sources folded into one, what went out below it, or a water or gas
 * meter.
 */
export type SeriesKey = UsageKind | 'other' | 'charged' | 'exported' | 'meter';

/**
 * A series as the card draws it: kWh per slot (what went out below zero) — a meter's figures in its kind's unit — and
 * its total over the range.
 */
export interface UsageSeries {
  readonly key: SeriesKey;
  /** The source it is (above), the one it went into or out through (below); none for the folded sources. */
  readonly kind?: UsageKind;
  readonly values: readonly number[];
  readonly total: number;
  /** The source's own name and colour, as the card lists them. */
  readonly name?: string | undefined;
  readonly color?: string | undefined;
  /** A meter's place among its kind's shades: the first its kind's colour, each after it a shade of it. */
  readonly shade?: number;
}

/** A series of `values`, its total what they add up to on both sides of the line. */
const series = (
  key: SeriesKey,
  values: number[],
  more: Partial<UsageSeries> = {},
): UsageSeries => ({
  key,
  values,
  total: values.reduce((sum, v) => sum + Math.abs(v), 0),
  ...more,
});

/** A `sources` entry as an object: a bare kind is one shown with its own words. */
const sourceOf = (entry: UsageSource | UsageKind): UsageSource =>
  typeof entry === 'string' ? { type: entry } : entry;

/**
 * How many of `count` sources keep their own name where no more than `max` may stand (6 by default, two at least):
 * the rest fold into one "Other", which is one of them — so two at least fold, as Home Assistant groups them.
 */
export function foldAt(count: number, max: unknown): number {
  const cap = Math.max(2, Math.floor(Number(max)) || 6);
  return count > cap ? cap - 1 : count;
}

export interface SeriesOptions {
  /** The kinds the house meters into it (the Energy dashboard's import, production and discharge). */
  readonly ins: ReadonlySet<SourceKind>;
  /** The kinds it meters out of it (the battery's charge, the export). */
  readonly outs: ReadonlySet<SourceKind>;
  /** The card's `sources`: the kinds in its order with their names and colours; none, every kind the house has. */
  readonly sources?: readonly (UsageSource | UsageKind)[] | undefined;
  /** Sources that keep their own name before the rest fold into one (`max_sources`, 6). */
  readonly max?: unknown;
  /** What went out, below the line: the battery's charge, the export (`show_returns`, true). */
  readonly returns?: boolean | undefined;
  /** What the sources' columns stand for (`mode`, `usage`). */
  readonly mode?: UsageMode | undefined;
}

/**
 * The series a card draws, bottom of the stack first: the sources it shows (its `sources` in their order, else every
 * kind the house has from the sun up) as its mode reads them, the last of them folded into "other" past `max`, then
 * below the line the battery's charge and the export, for a battery and a grid that are shown and metered that way. A
 * kind the house has no meter for draws nothing; a kind listed twice is its first entry.
 */
export function usageSeries(slots: readonly SlotEnergy[], o: SeriesOptions): UsageSeries[] {
  const listed = (o.sources?.length ? o.sources : USAGE_KINDS)
    .map(sourceOf)
    .filter(
      (s) =>
        s.show !== false &&
        USAGE_KINDS.includes(s.type) &&
        (o.ins.has(s.type) || o.outs.has(s.type)),
    );
  const shown = listed.filter((s, i) => listed.findIndex((other) => other.type === s.type) === i);
  const sources = shown.filter((s) => o.ins.has(s.type));
  const side = o.mode === 'flows' ? 'metered' : 'used';
  const named = foldAt(sources.length, o.max);
  const out = sources.slice(0, named).map((s) =>
    series(
      s.type,
      slots.map((slot) => slot[side][s.type]),
      { kind: s.type, name: s.name, color: s.color },
    ),
  );
  const rest = sources.slice(named);
  if (rest.length)
    out.push(
      series(
        'other',
        slots.map((slot) => rest.reduce((sum, s) => sum + slot[side][s.type], 0)),
      ),
    );
  if (o.returns === false) return out;
  // what went out, from the line down: into the battery, then out to the grid
  for (const [key, kind] of [
    ['charged', 'battery'],
    ['exported', 'grid'],
  ] as const) {
    const own = shown.find((s) => s.type === kind);
    if (own && o.outs.has(kind))
      out.push(
        series(
          key,
          slots.map((slot) => -slot[key]),
          { kind, color: own.color },
        ),
      );
  }
  return out;
}

/* ---------- water and gas ---------- */

/** A water or gas meter as a card draws it: its statistic, its name (the card's, told apart) and its own colour. */
export interface MeterLine {
  readonly id: string;
  readonly name: string;
  readonly color?: string | undefined;
}

/** A statistics row as Home Assistant answers it: its bucket's start and end, what the meter measured over it. */
export type MeterRow = StatRow & { readonly end?: number };

/**
 * A meter's figures in a range's slots: each of its rows' change (what it measured over its bucket, in the unit it was
 * asked in) added into the slot the row starts in; a row at or past `end`, or before the first slot, is not drawn.
 */
export function meterSlots(
  rows: readonly MeterRow[] | undefined,
  slots: readonly number[],
  end: number,
): number[] {
  const out = slots.map(() => 0);
  for (const row of rows ?? []) {
    const change = Number(row.change ?? 0);
    const index = row.start < end ? slotOf(slots, row.start) : -1;
    if (index >= 0 && Number.isFinite(change))
      out[index] = (out[index] as number) + Math.max(0, change);
  }
  return out;
}

/**
 * The series of a water or gas card, bottom of the stack first: each meter in its order, in a shade of its kind's
 * colour by its place (its own colour over it), the last past `max` folded into one "other" (`foldAt`). A meter that
 * measured nothing in the range draws its zeros.
 */
export function meterSeries(
  values: ReadonlyMap<string, readonly number[]>,
  meters: readonly MeterLine[],
  count: number,
  max: unknown,
): UsageSeries[] {
  const of = (m: MeterLine, i: number): number => values.get(m.id)?.[i] ?? 0;
  const slots = Array.from({ length: count }, (_unused, i) => i);
  const named = foldAt(meters.length, max);
  const out = meters.slice(0, named).map((m, shade) =>
    series(
      'meter',
      slots.map((i) => of(m, i)),
      { name: m.name, color: m.color, shade },
    ),
  );
  const rest = meters.slice(named);
  if (rest.length)
    out.push(
      series(
        'other',
        slots.map((i) => rest.reduce((sum, m) => sum + of(m, i), 0)),
      ),
    );
  return out;
}

/** A bucket of each grain (a month at its shortest): what a row lasts where it says no end of its own. */
const BUCKET: Readonly<Record<Grain, number>> = {
  hour: HOUR,
  day: 24 * HOUR,
  month: 28 * 24 * HOUR,
};

/** Where a meter's newest figures end: its last row's end (its bucket's, where it says none); none without a row. */
export function newestOf(rows: readonly MeterRow[] | undefined, grain: Grain): number | undefined {
  let newest: number | undefined;
  for (const row of rows ?? [])
    if (row.change !== null && row.change !== undefined)
      newest = Math.max(newest ?? -Infinity, row.end ?? row.start + BUCKET[grain]);
  return newest;
}

/**
 * Whether a meter's figures stop short of what has happened of the range (`until`: its end, or now while it runs) by a
 * whole bucket of its grain: an hour, a day or a month still being compiled is no gap; a utility's meter imported a
 * day or two behind is.
 */
export const stopsShort = (newest: number | undefined, until: number, grain: Grain): boolean =>
  newest !== undefined && until - newest >= BUCKET[grain];

/** The volume units Home Assistant converts water and gas between (its `VOLUME_UNITS`). */
const VOLUMES: readonly string[] = ['L', 'gal', 'ft³', 'm³', 'CCF', 'MCF'];

/**
 * The unit a kind's figures are asked in, as the Energy dashboard asks them (`getEnergyWaterUnit`,
 * `getEnergyGasUnit`): gas metered as energy in kWh; meters that agree on a volume in it; else the house's own —
 * litres or gallons of water, cubic metres or feet of gas.
 */
export function meteredUnit(
  kind: Metered,
  units: readonly (string | null | undefined)[],
  metric: boolean,
): string {
  if (kind === 'gas' && units.some((unit) => unit && unitClass(unit) === 'energy')) return 'kWh';
  const [first] = units;
  if (first && VOLUMES.includes(first) && units.every((unit) => unit === first)) return first;
  if (kind === 'water') return metric ? 'L' : 'gal';
  return metric ? 'm³' : 'ft³';
}

/** What went out, below the line: into the battery and out to the grid. */
export const isReturn = (series: UsageSeries): boolean =>
  series.key === 'charged' || series.key === 'exported';

/** What a slot's columns rise to (kWh): its parts above the line together, the bubble's figure and a ghost's. */
export const riseOf = (series: readonly UsageSeries[], index: number): number =>
  series.reduce((sum, s) => sum + Math.max(0, s.values[index] ?? 0), 0);

/** How far a slot's columns fall (kWh): what went out of it, below the line. */
export const fallOf = (series: readonly UsageSeries[], index: number): number =>
  -series.reduce((sum, s) => sum + Math.min(0, s.values[index] ?? 0), 0);

/** What the series above the line add up to over the range (kWh): the head's figure, what the card draws of it. */
export const drawnTotal = (series: readonly UsageSeries[]): number =>
  series.reduce((sum, s) => (isReturn(s) ? sum : sum + s.total), 0);

/** Heckbert's nice fractions within a decade, and the decimal a step of each writes below the units. */
const NICE: ReadonlyArray<readonly [fraction: number, decimal: 0 | 1]> = [
  [1, 0],
  [2, 0],
  [2.5, 1],
  [5, 0],
];

/**
 * The scale the columns stand on, hugging what they reach on both sides of zero (`low` the deepest fall, `high` the
 * tallest rise): of the nice steps (1 · 2 · 2.5 · 5 × 10ⁿ), the one whose outermost tick on each side — the first of
 * its multiples at or beyond that side's extreme — spans the least, three to five ticks over the whole (the more where
 * two span alike). A week rising to 18 and falling to 9 reads −10 · 0 · 10 · 20, not −20 … 40. Nothing either side:
 * zero alone.
 */
export function usageTicks(low: number, high: number): Ticks {
  const lo = Math.min(0, low);
  const hi = Math.max(0, high);
  if (!(hi > lo)) return niceTicks(0, 0);
  let best: { step: number; from: number; to: number; decimals: number } | undefined;
  const first = Math.floor(Math.log10((hi - lo) / 4)) - 1;
  for (let exponent = first; exponent <= first + 3; exponent++)
    for (const [fraction, decimal] of NICE) {
      const step = fraction * 10 ** exponent;
      const from = Math.floor(lo / step + 1e-9);
      const to = Math.ceil(hi / step - 1e-9);
      if (to - from < 2 || to - from > 4) continue;
      if (best && (to - from) * step >= (best.to - best.from) * best.step - 1e-9) continue;
      best = { step, from, to, decimals: Math.max(0, -exponent) + (exponent <= 0 ? decimal : 0) };
    }
  if (!best) return niceTicks(lo, hi);
  const { step, from, to, decimals } = best;
  const ticks = Array.from({ length: to - from + 1 }, (_unused, i) =>
    Number(((from + i) * step).toFixed(decimals)),
  );
  return {
    min: ticks[0] as number,
    max: ticks[ticks.length - 1] as number,
    step,
    ticks,
    decimals: ticks.every(Number.isInteger) ? 0 : decimals,
  };
}
