import { measureIds, type PrefSource } from '../energy-model/prefs.js';
import type { Directed } from '../energy-model/reading.js';
import { DEFAULT_THRESHOLD } from '../energy-model/sources.js';

/**
 * The grid card's arithmetic: which way the grid flows, the voltage its head can claim, and which of the Energy
 * dashboard's connections is the one the card reads.
 */

export type GridWay = 'both' | 'in' | 'out';

/** Importing, exporting, or both at once (a grid read per phase or by two sensors); null when it rests. */
export function gridWay(reading: Directed, threshold = DEFAULT_THRESHOLD): GridWay | null {
  const importing = (reading.in ?? 0) >= threshold;
  const exporting = (reading.out ?? 0) >= threshold;
  return importing && exporting ? 'both' : importing ? 'in' : exporting ? 'out' : null;
}

/** The mean of every value, or null as soon as one cannot be read: a mean that skipped a dead phase is another claim. */
export function meanOf(values: readonly (number | null)[]): number | null {
  if (!values.length || values.some((v) => v === null)) return null;
  return (values as number[]).reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The Energy dashboard's connection a card reads: the one whose power sensors it shares; with sensors of its own that
 * none shares, the only connection there is (the house's one grid, read another way); with no sensors, the first.
 */
export function connectionOf(
  connections: readonly PrefSource[],
  own: readonly string[],
): PrefSource | undefined {
  const grid = connections.filter((c) => c.kind === 'grid');
  if (!own.length) return grid[0];
  const ids = new Set(own);
  return (
    grid.find((c) => measureIds(c.measure).some((id) => ids.has(id))) ??
    (grid.length === 1 ? grid[0] : undefined)
  );
}
