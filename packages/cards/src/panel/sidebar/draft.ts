import type { LovelaceCardConfig } from '@fluvy/core';
import {
  DEVICES,
  parseSidebar,
  WIDTH_DEFAULTS,
  type SidebarSpec,
  type SidebarWidth,
} from '../../sidebar/config.js';

/*
 * A dashboard's sidebar as the panel edits it: the `fluvy_sidebar:` table as it is written, changed key by key. What
 * a key says is read as the sidebar reads it (`sidebar/config.ts`); what is written is only what a person chose — a
 * choice that is the default takes its key away, so a default is never written into a configuration, and what the
 * panel does not edit (a share for a width, pages written by hand, `views`, `users`) stays as it was written.
 */

/** The table as written. */
export type Raw = Readonly<Record<string, unknown>>;

/** The three lists of cards. */
export const REGIONS = ['header', 'cards', 'footer'] as const;
export type Region = (typeof REGIONS)[number];

/** What the panel offers: no sidebar, the ready-made one, or the person's own. */
export type Kind = 'none' | 'preset' | 'own';

/** What a sidebar holds, apart from where and how it stands. */
const CONTENT: readonly string[] = ['header', 'menu', 'cards', 'footer'];

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** A dashboard's `fluvy_sidebar` where it is a table; undefined where it asks for none. */
export const rawOf = (value: unknown): Raw | undefined => (isRecord(value) ? value : undefined);

/** A table as the sidebar reads it (every key checked, its default where it says nothing). */
export const read = (raw: Raw): SidebarSpec => parseSidebar(raw) as SidebarSpec;

/** What needs a look, as the automatic dashboards' Home asks for it: said in one line at the sidebar's foot. */
const ATTENTION = ['hazards', 'open', 'unlocked', 'errors', 'low_battery'].map((preset) => ({
  preset,
}));

/**
 * The ready-made sidebar, *Clock and pages*: a clock at the head (with the weather where the house has any: only what
 * it can draw), the dashboard's views as the menu, what needs a look at the foot.
 */
export const presetContent = (weather: string | undefined): Raw => ({
  header: {
    cards: [
      {
        type: 'custom:fluvy-clock-card',
        face: 'digital',
        ...(weather ? { weather, show_forecast: false } : {}),
      },
    ],
  },
  menu: { items: 'views' },
  footer: {
    cards: [{ type: 'custom:fluvy-alerts-card', variant: 'banner', alerts: ATTENTION }],
  },
});

const contentOf = (raw: Raw): Raw =>
  Object.fromEntries(CONTENT.filter((key) => key in raw).map((key) => [key, raw[key]]));

/**
 * Which of the three a table is: none where there is none, the ready-made one while it holds exactly that, else the
 * person's own (`own`: they asked for their own, though it still holds the ready-made).
 */
export const kindOf = (raw: Raw | undefined, preset: Raw, own = false): Kind =>
  !raw ? 'none' : own || !same(contentOf(raw), preset) ? 'own' : 'preset';

/** A table with other contents: where and how it stands is kept. */
export const withContent = (raw: Raw | undefined, content: Raw): Raw => ({
  ...Object.fromEntries(Object.entries(raw ?? {}).filter(([key]) => !CONTENT.includes(key))),
  ...content,
});

/** A key as chosen; one chosen as its default goes (`fallback`: what the sidebar does without the key). */
export const withKey = (raw: Raw, key: string, value: unknown, fallback: unknown): Raw => {
  const rest = Object.fromEntries(Object.entries(raw).filter(([own]) => own !== key));
  return same(value, fallback) ? rest : { ...rest, [key]: value };
};

/** A device's width in px; undefined where it is a share of the dashboard (the panel offers px alone). */
export const widthOf = (raw: Raw, device: 'tablet' | 'desktop'): number | undefined => {
  const { unit, value } = read(raw).width[device];
  return unit === 'px' ? value : undefined;
};

const written = ({ unit, value }: SidebarWidth): string | number =>
  unit === '%' ? `${value}%` : value;

/**
 * A device's width in px, the other devices' as they stand: each written only where it is not its default, and no
 * `width` at all where every one is.
 */
export function withWidth(raw: Raw, device: 'tablet' | 'desktop', px: number): Raw {
  const widths = { ...read(raw).width, [device]: { unit: 'px', value: px } satisfies SidebarWidth };
  return withKey(
    raw,
    'width',
    Object.fromEntries(
      DEVICES.filter((name) => !same(widths[name], WIDTH_DEFAULTS[name])).map((name) => [
        name,
        written(widths[name]),
      ]),
    ),
    {},
  );
}

/** A list's cards. */
export const listOf = (raw: Raw, region: Region): readonly LovelaceCardConfig[] =>
  read(raw)[region];

/** A list with other cards (the head's and the foot's under `cards:`); an empty one takes its key away. */
export const withList = (raw: Raw, region: Region, cards: readonly unknown[]): Raw =>
  region === 'cards'
    ? withKey(raw, region, cards, [])
    : withKey(raw, region, { cards }, { cards: [] });

/** Whether it has a menu of pages. */
export const hasMenu = (raw: Raw): boolean => read(raw).menu !== undefined;

/** The menu on (the dashboard's views) or off. */
export const withMenu = (raw: Raw, on: boolean): Raw =>
  withKey(raw, 'menu', on ? { items: 'views' } : undefined, undefined);
