import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { headlessOf, muted } from './shared/head-lines.js';
import { columnOf, HEAD, SECTION_COLUMN } from './shared/heights.js';

/**
 * The weather and compass cards, announced at start and defined when their chunk lands (`weather-cards.ts`), as the
 * energy and media families are: what the picker lists and how tall each is at a 360 column, without the cards
 * themselves.
 */

/** A day's row; the hero with the card's padding; a strip of columns (84) with the 16 above it; the compact head. */
export const WEATHER_ROW = 60;
export const WEATHER_HERO = 128;
export const WEATHER_STRIP = 100;
export const WEATHER_COMPACT_HEAD = 84;

/** What a config draws under the hero: a mode, or nothing when the forecast is not shown. */
export function forecastModeOf(
  config: Readonly<Record<string, unknown>> | undefined,
): 'daily' | 'hourly' | 'both' | 'none' {
  if (config?.['show_forecast'] === false) return 'none';
  const mode = config?.['forecast'];
  return mode === 'hourly' || mode === 'both' ? mode : 'daily';
}

/** The days a config asks for, one to ten (five by default). */
export function forecastDaysOf(config: LovelaceCardConfig | undefined): number {
  const days = config?.['days'];
  return Math.min(10, Math.max(1, Math.round(typeof days === 'number' ? days : 5)));
}

/** The forecasts a weather entity offers (`supported_features`): daily 1, hourly 2 (Home Assistant's bits). */
const FORECAST_DAILY = 1;
const FORECAST_HOURLY = 2;

/**
 * The card at a 360 column: the hero (or the compact head), then a strip per forecast or the days' rows. A forecast
 * the entity does not offer (its `features`, as the house describes them: `house-heights.ts`) draws nothing and
 * counts nothing; where the house is not there to say, every forecast asked for is offered.
 */
export function weatherHeight(config: LovelaceCardConfig, features?: number): number {
  const mode = forecastModeOf(config);
  const offers = (bit: number): boolean => features === undefined || (features & bit) !== 0;
  const hours = (mode === 'hourly' || mode === 'both') && offers(FORECAST_HOURLY) ? 1 : 0;
  const days = (mode === 'daily' || mode === 'both') && offers(FORECAST_DAILY) ? 1 : 0;
  if (config['variant'] === 'compact') return WEATHER_COMPACT_HEAD + WEATHER_STRIP * (hours + days);
  return (
    WEATHER_HERO + WEATHER_STRIP * hours + (days ? 16 + WEATHER_ROW * forecastDaysOf(config) : 0)
  );
}

/** A Compass ring's ticks (12, the gauge's) and its knob's 12 past them: its box is twice its radius and these. */
export const COMPASS_RIM = 24;

/** The full Compass card's ring from its column, as the gauge's: R 96 in a 240 box from a 240 column, down to R 32. */
export const compassRadius = (width: number): number =>
  Math.min(96, Math.max(32, Math.floor((width / 2 - COMPASS_RIM) / 4) * 4));

/** Under this radius the full card's reading is written under its ring: its open centre would not hold it. */
export const COMPASS_INSIDE = 56;

/** The compact Compass card's small ring: R 28 in a 104 box. */
export const COMPASS_SMALL_RING = 104;

/**
 * Whether a column holds the compact Compass card's reading beside its small ring, 16 from it: where what is left is
 * as wide as the ring's box. The column alone decides, never the figure, so the card keeps one anatomy and one height
 * whatever it reads, out of reach too; in a narrower one (a phone's narrowest section, half a section) the reading is
 * under the ring.
 */
export const compassBeside = (width: number): boolean =>
  width - COMPASS_SMALL_RING - 16 >= COMPASS_SMALL_RING;

/** The reading under a ring: 12 above it, its word's line (16 and 4), its figure (24), its point's line (20). */
const COMPASS_UNDER = 76;

/**
 * The Compass card at a 360 column, or the part of one `grid_options.columns` asks: the head, its ring (R 96 and its
 * ticks in a 240 box at 360, smaller in a narrower column) with its reading in it, or under it from a ring too small
 * to hold it, and the row of its readouts (16 and a line of 44) while it lists one; compact, the head, its small ring
 * with its reading beside it, or under it where the column does not hold it there (`compassBeside`), and its readouts
 * at the extra-small size (16 and 40); the readouts one a row in half a section; one row, 76.
 */
export function compassHeight(config: LovelaceCardConfig): number {
  if (config['variant'] === 'row') return 76;
  // a head left with nothing in it goes, with the 16 under it (#259)
  const head = HEAD - headlessOf(config, muted(config), 16);
  const stats = config['stats'];
  const count =
    config['show_stats'] !== false && Array.isArray(stats) ? Math.min(3, stats.length) : 0;
  const width = columnOf(config);
  const rows = width < SECTION_COLUMN ? count : Math.min(1, count);
  if (config['variant'] === 'compact')
    return head + COMPASS_SMALL_RING + (compassBeside(width) ? 0 : COMPASS_UNDER) + 56 * rows;
  const r = compassRadius(width);
  return head + 2 * (r + COMPASS_RIM) + (r < COMPASS_INSIDE ? COMPASS_UNDER : 0) + 60 * rows;
}

export const WEATHER_FAMILY: readonly FamilyEntry[] = [
  ['fluvy-weather-card', weatherHeight],
  ['fluvy-compass-card', compassHeight],
];
