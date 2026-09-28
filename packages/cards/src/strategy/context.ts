import { wordsIn, type HomeAssistant } from '@fluvy/core';
import { gridExportPositive } from './energy-sign.js';
import { HomeRegistry } from './home-registry.js';
import { findEnergyRoles, helloCard, tabsCard } from './home-views.js';
import type {
  EnergyPrefs,
  EnergyRoles,
  FluvyHomeStrategyConfig,
  Section,
  StrategyContext,
  View,
} from './types.js';

/*
 * The house as the automatic dashboard reads it: its energy roles, the context every view is built from, and the
 * frame every view is given (the greeting and the tabs first, three columns).
 */

/** Columns of every generated view: the widest layout, kept on every tab (an empty section still takes its column). */
export const COLUMNS = 3;

export const withCards = (sections: readonly Section[]): Section[] =>
  sections.filter((section) => section.cards.length > 0);

/** The greeting and the tabs first in the first section; empty sections up to the three columns. */
export function framed(view: View, ctx: StrategyContext, views: readonly View[]): View {
  const header = [helloCard(ctx.weather, ctx.home.me), tabsCard(ctx.base, views)];
  const [first, ...rest] = view.sections;
  const sections: Section[] = first
    ? [{ ...first, cards: [...header, ...first.cards] }, ...rest]
    : [{ type: 'grid', cards: header }];
  while (sections.length < COLUMNS) sections.push({ type: 'grid', cards: [] });
  return { ...view, sections };
}

/** A grid meter found by its words (not given by the energy preferences) takes the sign its last day shows. */
async function signedEnergyRoles(hass: HomeAssistant, roles: EnergyRoles): Promise<EnergyRoles> {
  if (!roles.gridPower || roles.gridSigned || roles.batteryPower) return roles;
  return {
    ...roles,
    gridInvert: await gridExportPositive(hass, roles.gridPower, roles.solarPower),
  };
}

/**
 * The house's power meters as the automatic dashboard finds them: the energy dashboard's preferences first, then
 * the registries' words, each with its sign.
 */
export async function houseEnergy(
  hass: HomeAssistant,
  home = new HomeRegistry(hass),
): Promise<EnergyRoles> {
  // a house without the energy dashboard answers with an error: then there are no preferences
  const prefs = await hass
    .callWS<EnergyPrefs>({ type: 'energy/get_prefs' })
    .catch((): null => null);
  return signedEnergyRoles(hass, findEnergyRoles(home, prefs));
}

/** The context a dashboard is generated in: the house, its words, its base path, its weather and energy, and the cards' style. */
export async function buildContext(
  config: FluvyHomeStrategyConfig,
  hass: HomeAssistant,
  base = `/${(typeof location !== 'undefined' ? location.pathname.split('/')[1] : '') || 'fluvy-home'}`,
): Promise<StrategyContext> {
  const home = new HomeRegistry(hass);
  const ctx: StrategyContext = {
    home,
    t: config.language ? wordsIn(config.language) : (key) => home.t(key),
    // the dashboard the strategy is generated for: the page's first path segment
    base,
    weather: config.weather ?? home.weather[0],
    energy: await houseEnergy(hass, home),
    style: {
      ...(config.thermostat_variant ? { thermostat: config.thermostat_variant } : {}),
      ...(config.tile_size ? { tiles: config.tile_size } : {}),
      ...(config.flow_style ? { flow: config.flow_style } : {}),
    },
  };
  return ctx;
}
