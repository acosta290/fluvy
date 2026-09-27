import {
  lookKey,
  paletteKey,
  paletteOf,
  type EffectiveSettings,
  type HomeAssistant,
  type Look,
  type LookHandle,
} from '@fluvy/core';
import {
  DEFAULT_PALETTE,
  PALETTE_NAMES,
  presetSeeds,
  type CustomPalette,
  type Hex,
  type PaletteChoice,
  type PaletteMode,
  type PaletteName,
} from '@fluvy/tokens/runtime';
import { s } from './strings.js';

export type Tab = 'appearance' | 'scope' | 'dashboard' | 'preferences' | 'about';
export const TABS: readonly Tab[] = ['appearance', 'scope', 'dashboard', 'preferences', 'about'];

export type StringKey = Parameters<typeof s>[1];

/** The house's settings the Scope tab edits (an administrator's to save). */
export type HouseEdit = Partial<
  Pick<EffectiveSettings, 'scope' | 'dashboards' | 'frame' | 'icons' | 'activity' | 'history'>
>;
/** A person's preferences, their own to save. */
export type PersonalEdit = Partial<
  Pick<EffectiveSettings, 'language' | 'motion' | 'haptics' | 'activityCard'>
>;
/** Options of the automatic dashboard's strategy; `undefined` takes a key away (back to its default). */
export type StrategyEdit = Readonly<Record<string, unknown>>;

/**
 * What every section renders from, and the panel's actions it may call. Nothing a tab changes is saved at once:
 * it is an edit, shown live on this page (the look on the panel, where it applies and the preferences on the
 * whole screen), and saved with the others from the apply bar.
 */
export interface PanelContext {
  readonly hass: HomeAssistant;
  readonly t: (key: StringKey, values?: Record<string, string | number>) => string;
  readonly admin: boolean;
  readonly mode: PaletteMode;
  /** The panel is 648 or wider: desktop gaps (12) and art sizes; a phone's are 8. */
  readonly wide: boolean;
  readonly handle: LookHandle;
  /** What is saved. */
  readonly settings: EffectiveSettings;
  /** What the tabs show: the saved settings with the edits on top. */
  readonly shown: EffectiveSettings;
  /** The look being chosen (what the gallery shows as selected, what the preview wears). */
  readonly draft: Look;
  /** The look differs from the one in use. */
  readonly dirty: boolean;
  readonly houseEdit: HouseEdit;
  readonly personalEdit: PersonalEdit;
  readonly strategyEdit: StrategyEdit;
  readonly tryOnApp: boolean;
  readonly dashboards: readonly DashboardInfo[];
  /** The automatic dashboard's strategy as saved, with its edits on top (undefined: there is none). */
  readonly strategy: Readonly<Record<string, unknown>> | undefined;
  setDraft(look: Partial<Look>): void;
  editHouse(edit: HouseEdit): void;
  editPersonal(edit: PersonalEdit): void;
  editStrategy(edit: StrategyEdit): void;
  setTryOnApp(on: boolean): void;
  /** Saves every edit; a changed look for the house or for this person. */
  apply(to: 'house' | 'me'): void;
  discard(): void;
  run(task: () => Promise<unknown>): void;
}

export interface DashboardInfo {
  readonly urlPath: string;
  readonly title: string;
  /** Its sidebar icon (`mdi:…`, `fluvy:…`), when it has one. */
  readonly icon?: string;
  /** The automatic dashboard's strategy options, when it is one. */
  readonly strategy?: Record<string, unknown>;
}

/** The presets by line, in presentation order: the launch palette (the one a reset returns to) leads its line. */
export const LINES: readonly {
  readonly key: 'soft' | 'vivid';
  readonly names: readonly PaletteName[];
}[] = [
  {
    key: 'soft',
    names: PALETTE_NAMES.filter(
      (name) => presetSeeds.find((seed) => seed.name === name)?.character !== 'vivid',
    ).sort((a, b) => Number(b === DEFAULT_PALETTE) - Number(a === DEFAULT_PALETTE)),
  },
  {
    key: 'vivid',
    names: PALETTE_NAMES.filter(
      (name) => presetSeeds.find((seed) => seed.name === name)?.character === 'vivid',
    ),
  },
];

