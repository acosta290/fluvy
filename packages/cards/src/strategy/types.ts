import type { LanguageCode, LovelaceCardConfig, MessageKey } from '@fluvy/core';
import type { FlowStyle } from '../energy-flow/energy-flow-card.js';
import type { ThermostatVariant } from '../thermostat/thermostat-card.js';
import type { HomeRegistry } from './home-registry.js';

/*
 * What the automatic dashboard is made of: its config, the cards and sections it lays out, the house's energy
 * roles, and the context every view is built from. Types only: the definer in core reads them without the strategy.
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
