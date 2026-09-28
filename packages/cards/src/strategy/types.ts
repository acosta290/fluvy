import type { LanguageCode, LovelaceCardConfig, MessageKey } from '@fluvy/core';
import type { FlowStyle } from '../energy-flow/energy-flow-card.js';
import type { ThermostatVariant } from '../thermostat/thermostat-card.js';
import type { HomeRegistry } from './home-registry.js';
import { type RoomVariant } from '../room/room-card.js';

/*
 * What the automatic dashboards are made of: their configs, the cards and sections they lay out, the house's
 * energy roles, and the context every view is built from. Types only: the definer in core reads them without the
 * strategy.
 */

/** The dashboards Fluvy builds by itself, each a template: `custom:fluvy-<id>`. */
export type TemplateId = 'home' | 'rooms' | 'energy' | 'security' | 'wall';
export type StrategyType = `custom:fluvy-${TemplateId}`;

/** Seconds between a camera's stills on the security dashboard. */
export type CameraRefresh = 5 | 10 | 30;
/** How many scenes a wall shows as chips. */
export type ScenesMax = 4 | 6 | 8;

/** What any of the automatic dashboards reads from its raw configuration; each template honours its own keys. */
export interface FluvyStrategyConfig {
  type: StrategyType;
  /** The weather entity of the greeting and the clock; default: the first `weather.*`. */
  weather?: string;
  /** Views to leave out: any but the first, which always stays. */
  hide?: readonly string[];
  /** The thermostats' variant (default: each card's own, the dial). */
  thermostat_variant?: ThermostatVariant;
  /** The lights' tiles: large (default, with their ruler) or compact rows. */
  tile_size?: 'large' | 'compact';
  /** How the energy flow draws its lines (default: ribbons). */
  flow_style?: FlowStyle;
  /** The rooms' cards (default: a photo where the area has one, else a tile). */
  room_variant?: RoomVariant;
  /** The rooms a wall shows (default: every room with something in it). */
  areas?: readonly string[];
  /** Seconds between the cameras' stills (default 10). */
  camera_refresh?: CameraRefresh;
  /** How many scenes a wall offers (default 6). */
  scenes_max?: ScenesMax;
  /** The dashboard's words in one language, whoever opens it (default: each person's). */
  language?: LanguageCode;
}

/** The home dashboard's config: the same keys, its views by name. */
export interface FluvyHomeStrategyConfig extends FluvyStrategyConfig {
  type: 'custom:fluvy-home';
  hide?: ReadonlyArray<Exclude<ViewKey, 'home'>>;
}

export type Card = LovelaceCardConfig & { grid_options?: { columns?: number } };
export interface Section {
  readonly type: 'grid';
  readonly cards: Card[];
}
export type ViewKey =
  'home' | 'rooms' | 'lights' | 'climate' | 'energy' | 'security' | 'media' | 'agenda' | 'sensors';
export interface View {
  title: string;
  path: string;
  icon: string;
  type: 'sections';
  max_columns: number;
  sections: Section[];
  /** A view reached from another (a room from the rooms), not from the tabs; `back_path` is where its back arrow goes. */
  subview?: boolean;
  back_path?: string;
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
  readonly room?: RoomVariant;
  readonly refresh?: CameraRefresh;
  readonly scenes?: ScenesMax;
}

export interface StrategyContext {
  readonly home: HomeRegistry;
  readonly t: (key: MessageKey) => string;
  /** The dashboard's url path (`/fluvy-home`): the tabs and "see all" links navigate inside it. */
  readonly base: string;
  readonly weather: string | undefined;
  readonly energy: EnergyRoles;
  readonly style: CardStyle;
  /** The rooms the dashboard was asked to show (undefined: every room with something in it). */
  readonly areas: readonly string[] | undefined;
}

export interface ViewSpec {
  /** The view's path inside its dashboard (`hide` names it). */
  readonly key: string;
  readonly icon: string;
  readonly title: MessageKey;
  /** A title of its own (a floor's name) instead of the word. */
  readonly name?: string;
  readonly build: (ctx: StrategyContext) => Section[];
  /** Whether the house has anything for the view; default: some section has cards. */
  readonly when?: (ctx: StrategyContext) => boolean;
}
