import { houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import { niceTicks, type Ticks } from '../chart/engine/index.js';
import { allocate, type Totals } from '../energy-model/allocate.js';
import type { Range, Step } from '../energy-model/period.js';
import type { SourceKind } from '../energy-model/prefs.js';
import { midnightOf } from '../energy-period/picker.js';

/**
 * The Energy usage card's figures, pure: a range in its slots (a day's hours, a week's or a month's days, a year's
 * months), each slot's energy by where the house took it from and where it went — Home Assistant's own series, from
 * the dashboard's own arithmetic (`allocate`, bucket by bucket) — and the series a card draws of them, in the order
 * and the colours it asks for, the sources past `max_sources` folded into one, on a scale that hugs them.
 */

/** A slot's grain: the buckets the range is read in (Home Assistant's `getSuggestedPeriod`). */
export type Grain = Exclude<Step, '5minute'>;

/** The sources an Energy dashboard meters (its preferences name no generator and no car): the usage graph's three. */
export type UsageKind = Extract<SourceKind, 'solar' | 'battery' | 'grid'>;

/** The sources from the bottom of the stack up: the sun (the house's own), the battery, the grid on top. */
export const USAGE_KINDS: readonly UsageKind[] = ['solar', 'battery', 'grid'];

/** A slot's energy (kWh): what the house used from each origin, and what went into the battery and out to the grid. */
export interface SlotEnergy {
  readonly used: Readonly<Record<UsageKind, number>>;
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

/**
 * Each slot's energy from the statistics' buckets: every bucket allocated on its own (an hour's import never netted
 * against another hour's export) and added into the slot it starts in; a bucket outside the slots is not drawn.
 * Above the line, `allocate`'s use by origin; below it, what the battery's and the grid's meters took (Home
 * Assistant's `to_battery` and `to_grid`).
 */
export function slotEnergy(
  buckets: ReadonlyArray<{ readonly start: number; readonly totals: Totals }>,
  slots: readonly number[],
  end: number,
): SlotEnergy[] {
  const out = slots.map(() => ({
    used: { solar: 0, battery: 0, grid: 0 },
    charged: 0,
    exported: 0,
  }));
  for (const { start, totals } of buckets) {
    if (start >= end) continue;
    let index = slots.length - 1;
    while (index >= 0 && (slots[index] as number) > start) index--;
    const slot = out[index];
    if (!slot) continue;
    const a = allocate(totals);
    slot.used.solar += a.usedSolar;
    slot.used.battery += a.usedBattery;
    slot.used.grid += a.usedGrid;
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

/** What a series is: a source above the line, the sources folded into one, or what went out below it. */
export type SeriesKey = UsageKind | 'other' | 'charged' | 'exported';

/** A series as the card draws it: kWh per slot (what went out below zero), and its total over the range. */
export interface UsageSeries {
  readonly key: SeriesKey;
  /** The source it is (above), the one it went into or out through (below); none for the folded sources. */
  readonly kind?: UsageKind;
  readonly values: readonly number[];
  readonly total: number;
  /** The source's own name and colour, as the card lists them. */
  readonly name?: string | undefined;
  readonly color?: string | undefined;
}

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
}

/**
 * The series a card draws, bottom of the stack first: the sources it shows (its `sources` in their order, else every
 * kind the house has from the sun up), the last of them folded into "other" past `max`, then below the line the
 * battery's charge and the export, for a battery and a grid that are shown and metered that way. A kind the house has
 * no meter for draws nothing; a kind listed twice is its first entry.
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
  const sources = shown.filter((s) => o.ins.has(s.type));
  const named = foldAt(sources.length, o.max);
  const out = sources.slice(0, named).map((s) =>
    series(
      s.type,
      slots.map((slot) => slot.used[s.type]),
      { kind: s.type, name: s.name, color: s.color },
    ),
  );
  const rest = sources.slice(named);
  if (rest.length)
    out.push(
      series(
        'other',
        slots.map((slot) => rest.reduce((sum, s) => sum + slot.used[s.type], 0)),
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

/** What the house used in a slot (kWh), every origin together: the ghost of a range compared, its bubble's figure. */
export const usedOf = (slot: SlotEnergy | undefined): number =>
  slot ? slot.used.solar + slot.used.battery + slot.used.grid : 0;

/** What left the house in a slot (kWh): into the battery and out to the grid. */
export const returnedOf = (slot: SlotEnergy | undefined): number =>
  slot ? slot.charged + slot.exported : 0;

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
