import {
  CUSTOM_BASES,
  DEFAULT_PALETTE,
  DEFAULT_PILL,
  DEFAULT_SHAPE,
  isPaletteName,
  isPillName,
  isShapeName,
  type CustomPalette,
  type PaletteChoice,
  type PillName,
  type ShapeName,
} from '@fluvy/tokens/runtime';
import { THEME_NAME } from '@fluvy/tokens/config';
import type { Look } from '../look/css.js';

/**
 * fluvy's settings, kept where Home Assistant keeps its own frontend settings: the house's in its system
 * data (written by an admin, read by everyone) and each person's in their user data, both under the key
 * `fluvy`. What is stored is parsed, never trusted: an unknown or broken field falls back to its default,
 * so a stored value from another version can never break the page.
 */

/** Where the look applies: the chosen dashboards only, or all of Home Assistant. */
export type Scope = 'dashboards' | 'everywhere';
export type Motion = 'system' | 'reduced';
export type CardLanguage = 'auto' | 'en' | 'es';

export const SETTINGS_KEY = 'fluvy';
export const SETTINGS_VERSION = 1;

/** What the house decides (an admin). */
export interface HouseSettings {
  readonly version: typeof SETTINGS_VERSION;
  readonly palette: PaletteChoice;
  readonly shape: ShapeName;
  readonly pills: PillName;
  readonly scope: Scope;
  /** Dashboards (url paths) that wear the look in the `dashboards` scope; empty: every `fluvy-…` dashboard. */
  readonly dashboards: readonly string[];
  /** The floating frame around the app on wide screens (`everywhere`). */
  readonly frame: boolean;
  /** Our icons in Home Assistant's own menus (the sidebar, Settings); false keeps Home Assistant's. */
  readonly icons: boolean;
  /** Our Activity view in place of Home Assistant's logbook page (where the look reaches it); false keeps Home Assistant's. */
  readonly activity: boolean;
  /** Our History view in place of Home Assistant's history page (where the look reaches it); false keeps Home Assistant's. */
  readonly history: boolean;
}

/** What each person may choose for themselves. */
export interface PersonalSettings {
  readonly version: typeof SETTINGS_VERSION;
  /** Their own look instead of the house's; absent: the house's. */
  readonly palette?: PaletteChoice;
  readonly shape?: ShapeName;
  readonly pills?: PillName;
  readonly language: CardLanguage;
  readonly motion: Motion;
  readonly haptics: boolean;
  /** The Activity page's timeline on a card (like a dashboard's); false: on the page itself. */
  readonly activityCard: boolean;
}

/** The two layers resolved: what this person sees. */
export interface EffectiveSettings {
  readonly look: Look;
  /** Whether the look is this person's own rather than the house's. */
  readonly personalLook: boolean;
  readonly scope: Scope;
  readonly dashboards: readonly string[];
  readonly frame: boolean;
  readonly icons: boolean;
  readonly activity: boolean;
  readonly history: boolean;
  readonly language: CardLanguage;
  readonly motion: Motion;
  readonly haptics: boolean;
  readonly activityCard: boolean;
}

export const HOUSE_DEFAULTS: HouseSettings = {
  version: SETTINGS_VERSION,
  palette: DEFAULT_PALETTE,
  shape: DEFAULT_SHAPE,
  pills: DEFAULT_PILL,
  scope: 'dashboards',
  dashboards: [],
  frame: true,
  icons: true,
  activity: true,
  history: true,
};

export const PERSONAL_DEFAULTS: PersonalSettings = {
  version: SETTINGS_VERSION,
  language: 'auto',
  motion: 'system',
  haptics: true,
  activityCard: false,
};

const HEX = /^#[0-9a-f]{6}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

