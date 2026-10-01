import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import { DEFAULT_THRESHOLD, measureKeys, type SourceConfig } from '../energy-model/sources.js';

/**
 * A house's batteries read as one: the arithmetic of the batteries card, kept apart from the drawing so every rule
 * of it is tested. Nothing is estimated: a state of charge that cannot be read makes the group's "—", a battery
 * whose power cannot be read leaves the group's power unknown, and a time is given only when the capacity, the
 * charge and the power are all known.
 */

/** A battery as the card's config writes it: a source of the energy model, without its kind. */
export type BatteryConfig = Omit<SourceConfig, 'type' | 'arrows' | 'show' | 'threshold'>;

export const BATTERY_KEYS = [
  'power',
  'phases',
  'import',
  'export',
  'invert',
  'level',
  'capacity',
  'name',
  'icon',
  'color',
] as const;

/** One battery, read. `undefined` = not configured (not drawn); `null` = configured but unreadable ("—"). */
export interface Cell {
  /** State of charge in %, 0–100. */
  readonly level: number | null | undefined;
  /** Usable capacity in kWh. */
  readonly capacity: number | undefined;
  /** Watts into the battery: + charging, − discharging. */
  readonly charge: number | null | undefined;
}

export type Way = 'charging' | 'discharging' | 'idle';

/** The batteries of the Energy dashboard, as the card's own: a battery with a state of charge but no power still counts. */
export function prefBatteries(prefs: EnergyPrefs | null | undefined): BatteryConfig[] {
  return readPrefs(prefs)
    .sources.filter((p) => p.kind === 'battery')
    .map((p): BatteryConfig => ({
      ...(p.measure ? measureKeys(p.measure) : {}),
      ...(p.soc ? { level: p.soc } : {}),
      ...(p.capacity ? { capacity: p.capacity } : {}),
      ...(p.name ? { name: p.name } : {}),
    }))
    .filter((b) => hasPower(b) || b.level !== undefined);
}

/** Whether a battery says how its power is read. */
export const hasPower = (b: BatteryConfig): boolean =>
  Boolean(b.power) || Boolean(b.phases?.length) || Boolean(b.import) || Boolean(b.export);

const clampLevel = (v: number): number => Math.min(100, Math.max(0, v));

/**
 * The group's state of charge, or `undefined` when no battery has one to read. Weighted by capacity (a 10 kWh battery
 * at 72 % and a 5 kWh one at 40 % hold 61 %, not 56 %); `null` when one cannot be read, a battery has none at all, or
 * two or more batteries do not all state their capacity — a plain mean would assume them equal, and the group's
 * charge is then not known.
 */
export function stateOfCharge(cells: readonly Cell[]): number | null | undefined {
  if (!cells.some((c) => c.level !== undefined)) return undefined;
  const levels: number[] = [];
  for (const c of cells) {
    if (c.level === null || c.level === undefined) return null;
    levels.push(clampLevel(c.level));
  }
  if (!levels.length) return undefined;
  const capacities = cells.map((c) => c.capacity);
  if (capacities.every((k): k is number => typeof k === 'number' && k > 0)) {
    const total = capacities.reduce((sum, k) => sum + k, 0);
    return levels.reduce((sum, level, i) => sum + level * (capacities[i] as number), 0) / total;
  }
  return levels.length === 1 ? (levels[0] as number) : null;
}

/** The group's power into its batteries (+ charging), or `undefined` when none is read, `null` when one cannot be. */
export function netCharge(cells: readonly Cell[]): number | null | undefined {
  if (!cells.some((c) => c.charge !== undefined)) return undefined;
  let sum = 0;
  for (const c of cells) {
    if (c.charge === null || c.charge === undefined) return null;
    sum += c.charge;
  }
  return sum;
}

/** The capacity of the group in kWh, when every battery states one. */
export function totalCapacity(cells: readonly Cell[]): number | undefined {
  if (!cells.length) return undefined;
  let sum = 0;
  for (const c of cells) {
    if (typeof c.capacity !== 'number' || !(c.capacity > 0)) return undefined;
    sum += c.capacity;
  }
  return sum;
}

/** Which way a power goes: below the threshold it rests. */
export function wayOf(watts: number, threshold = DEFAULT_THRESHOLD): Way {
  return watts >= threshold ? 'charging' : watts <= -threshold ? 'discharging' : 'idle';
}

/**
 * Seconds until the group is full (charging) or down to its reserve (discharging), at the power of now; `null` when
 * anything it needs is unknown, when nothing flows, when there is nothing left to count (full, at the reserve), or
 * when one battery charges while another drains — the group then never gets full nor empty at these powers.
 */
export function timeLeft(cells: readonly Cell[], reserve = 0): number | null {
  const capacity = totalCapacity(cells);
  const level = stateOfCharge(cells);
  const net = netCharge(cells);
  if (capacity === undefined || typeof level !== 'number' || typeof net !== 'number') return null;
  const ways = new Set(cells.map((c) => wayOf(c.charge ?? 0)).filter((w) => w !== 'idle'));
  if (ways.size > 1) return null;
  const way = wayOf(net);
  if (way === 'idle') return null;
  const stored = (level / 100) * capacity; // kWh
  const floor = (clampLevel(reserve) / 100) * capacity;
  const kwh = way === 'charging' ? capacity - stored : stored - floor;
  if (!(kwh > 0)) return null;
  return (kwh * 1000 * 3600) / Math.abs(net);
}