/**
 * Accents offered for a custom palette, by style (any colour can still be typed): pastels (a pick lends its hue:
 * the line is drawn deeper and the tiles' fill paler) and electric colours, twelve round the wheel. The two lists
 * go hue for hue, so changing the style keeps the colour's place.
 */
export const ACCENTS: Readonly<Record<'soft' | 'vivid', readonly Hex[]>> = {
  soft: [
    '#f9b9d0',
    '#febab6',
    '#f9c09e',
    '#efd99e',
    '#c2d79e',
    '#a0debc',
    '#8ddfde',
    '#97d8f8',
    '#b0d0ff',
    '#c7c8ff',
    '#dcc0f7',
    '#efbbe4',
  ],
  vivid: [
    '#ff2d7a',
    '#e5243b',
    '#ff4a1a',
    '#ffb000',
    '#c6ff00',
    '#00b377',
    '#00a3a3',
    '#00b4e6',
    '#2f5bff',
    '#5a4fff',
    '#8a3ffc',
    '#d63bff',
  ],
};

/** The same place in the other style's list, for a listed accent; any other colour stays as it is. */
export function accentFor(accent: Hex, character: 'soft' | 'vivid'): Hex {
  const other = character === 'soft' ? ACCENTS.vivid : ACCENTS.soft;
  const index = other.indexOf(accent);
  return index < 0 ? accent : (ACCENTS[character][index] ?? accent);
}

/** Second colours a vivid custom palette can carry. */
export const HIGHLIGHTS: readonly Hex[] = ['#e2ff3d', '#5ce1ff', '#ffe14d', '#ffb3d1', '#d4c2ff'];

export const DEFAULT_CUSTOM: CustomPalette = {
  character: 'vivid',
  base: 'cool',
  accent: '#2f5bff',
  fill: 'tint',
};

export const isCustom = (choice: PaletteChoice): choice is CustomPalette =>
  typeof choice !== 'string';

/**
 * What a palette's miniature draws, in the mode on screen: its page, an "on" tile in its fill with the icon and
 * the lit ticks (the accent's ink on a tint, the fill's own ink on a solid colour), an "off" tile in its card,
 * and its highlight when it has one.
 */
export function swatchColors(choice: PaletteChoice, mode: PaletteMode) {
  const colors = paletteOf(choice)[mode];
  const solid = colors.fillStyle === 'solid';
  return {
    page: colors.surface.page,
    card: colors.surface.card,
    border: colors.surface.border,
    accent: colors.accent.ink,
    fill: colors.accent.fill,
    tick: solid ? colors.accent.onFill : colors.accent.ink,
    highlight: colors.mark?.fill,
  };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The part of an edit that differs from what is saved (an edit back to the saved value is no edit). */
export function unsaved<T extends object>(edit: T, saved: object): T {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edit))
    if (!same(value, (saved as Record<string, unknown>)[key])) kept[key] = value;
  return kept as T;
}

/** A strategy with its edits on top (an `undefined` edit takes the key away). */
export function withEdit(
  strategy: Readonly<Record<string, unknown>>,
  edit: StrategyEdit,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...strategy, ...edit };
  for (const [key, value] of Object.entries(edit)) if (value === undefined) delete next[key];
  return next;
}

export const sameLook = (a: Look, b: Look): boolean => lookKey(a) === lookKey(b);

const OPTION_VALUES: Readonly<Record<string, readonly string[]>> = {
  thermostat_variant: ['dial', 'compact', 'ruler'],
  tile_size: ['large', 'compact'],
  flow_style: ['ribbons', 'rail', 'legs'],
};

/**
 * The automatic dashboard's options from a settings file: only the keys its strategy knows, each well formed (a
 * house's own entities, such as its weather, do not travel).
 */
