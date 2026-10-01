/**
 * Home Assistant's energy preferences (`energy/get_prefs`), in every shape they have had, read into one model.
 *
 * - 2026.3+ (storage 1.3): every grid connection is its own `energy_sources[]` entry of `type: grid` with its import
 *   and export meters, costs and power (`stat_rate`, `power_config`).
 * - 2025.12 – 2026.2: one grid entry with `flow_from[]`, `flow_to[]` and `power[]` — paired by index into connections,
 *   the way core migrates them; `power[]` entries may carry a `power_config` from 2026.2.
 * - Before 2025.12: energy meters only, no power.
 *
 * `power_config` keeps what the user chose: one signed sensor (`stat_rate`), one signed the other way
 * (`stat_rate_inverted`), or two sensors (`stat_rate_from` = import / discharge, `stat_rate_to` = export / charge).
 * Core turns the last into a single net helper; the cards read the two sensors instead, so a house that imports and
 * exports at the same moment (three phases, the sun on one) shows both.
 */

export interface PowerConfigPref {
  readonly stat_rate?: string;
  readonly stat_rate_inverted?: string;
  readonly stat_rate_from?: string;
  readonly stat_rate_to?: string;
}

interface PowerPref {
  readonly stat_rate?: string;
  readonly power_config?: PowerConfigPref;
}

export interface EnergySourcePref extends PowerPref {
  readonly type: string;
  readonly name?: string;
  readonly stat_energy_from?: string | null;
  readonly stat_energy_to?: string | null;
  readonly flow_from?: ReadonlyArray<{ readonly stat_energy_from: string }>;
  readonly flow_to?: ReadonlyArray<{ readonly stat_energy_to: string }>;
  readonly power?: readonly PowerPref[];
  readonly stat_soc?: string;
  readonly capacity?: number;
  readonly stat_cost?: string | null;
  readonly stat_compensation?: string | null;
}

export interface DeviceConsumptionPref {
  readonly stat_consumption: string;
  readonly name?: string;
  /** The upstream device's `stat_consumption`: this device's energy is part of that one's. */
  readonly included_in_stat?: string;
  readonly stat_rate?: string;
}

export interface EnergyPrefs {
  readonly energy_sources?: readonly EnergySourcePref[];
  readonly device_consumption?: readonly DeviceConsumptionPref[];
  readonly device_consumption_water?: readonly DeviceConsumptionPref[];
}

/**
 * How a node's live power is read. `power`: signed sensors (+ toward the house: import, discharge, production),
 * summed per sign — a list is one per phase or per inverter. `import` / `export`: two sensors, both positive.
 * `invert` flips the signed sensors (a meter that counts export as positive).
 */
export interface PowerMeasure {
  readonly power?: readonly string[];
  readonly invert?: boolean;
  readonly import?: string;
  readonly export?: string;
}

export type SourceKind = 'solar' | 'grid' | 'battery' | 'generator' | 'vehicle';

/** One source of the house, as the energy preferences describe it. */
export interface PrefSource {
  readonly kind: SourceKind;
  readonly name?: string;
  readonly measure: PowerMeasure | null;
  /** Energy meters into the house (import, production, discharge) and out of it (export, charge). */
  readonly energyIn: readonly string[];
  readonly energyOut: readonly string[];
  readonly soc?: string;
  readonly capacity?: number;
  readonly cost?: string;
  readonly compensation?: string;
}

export interface PrefDevice {
  readonly stat: string;
  readonly name?: string;
  readonly parent?: string;
  readonly power?: string;
}

export interface HouseEnergy {
  readonly sources: readonly PrefSource[];
  readonly devices: readonly PrefDevice[];
  readonly gas: readonly string[];
  readonly water: readonly string[];
}

const nonEmpty = (id: string | null | undefined): id is string =>
  typeof id === 'string' && id !== '';

/** A power preference as a measure: the two sensors when the user gave two, else the signed one. */
export function measureOf(pref: PowerPref | undefined): PowerMeasure | null {
  const config = pref?.power_config;
  if (config) {
    if (nonEmpty(config.stat_rate_from) && nonEmpty(config.stat_rate_to))
      return { import: config.stat_rate_from, export: config.stat_rate_to };
    if (nonEmpty(config.stat_rate_inverted))
      return { power: [config.stat_rate_inverted], invert: true };
    if (nonEmpty(config.stat_rate)) return { power: [config.stat_rate] };
  }
  return nonEmpty(pref?.stat_rate) ? { power: [pref.stat_rate] } : null;
}

