import type { ActionConfig, LovelaceCardConfig } from '@fluvy/core';

/*
 * A dashboard's own sidebar as its configuration asks for it (1.21, #187): `fluvy_sidebar:` beside `views:`, or beside
 * `strategy:` on an automatic dashboard. What is written is read, never trusted: every field is checked on its own and
 * an unknown or broken one takes its default, so nothing of the configuration reaches a style, an address or a
 * selector as it was written. The cards are Home Assistant's to build (`expander/held.ts`), which says a bad one in an
 * error card.
 */

/** The side it stands on: where the page starts (the left, in a language read from the left) or where it ends. */
export const POSITIONS = ['start', 'end'] as const;
export type SidebarPosition = (typeof POSITIONS)[number];

/**
 * Its surface: `panel`, edge to edge on the card's fill with a hairline at its inner edge; `card`, one card with the
 * view's gap round it; `plain`, none, each card on its own.
 */
export const STYLES = ['panel', 'card', 'plain'] as const;
export type SidebarStyle = (typeof STYLES)[number];

/** What a phone gets where it has no width of its own: nothing, the head and the menu above the view, or a drawer. */
export const PHONES = ['none', 'top', 'drawer'] as const;
export type SidebarPhone = (typeof PHONES)[number];

/** The screens a width is said for, by the window's width: a phone under 600, a tablet under 1280, a desktop above. */
export const DEVICES = ['phone', 'tablet', 'desktop'] as const;
export type SidebarDevice = (typeof DEVICES)[number];
export const TABLET_FROM = 600;
export const DESKTOP_FROM = 1280;

/** A width: so many px, or a share of the dashboard in percent; 0 px is none. */
export interface SidebarWidth {
  readonly unit: 'px' | '%';
  readonly value: number;
}
export type SidebarWidths = Readonly<Record<SidebarDevice, SidebarWidth>>;

/** The narrowest and the widest a sidebar stands, in px and as a share. */
export const WIDTH_PX = [160, 560] as const;
export const WIDTH_SHARE = [10, 50] as const;

const NONE: SidebarWidth = { unit: 'px', value: 0 };
export const WIDTH_DEFAULTS: SidebarWidths = {
  phone: NONE,
  tablet: { unit: 'px', value: 280 },
  desktop: { unit: 'px', value: 320 },
};

/** A page of the menu: its words, its icon, and where it leads (a path) or what it runs (an action). */
export interface SidebarItem {
  readonly title: string;
  readonly icon?: string;
  /** An address of Home Assistant's (`/lights/living`), or a view of this dashboard by its path (`living`). */
  readonly path?: string;
  readonly tap_action?: ActionConfig;
}

export interface SidebarMenu {
  /** The dashboard's own views, or the pages written. */
  readonly items: 'views' | readonly SidebarItem[];
  /** It stays under the head while the middle scrolls. */
  readonly pinned: boolean;
}

export interface SidebarSpec {
  readonly position: SidebarPosition;
  readonly width: SidebarWidths;
  readonly phone: SidebarPhone;
  readonly style: SidebarStyle;
  readonly collapsible: boolean;
  readonly header: readonly LovelaceCardConfig[];
  readonly menu: SidebarMenu | undefined;
  readonly cards: readonly LovelaceCardConfig[];
  readonly footer: readonly LovelaceCardConfig[];
  /** The views it stands beside, by their paths; undefined: every view. */
  readonly views: readonly string[] | undefined;
  readonly subviews: boolean;
  /** The people it is drawn for, by their user ids; undefined: everyone. */
  readonly users: readonly string[] | undefined;
  readonly hideTabs: boolean;
  /** How opaque its surface is, in percent; undefined: the house's cards'. */
  readonly opacity: number | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  (values as readonly unknown[]).includes(value) ? (value as T) : fallback;

/** The older words for a side: `left` and `right`, as a language read from the left has them. */
const SIDES: Readonly<Record<string, SidebarPosition>> = { left: 'start', right: 'end' };

const hold = (value: number, [least, most]: readonly [number, number]): number =>
  Math.min(most, Math.max(least, Math.round(value)));

/**
 * A width as written: a number or `'280px'` (px), `'24%'` (a share of the dashboard), held to what a sidebar can be;
 * 0 is none, and what cannot be read is undefined.
 */
export function parseWidth(raw: unknown): SidebarWidth | undefined {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  const [, figure, unit] = /^(\d+(?:\.\d+)?)\s*(px|%)?$/.exec(text) ?? [];
  if (figure === undefined) return undefined;
  const value = Number(figure);
  if (value === 0) return NONE;
  return unit === '%'
    ? { unit: '%', value: hold(value, WIDTH_SHARE) }
    : { unit: 'px', value: hold(value, WIDTH_PX) };
}

/** One width for a tablet and a desktop (a phone has none), or each device's own, its default where it says none. */
function parseWidths(raw: unknown): SidebarWidths {
  if (isRecord(raw))
    return {
      phone: parseWidth(raw['phone']) ?? WIDTH_DEFAULTS.phone,
      tablet: parseWidth(raw['tablet']) ?? WIDTH_DEFAULTS.tablet,
      desktop: parseWidth(raw['desktop']) ?? WIDTH_DEFAULTS.desktop,
    };
  const one = parseWidth(raw);
  return one ? { phone: NONE, tablet: one, desktop: one } : WIDTH_DEFAULTS;
}

/** A list of cards: every entry that is a card's config (an object naming its type). */
const parseCards = (raw: unknown): LovelaceCardConfig[] =>
  (Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw['cards'])
      ? raw['cards']
      : []
  ).filter(
    (card): card is LovelaceCardConfig => isRecord(card) && typeof card['type'] === 'string',
  );

