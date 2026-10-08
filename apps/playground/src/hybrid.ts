import { house, type Handler } from './houses.js';

/**
 * Issue #23's house, for the energy card's `sources` frames: a hybrid inverter with the sun on its DC side and a
 * battery that charges hard at midday. Its POWER sensors are right (the sun, the grid signed, the battery signed); its
 * ENERGY meters are what such a house often has — they tick in 0.1 kWh steps, and the "solar" meter is the inverter's
 * AC output (the sun less what went into the battery, plus what came out of it at night). The recorder was down from
 * 03:00 to 03:30. Home Assistant's own "Power sources" graph draws this house right from the power sensors; a chart
 * drawn from the meters cannot.
 */

/** The sheet's midnight in the browser's own zone, as the card counts its day (a runner in UTC and a desk in Madrid differ). */
const DAY = new Date(2026, 8, 17).getTime();
const STEP = 300_000;
/** The sheet's moment, 21:47: buckets up to it. */
const BUCKETS = 262;
const GAP = new Set(Array.from({ length: 6 }, (_, i) => 36 + i)); // 03:00–03:30

interface Bucket {
  readonly sun: number;
  readonly house: number;
  readonly charge: number;
  readonly discharge: number;
  readonly imported: number;
  readonly exported: number;
}

/** The day in kW, a value a five-minute bucket: a 6 kW bell of sun, a 4.5 kW charge at midday, the battery at night. */
function day(): Bucket[] {
  const out: Bucket[] = [];
  for (let i = 0; i < BUCKETS; i++) {
    const h = (i * 5 + 2.5) / 60;
    const sun = 6.2 * Math.max(0, Math.sin(((h - 7) / 12) * Math.PI));
    const house =
      1.0 +
      0.4 * Math.exp(-((h - 7.5) ** 2) / 1.2) +
      0.6 * Math.exp(-((h - 13.5) ** 2) / 0.5) +
      1.2 * Math.exp(-((h - 19.5) ** 2) / 3);
    const window = h > 9 && h < 15 ? Math.sin(((h - 9) / 6) * Math.PI) : 0;
    const charge = Math.min(4.5, Math.max(0, sun - house)) * window;
    const night = h < 7.5 || h > 17;
    const discharge = night ? Math.min(house, 1.3) : 0;
    const exported = Math.max(0, sun - house - charge);
    const imported = Math.max(0, house - sun - discharge);
    out.push({ sun, house, charge, discharge, imported, exported });
  }
  return out;
}

/** A meter's five-minute changes when it counts in 0.1 kWh steps: the cumulative energy floored to the step. */
function ticks(kw: readonly number[]): number[] {
  let total = 0;
  let shown = 0;
  return kw.map((p) => {
    total += p / 12;
    const next = Math.floor(total * 10 + 1e-9) / 10;
    const change = next - shown;
    shown = next;
    return change;
  });
}

const D = day();
const series = (pick: (b: Bucket) => number): number[] => D.map(pick);

/** The battery's usable capacity (kWh) and its charge at midnight (%). */
const CAPACITY = 15;
const MIDNIGHT_LEVEL = 70;

/** Its state of charge through the day: what went in less what came out, at the end of each five minutes. */
function charge(): number[] {
  let level = MIDNIGHT_LEVEL;
  return D.map((b) => {
    level = Math.min(100, Math.max(0, level + (((b.charge - b.discharge) / 12) * 100) / CAPACITY));
    return level;
  });
}
const LEVELS = charge();

/** The power sensors' five-minute means (kW): the truth. */
const MEANS: Record<string, number[]> = {
  'sensor.hy_pv': series((b) => b.sun),
  'sensor.hy_grid': series((b) => b.imported - b.exported),
  'sensor.hy_battery': series((b) => b.discharge - b.charge),
  'sensor.hy_soc': LEVELS,
  'sensor.hy_battery_2': series(() => 0),
};
/** The energy meters' five-minute changes (kWh): coarse, and the "solar" meter is the inverter's AC side. */
const METERS: Record<string, number[]> = {
  'sensor.hy_solar_energy': ticks(series((b) => Math.max(0, b.sun - b.charge) + b.discharge)),
  'sensor.hy_grid_in_energy': ticks(series((b) => b.imported)),
  'sensor.hy_grid_out_energy': ticks(series((b) => b.exported)),
  'sensor.hy_battery_out_energy': ticks(series((b) => b.discharge)),
  'sensor.hy_battery_in_energy': ticks(series((b) => b.charge)),
};

