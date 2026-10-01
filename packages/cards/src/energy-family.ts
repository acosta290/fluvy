import type { LovelaceCardConfig } from '@fluvy/core';
import { HEAD, listLength, ROW, ROW_BAR } from './shared/heights.js';

/**
 * The energy family, announced at start and defined when its chunk lands (`energy-cards.ts`): what the card picker
 * lists and how tall each card is at a 360 column, without the cards themselves — so a dashboard with no energy on
 * it never waits for them, and every page keeps its budget.
 */

/** The flow's rows: the first node one pitch under the head's icon, a pitch between nodes. */
export const FLOW_TOP = 42;
export const FLOW_PITCH = 80;

const up4 = (v: number): number => Math.ceil(v / 4) * 4;

/** The flow at a 360 column: its nodes (or the cross), the period chips, the consumers' rows, the totals. */
export function flowHeight(config: LovelaceCardConfig): number {
  const sources = Array.isArray(config['sources']) ? config['sources'].length : 0;
  const count = Math.max(1, sources || 3);
  const last = FLOW_TOP + (count - 1) * FLOW_PITCH;
  const house = Math.round((FLOW_TOP + last) / 2 / 4) * 4;
  const stage = config['variant'] === 'cross' ? 292 : up4(Math.max(last + 22, house + 72));
  const period = config['period'] !== undefined && config['period'] !== 'live';
  // at a 360 column consumers are rows with bars (76), and the rest of the house one more
  const consumers = listLength(config, ['consumers']);
  return (
    HEAD +
    stage +
    (period && config['show_period'] !== false ? 60 : 0) +
    (consumers ? 16 + ROW_BAR * (consumers + 1) : 0) +
    (listLength(config, ['readouts']) ? 60 : 0)
  );
}

/** A grid source's phases, from its config (`phases`, or 1.3's `power` list). */
const phasesOf = (config: unknown): number => {
  const c = (config ?? {}) as Record<string, unknown>;
  const list = Array.isArray(c['phases'])
    ? c['phases']
    : Array.isArray(c['power'])
      ? c['power']
      : [];
  return list.length > 1 ? list.length : 0;
};

/** A block of the balance: 20 + its 20 head + 8 + the 12 bar + 12 + a 40 legend row. */
const BALANCE_BLOCK = 112;
/** A phase's row and the gap after it; the axis (4 + 16) under the last. */
const PHASE_PITCH = 40;

/**
 * The balance at a 360 column: its two blocks (a legend row each), the phases of a grid read by phase (live), the
 * period's chips and its money. A card that reads the Energy dashboard's sources is counted without phases.
 */
export function balanceHeight(config: LovelaceCardConfig): number {
  const period = config['period'] !== undefined && config['period'] !== 'live';
  const sources = Array.isArray(config['sources']) ? (config['sources'] as unknown[]) : [];
  const grid = sources.filter((s) => (s as Record<string, unknown> | null)?.['type'] === 'grid');
  const phases = period || config['show_phases'] === false ? 0 : Math.max(0, ...grid.map(phasesOf));
  return (
    64 +
    (period && config['show_period'] !== false ? 60 : 0) +
    2 * BALANCE_BLOCK +
    (phases ? 20 + 28 + phases * PHASE_PITCH - 8 + 20 : 0) +
    (period && config['show_cost'] !== false ? 60 : 0) +
    20
  );
}

/** The grid at a 360 column: its value row, its phases, the price, the totals (today's when none are named). */
export function gridHeight(config: LovelaceCardConfig): number {
  const phases = phasesOf(config);
  return (
    64 +
    80 +
    (phases ? 20 + phases * PHASE_PITCH - 8 + 20 : 0) +
    (config['price'] ? 76 : 0) +
    60 +
    20
  );
}

export const energyHeight = (config: LovelaceCardConfig): number =>
  config['variant'] === 'compact'
    ? 240
    : config['variant'] === 'sources'
      ? 468
      : 320 + (listLength(config, ['legend']) ? 60 : 0);

/**
 * The devices at a 360 column: a 76 bar row each, one more under each parent (what its devices leave unmeasured) and
 * one for the rest of the house when its meter is given. With no rows, the Energy dashboard's devices: four, say.
 */
export function devicesHeight(config: LovelaceCardConfig): number {
  const list = config['rows'] ?? config['entities'];
  if (!Array.isArray(list) || !list.length) return HEAD + ROW_BAR * 4;
  const items = list.map((row: unknown) =>
    typeof row === 'string' ? { entity: row } : ((row ?? {}) as Record<string, unknown>),
  );
  const ids = new Set(items.map((row) => row['entity']));
  const parents = new Set(
    items.map((row) => row['parent']).filter((parent) => parent !== undefined && ids.has(parent)),
  );
  return HEAD + ROW_BAR * (items.length + parents.size + (config['total'] ? 1 : 0));
}

/** Production at a 360 column; several arrays draw a taller chart (112) and their legend (52) instead of the figures. */
export function productionHeight(config: LovelaceCardConfig): number {
  const arrays = listLength(config, ['arrays']) > 0;
  if (config['variant'] === 'compact') return arrays ? 288 : 236;
  return arrays ? 368 : 344;
}

/**
 * Water & gas at a 360 column: a 48 block per meter with 16 between them, then the rows under them (a 60 each). The
 * `rows` layout draws a 76 bar row per meter above the rows. With no meters given, the Energy dashboard's two.
 */
