import type { LovelaceCardConfig, MessageKey } from '@fluvy/core';
import type { FlowStyle } from '../energy-flow/energy-flow-card.js';
import type { ThermostatVariant } from '../thermostat/thermostat-card.js';
import {
  BATTERY_POWER,
  GRID,
  HOME_POWER,
  LIGHT_WORDS,
  OUTDOOR,
  SOLAR,
  TODAY,
  type HomeRegistry,
} from './home-registry.js';

/*
 * The five views of the automatic dashboard, in the layout of the approved `/fluvy-home`: each one is
 * a small builder from the house (`HomeRegistry`) to sections of fluvy cards. Every list is capped so
 * a big house still reads.
 */

export type Card = LovelaceCardConfig & { grid_options?: { columns?: number } };
export interface Section {
  readonly type: 'grid';
  readonly cards: Card[];
}
export type ViewKey =
  'home' | 'lights' | 'climate' | 'energy' | 'security' | 'media' | 'agenda' | 'sensors';
export interface View {
  title: string;
  path: string;
  icon: string;
  type: 'sections';
  max_columns: number;
  sections: Section[];
}

/** What `energy/get_prefs` answers: the energy dashboard's sources and devices. */
export interface EnergyPrefs {
  energy_sources?: ReadonlyArray<{
    type: string;
    stat_energy_from?: string;
    stat_energy_to?: string;
    flow_from?: ReadonlyArray<{ stat_energy_from: string }>;
    flow_to?: ReadonlyArray<{ stat_energy_to: string }>;
    /** The source's power sensor (HA 2025.12+); for grid and battery, `power_config` says how it is signed. */
    stat_rate?: string;
    power_config?: { stat_rate?: string; stat_rate_inverted?: string };
  }>;
  device_consumption?: ReadonlyArray<{ stat_consumption: string; name?: string }>;
}

/** The energy readings found once, each by its role. */
export interface EnergyRoles {
  readonly solarPower: string | undefined;
  readonly gridPower: string | undefined;
  readonly batteryPower: string | undefined;
  readonly homePower: string | undefined;
  /** The grid / battery meter counts towards the house as negative (the card's `grid_invert` / `battery_invert`). */
  readonly gridInvert: boolean;
  readonly batteryInvert: boolean;
  /** The grid meter came from the energy dashboard's preferences, with its sign: nothing left to find out. */
  readonly gridSigned: boolean;
  readonly solarToday: string | undefined;
  /** The energy dashboard's devices (their energy statistics) and the power sensor beside each. */
  readonly consumption: readonly string[];
  readonly consumptionPowers: readonly string[];
  readonly any: boolean;
}

/** How the generated cards are drawn: the dashboard's options (fluvy's panel edits them). */
export interface CardStyle {
  readonly thermostat?: ThermostatVariant;
  readonly tiles?: 'large' | 'compact';
  readonly flow?: FlowStyle;
}

export interface StrategyContext {
  readonly home: HomeRegistry;
  readonly t: (key: MessageKey) => string;
  /** The dashboard's url path (`/fluvy-home`): the tabs and "see all" links navigate inside it. */
  readonly base: string;
  readonly weather: string | undefined;
  readonly energy: EnergyRoles;
  readonly style: CardStyle;
}

export interface ViewSpec {
  readonly key: ViewKey;
  readonly icon: string;
  readonly title: MessageKey;
  readonly build: (ctx: StrategyContext) => Section[];
  /** Whether the house has anything for the view; default: some section has cards. */
  readonly when?: (ctx: StrategyContext) => boolean;
}

/* ---------- cards ---------- */

