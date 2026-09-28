import type { HomeRegistry } from './home-registry.js';
import type { Card, CardStyle, EnergyRoles, Section, View } from './types.js';

/*
 * The cards the strategy places and how a view's columns are cut so they end on one line: the small builders the
 * views share, the header every view opens with, and the heights (measured at a 360 column) the cutting reads.
 */

/* ---------- cards ---------- */

export const tile = (entity: string, extra: Record<string, unknown> = {}): Card => ({
  type: 'custom:fluvy-tile-card',
  entity,
  ...extra,
  grid_options: { columns: 6 },
});
export const full = (type: string, extra: Record<string, unknown> = {}): Card => ({
  type: `custom:fluvy-${type}-card`,
  ...extra,
  grid_options: { columns: 12 },
});
export const heading = (
  title: string,
  icon: string,
  entities: readonly string[],
  path?: string,
): Card => ({
  type: 'custom:fluvy-heading-card',
  title,
  icon,
  ...(entities.length ? { entities: [...entities] } : {}),
  ...(path ? { path } : {}),
});
export const section = (...cards: Card[]): Section => ({ type: 'grid', cards });
/** `...when(value, (v) => [cards])`: the cards only when the house has the thing. */
export const when = <V, T = Card>(
  value: V | undefined | null | false | 0 | '',
  build: (value: V) => T[],
): T[] => (value ? build(value) : []);

export const entityRow = (home: HomeRegistry, entity: string) => ({
  entity,
  ...home.named(entity),
});
export const deviceRow = (home: HomeRegistry, entity: string) => ({
  entity,
  name: home.deviceLabel(entity),
});
export const applianceTile = (home: HomeRegistry, id: string): Card => {
  const readouts = home.readoutsOf(id);
  return tile(id, { ...home.named(id), ...(readouts.length ? { readouts: [...readouts] } : {}) });
};
export const energyFlow = (
  { solarPower, gridPower, batteryPower, homePower, gridInvert, batteryInvert }: EnergyRoles,
  style: CardStyle,
): Card =>
  full('energy-flow', {
    ...(style.flow ? { flow_style: style.flow } : {}),
    ...(solarPower ? { solar_power: solarPower } : {}),
    ...(gridPower ? { grid_power: gridPower, ...(gridInvert ? { grid_invert: true } : {}) } : {}),
    ...(batteryPower
      ? { battery_power: batteryPower, ...(batteryInvert ? { battery_invert: true } : {}) }
      : {}),
    ...(homePower ? { home_power: homePower } : {}),
  });

/** A thermostat in the dashboard's variant. */
export const thermostat = (id: string, style: CardStyle): Card =>
  full('thermostat', { entity: id, ...(style.thermostat ? { variant: style.thermostat } : {}) });
/** A tile in the dashboard's size (a compact odd one out still spans the column: `tileRows`). */
export const sizedTile = (id: string, extra: Record<string, unknown>, style: CardStyle): Card =>
  tile(id, { ...extra, ...(style.tiles === 'compact' ? { size: 'compact' } : {}) });

/** The header every view opens with (the greeting and the tabs), so it reads as fixed while the content changes. */
export const helloCard = (weather: string | undefined, person: string | undefined): Card => ({
  type: 'custom:fluvy-hello-card',
  ...(person ? { person } : {}),
  ...(weather ? { weather } : {}),
});
export const tabsCard = (base: string, views: readonly View[]): Card => ({
  type: 'custom:fluvy-chips-card',
  chips: views.map((view) => ({
    label: view.title,
    icon: view.icon,
    path: `${base}/${view.path}`,
  })),
});

/**
 * The heights of the cards the strategy places, measured at a 360 column (the 16 px gap is added where they
 * stack), so the columns of a view can be cut to end on one line. A large tile is half a column: two share a row.
 */
