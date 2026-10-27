import {
  chartDefaults,
  lookHandle,
  PALETTE_SERIES,
  paletteOf,
  SERIES_COUNT,
  type HouseCharts,
} from '@fluvy/core';
import {
  DEFAULT_PALETTE,
  deltaE,
  GATES,
  type Hex,
  type Palette,
  type PaletteChoice,
  type PaletteMode,
} from '@fluvy/tokens/runtime';
// a path of its own, in the engine's chunk (`groups.mjs`): through the runtime's, core would carry the fitting
import { fitSeries } from '@fluvy/tokens/series';
import type { SeriesColour } from './model.js';

/**
 * The colours of a chart's series. A lone series wears its card's colour (`color`), its tone, or the palette's
 * accent, through the tone its wrapper carries. Several wear the palette's six derived series colours
 * (`--fluvy-graph-1 … 6`, pairwise ΔE2000 ≥ 8 and icon contrast on the card) unless the house's chart settings name
 * a saved set, or the card names a colour of its own per series. A saved set keeps the person's six hues as chosen and
 * is worn fitted to each mode's card (`fitSeries`), once per set and palette, never per frame. The fills, the soft
 * copy and the bars derive from the ink once, in the engine's sheet: a series only ever sets its ink.
 */

/**
 * How a series is painted: the class it wears — its tone's, or `fc-set`, which wears the mode's of a set's two
 * colours — and what it writes on itself: its ink (`--tone-ink`), or a set's colour fitted to the light card and the
 * dark one (`--fc-light`, `--fc-dark`).
 */
export interface SeriesPaint {
  readonly className: string;
  readonly style?: string;
}

/** A set of series colours fitted to both modes of a palette: what the light card wears, and the dark one. */
export type FittedSet = Readonly<Record<PaletteMode, readonly Hex[]>>;

/**
 * The sets fitted on each palette (core derives one per choice), by their colours, the last 32 of each: a set is
 * fitted once, and again only when it or the palette changes.
 */
const fitted = new WeakMap<Palette, Map<string, FittedSet>>();
const KEPT = 32;

/** A set's colours fitted to each mode of a palette: its hues as chosen, each reading on that mode's card, apart. */
export function fitSet(colours: readonly Hex[], choice: PaletteChoice): FittedSet {
  const palette = paletteOf(choice);
  let sets = fitted.get(palette);
  if (!sets) fitted.set(palette, (sets = new Map()));
  const key = colours.join();
  let set = sets.get(key);
  if (!set) {
    set = { light: fitSeries(colours, palette.light), dark: fitSeries(colours, palette.dark) };
    sets.set(key, set);
    if (sets.size > KEPT) sets.delete(sets.keys().next().value as string);
  }
  return set;
}

/**
 * The palette a house's set is worn on: the look's (this person's, or the house's; a preview's while the settings show
 * one) — the one Fluvy's cards wear, and its fallback where a dashboard does not — the default's where no look runs.
 */
const wornPalette = (): PaletteChoice => lookHandle()?.settings().look.palette ?? DEFAULT_PALETTE;

/** The n-th series colour (from 0): the house's saved set's, fitted to each mode, or the palette's n-th. */
function seriesColour(index: number, house: HouseCharts): SeriesPaint {
  const chosen = house.settings.series;
  const set =
    chosen === PALETTE_SERIES ? undefined : house.sets.find((saved) => saved.id === chosen);
  const n = index % SERIES_COUNT;
  if (!set) return { className: '', style: `--tone-ink:var(--fluvy-graph-${n + 1})` };
  const { light, dark } = fitSet(set.colours, wornPalette());
  return { className: 'fc-set', style: `--fc-light:${light[n]};--fc-dark:${dark[n]}` };
}

/** How a series paints itself: a tone as its class, a series colour or a colour of its own as its ink; none: its wrapper's. */
export function seriesPaint(
  colour: SeriesColour | undefined,
  house: HouseCharts = chartDefaults(),
): SeriesPaint {
  if (colour === undefined) return { className: '' };
  if (colour.startsWith('#') || colour.startsWith('var('))
    return { className: '', style: `--tone-ink:${colour}` };
  if (colour.startsWith('series-'))
    return seriesColour(Number(colour.slice('series-'.length)) - 1, house);
  return { className: `fv-tone--${colour}` };
}

/** Two colours of a set too close to tell apart once fitted: on both cards, or only on `mode`'s. */
export interface SeriesWarning {
  readonly a: number;
  readonly b: number;
  readonly mode?: PaletteMode;
}

/**
 * What fitting cannot fix in a set (`fitSet`): two colours closer than `GATES.graphSeparation` (ΔE2000) on a mode's
 * card once fitted to it — two hues too close to tell apart, or brought together where one was lifted or deepened to
 * read. Every colour reads on both cards by then: none is too faint.
 */
export function seriesCheck(set: FittedSet): SeriesWarning[] {
  const out: SeriesWarning[] = [];
  const count = set.light.length;
  for (let a = 0; a < count; a++)
    for (let b = a + 1; b < count; b++) {
      const [mode, both] = (['light', 'dark'] as const).filter(
        (m) => deltaE(set[m][a] as Hex, set[m][b] as Hex) < GATES.graphSeparation,
      );
      if (both) out.push({ a, b });
      else if (mode) out.push({ a, b, mode });
    }
  return out;
}
