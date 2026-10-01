import type { GlyphName, Tone } from '@fluvy/ui';
import {
  readPrefs,
  type EnergyPrefs,
  type PowerMeasure,
  type PrefSource,
  type SourceKind,
} from './prefs.js';

/**
 * A source as a card's configuration writes it — the one vocabulary of every energy card:
 *
 *   sources:
 *     - type: solar
 *       power: sensor.pv
 *     - type: grid
 *       import: sensor.grid_in                 # two sensors, both positive
 *       export: sensor.grid_out
 *       # or power: sensor.grid_net (+ import) · phases: [sensor.l1, sensor.l2, sensor.l3] (each signed)
 *     - type: battery
 *       power: sensor.battery                  # + discharging; `invert: true` for a meter signed the other way
 *       level: sensor.battery_soc
 *
 * Without `sources`, a card reads the house's energy preferences (every grid connection, array and battery).
 */
export type Arrows = 'arrival' | 'none';
export type Show = 'always' | 'active' | 'never';
export const ARROWS: readonly Arrows[] = ['arrival', 'none'];
export const SHOWS: readonly Show[] = ['always', 'active', 'never'];
export const SOURCE_KINDS: readonly SourceKind[] = [
  'solar',
  'grid',
  'battery',
  'generator',
  'vehicle',
];

export interface SourceConfig {
  type: SourceKind;
  /** One signed sensor: + toward the house (import, production, discharge). */
  power?: string;
  /** Signed sensors summed per sign: one per phase, per inverter, per string. */
  phases?: readonly string[];
  /** Two sensors, both positive: what comes in and what goes out. */
  import?: string;
  export?: string;
  invert?: boolean;
  /** State of charge (a battery, a car), in %. */
  level?: string;
  /** Usable capacity in kWh: weights a group's state of charge, and gives "full in". */
  capacity?: number;
  name?: string;
  icon?: string;
  color?: string;
  arrows?: Arrows;
  show?: Show;
  /** Below this many watts a direction rests (default 10). */
  threshold?: number;
}

export const SOURCE_KEYS = [
  'type',
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
  'arrows',
  'show',
  'threshold',
] as const;

/** A kind's glyph and tone: the grid's pylon (the head keeps the bolt), the car in its own colour. */
export const KIND: Readonly<Record<SourceKind, { glyph: GlyphName; tone: Tone }>> = {
  solar: { glyph: 'sun', tone: 'solar' },
  grid: { glyph: 'tower', tone: 'grid' },
  battery: { glyph: 'battery', tone: 'battery' },
  generator: { glyph: 'generator', tone: 'gas' },
  vehicle: { glyph: 'car', tone: 'vehicle' },
};

const list = (v: string | readonly string[] | undefined): string[] =>
  v === undefined ? [] : (typeof v === 'string' ? [v] : [...v]).filter((id) => id !== '');

/** How a source's power is read. */
export function measureOfSource(s: SourceConfig): PowerMeasure | null {
  const power = [...list(s.power), ...list(s.phases)];
  if (!power.length && !s.import && !s.export) return null;
  return {
    ...(power.length ? { power } : {}),
    ...(s.invert ? { invert: true } : {}),
    ...(s.import ? { import: s.import } : {}),
    ...(s.export ? { export: s.export } : {}),
  };
}

/** The entities a source reads. */
export const sourceIds = (s: SourceConfig): string[] =>
  [...list(s.power), ...list(s.phases), s.import, s.export, s.level].filter(
    (id): id is string => !!id,
  );

/** A source can import and export at the same moment only when it is read by phase or by two sensors. */
export const bothWays = (s: SourceConfig): boolean =>
  s.type === 'grid' && (list(s.phases).length > 1 || (!!s.import && !!s.export));

/** 1.3's flat keys as sources (read, never written): `solar_power`, `grid_power` + `grid_invert`, `battery_*`. */
export interface LegacyFlowKeys {
  solar_power?: string;
  grid_power?: string;
  grid_invert?: boolean;
  battery_power?: string;
  battery_invert?: boolean;
  battery_level?: string;
}
export function legacySources(c: LegacyFlowKeys): SourceConfig[] {
  const out: SourceConfig[] = [];
  if (c.solar_power) out.push({ type: 'solar', power: c.solar_power });
  if (c.grid_power)
    out.push({ type: 'grid', power: c.grid_power, ...(c.grid_invert ? { invert: true } : {}) });
  if (c.battery_power)
    out.push({
      type: 'battery',
      power: c.battery_power,
      ...(c.battery_invert ? { invert: true } : {}),
      ...(c.battery_level ? { level: c.battery_level } : {}),
    });
  return out;
}

/** How a power is read, in a card's words: one sensor, one per phase, or two (import and export). */
export type MeasureKeys = Pick<SourceConfig, 'power' | 'phases' | 'invert' | 'import' | 'export'>;

export function measureKeys(m: PowerMeasure): MeasureKeys {
  return {
    ...(m.power?.length === 1
      ? { power: m.power[0] as string }
      : m.power?.length
        ? { phases: m.power }
        : {}),
    ...(m.invert ? { invert: true } : {}),
    ...(m.import ? { import: m.import } : {}),
    ...(m.export ? { export: m.export } : {}),
  };
}

/** A source the preferences describe, as a card's source. */
export function prefSourceConfig(p: PrefSource): SourceConfig | null {
  const m = p.measure;
  if (!m) return null;
  return {
    type: p.kind,
    ...measureKeys(m),
    ...(p.soc ? { level: p.soc } : {}),
    ...(p.capacity ? { capacity: p.capacity } : {}),
    ...(p.name ? { name: p.name } : {}),
  };
}

/** The live sources of a house as its energy preferences describe them. */
export const prefSources = (prefs: EnergyPrefs | null | undefined): SourceConfig[] =>
  readPrefs(prefs)
    .sources.map(prefSourceConfig)
    .filter((s): s is SourceConfig => s !== null);

/** Several sources of one kind drawn as one node (a sum), or each on its own. */
export const DEFAULT_THRESHOLD = 10;