export function metersHeight(config: LovelaceCardConfig): number {
  const meters = listLength(config, ['meters']) || 2;
  const rows = listLength(config, ['rows']);
  if (config['variant'] === 'rows') return HEAD + ROW_BAR * meters + ROW * rows;
  return HEAD + 48 + 64 * (meters - 1) + (rows ? 16 + ROW * rows : 0);
}

/* the charge cards' pieces: the value row (16 + 64 under the head, the 16 counted in HEAD), a marked ruler and its
   labels (12 + 44, 4 + 16), a readout row (16 + 44), the mode (a label 16 + 20, then a row of tiles 8 + 84 or of
   chips 8 + 44) */
const VALUE_ROW = 64;
const RULER = 56 + 20;
const COLS = 60;
const MODE_TILES = 128;
const MODE_CHIPS = 88;

/** Batteries at a 360 column: the charge on its ruler, a row per battery when there are several, the mode. */
export function batteriesHeight(config: LovelaceCardConfig): number {
  const listed = Array.isArray(config['batteries']) ? (config['batteries'] as unknown[]) : [];
  // none listed: the Energy dashboard's, most often one with its state of charge
  const count = Math.max(1, listed.length);
  const level = !listed.length || listed.some((b) => typeof b === 'object' && b && 'level' in b);
  return (
    HEAD +
    VALUE_ROW +
    (level ? RULER : 0) +
    (count > 1 ? 16 + ROW_BAR * count : 0) +
    (config['mode'] ? MODE_CHIPS : 0)
  );
}

/**
 * The car charger at a 360 column: the car's charge on its ruler (else the power), the session's readouts (the time
 * it has charged only shows while it charges: a status alone is not counted), the mode.
 */
export const chargerHeight = (config: LovelaceCardConfig): number =>
  HEAD +
  VALUE_ROW +
  (config['level'] ? RULER : 0) +
  (config['session_energy'] || config['solar_share'] ? COLS : 0) +
  (config['mode'] ? MODE_TILES : 0);

/** The chips a period card carries by default: 16 under the head, a 44 row. */
const periodChips = (config: LovelaceCardConfig): number =>
  config['show_period'] === false ? 0 : 60;

/**
 * The sankey's body at a 360 column for a house with the sun, a battery and a few devices: a tier of source words,
 * the sources' ribbons, two tiers of targets, the house's ribbons, two tiers of devices (the approved figure).
 */
export const SANKEY_BODY = 416;

export const sankeyHeight = (config: LovelaceCardConfig): number =>
  HEAD + periodChips(config) + SANKEY_BODY;

/** The score: three rings (88 and their label, 20 under what is above) and a row of three readouts. */
export const scoreHeight = (config: LovelaceCardConfig): number =>
  HEAD + periodChips(config) + 4 + 112 + 60;

export type FamilyEntry = readonly [
  tag: string,
  name: string,
  description: string,
  height: (config: LovelaceCardConfig) => number,
];

export const ENERGY_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-energy-card',
    'Fluvy · Energy',
    'Power right now, the day curve and the energy legend.',
    energyHeight,
  ],
  [
    'fluvy-energy-flow-card',
    'Fluvy · Energy flow',
    'Where the house’s energy comes from and where it goes, live or over a period: import and export at once, every source, lanes in their origin’s colour.',
    flowHeight,
  ],
  [
    'fluvy-energy-balance-card',
    'Fluvy · Energy balance',
    'What comes in against what goes out, live or over a period: the house is the remainder, so the totals agree; each phase of the grid, and the money.',
    balanceHeight,
  ],
  [
    'fluvy-grid-card',
    'Fluvy · Grid',
    'The grid right now: the net import or export, in and out at once, each phase with its voltage, the price and today’s totals.',
    gridHeight,
  ],
  [
    'fluvy-energy-devices-card',
    'Fluvy · Energy devices',
    'Where the energy goes, device by device on one scale: nested circuits, and what no meter measures.',
    devicesHeight,
  ],
  [
    'fluvy-meters-card',
    'Fluvy · Water & gas',
    'Today’s water and gas against a typical day, what flows right now, and a leak sensor or a valve beside them.',
    metersHeight,
  ],
  [
    'fluvy-production-card',
    'Fluvy · Production',
    'Hourly production bars with the forecast behind, stacked per array when there are several.',
    productionHeight,
  ],
  [
    'fluvy-batteries-card',
    'Fluvy · Batteries',
    'The house’s batteries as one: their state of charge, full or empty in, the reserve on the ruler, a row per battery and their mode.',
    batteriesHeight,
  ],
  [
    'fluvy-ev-charger-card',
    'Fluvy · Car charger',
    'The car on its charger: its charge against the target, ready by when, what the session added and how much of it came from the sun, the charging mode.',
    chargerHeight,
  ],
  [
    'fluvy-energy-sankey-card',
    'Fluvy · Where it went',
    'A day, week or month of energy from where to where, in true proportions: the grid, the battery and the sun into the house, the charge and the export, and the house into its devices.',
    sankeyHeight,
  ],
  [
    'fluvy-energy-score-card',
    'Fluvy · Energy score',
    'Self-powered, sun used and low-carbon as rings, the Energy dashboard’s own gauges, over imported, exported and net.',
    scoreHeight,
  ],
];
