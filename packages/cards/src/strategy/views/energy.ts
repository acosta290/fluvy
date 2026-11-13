import {
  balanced,
  batteriesCard,
  deviceRows,
  energyBalance,
  energyFlow,
  full,
  gridCard,
  hasBattery,
  hasSources,
  productionCards,
  runsOf,
  solarCurves,
  solarGauges,
  when,
} from '../layout.js';
import { capped, each, looseAfter, moreCard } from '../caps.js';
import { COLUMNS } from '../context.js';
import { listed, part } from '../edit.js';
import { TODAY } from '../home-registry.js';
import type { Card, Section, StrategyContext, ViewSpec } from '../types.js';

/*
 * The energy dashboard (`custom:fluvy-energy`): now (the flow, the balance, the grid, the batteries, the charger and
 * the day by source), today (a day's flow, where it went, the score, the day's balance, the range's usage), what the sun makes, what
 * the devices draw, water and gas, and a curve a power meter. Each card is a part of its view (#170), under what it
 * is: `flow`, `balance`, `sankey` …
 */

/** The live cards: where the energy comes from and goes, and each part of the house's system on its own. */
export function liveCards(ctx: StrategyContext): Card[] {
  const { energy, t } = ctx;
  return [
    ...part(
      ctx,
      'flow',
      when(hasSources(energy), () => [energyFlow(energy, ctx.style)]),
    ),
    ...part(
      ctx,
      'balance',
      when(hasSources(energy) && (energy.solarPowers.length || hasBattery(energy)), () => [
        energyBalance(energy),
      ]),
    ),
    ...part(
      ctx,
      'sources',
      when(energy.prefsMeters, () => [full('energy', { variant: 'sources' })]),
    ),
    ...part(
      ctx,
      'grid',
      when(
        energy.gridPower || energy.gridPhases.length || (energy.gridImport && energy.gridExport),
        () => [gridCard(energy)],
      ),
    ),
    // the meter's id last: `when` hands its value to the card
    ...part(
      ctx,
      'grid_gauge',
      when(!energy.gridExport && !energy.prefsPower && energy.gridPower, (id) => [
        full('gauge', {
          entity: id,
          variant: 'signed',
          name: t('energy.grid'),
        }),
      ]),
    ),
    ...part(
      ctx,
      'batteries',
      when(hasBattery(energy), () => [batteriesCard(energy)]),
    ),
    ...part(
      ctx,
      'charger',
      when(energy.charger, (id) => [full('ev-charger', { entity: id })]),
    ),
  ];
}

/**
 * A day's totals as the energy dashboard allocates them: the flow of the day, where it went, the score. Given an
 * Energy date picker's key, each follows its span instead (its chips gone): the Energy dashboard's Today view.
 */
export function todayCards(ctx: StrategyContext, collection?: string): Card[] {
  const { energy } = ctx;
  const follows = collection ? { collection_key: collection } : {};
  const day = (id: string, card: () => Card): Card[] =>
    part(
      ctx,
      id,
      when(energy.prefsMeters, () => [card()]),
    );
  return [
    ...day('day_flow', () =>
      energyFlow(energy, ctx.style, { period: 'day', badge: 'self_powered', ...follows }),
    ),
    ...day('sankey', () => full('energy-sankey', follows)),
    ...day('score', () => full('energy-score', follows)),
    ...day('day_balance', () => energyBalance(energy, { period: 'day', ...follows })),
  ];
}

/** How the devices share what the house draws now: the first eight of them, when there are two or more. */
export function distributionCard(ctx: StrategyContext): Card[] {
  const { energy, t } = ctx;
  const shares = listed(ctx, 'distribution', energy.consumptionPowers.slice(0, 8));
  return part(
    ctx,
    'distribution',
    when(shares.length >= 2, () => [
      full('distribution', {
        title: t('strategy.consumption'),
        entities: [...shares],
        ...(energy.homePower ? { total: energy.homePower } : {}),
      }),
    ]),
  );
}

/**
 * The picked range charted (#181): the house's electricity by its sources where the energy dashboard meters them,
 * then its water and its gas by their meters, each following the date picker, each a part of its own (`usage`,
 * `usage_water`, `usage_gas`).
 */
function usageCards(ctx: StrategyContext, collection: string): Card[] {
  const { energy } = ctx;
  const follows = { collection_key: collection };
  return [
    ...part(
      ctx,
      'usage',
      when(energy.prefsMeters, () => [full('energy-usage', follows)]),
    ),
    ...(['water', 'gas'] as const).flatMap((kind) =>
      part(
        ctx,
        `usage_${kind}`,
        when(energy.prefsMetered.includes(kind), () => [
          full('energy-usage', { kind, ...follows }),
        ]),
      ),
    ),
  ];
}

/** The energy dashboard's devices as rows, at the cap (`consumption`: eight here, `cap` on a view of their own). */
export function consumptionRows(ctx: StrategyContext, cap?: number): Card[] {
  const { home, t } = ctx;
  const card = (ids: readonly string[]): Card =>
    full('energy-devices', {
      title: t('strategy.appliances'),
      rows: deviceRows(home, ids),
    });
  const devices = capped(
    ctx,
    {
      key: 'consumption',
      title: 'strategy.consumption',
      icon: 'fluvy:plug',
      ...(cap ? { cap } : {}),
    },
    ctx.energy.consumption,
    (ids) => [[card(ids)]],
  );
  return part(
    ctx,
    'consumption',
    devices.shown.length ? [card(devices.shown), ...moreCard(devices)] : [],
  );
}