const HEIGHTS: Readonly<Record<string, number>> = {
  heading: 24,
  light: 368,
  thermostat: 660,
  weather: 444,
  clock: 196,
  humidity: 312,
  sensor: 304,
  'energy-flow': 256,
  energy: 320,
  gauge: 384,
  production: 344,
  media: 76,
  vacuum: 388,
  todo: 220,
  camera: 280,
  cover: 330,
  fan: 380,
  lock: 300,
  alarm: 320,
  calendar: 560,
  timer: 252,
  'now-playing': 212,
  'stat-tiles': 200,
  scene: 76,
  // the calm state: everything up to date is one row
  updates: 160,
};
/** Cards whose height follows their list: a head, then a rhythm of rows up to what the card shows. */
const LIST_HEIGHTS: Readonly<Record<string, (rows: number) => number>> = {
  bars: (n) => 100 + 76 * n,
  entities: (n) => 92 + 60 * n,
  // four rows, then the "All sensors" row
  openings: (n) => 100 + 60 * Math.min(n, 5),
  people: (n) => 84 + 104 * Math.ceil(n / 3),
  helpers: (n) => 100 + 80 * n,
  // automations have long names: one a line
  scenes: (n) => 80 + 64 * n,
  distribution: (n) => 124 + 36 * Math.min(n, 5),
  // compact tiles two a row, 8 apart
  tiles: (n) => Math.ceil(n / 2) * 84 - 8,
  // two a row
  actions: (n) => 76 + 76 * Math.ceil(n / 2),
  readouts: (n) => (n > 3 ? 152 : 88),
};
/** The greeting and the tabs above the first column (60 + 16 + 44 + 16). */
const HEADER = 136;
const GAP = 16;
const listLength = (card: Card): number => {
  for (const key of ['rows', 'entities', 'scenes', 'tiles'] as const) {
    const value = card[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
};
export const heightOf = (card: Card): number => {
  const kind = card.type.replace(/^custom:fluvy-/, '').replace(/-card$/, '');
  if (kind === 'tile') return card['size'] === 'compact' ? 76 : 168;
  if (kind === 'thermostat')
    return card['variant'] === 'compact' ? 470 : card['variant'] === 'ruler' ? 460 : 660;
  return LIST_HEIGHTS[kind]?.(listLength(card)) ?? HEIGHTS[kind] ?? 100 + 64 * listLength(card);
};
const halfColumn = (card: Card): boolean => card.grid_options?.columns === 6;
/** A run of cards stacked in one column; half-column cards side by side, two a row. */
function heightOfAll(cards: readonly Card[]): number {
  let height = 0;
  let pending: number | undefined;
  for (const card of cards) {
    const own = heightOf(card) + GAP;
    if (!halfColumn(card)) height += own;
    else if (pending === undefined) pending = own;
    else {
      height += Math.max(pending, own);
      pending = undefined;
    }
  }
  return height + (pending ?? 0);
}

/** Every way to cut `count` blocks into `parts` non-empty runs, as the indices where the runs after the first begin. */
function* cutsOf(count: number, parts: number, from = 1): Generator<number[]> {
  if (parts <= 1) {
    yield [];
    return;
  }
  for (let cut = from; cut <= count - parts + 1; cut++)
    for (const rest of cutsOf(count, parts - 1, cut + 1)) yield [cut, ...rest];
}

/**
 * A view's columns, level at the foot. The blocks are laid down column after column in reading order (a
 * block — a heading with its first row, a pair of tiles — never splits); then each loose card goes to the foot
 * of the column that is shortest by then. Of every way to cut the blocks into the columns, the one whose
 * columns end closest to one line once the loose cards are in (the first column carries the header).
 */
export function flowed(
  blocks: readonly (readonly Card[])[],
  loose: readonly Card[] = [],
  columns = 3,
): Section[] {
  const runs = blocks.filter((block) => block.length > 0);
  let best: { columns: Card[][]; spread: number } | undefined;
  for (const cuts of cutsOf(runs.length, Math.min(columns, runs.length))) {
    const bounds = [0, ...cuts, runs.length];
    const laid = Array.from({ length: columns }, (_, i) => {
      const cards = runs.slice(bounds[i] ?? runs.length, bounds[i + 1] ?? runs.length).flat();
      return { cards, height: (i === 0 ? HEADER : 0) + heightOfAll(cards) };
    });
    for (const card of loose) {
      const shortest = laid.reduce((low, next) => (next.height < low.height ? next : low));
      shortest.cards.push(card);
      shortest.height += heightOf(card) + GAP;
    }
    const heights = laid.map((column) => column.height);
    const spread = Math.max(...heights) - Math.min(...heights);
    if (!best || spread < best.spread)
      best = { columns: laid.map((column) => column.cards), spread };
  }
  return (best?.columns ?? []).map((cards) => section(...cards));
}

/** Cards shared out over the columns: the lead card under the header, every other one where the columns are shortest. */
export const balanced = ([lead, ...rest]: readonly Card[]): Section[] =>
  flowed(lead ? [[lead]] : [], rest);

/** Tiles two a row; an odd one out closes the run as a compact tile across the column, so no row is half empty. */
export function tileRows(tiles: readonly Card[]): Card[][] {
  const rows = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, i) =>
    tiles.slice(i * 2, i * 2 + 2),
  );
  const [odd, pair] = rows.at(-1) ?? [];
  if (odd && !pair)
    rows[rows.length - 1] = [{ ...odd, size: 'compact', grid_options: { columns: 12 } }];
  return rows;
}

/** A heading and its rows as blocks: the heading rides with the first row, never alone at a column's foot. */
export function headed(head: Card, rows: readonly Card[][]): Card[][] {
  const [first = [], ...rest] = rows;
  return [[head, ...first], ...rest];
}