export function strategyOptions(raw: unknown, views: readonly string[]): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const options: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(OPTION_VALUES)) {
    const option = value[key];
    if (typeof option === 'string' && allowed.includes(option)) options[key] = option;
  }
  const hide = value['hide'];
  if (Array.isArray(hide)) {
    const known = hide.filter(
      (key): key is string => typeof key === 'string' && key !== 'home' && views.includes(key),
    );
    if (known.length) options['hide'] = known;
  }
  return options;
}

/** A palette's name: a preset's own (the same in every language), or "Custom". */
export const paletteTitle = (choice: PaletteChoice, t: PanelContext['t']): string =>
  isCustom(choice)
    ? t('palette.custom')
    : (presetSeeds.find((seed) => seed.name === choice)?.title ?? choice);

export const shapeTitle = (look: Look, t: PanelContext['t']): string =>
  t(`shape.${look.shape}` as StringKey);

/** "Linen · Soft". */
export const lookTitle = (look: Look, t: PanelContext['t']): string =>
  `${paletteTitle(look.palette, t)} · ${shapeTitle(look, t)}`;

export const pillTitle = (look: Look, t: PanelContext['t']): string =>
  t(`pills.${look.pills}` as StringKey);

/** What a look change is, in a line: what moved, each from → to ("Linen → Volt · Soft → Round"). */
export function changeTitle(from: Look, to: Look, t: PanelContext['t']): string {
  const parts: string[] = [];
  if (paletteKey(from.palette) !== paletteKey(to.palette))
    parts.push(`${paletteTitle(from.palette, t)} → ${paletteTitle(to.palette, t)}`);
  if (from.shape !== to.shape) parts.push(`${shapeTitle(from, t)} → ${shapeTitle(to, t)}`);
  if (from.pills !== to.pills) parts.push(`${pillTitle(from, t)} → ${pillTitle(to, t)}`);
  return parts.join(' · ');
}

const LANGUAGES: Readonly<Record<string, string>> = { en: 'English', es: 'Español' };

/** The strategy options by the label the Dashboard tab gives them. */
const STRATEGY_LABELS: Readonly<Record<string, StringKey>> = {
  hide: 'dashboard.views',
  thermostat_variant: 'dashboard.thermostat',
  tile_size: 'dashboard.tiles',
  flow_style: 'dashboard.flow',
};

/** Every pending change as a line of the apply bar, in the order of the tabs. */
export function changeLines(ctx: PanelContext): string[] {
  const { t, shown } = ctx;
  const onOff = (on: boolean): string => t(on ? 'change.on' : 'change.off');
  const lines: string[] = [];
  if (ctx.dirty) lines.push(changeTitle(ctx.settings.look, ctx.draft, t));
  const house = ctx.houseEdit;
  if (house.scope)
    lines.push(t(house.scope === 'everywhere' ? 'change.everywhere' : 'change.dashboards'));
  if (house.dashboards) lines.push(`${t('scope.list')} · ${shown.dashboards.length}`);
  if (house.frame !== undefined) lines.push(`${t('scope.frame')} · ${onOff(house.frame)}`);
  if (house.icons !== undefined) lines.push(`${t('scope.icons')} · ${onOff(house.icons)}`);
  if (house.activity !== undefined) lines.push(`${t('scope.activity')} · ${onOff(house.activity)}`);
  if (house.history !== undefined) lines.push(`${t('scope.history')} · ${onOff(house.history)}`);
  for (const key of Object.keys(ctx.strategyEdit))
    lines.push(`${t('dashboard.title')} · ${t(STRATEGY_LABELS[key] ?? 'dashboard.cards')}`);
  const personal = ctx.personalEdit;
  if (personal.language)
    lines.push(`${t('pref.language')} · ${LANGUAGES[personal.language] ?? t('pref.auto')}`);
  if (personal.motion) lines.push(`${t('pref.reduce')} · ${onOff(personal.motion === 'reduced')}`);
  if (personal.haptics !== undefined)
    lines.push(`${t('pref.haptics')} · ${onOff(personal.haptics)}`);
  if (personal.activityCard !== undefined)
    lines.push(`${t('pref.activity_card')} · ${onOff(personal.activityCard)}`);
  return lines;
}