/** The day's energy readings as stat tiles, four a card, when there are two or more. */
export function todayTiles(ctx: StrategyContext): Card[] {
  const { home, t } = ctx;
  const todays = home.energies.filter((id) => TODAY.test(home.label(id)));
  const card = (ids: readonly string[]): Card =>
    full('stat-tiles', { title: t('strategy.today'), tiles: [...ids] });
  const today = capped(
    ctx,
    { key: 'today', title: 'strategy.today', icon: 'fluvy:calendar' },
    todays,
    (ids) => runsOf(ids, 4).map((run) => [card(run)]),
  );
  return part(
    ctx,
    'today',
    today.shown.length < 2 ? [] : [...runsOf(today.shown, 4).map(card), ...moreCard(today)],
  );
}

/** The flow and the day by source first, then each part of the system, and the day's curve. */
function nowView(ctx: StrategyContext): Section[] {
  const { t, energy } = ctx;
  const { gridPower, homePower } = energy;
  return balanced(ctx, [
    ...liveCards(ctx),
    ...part(
      ctx,
      'curve',
      energy.prefsMeters
        ? []
        : energy.solarPowers.length
          ? solarCurves(energy, { name: t('energy.solar') })
          : gridPower
            ? [full('energy', { entity: gridPower, name: t('energy.grid') })]
            : homePower
              ? [full('energy', { entity: homePower })]
              : [],
    ),
    ...distributionCard(ctx),
    ...todayTiles(ctx),
  ]);
}

/**
 * Today in energy: the period bar across the view (its chips beside its capsule, Today and Compare at its far end,
 * #182), then the day's flow, where it went, the score, the day's balance and the range's usage — the electricity's,
 * the water's, the gas's — following it: the dashboard's own date picker (`energy_<its url>`), so Home Assistant's
 * energy cards on the view would follow it too. A generated config is never stored: the key is the strip's default,
 * said out loud here.
 */
function todayView(ctx: StrategyContext): Section[] {
  const collection = `energy_${ctx.panelUrl}`;
  const { energy } = ctx;
  if (!energy.prefsMeters && !energy.prefsMetered.length) return [];
  const strip = part(ctx, 'period', [
    {
      ...full('energy-period', { collection_key: collection, variant: 'bar' }),
      grid_options: { columns: 'full' },
    } as Card,
  ]);
  return [
    { type: 'grid', column_span: COLUMNS, cards: strip },
    ...balanced(ctx, [...todayCards(ctx, collection), ...usageCards(ctx, collection)]),
  ];
}

/** What the sun makes: today's production, tomorrow's forecast, its last days as bars, each inverter's gauge and its day. */
function productionView(ctx: StrategyContext): Section[] {
  const { t, energy } = ctx;
  return balanced(ctx, [
    ...productionCards(ctx),
    ...part(ctx, 'gauges', solarGauges(energy)),
    ...part(ctx, 'curve', solarCurves(energy, { name: t('energy.solar') })),
  ]);
}

/** The energy dashboard's devices, nested as it nests them, and how they share what the house draws. */
function devicesView(ctx: StrategyContext): Section[] {
  // the devices' own view lists twelve before its "N more" row
  return balanced(ctx, [...consumptionRows(ctx, 12), ...distributionCard(ctx)]);
}

/** The house's water and gas meters. */
function metersCards(ctx: StrategyContext): Card[] {
  const { meters } = ctx.energy;
  // a meter the house reads keeps what it says of itself (a statistic a utility imports its kind, #181); one a
  // person adds is a sensor, which says its own
  const kept = listed(
    ctx,
    'water',
    meters.map((meter) => meter.entity),
    { takes: ['sensor'] },
  );
  return part(
    ctx,
    'water',
    when(kept.length, () => [
      full('meters', {
        meters: kept.map((entity) => ({
          ...(meters.find((meter) => meter.entity === entity) ?? { entity }),
        })),
      }),
    ]),
  );
}

/** A day's curve for every power meter of the house, each by its place, two of one place told apart (#170). */
function metersView(ctx: StrategyContext): Section[] {
  const { home } = ctx;
  const place = home.apart(home.powers, (id) => home.placeName(id));
  const curve = (id: string): Card => full('energy', { entity: id, name: place(id) });
  const meters = capped(
    ctx,
    { key: 'meters', title: 'strategy.meters', icon: 'fluvy:chart' },
    home.powers,
    each(curve),
  );
  return balanced(ctx, part(ctx, 'meters', looseAfter(meters.shown.map(curve), meters)));
}

export const ENERGY_VIEWS: readonly ViewSpec[] = [
  { key: 'now', icon: 'fluvy:bolt', title: 'strategy.now', build: nowView, when: () => true },
  {
    key: 'today',
    icon: 'fluvy:calendar',
    title: 'strategy.today',
    build: todayView,
    when: ({ energy }) => energy.prefsMeters || energy.prefsMetered.length > 0,
  },
  {
    key: 'production',
    icon: 'fluvy:sun',
    title: 'strategy.production',
    build: productionView,
    when: ({ energy }) => Boolean(energy.solarPowers.length || energy.solarToday),
  },
  {
    key: 'devices',
    icon: 'fluvy:plug',
    title: 'strategy.devices',
    build: devicesView,
    when: ({ energy }) => energy.consumption.length > 0 || energy.consumptionPowers.length >= 2,
  },
  {
    key: 'water',
    icon: 'fluvy:drop',
    title: 'strategy.water_gas',
    build: (ctx) => balanced(ctx, metersCards(ctx)),
    when: ({ energy }) => energy.meters.length > 0,
  },
  {
    key: 'meters',
    icon: 'fluvy:chart',
    title: 'strategy.meters',
    build: metersView,
    when: ({ home }) => home.powers.length > 0,
  },
];

export { metersCards };