const tile = (entity: string, extra: Record<string, unknown> = {}): Card => ({
  type: 'custom:fluvy-tile-card',
  entity,
  ...extra,
  grid_options: { columns: 6 },
});
const full = (type: string, extra: Record<string, unknown> = {}): Card => ({
  type: `custom:fluvy-${type}-card`,
  ...extra,
  grid_options: { columns: 12 },
});
const heading = (
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
const section = (...cards: Card[]): Section => ({ type: 'grid', cards });
/** `...when(value, (v) => [cards])`: the cards only when the house has the thing. */
const when = <V, T = Card>(
  value: V | undefined | null | false | 0 | '',
  build: (value: V) => T[],
): T[] => (value ? build(value) : []);

const entityRow = (home: HomeRegistry, entity: string) => ({ entity, ...home.named(entity) });
const deviceRow = (home: HomeRegistry, entity: string) => ({
  entity,
  name: home.deviceLabel(entity),
});
const applianceTile = (home: HomeRegistry, id: string): Card => {
  const readouts = home.readoutsOf(id);
  return tile(id, { ...home.named(id), ...(readouts.length ? { readouts: [...readouts] } : {}) });
};
const energyFlow = (
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
const thermostat = (id: string, style: CardStyle): Card =>
  full('thermostat', { entity: id, ...(style.thermostat ? { variant: style.thermostat } : {}) });
/** A tile in the dashboard's size (a compact odd one out still spans the column: `tileRows`). */
const sizedTile = (id: string, extra: Record<string, unknown>, style: CardStyle): Card =>
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
const heightOf = (card: Card): number => {
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
function flowed(
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
const balanced = ([lead, ...rest]: readonly Card[]): Section[] =>
  flowed(lead ? [[lead]] : [], rest);

/** Tiles two a row; an odd one out closes the run as a compact tile across the column, so no row is half empty. */
function tileRows(tiles: readonly Card[]): Card[][] {
  const rows = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, i) =>
    tiles.slice(i * 2, i * 2 + 2),
  );
  const [odd, pair] = rows.at(-1) ?? [];
  if (odd && !pair)
    rows[rows.length - 1] = [{ ...odd, size: 'compact', grid_options: { columns: 12 } }];
  return rows;
}

/** A heading and its rows as blocks: the heading rides with the first row, never alone at a column's foot. */
function headed(head: Card, rows: readonly Card[][]): Card[][] {
  const [first = [], ...rest] = rows;
  return [[head, ...first], ...rest];
}

/* ---------- energy roles ---------- */

/** A source's power sensor from the energy preferences and whether it counts towards the house as negative. */
function preferredPower(
  home: HomeRegistry,
  prefs: EnergyPrefs | null,
  type: 'solar' | 'grid' | 'battery',
): { id: string; inverted: boolean } | undefined {
  for (const source of prefs?.energy_sources ?? []) {
    if (source.type !== type) continue;
    const inverted = source.power_config?.stat_rate_inverted;
    if (inverted) {
      if (home.hasState(inverted)) return { id: inverted, inverted: true };
      continue;
    }
    const plain = source.power_config?.stat_rate ?? source.stat_rate;
    if (plain && home.hasState(plain)) return { id: plain, inverted: false };
  }
  return undefined;
}

export function findEnergyRoles(home: HomeRegistry, prefs: EnergyPrefs | null): EnergyRoles {
  const { powers, energies } = home;
  // the energy dashboard's own power sensors first (they carry their sign); otherwise the readings by their words
  const solarPref = preferredPower(home, prefs, 'solar');
  const gridPref = preferredPower(home, prefs, 'grid');
  const batteryPref = preferredPower(home, prefs, 'battery');
  const solarPower = solarPref?.id ?? home.pick(powers, SOLAR);
  const gridPower = gridPref?.id ?? home.pick(powers, GRID);
  const batteryPower =
    batteryPref?.id ??
    home.pick(
      powers.filter((id) => id !== solarPower && id !== gridPower),
      BATTERY_POWER,
    );
  const homePower = home.pick(
    powers.filter((id) => ![solarPower, gridPower, batteryPower].includes(id)),
    HOME_POWER,
  );
  const solarToday =
    home.pick(
      energies.filter((id) => SOLAR.test(home.label(id))),
      TODAY,
    ) ?? prefs?.energy_sources?.find((s) => s.type === 'solar')?.stat_energy_from;
  const consumption = (prefs?.device_consumption ?? [])
    .map((d) => d.stat_consumption)
    .filter((id) => home.hasState(id));
  // each device's power: the power sensor beside its energy statistic (same device, or the same name stem);
  // without devices in the energy dashboard, the appliances' own plugs
  const powerBeside = (id: string): string | undefined =>
    home.readoutsOf(id).find((reading) => home.deviceClass(reading) === 'power');
  const consumptionPowers = (consumption.length ? consumption : home.appliances)
    .map(powerBeside)
    .filter((p): p is string => Boolean(p));
  return {
    solarPower,
    gridPower,
    batteryPower,
    homePower,
    gridInvert: gridPref?.inverted ?? false,
    batteryInvert: batteryPref?.inverted ?? false,
    gridSigned: gridPref !== undefined,
    solarToday,
    consumption,
    consumptionPowers,
    any: Boolean(solarPower || gridPower || consumption.length || energies.length),
  };
}

/* ---------- views ---------- */

function homeView(ctx: StrategyContext): Section[] {
  const { home, t, base, weather, energy } = ctx;
  const { lights, appliances, climate, temperatures } = home;
  const secured = [...home.domain('lock'), ...home.openings];
  // the controls, the climate and the day, the energy and the house's state, in reading order; the
  // single-purpose cards fill the columns' feet
  return flowed(
    [
      ...when(lights.length, () =>
        headed(
          heading(t('strategy.lights'), 'fluvy:bulb', lights, `${base}/lights`),
          tileRows(lights.slice(0, 6).map((id) => sizedTile(id, home.named(id), ctx.style))),
        ),
      ),
      ...when(appliances.length, () =>
        headed(
          heading(t('strategy.appliances'), 'fluvy:plug', appliances),
          tileRows(appliances.slice(0, 4).map((id) => applianceTile(home, id))),
        ),
      ),
      when(home.covers.length, () => [
        heading(t('strategy.covers'), 'fluvy:blinds', home.covers),
        full('tiles', {
          size: 'compact',
          columns: 2,
          tiles: home.covers.slice(0, 6).map((id) => ({ entity: id, ...home.named(id) })),
        }),
      ]),
      when(climate[0], (id) => [thermostat(id, ctx.style)]),
      when(temperatures.length, () => [
        {
          type: 'custom:fluvy-readouts-card',
          rows: temperatures.slice(0, 3).map((id) => ({ entity: id, name: home.placeName(id) })),
        },
      ]),
      ...(weather
        ? [[full('weather', { entity: weather })], [full('clock', { variant: 'digital', weather })]]
        : [[full('clock', { variant: 'digital' })]]),
      when(energy.solarPower || energy.gridPower, () => [energyFlow(energy, ctx.style)]),
      energy.solarPower
        ? [full('energy', { entity: energy.solarPower, title: t('energy.solar') })]
        : energy.homePower
          ? [full('energy', { entity: energy.homePower })]
          : [],
      when(secured.length, () => [
        full('entities', {
          title: t('strategy.security'),
          rows: secured.slice(0, 5).map((id) => entityRow(home, id)),
        }),
      ]),
    ],
    [
      ...when(home.first('media_player'), (id) => [
        full('media', { entity: id, variant: 'mini', ...home.named(id) }),
      ]),
      ...when(home.first('vacuum'), (id) => [full('vacuum', { entity: id, ...home.named(id) })]),
      ...when(home.first('todo'), (id) => [full('todo', { entity: id })]),
      // the house's first scene, one tap away
      ...when(home.scenes[0], (id) => [full('scene', { entity: id, ...home.named(id) })]),
    ],
  );
}

/** By area when areas are assigned, else indoor / outdoor; the biggest group first; light automations as scenes last. */
function lightsView(ctx: StrategyContext): Section[] {
  const { home, t } = ctx;
  const groups = new Map<string, string[]>();
  for (const id of home.lights) {
    const key =
      home.areaName(home.areaOf(id)) ??
      (home.outdoor(id) ? t('strategy.outdoor') : t('strategy.indoor'));
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  // a dimmable light is a full card (a row of its own); the switches after it are tiles, two a row
  const blocks = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .flatMap(([name, ids]) =>
      headed(heading(name, OUTDOOR.test(name) ? 'fluvy:moon' : 'fluvy:bulb', ids), [
        ...ids
          .filter((id) => home.dimmable(id))
          .map((id) => [full('light', { entity: id, ...home.named(id) })]),
        ...tileRows(
          ids
            .filter((id) => !home.dimmable(id))
            .map((id) => sizedTile(id, home.named(id), ctx.style)),
        ),
      ]),
    );
  const scenes = [...home.scenes, ...home.automations.filter((id) => LIGHT_WORDS.test(id))].slice(
    0,
    6,
  );
  if (scenes.length) blocks.push([full('scenes', { title: t('strategy.automations'), scenes })]);
  return flowed(blocks);
}

/** Thermostats first, then the forecast, humidity and temperatures, shared out so the three columns end level. */
function climateView(ctx: StrategyContext): Section[] {
  const { home } = ctx;
  return balanced([
    ...home.climate.slice(0, 4).map((id) => thermostat(id, ctx.style)),
    ...home.fans.slice(0, 2).map((id) => full('fan', { entity: id, ...home.named(id) })),
    ...home.weather.slice(0, 1).map((id) => full('weather', { entity: id })),
    ...home.humidities.slice(0, 3).map((id) => {
      const temperature = home.temperatureBeside(id);
      return full('humidity', {
        entity: id,
        name: home.placeName(id),
        ...(temperature ? { temperature_entity: temperature } : {}),
      });
    }),
    ...home.temperatures
      .slice(0, 4)
      .map((id) => full('sensor', { entity: id, name: home.placeName(id) })),
  ]);
}

/** The flow and the day's curve first, then what the sun makes and what the house draws, shared out over three level columns. */
function energyView(ctx: StrategyContext): Section[] {
  const { home, t, energy } = ctx;
  const { solarPower, gridPower, solarToday, consumption, consumptionPowers } = energy;
  return balanced([
    ...when(solarPower || gridPower, () => [energyFlow(energy, ctx.style)]),
    ...(solarPower
      ? [full('energy', { entity: solarPower, title: t('energy.solar') })]
      : gridPower
        ? [full('energy', { entity: gridPower, title: t('energy.grid') })]
        : []),
    ...when(
      home.energies.filter((id) => TODAY.test(home.label(id))),
      (todays) =>
        todays.length >= 2
          ? [full('stat-tiles', { title: t('strategy.today'), tiles: todays.slice(0, 4) })]
          : [],
    ),
    ...when(solarPower, (id) => [full('gauge', { entity: id })]),
    ...when(solarToday, (id) => [full('production', { entity: id })]),
    ...when(consumptionPowers.length >= 2, () => [
      full('distribution', {
        title: t('strategy.consumption'),
        entities: consumptionPowers.slice(0, 8),
      }),
    ]),
    ...when(consumption.length, () => [
      full('energy-devices', {
        title: t('strategy.appliances'),
        rows: consumption.slice(0, 8).map((id) => deviceRow(home, id)),
      }),
    ]),
  ]);
}

/** Whether the house has a security view: an alarm, a lock, a camera or a way in (the openings then move there). */
const secured = (home: HomeRegistry): boolean =>
  Boolean(home.alarms.length || home.locks.length || home.cameras.length || home.gateways.length);

/** The alarm first, then what opens (locks, garage doors and gates), what is open, and the cameras. */
function securityView({ home, t }: StrategyContext): Section[] {
  return balanced([
    ...home.alarms.slice(0, 2).map((id) => full('alarm', { entity: id, ...home.named(id) })),
    ...home.locks.slice(0, 4).map((id) => full('lock', { entity: id, ...home.named(id) })),
    ...home.gateways.slice(0, 2).map((id) => full('cover', { entity: id, ...home.named(id) })),
    ...when(home.openings.length, () => [
      full('openings', { title: t('strategy.sensors'), entities: home.openings.slice(0, 8) }),
    ]),
    ...home.cameras.slice(0, 4).map((id) => full('camera', { entity: id })),
  ]);
}

/** What plays now (only while something does), then every other player of the house. */
function mediaView({ home }: StrategyContext): Section[] {
  const players = home.players.slice(0, 6);
  const playing =
    players.find((id) => home.state(id) === 'playing') ??
    players.find((id) => home.state(id) === 'paused');
  return balanced([
    ...when(playing, (id) => [full('now-playing', { entity: id, ...home.named(id) })]),
    ...players
      .filter((id) => id !== playing)
      .map((id) => full('media', { entity: id, ...home.named(id) })),
  ]);
}

/** The calendars, the lists, the timers and what a person runs by hand. */
function agendaView({ home, t }: StrategyContext): Section[] {
  return balanced([
    ...when(home.calendars.length, () => [
      full('calendar', { entities: home.calendars.slice(0, 3), view: 'month-day' }),
    ]),
    ...home.lists.slice(0, 3).map((id) => full('todo', { entity: id })),
    ...home.timers.slice(0, 3).map((id) => full('timer', { entity: id, ...home.named(id) })),
    ...when(home.runnables.length, () => [
      full('actions', { title: t('strategy.actions'), entities: home.runnables.slice(0, 6) }),
    ]),
  ]);
}

function sensorsView({ home, t }: StrategyContext): Section[] {
  const { batteries, phones, openings, plants, helpers, people, updates } = home;
  // what runs on batteries, who is home, what is open, then the helpers and the updates
  return flowed([
    when(batteries.length, () => [
      full('bars', {
        title: t('strategy.batteries'),
        rows: batteries.slice(0, 8).map((id) => deviceRow(home, id)),
      }),
    ]),
    when(phones.length, () => [
      full('bars', {
        title: t('strategy.phones'),
        rows: phones.slice(0, 8).map((id) => deviceRow(home, id)),
      }),
    ]),
    when(people.length, () => [
      full('people', { title: t('strategy.people'), entities: [...people] }),
    ]),
    // with a security view the openings live there
    when(!secured(home) && openings.length, () => [
      full('openings', { title: t('strategy.sensors'), entities: openings.slice(0, 8) }),
    ]),
    when(plants.length, () => [
      full('bars', { title: t('strategy.plants'), rows: plants.slice(0, 4) }),
    ]),
    when(helpers.length, () => [
      full('helpers', { title: t('strategy.helpers'), entities: helpers.slice(0, 6) }),
    ]),
    when(updates.length, () => [
      full('updates', { title: t('strategy.updates'), entities: updates.slice(0, 8) }),
    ]),
    when(home.first('camera'), (id) => [full('camera', { entity: id })]),
  ]);
}

/** The views in tab order. Home is always there; the others only when the house has what they show. */
export const VIEWS: readonly ViewSpec[] = [
  { key: 'home', icon: 'fluvy:home', title: 'strategy.home', build: homeView, when: () => true },
  {
    key: 'lights',
    icon: 'fluvy:bulb',
    title: 'strategy.lights',
    build: lightsView,
    when: ({ home }) => home.lights.length > 0,
  },
  {
    key: 'climate',
    icon: 'fluvy:thermo',
    title: 'strategy.climate',
    build: climateView,
    when: ({ home, weather }) =>
      Boolean(home.climate.length || home.temperatures.length || weather),
  },
  {
    key: 'energy',
    icon: 'fluvy:bolt',
    title: 'strategy.energy',
    build: energyView,
    when: ({ energy }) => energy.any,
  },
  {
    key: 'security',
    icon: 'fluvy:shield',
    title: 'strategy.security',
    build: securityView,
    when: ({ home }) => secured(home),
  },
  {
    key: 'media',
    icon: 'fluvy:speaker',
    title: 'strategy.media',
    build: mediaView,
    when: ({ home }) => home.players.length > 0,
  },
  {
    key: 'agenda',
    icon: 'fluvy:calendar',
    title: 'strategy.agenda',
    build: agendaView,
    // one to-do list already lives on the home view
    when: ({ home }) =>
      Boolean(
        home.calendars.length ||
        home.timers.length ||
        home.runnables.length ||
        home.lists.length > 1,
      ),
  },
  { key: 'sensors', icon: 'fluvy:signal', title: 'strategy.sensors', build: sensorsView },
];
