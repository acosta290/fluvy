/**
 * Who feeds whom: Home Assistant's own allocation (`computeConsumptionSingle` in its frontend), so Fluvy's figures
 * match the Energy dashboard's. It runs on one instant (live watts) or on one hour of energy, and period totals are
 * the sum of the hours — never an allocation of the sums, which would net an hour of import against an hour of
 * export.
 *
 * Priority: excess grid → battery first (grid energy that the house did not use), then sun → battery, sun → grid,
 * battery → grid, grid → battery, sun → house, battery → house, grid → house. A generator and a car that powers the
 * house (V2H) feed the house after the battery and before the grid.
 */

export interface Totals {
  readonly solar: number;
  readonly fromGrid: number;
  readonly toGrid: number;
  readonly fromBattery: number;
  readonly toBattery: number;
  readonly generator?: number;
  readonly fromVehicle?: number;
  /** A car charging from the house as a node of its own (a battery on wheels), not as one of its devices. */
  readonly toVehicle?: number;
}

export interface Allocation {
  readonly usedTotal: number;
  readonly usedSolar: number;
  readonly usedBattery: number;
  readonly usedGrid: number;
  readonly usedGenerator: number;
  readonly usedVehicle: number;
  readonly solarToBattery: number;
  readonly solarToGrid: number;
  readonly batteryToGrid: number;
  readonly gridToBattery: number;
  readonly solarToVehicle: number;
  readonly gridToVehicle: number;
}

const pos = (n: number | undefined): number => Math.max(0, n ?? 0);

export function allocate(t: Totals): Allocation {
  let solar = pos(t.solar);
  let fromGrid = pos(t.fromGrid);
  let toGrid = pos(t.toGrid);
  let fromBattery = pos(t.fromBattery);
  let toBattery = pos(t.toBattery);
  const generator = pos(t.generator);
  const fromVehicle = pos(t.fromVehicle);
  let toVehicle = pos(t.toVehicle);
  const usedTotal = Math.max(
    0,
    fromGrid + solar + fromBattery + generator + fromVehicle - toGrid - toBattery - toVehicle,
  );

  // grid energy beyond what the house used can only have gone into the battery
  const excess = Math.max(0, Math.min(toBattery, fromGrid - usedTotal));
  let gridToBattery = excess;
  toBattery -= excess;
  fromGrid -= excess;

  const solarToBattery = Math.min(solar, toBattery);
  toBattery -= solarToBattery;
  solar -= solarToBattery;

  // a car charging takes the sun after the battery and before the grid does, then the grid's
  const solarToVehicle = Math.min(solar, toVehicle);
  toVehicle -= solarToVehicle;
  solar -= solarToVehicle;

  const solarToGrid = Math.min(solar, toGrid);
  toGrid -= solarToGrid;
  solar -= solarToGrid;

  const batteryToGrid = Math.min(fromBattery, toGrid);
  fromBattery -= batteryToGrid;

  const second = Math.min(fromGrid, toBattery);
  gridToBattery += second;
  fromGrid -= second;

  const gridToVehicle = Math.min(fromGrid, toVehicle);

  const usedSolar = Math.min(usedTotal, solar);
  const usedBattery = Math.min(fromBattery, usedTotal - usedSolar);
  const usedGenerator = Math.min(generator, usedTotal - usedSolar - usedBattery);
  const usedVehicle = Math.min(fromVehicle, usedTotal - usedSolar - usedBattery - usedGenerator);
  const usedGrid = Math.max(0, usedTotal - usedSolar - usedBattery - usedGenerator - usedVehicle);
  return {
    usedTotal,
    usedSolar,
    usedBattery,
    usedGrid,
    usedGenerator,
    usedVehicle,
    solarToBattery,
    solarToGrid,
    batteryToGrid,
    gridToBattery,
    solarToVehicle,
    gridToVehicle,
  };
}

/** Adds allocations (hours of a period). */
export function sumAllocations(list: readonly Allocation[]): Allocation {
  const zero: Allocation = {
    usedTotal: 0,
    usedSolar: 0,
    usedBattery: 0,
    usedGrid: 0,
    usedGenerator: 0,
    usedVehicle: 0,
    solarToBattery: 0,
    solarToGrid: 0,
    batteryToGrid: 0,
    gridToBattery: 0,
    solarToVehicle: 0,
    gridToVehicle: 0,
  };
  return list.reduce(
    (acc, a) =>
      Object.fromEntries(
        Object.keys(acc).map((k) => [k, acc[k as keyof Allocation] + a[k as keyof Allocation]]),
      ) as unknown as Allocation,
    zero,
  );
}