/** The grid connections of one `type: grid` entry: itself (2026.3+), or its legacy arrays paired by index. */
function gridConnections(entry: EnergySourcePref): PrefSource[] {
  const legacy =
    entry.flow_from !== undefined || entry.flow_to !== undefined || entry.power !== undefined;
  if (!legacy)
    return [
      {
        kind: 'grid',
        ...(entry.name ? { name: entry.name } : {}),
        measure: measureOf(entry),
        energyIn: [entry.stat_energy_from].filter(nonEmpty),
        energyOut: [entry.stat_energy_to].filter(nonEmpty),
        ...(nonEmpty(entry.stat_cost) ? { cost: entry.stat_cost } : {}),
        ...(nonEmpty(entry.stat_compensation) ? { compensation: entry.stat_compensation } : {}),
      },
    ];
  const from = entry.flow_from ?? [];
  const to = entry.flow_to ?? [];
  const power = entry.power ?? [];
  const count = Math.max(from.length, to.length, power.length, 1);
  return Array.from({ length: count }, (_, i) => ({
    kind: 'grid' as const,
    measure: measureOf(power[i]),
    energyIn: [from[i]?.stat_energy_from].filter(nonEmpty),
    energyOut: [to[i]?.stat_energy_to].filter(nonEmpty),
  })).filter((c) => c.measure || c.energyIn.length || c.energyOut.length);
}

/** The house's energy as its preferences describe it: every grid connection, array, battery, device, gas and water meter. */
export function readPrefs(prefs: EnergyPrefs | null | undefined): HouseEnergy {
  const sources: PrefSource[] = [];
  const gas: string[] = [];
  const water: string[] = [];
  for (const entry of prefs?.energy_sources ?? []) {
    switch (entry.type) {
      case 'grid':
        sources.push(...gridConnections(entry));
        break;
      case 'solar':
        sources.push({
          kind: 'solar',
          ...(entry.name ? { name: entry.name } : {}),
          measure: nonEmpty(entry.stat_rate) ? { power: [entry.stat_rate] } : null,
          energyIn: [entry.stat_energy_from].filter(nonEmpty),
          energyOut: [],
        });
        break;
      case 'battery':
        sources.push({
          kind: 'battery',
          ...(entry.name ? { name: entry.name } : {}),
          measure: measureOf(entry),
          energyIn: [entry.stat_energy_from].filter(nonEmpty),
          energyOut: [entry.stat_energy_to].filter(nonEmpty),
          ...(nonEmpty(entry.stat_soc) ? { soc: entry.stat_soc } : {}),
          ...(typeof entry.capacity === 'number' && entry.capacity > 0
            ? { capacity: entry.capacity }
            : {}),
        });
        break;
      case 'gas':
        if (nonEmpty(entry.stat_energy_from)) gas.push(entry.stat_energy_from);
        break;
      case 'water':
        if (nonEmpty(entry.stat_energy_from)) water.push(entry.stat_energy_from);
        break;
    }
  }
  const devices = (prefs?.device_consumption ?? [])
    .filter((d) => nonEmpty(d.stat_consumption))
    .map((d) => ({
      stat: d.stat_consumption,
      ...(d.name ? { name: d.name } : {}),
      ...(nonEmpty(d.included_in_stat) ? { parent: d.included_in_stat } : {}),
      ...(nonEmpty(d.stat_rate) ? { power: d.stat_rate } : {}),
    }));
  // Home Assistant lists the grid first; every diagram reads from the sun down: the sun, the grid, a generator, the
  // batteries, a car (the order within a kind is the dashboard's)
  const rank: Readonly<Record<SourceKind, number>> = {
    solar: 0,
    grid: 1,
    generator: 2,
    battery: 3,
    vehicle: 4,
  };
  const ordered = sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => rank[a.source.kind] - rank[b.source.kind] || a.index - b.index)
    .map(({ source }) => source);
  return { sources: ordered, devices, gas, water };
}

/** Every entity a measure reads. */
export const measureIds = (m: PowerMeasure | null | undefined): string[] =>
  m ? [...(m.power ?? []), m.import, m.export].filter(nonEmpty) : [];