const rows = (id: string, mean: boolean) => {
  const list = (mean ? MEANS : METERS)[id];
  if (!list) return [];
  return list.flatMap((value, i) =>
    GAP.has(i)
      ? []
      : [
          mean
            ? { start: DAY + i * STEP, end: DAY + (i + 1) * STEP, mean: value }
            : { start: DAY + i * STEP, change: value },
        ],
  );
};

/** The hourly changes the legend of the meters' path reads (the Energy dashboard's arithmetic). */
const hourly = (id: string) => {
  const list = METERS[id] ?? [];
  const hours = new Map<number, number>();
  list.forEach((value, i) => {
    if (GAP.has(i)) return;
    const hour = Math.floor(i / 12);
    hours.set(hour, (hours.get(hour) ?? 0) + value);
  });
  return [...hours.entries()].map(([hour, change]) => ({ start: DAY + hour * 3600_000, change }));
};

const statistics: Handler = (message) =>
  Object.fromEntries(
    ((message['statistic_ids'] as string[] | undefined) ?? []).map((id) => {
      const types = (message['types'] as string[] | undefined) ?? [];
      if (types.includes('mean')) return [id, rows(id, true)];
      return [id, message['period'] === '5minute' ? rows(id, false) : hourly(id)];
    }),
  );

const prefs = (power: boolean, batteries = 1, capacity = true) => ({
  energy_sources: [
    {
      type: 'grid',
      stat_energy_from: 'sensor.hy_grid_in_energy',
      stat_energy_to: 'sensor.hy_grid_out_energy',
      ...(power ? { stat_rate: 'sensor.hy_grid' } : {}),
    },
    {
      type: 'solar',
      stat_energy_from: 'sensor.hy_solar_energy',
      ...(power ? { stat_rate: 'sensor.hy_pv' } : {}),
    },
    // a second battery idles all day: it only says its own charge
    ...Array.from({ length: batteries }, (_, i) => ({
      type: 'battery',
      stat_energy_from: i === 0 ? 'sensor.hy_battery_out_energy' : 'sensor.hy_battery_2_out_energy',
      stat_energy_to: i === 0 ? 'sensor.hy_battery_in_energy' : 'sensor.hy_battery_2_in_energy',
      ...(power ? { stat_rate: i === 0 ? 'sensor.hy_battery' : 'sensor.hy_battery_2' } : {}),
      stat_soc: i === 0 ? 'sensor.hy_soc' : 'sensor.hy_soc_2',
      ...(capacity ? { capacity: CAPACITY } : {}),
    })),
  ],
  device_consumption: [],
});

/** The house with its power sensors in the Energy dashboard, and the same house with its meters alone. */
export const hybridWithPower = house({
  'energy/get_prefs': () => prefs(true),
  'recorder/statistics_during_period': statistics,
});
export const hybridMetersOnly = house({
  'energy/get_prefs': () => prefs(false),
  'recorder/statistics_during_period': statistics,
});
/** Two batteries that do not state their capacity: their group's charge cannot be known (no line, "—"). */
export const hybridTwoBatteries = house({
  'energy/get_prefs': () => prefs(true, 2, false),
  'recorder/statistics_during_period': statistics,
});
/** The house without its battery. */
export const hybridNoBattery = house({
  'energy/get_prefs': () => prefs(true, 0),
  'recorder/statistics_during_period': statistics,
});

/** Its live sensors at 21:47: the sun down, the battery carrying the evening, a little from the grid. */
export const HYBRID_STATES = [
  ['sensor.hy_pv', '0', 'Inverter PV power'],
  ['sensor.hy_grid', '0.3', 'Grid power'],
  ['sensor.hy_battery', '1.3', 'Battery power'],
  ['sensor.hy_battery_2', '0', 'Second battery power'],
] as const;

/** Its batteries' charge at 21:47 (%): the first, and a second one for the two-battery house. */
export const HYBRID_LEVELS = [
  ['sensor.hy_soc', String(Math.round(LEVELS[LEVELS.length - 1] ?? 0))],
  ['sensor.hy_soc_2', '48'],
] as const;

/** What the suite compares with: the sun's power at noon and at 02:00 (kW). */
export const HYBRID_EXPECT = {
  sunAtNoon: MEANS['sensor.hy_pv']?.[144] ?? 0,
  /** The battery's charge at noon (%), on its own scale. */
  levelAtNoon: LEVELS[144] ?? 0,
};