/** A period as Home Assistant's gauges read it: its totals, and bucket by bucket (hours of a day, days of a week). */
export interface ScoreInput {
  readonly totals: Totals;
  readonly buckets: ReadonlyArray<{ readonly totals: Totals }>;
  /** A battery's meters are part of the house: the sun is then followed through it. */
  readonly battery: boolean;
  /** The grid's export is metered: without it, what the sun gave away cannot be known. */
  readonly exported: boolean;
}

export interface Scores {
  /** How much of what the house used did not come from the grid (0 … 1), or null when it used nothing. */
  readonly selfPowered: number | null;
  /** How much of the sun's energy stayed in the house (0 … 1), or null when it cannot be known. */
  readonly sunUsed: number | null;
  /** Imported minus exported (+ a net importer). */
  readonly net: number;
}

/**
 * Home Assistant's gauges, to their arithmetic, so a Fluvy card and the Energy dashboard say the same number:
 *
 * - self-sufficiency (`hui-energy-self-sufficiency-gauge-card`): 1 − imported ÷ used, where "used" is the sum of
 *   each hour's use (imported + produced + discharged − exported − charged: a sum of the totals) floored at 0 — the
 *   grid charging the battery counts as the grid's;
 * - self-consumed solar (`calculateSolarConsumedGauge`): with no battery, the sun used by the house over the sun
 *   produced; with one, the sun is followed through it hour by hour, last in first out — what the battery gives the
 *   house or the grid is the sun's while the sun's charge is on top — and the share is the sun's energy used over
 *   the sun's energy used or exported (a charge still in the battery counts for neither). No export meter, no gauge.
 */
export function scores(p: ScoreInput): Scores {
  const t = p.totals;
  const used = Math.max(
    0,
    pos(t.fromGrid) + pos(t.solar) + pos(t.fromBattery) - pos(t.toGrid) - pos(t.toBattery),
  );
  return {
    selfPowered: used > 0 ? 1 - Math.min(1, pos(t.fromGrid) / used) : null,
    sunUsed: sunUsed(p),
    net: pos(t.fromGrid) - pos(t.toGrid),
  };
}

function sunUsed(p: ScoreInput): number | null {
  const solar = pos(p.totals.solar);
  if (!p.exported || solar <= 0) return null;
  const hours = p.buckets.map((b) => allocate(b.totals));
  if (!p.battery) return hours.reduce((sum, a) => sum + a.usedSolar, 0) / solar;

  let consumed = 0;
  let returned = 0;
  /** What the battery holds, by origin, newest last. */
  const stack: { sun: boolean; value: number }[] = [];
  const drain = (amount: number): { value: number; sun: boolean } => {
    const top = stack[stack.length - 1] as { sun: boolean; value: number };
    if (amount >= top.value) {
      stack.pop();
      return top;
    }
    top.value -= amount;
    return { value: amount, sun: top.sun };
  };
  for (const a of hours) {
    consumed += a.usedSolar;
    returned += a.solarToGrid;
    if (a.gridToBattery) stack.push({ sun: false, value: a.gridToBattery });
    if (a.solarToBattery) stack.push({ sun: true, value: a.solarToBattery });
    let toHouse = a.usedBattery;
    while (toHouse > 0 && stack.length) {
      const d = drain(toHouse);
      if (d.sun) consumed += d.value;
      toHouse -= d.value;
    }
    let toGrid = a.batteryToGrid;
    while (toGrid > 0 && stack.length) {
      const d = drain(toGrid);
      if (d.sun) returned += d.value;
      toGrid -= d.value;
    }
  }
  const total = consumed + returned;
  return total > 0 ? consumed / total : null;
}

/**
 * Home Assistant's low-carbon gauge (`hui-energy-carbon-consumed-gauge-card`): 1 − the grid's fossil energy (from
 * `energy/fossil_energy_consumption`) over the energy consumed, which it counts as imported + the sun not exported
 * (the battery does not enter it). Null when nothing was consumed.
 */
export function lowCarbon(t: Totals, fossil: number): number | null {
  const consumed = pos(t.fromGrid) + Math.max(0, pos(t.solar) - pos(t.toGrid));
  return consumed ? 1 - fossil / consumed : null;
}