/** A preset's name, or a well-formed custom palette; anything else is undefined. */
export function parsePalette(value: unknown): PaletteChoice | undefined {
  if (isPaletteName(value)) return value;
  if (!isRecord(value)) return undefined;
  const { character, base, accent, fill, highlight } = value;
  if (!oneOf(character, ['soft', 'vivid'] as const)) return undefined;
  if (!oneOf(base, CUSTOM_BASES) || typeof accent !== 'string' || !HEX.test(accent))
    return undefined;
  const custom: CustomPalette = {
    character,
    base,
    accent: accent.toLowerCase(),
    ...(character === 'vivid' && oneOf(fill, ['tint', 'solid'] as const) ? { fill } : {}),
    ...(character === 'vivid' && typeof highlight === 'string' && HEX.test(highlight)
      ? { highlight: highlight.toLowerCase() }
      : {}),
  };
  return custom;
}

export function parseHouse(raw: unknown): HouseSettings {
  const value = isRecord(raw) ? raw : {};
  const d = HOUSE_DEFAULTS;
  return {
    version: SETTINGS_VERSION,
    palette: parsePalette(value['palette']) ?? d.palette,
    shape: isShapeName(value['shape']) ? value['shape'] : d.shape,
    pills: isPillName(value['pills']) ? value['pills'] : d.pills,
    scope: oneOf(value['scope'], ['dashboards', 'everywhere'] as const) ? value['scope'] : d.scope,
    dashboards: Array.isArray(value['dashboards'])
      ? value['dashboards'].filter((path): path is string => typeof path === 'string')
      : d.dashboards,
    frame: typeof value['frame'] === 'boolean' ? value['frame'] : d.frame,
    icons: typeof value['icons'] === 'boolean' ? value['icons'] : d.icons,
    activity: typeof value['activity'] === 'boolean' ? value['activity'] : d.activity,
    history: typeof value['history'] === 'boolean' ? value['history'] : d.history,
  };
}

export function parsePersonal(raw: unknown): PersonalSettings {
  const value = isRecord(raw) ? raw : {};
  const d = PERSONAL_DEFAULTS;
  const palette = parsePalette(value['palette']);
  return {
    version: SETTINGS_VERSION,
    ...(palette ? { palette } : {}),
    ...(isShapeName(value['shape']) ? { shape: value['shape'] } : {}),
    ...(isPillName(value['pills']) ? { pills: value['pills'] } : {}),
    language: oneOf(value['language'], ['auto', 'en', 'es'] as const)
      ? value['language']
      : d.language,
    motion: oneOf(value['motion'], ['system', 'reduced'] as const) ? value['motion'] : d.motion,
    haptics: typeof value['haptics'] === 'boolean' ? value['haptics'] : d.haptics,
    activityCard:
      typeof value['activityCard'] === 'boolean' ? value['activityCard'] : d.activityCard,
  };
}

/** The house's settings with this person's on top: their own look replaces the house's as a whole. */
export function resolveSettings(
  house: HouseSettings,
  personal: PersonalSettings,
): EffectiveSettings {
  const own = personal.palette !== undefined;
  return {
    look: {
      palette: personal.palette ?? house.palette,
      shape: own ? (personal.shape ?? house.shape) : house.shape,
      pills: own ? (personal.pills ?? house.pills) : house.pills,
    },
    personalLook: own,
    scope: house.scope,
    dashboards: house.dashboards,
    frame: house.frame,
    icons: house.icons,
    activity: house.activity,
    history: house.history,
    language: personal.language,
    motion: personal.motion,
    haptics: personal.haptics,
    activityCard: personal.activityCard,
  };
}

/** Whether a dashboard wears the look in the `dashboards` scope. */
export function wearsLook(
  settings: Pick<EffectiveSettings, 'dashboards'>,
  urlPath: string | undefined,
): boolean {
  if (!urlPath) return false;
  return settings.dashboards.length
    ? settings.dashboards.includes(urlPath)
    : urlPath.startsWith('fluvy');
}

/**
 * The scope a page applies. "Everywhere" holds while Home Assistant's own theme for this person is Fluvy (their
 * profile's, or the house's default): a person who picks another theme keeps it on every Home Assistant page, and the
 * look stays on Fluvy's dashboards, as with "only dashboards". Before Home Assistant says which theme it wears (the
 * first paint), the setting is taken as it is.
 */
export function pageScope(scope: Scope, theme: string | undefined): Scope {
  return scope === 'everywhere' && theme && theme !== THEME_NAME ? 'dashboards' : scope;
}
