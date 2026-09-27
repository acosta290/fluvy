/**
 * The arithmetic of the flow diagram, kept apart from the drawing so its sign conventions can be
 * tested. Every figure is in watts and signed from the house's point of view:
 *   + flows towards the house (production, import, discharge), − flows away from it (export, charge).
 * `undefined` = not configured, `null` = configured but without a usable reading.
 */

export type Reading = number | null | undefined;

export interface Flows {
  readonly solar: Reading;
  readonly grid: Reading;
  readonly battery: Reading;
}

/** Below this a link reads "0" and nothing travels along it. */
export const IDLE = 0.5;

/**
 * What the house is drawing when it has no meter of its own: the balance of its sources. Known only
 * when every configured source is — a sum that silently skips a dead sensor is a wrong number.
 */
export function houseBalance(flows: Flows): number | null {
  let sum = 0;
  for (const value of [flows.solar, flows.grid, flows.battery]) {
    if (value === undefined) continue;
    if (value === null) return null;
    sum += value;
  }
  return Math.max(0, sum);
}

export type FlowStatus =
  | { readonly kind: 'solar'; readonly percent: number }
  | { readonly kind: 'importing' | 'exporting' | 'charging' | 'discharging' | 'idle' };

/** The head badge: how much of the house runs on sun; without sun, the bigger of the other two flows is the news. */
export function flowStatus(flows: Flows, home: number | null): FlowStatus {
  const solar = flows.solar ?? 0;
  const grid = flows.grid ?? 0;
  const battery = flows.battery ?? 0;
  if (solar >= IDLE && home !== null && home >= IDLE) {
    // what the sun actually runs: production less what leaves for the grid and what charges the battery
    const used = Math.max(0, solar - Math.max(0, -grid) - Math.max(0, -battery));
    return { kind: 'solar', percent: Math.round(Math.min(1, used / home) * 100) };
  }
  if (Math.abs(battery) >= IDLE && Math.abs(battery) > Math.abs(grid))
    return { kind: battery < 0 ? 'charging' : 'discharging' };
  if (Math.abs(grid) >= IDLE) return { kind: grid < 0 ? 'exporting' : 'importing' };
  return { kind: 'idle' };
}

/** 0 … 1 on a log scale, 50 W → 5 kW: a fridge and an oven both read, and a link depends on its own power only. */
export const intensity = (power: number): number =>
  Math.min(1, Math.max(0, Math.log10(Math.max(power, 1e-9) / 50) / 2));
