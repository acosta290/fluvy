import { balanced, deviceRow, energyFlow, full, when } from '../layout.js';
import { TODAY } from '../home-registry.js';
import type { Section, StrategyContext, ViewSpec } from '../types.js';

/*
 * The energy dashboard (`custom:fluvy-energy`): now (the flow and the day's curve), what the sun makes, what the
 * devices draw, and a curve a power meter.
 */

/** The flow and today's curve first, then the sun's share and the distribution of what draws. */
function nowView(ctx: StrategyContext): Section[] {
  const { home, t, energy } = ctx;
  const { solarPower, gridPower, homePower, consumptionPowers } = energy;
  return balanced([
    ...when(solarPower || gridPower, () => [energyFlow(energy, ctx.style)]),
    ...(solarPower
      ? [full('energy', { entity: solarPower, name: t('energy.solar') })]
      : gridPower
        ? [full('energy', { entity: gridPower, name: t('energy.grid') })]
        : homePower
          ? [full('energy', { entity: homePower })]
          : []),
    ...when(solarPower, (id) => [full('gauge', { entity: id })]),
    ...when(consumptionPowers.length >= 2, () => [
      full('distribution', {
        title: t('strategy.consumption'),
        entities: consumptionPowers.slice(0, 8),
      }),
    ]),
    ...when(
      home.energies.filter((id) => TODAY.test(home.label(id))),
      (todays) =>
        todays.length >= 2
          ? [full('stat-tiles', { title: t('strategy.today'), tiles: todays.slice(0, 4) })]
          : [],
    ),
  ]);
}

/** What the sun makes: today's production, the inverter's gauge and its day. */
function productionView(ctx: StrategyContext): Section[] {
  const { t, energy } = ctx;
  const { solarPower, solarToday } = energy;
  return balanced([
    ...when(solarToday, (id) => [full('production', { entity: id })]),
    ...when(solarPower, (id) => [full('gauge', { entity: id })]),
    ...when(solarPower, (id) => [full('energy', { entity: id, name: t('energy.solar') })]),
  ]);
}

/** The energy dashboard's devices and how they share what the house draws. */
function devicesView(ctx: StrategyContext): Section[] {
  const { home, t, energy } = ctx;
  const { consumption, consumptionPowers } = energy;
  return balanced([
    ...when(consumption.length, () => [
      full('energy-devices', {
        title: t('strategy.appliances'),
        rows: consumption.slice(0, 12).map((id) => deviceRow(home, id)),
      }),
    ]),
    ...when(consumptionPowers.length >= 2, () => [
      full('distribution', {
        title: t('strategy.consumption'),
        entities: consumptionPowers.slice(0, 8),
      }),
    ]),
  ]);
}

/** A day's curve for every power meter of the house. */
function metersView({ home }: StrategyContext): Section[] {
  return balanced(
    home.powers.slice(0, 9).map((id) => full('energy', { entity: id, name: home.placeName(id) })),
  );
}

export const ENERGY_VIEWS: readonly ViewSpec[] = [
  { key: 'now', icon: 'fluvy:bolt', title: 'strategy.now', build: nowView, when: () => true },
  {
    key: 'production',
    icon: 'fluvy:sun',
    title: 'strategy.production',
    build: productionView,
    when: ({ energy }) => Boolean(energy.solarPower || energy.solarToday),
  },
  {
    key: 'devices',
    icon: 'fluvy:plug',
    title: 'strategy.devices',
    build: devicesView,
    when: ({ energy }) => energy.consumption.length > 0 || energy.consumptionPowers.length >= 2,
  },
  {
    key: 'meters',
    icon: 'fluvy:chart',
    title: 'strategy.meters',
    build: metersView,
    when: ({ home }) => home.powers.length > 0,
  },
];
