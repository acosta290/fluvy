import {
  formatNumber,
  localize,
  numberAttr,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import { clamp } from '@fluvy/ui';
import { SET_POSITION, SET_TILT_POSITION } from '../cover-family.js';
import type { Choice } from '../shared/chips.js';
import type { CoverCardConfig, CoverFavorite } from './cover-card.js';

/*
 * How a cover reads under its card's config (#203): what the Cover card and the details sheet it opens share, so the
 * two never say different figures of one blind (#258) — its position turned round or counted as it comes down, its
 * tilt in degrees, its ends in the person's words, and the places it goes in a tap.
 */

export type Percent = number | null;

/** Positions are whole percents; a device that answers 59 for 60 has arrived. */
export const near = (a: Percent, b: Percent): boolean =>
  a !== null && b !== null && Math.abs(a - b) <= 1;

export const percentAttr = (view: EntityView, key: string): Percent => {
  const value = numberAttr(view, key);
  return value === null ? null : clamp(Math.round(value), 0, 100);
};

/** A percent turned round (`invert_position`, `invert_tilt`, `direction: down`), or as it is. */
export const mirror = (turned: boolean, value: number): number => (turned ? 100 - value : value);

/**
 * What a Cover card says of its cover's figures and places: its details sheet reads them from the card that opened
 * it, and draws by them as the card does.
 */
export type CoverReads = Pick<
  CoverCardConfig,
  | 'invert_position'
  | 'invert_tilt'
  | 'direction'
  | 'tilt_angle'
  | 'open_label'
  | 'closed_label'
  | 'favorites'
  | 'favorites_style'
  | 'show_favorites'
>;

/** A cover as it stands, and the state it is drawn in. */
export interface Motion {
  /** The position it reports, Home Assistant's own number; none for a cover that has none. */
  readonly reported: Percent;
  readonly fullyOpen: boolean;
  readonly fullyClosed: boolean;
  /** The state drawn: the one expected, until the cover says its travel is over. */
  readonly shown: string;
  readonly moving: boolean;
}

/** A cover's motion for the state `expected` of it (the one asked for, while Home Assistant has not answered). */
export function motionOf(view: EntityView, expected: string): Motion {
  const reported = percentAttr(view, 'current_position');
  // Home Assistant's own rule for the ends: the position when there is one, the state otherwise
  const fullyOpen = reported !== null ? reported >= 100 : view.state === 'open';
  const fullyClosed = reported !== null ? reported <= 0 : view.state === 'closed';
  // the travel is over once the cover says so, even if the "Opening" expected never came
  const shown =
    (expected === 'opening' && fullyOpen) || (expected === 'closing' && fullyClosed)
      ? view.state
      : expected;
  return {
    reported,
    fullyOpen,
    fullyClosed,
    shown,
    moving: shown === 'opening' || shown === 'closing',
  };
}

/** Degrees at 100 % tilt, or 0 when tilt reads in percent. */
export const tiltAngleOf = (config: CoverReads | undefined): number => {
  const angle = config?.tilt_angle;
  return typeof angle === 'number' && angle > 0 ? angle : 0;
};

/** A whole percent as a cover's words say it: "60 %". */
export const percentText = (hass: HomeAssistant | undefined, value: number): string =>
  `${formatNumber(hass, value, { digits: 0 })} %`;

/** The words at a position ruler's ends, and whether each is the person's own, which may end in an ellipsis. */
export interface Ends {
  readonly open: string;
  readonly closed: string;
  readonly own: { readonly open: boolean; readonly closed: boolean };
}

/** The position ruler's ends: the config's words (`open_label`, `closed_label`, #203), else "Open" and "Closed". */
export function endsOf(hass: HomeAssistant | undefined, config: CoverReads | undefined): Ends {
  const own = (text: unknown): string => (typeof text === 'string' ? text.trim() : '');
  const open = own(config?.open_label);
  const closed = own(config?.closed_label);
  return {
    open: open || localize(hass, 'common.open'),
    closed: closed || localize(hass, 'common.closed'),
    own: { open: open !== '', closed: closed !== '' },
  };
}

/** The favourites a cover can actually reach: a position needs SET_POSITION, a tilt needs SET_TILT_POSITION. */
export function favoritesFor(
  view: EntityView,
  config: CoverReads | undefined,
): readonly CoverFavorite[] {
  const position = view.supports(SET_POSITION);
  const tilt = view.domain === 'cover' && view.supports(SET_TILT_POSITION);
  return (config?.favorites ?? []).filter(
    (f) =>
      f !== null &&
      typeof f === 'object' &&
      ((position && typeof f.position === 'number') || (tilt && typeof f.tilt === 'number')),
  );
}

/**
 * "Morning · 60 %", "Night · closed", "Shade · tilt 30 %", or just "60 %" when the favourite has no name; `bare`,
 * an angle's figure without the tilt's word ("Shade · 30 %"), what its chip says where its words hold no row.
 */
export function favoriteLabel(
  hass: HomeAssistant | undefined,
  config: CoverReads | undefined,
  favorite: CoverFavorite,
  bare = false,
): string {
  const position = favorite.position;
  const ends = endsOf(hass, config);
  const opening = typeof position === 'number' ? mirror(config?.direction === 'down', position) : 0;
  const tilt = percentText(hass, favorite.tilt ?? 0);
  const value =
    typeof position === 'number'
      ? opening >= 100
        ? ends.open
        : opening <= 0
          ? ends.closed
          : percentText(hass, position)
      : bare
        ? tilt
        : `${localize(hass, 'cover.tilt')} ${tilt}`;
  return favorite.name ? `${favorite.name} · ${value.toLowerCase()}` : value;
}

/**
 * The favourites as chips, the one the cover stands at lit: `said`, the position as the card says it, and `tilt`, its
 * tilt as the card shows it. An angle's chip whose words hold no row says its figure without the tilt's word (pt
 * "inclinação" at 211).
 */
export const favoriteChips = (
  hass: HomeAssistant | undefined,
  config: CoverReads | undefined,
  favorites: readonly CoverFavorite[],
  said: Percent,
  tilt: Percent,
  unusable: boolean,
): Choice[] =>
  favorites.map((favorite, index) => ({
    key: String(index),
    label: favoriteLabel(hass, config, favorite),
    ...(typeof favorite.position === 'number'
      ? {}
      : { own: favoriteLabel(hass, config, favorite, true) }),
    active:
      !unusable &&
      (typeof favorite.position !== 'number' || near(said, Math.round(favorite.position))) &&
      (typeof favorite.tilt !== 'number' || near(tilt, Math.round(favorite.tilt))),
  }));