/** An icon as Home Assistant names them (`mdi:home`, `fluvy:sun`). */
export const isIcon = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(value);

/** A view's path as Home Assistant writes them: letters, digits, `-` and `_`. */
export const isViewPath = (value: unknown): value is string =>
  typeof value === 'string' && /^[\p{L}\p{N}_-]+$/u.test(value);

/**
 * An address inside Home Assistant: one that starts at its root (`/lights/living`, never `//host` nor a scheme), with no
 * space or backslash in it.
 */
export const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^\/(?!\/)[^\s\\]*$/.test(value);

/** A page as written: one with words (what it is read out by) that leads somewhere or runs something. */
function parseItem(raw: unknown): SidebarItem | undefined {
  if (!isRecord(raw)) return undefined;
  const path = raw['path'];
  const action = raw['tap_action'];
  const leads = isAddress(path) || isViewPath(path);
  const runs = isRecord(action) && typeof action['action'] === 'string';
  const title = typeof raw['title'] === 'string' ? raw['title'].trim() : '';
  if (!title || (!leads && !runs)) return undefined;
  const icon = raw['icon'];
  return {
    title,
    ...(isIcon(icon) ? { icon } : {}),
    ...(leads ? { path } : { tap_action: action as unknown as ActionConfig }),
  };
}

/** The menu: `views` (also `menu: views`, `menu: true`), or the pages written; none where nothing is asked. */
function parseMenu(raw: unknown): SidebarMenu | undefined {
  if (raw === true || raw === 'views') return { items: 'views', pinned: false };
  if (!isRecord(raw)) return undefined;
  const items = raw['items'];
  const pinned = raw['pinned'] === true;
  if (items === undefined || items === 'views') return { items: 'views', pinned };
  const pages = (Array.isArray(items) ? items : [])
    .map(parseItem)
    .filter((item): item is SidebarItem => item !== undefined);
  return pages.length ? { items: pages, pinned } : undefined;
}

const words = (raw: unknown, known: (value: unknown) => value is string): string[] | undefined => {
  const list = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).filter(known);
  return list.length ? [...new Set(list)] : undefined;
};

const isId = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** The sidebar a configuration asks for; undefined where it asks for none (the key left out, `false`, no object). */
export function parseSidebar(raw: unknown): SidebarSpec | undefined {
  if (!isRecord(raw)) return undefined;
  const position = raw['position'];
  const opacity = raw['card_opacity'];
  return {
    position: oneOf(
      POSITIONS,
      typeof position === 'string' ? (SIDES[position] ?? position) : position,
      'start',
    ),
    width: parseWidths(raw['width']),
    phone: oneOf(PHONES, raw['phone'], 'none'),
    style: oneOf(STYLES, raw['style'], 'panel'),
    collapsible: raw['collapsible'] === true,
    header: parseCards(raw['header']),
    menu: parseMenu(raw['menu']),
    cards: parseCards(raw['cards']),
    footer: parseCards(raw['footer']),
    views: words(raw['views'], isViewPath),
    subviews: raw['subviews'] !== false,
    users: words(raw['users'], isId),
    hideTabs: raw['hide_tabs'] === true,
    opacity:
      typeof opacity === 'number' && Number.isFinite(opacity)
        ? Math.min(100, Math.max(0, Math.round(opacity)))
        : undefined,
  };
}

/** The device a window of this width is. */
export const deviceOf = (width: number): SidebarDevice =>
  width < TABLET_FROM ? 'phone' : width < DESKTOP_FROM ? 'tablet' : 'desktop';

/** How a sidebar stands on a device: beside the views, above them, in a drawer over them, or not at all. */
export type Presentation = 'beside' | 'top' | 'drawer';

export function presentationOf(spec: SidebarSpec, device: SidebarDevice): Presentation | undefined {
  if (spec.width[device].value > 0) return 'beside';
  return device === 'phone' && spec.phone !== 'none' ? spec.phone : undefined;
}

/** A width as CSS, from its checked figures alone. */
export const widthCss = ({ unit, value }: SidebarWidth): string =>
  unit === '%' ? `clamp(${WIDTH_PX[0]}px, ${value}%, ${WIDTH_PX[1]}px)` : `${value}px`;
