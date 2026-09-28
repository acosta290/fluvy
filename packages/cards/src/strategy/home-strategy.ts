import { wordsIn, type LanguageCode } from '@fluvy/core';
import type { HomeAssistant } from '@fluvy/core';
import type { FlowStyle } from '../energy-flow/energy-flow-card.js';
import type { ThermostatVariant } from '../thermostat/thermostat-card.js';
import { gridExportPositive } from './energy-sign.js';
import { HomeRegistry } from './home-registry.js';
import {
  findEnergyRoles,
  helloCard,
  tabsCard,
  VIEWS,
  type EnergyPrefs,
  type EnergyRoles,
  type Section,
  type StrategyContext,
  type View,
  type ViewKey,
} from './home-views.js';

/**
 * `custom:fluvy-home` — the dashboard a new install gets without configuring anything: five views
 * (Home, Lights, Climate, Energy, Sensors) built from the entity, device and area registries and
 * from the energy dashboard's own preferences, in the layout of the approved `/fluvy-home`.
 *
 * Every card is a fluvy card. A section that would be empty is left out, a view without content is
 * left out. Every view opens with the greeting and the tabs and is three columns wide, so the header
 * never moves when the tab changes. Names come from the entities themselves (the cards resolve
 * them), titles from the dashboard's language.
 */

export interface FluvyHomeStrategyConfig {
  type: 'custom:fluvy-home';
  /** The weather entity of the greeting and the clock; default: the first `weather.*`. */
  weather?: string;
  /** Views to leave out: any but `home`, which always stays. */
  hide?: ReadonlyArray<Exclude<ViewKey, 'home'>>;
  /** The thermostats' variant (default: each card's own, the dial). */
  thermostat_variant?: ThermostatVariant;
  /** The lights' tiles: large (default, with their ruler) or compact rows. */
  tile_size?: 'large' | 'compact';
  /** How the energy flow draws its lines (default: ribbons). */
  flow_style?: FlowStyle;
  /** The dashboard's words in one language, whoever opens it (default: each person's). */
  language?: LanguageCode;
}

/** Columns of every generated view: the widest layout, kept on every tab (an empty section still takes its column). */
const COLUMNS = 3;

const withCards = (sections: readonly Section[]): Section[] =>
  sections.filter((section) => section.cards.length > 0);

/** The greeting and the tabs first in the first section; empty sections up to the three columns. */
function framed(view: View, ctx: StrategyContext, views: readonly View[]): View {
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

export class FluvyHomeStrategy {
  static async generate(
    config: FluvyHomeStrategyConfig,
    hass: HomeAssistant,
  ): Promise<{ views: View[] }> {
    const home = new HomeRegistry(hass);
    const ctx: StrategyContext = {
      home,
      t: config.language ? wordsIn(config.language) : (key) => home.t(key),
      // the dashboard the strategy is generated for: the page's first path segment
      base: `/${(typeof location !== 'undefined' ? location.pathname.split('/')[1] : '') || 'fluvy-home'}`,
      weather: config.weather ?? home.weather[0],
      energy: await houseEnergy(hass, home),
      style: {
        ...(config.thermostat_variant ? { thermostat: config.thermostat_variant } : {}),
        ...(config.tile_size ? { tiles: config.tile_size } : {}),
        ...(config.flow_style ? { flow: config.flow_style } : {}),
      },
    };
    const hidden = new Set<ViewKey>(config.hide ?? []);
    const views = VIEWS.filter((spec) => spec.key === 'home' || !hidden.has(spec.key))
      .map((spec) => ({ spec, sections: withCards(spec.build(ctx)) }))
      .filter(({ spec, sections }) => (spec.when ? spec.when(ctx) : sections.length > 0))
      .map(({ spec, sections }): View => ({
        title: ctx.t(spec.title),
        icon: spec.icon,
        path: spec.key,
        type: 'sections',
        max_columns: COLUMNS,
        sections,
      }));
    return { views: views.map((view) => framed(view, ctx, views)) };
  }
}
