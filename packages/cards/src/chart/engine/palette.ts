import {
  chartDefaults,
  isPaletteRef,
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
  type PaletteModeColors,
  type StatusColours,
} from '@fluvy/tokens/runtime';
// a path of its own, in the engine's chunk (`groups.mjs`): through the runtime's, core would carry the fitting
import { fitSeries } from '@fluvy/tokens/series';
import type { SeriesColour } from './model.js';

/**
 * The colours of a chart's series. A lone series wears its card's colour (`color`), its tone, or the palette's
 * accent, through the tone its wrapper carries. Several wear the palette's six derived series colours
 * (`--fluvy-graph-1 … 6`, pairwise ΔE2000 ≥ 8 and icon contrast on the card) unless the house's chart settings name
 * a saved set, or the card names a colour of its own per series. A saved set's colour is one of the palette's (`graph-3`,
 * `accent`, `ok`, `solar` …: its token, so it follows the palette and the mode) or a hue of the person's, kept as chosen
 * and worn fitted to each mode's card (`fitSeries`), once per set and palette, never per frame. The fills, the soft
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
 * The colours of the palette's a set or a series may name (core's `isPaletteRef`), in the groups the settings show them
 * in: its twelve series colours, its accent with the statuses and the lit light, the energy states. Each is a token of
 * the theme's, so what names it follows the palette and the mode as they are drawn.
 */
export const PALETTE_REFS = {
  series: Array.from({ length: 12 }, (_unused, n) => `graph-${n + 1}`),
  tones: ['accent', 'ok', 'warning', 'danger', 'notice', 'light'],
  energy: ['solar', 'grid', 'battery', 'water', 'gas', 'home'],
} as const;
const ENERGY: readonly string[] = PALETTE_REFS.energy;

/** The theme's token a colour of the palette's is (`--fluvy-<token>`): a status's, a state's, or its own name. */
const tokenOf = (ref: string): string =>
  ref === 'ok'
    ? 'success'
    : ref === 'light'
      ? 'state-light-active'
      : ENERGY.includes(ref)
        ? `state-energy-${ref}`
        : ref;

/** A colour of the palette's as a series wears it: its token, which the palette and the mode it is drawn in resolve. */
export const refInk = (ref: string): string => `var(--fluvy-${tokenOf(ref)})`;

/** A colour of the palette's on one of its modes: what its token is there. */
export function refHex(ref: string, colors: PaletteModeColors): Hex {
  if (ref.startsWith('graph-')) return colors.graph[Number(ref.slice('graph-'.length)) - 1] as Hex;
  if (ref === 'accent') return colors.accent.ink;
  if (ref === 'notice') return colors.notice.ink;
  if (ref === 'ok') return colors.semantic.success.ink;
  if (ref === 'warning' || ref === 'danger') return colors.semantic[ref].ink;
  return colors.state[tokenOf(ref).slice('state-'.length) as keyof PaletteModeColors['state']].ink;
}

/**
 * The sets fitted on each palette (core derives one per choice and status colours), by their colours, the last 32 of
 * each: a set is fitted once, and again only when it or the palette changes.
 */
const fitted = new WeakMap<Palette, Map<string, FittedSet>>();
const KEPT = 32;

/**
 * A set's colours on each mode of a palette, in the house's status colours: a colour of the palette's as that mode has
 * it; a hex at its hue as chosen, fitted to read on that mode's card and to stand apart from the colours before it.
 */
export function fitSet(
  colours: readonly string[],
  choice: PaletteChoice,
  statuses?: StatusColours,
): FittedSet {
  const palette = paletteOf(choice, statuses);
  let sets = fitted.get(palette);
  if (!sets) fitted.set(palette, (sets = new Map()));
  const key = colours.join();
  let set = sets.get(key);
  if (!set) {
    const kept = colours.map(isPaletteRef);
    const fit = (colors: PaletteModeColors): Hex[] =>
      fitSeries(
        colours.map((colour, n) => (kept[n] ? refHex(colour, colors) : colour)),
        colors,
        kept,
      );
    set = { light: fit(palette.light), dark: fit(palette.dark) };
    sets.set(key, set);
    if (sets.size > KEPT) sets.delete(sets.keys().next().value as string);
  }
  return set;
}

/**
 * What a set's colours are drawn with on a mode's card: a colour of the palette's by its token (the look in force there
 * says what it is), a hex as that mode wears it fitted (`fitSet`).
 */
export const setInks = (colours: readonly string[], set: FittedSet, mode: PaletteMode): string[] =>
  colours.map((colour, n) => (isPaletteRef(colour) ? refInk(colour) : (set[mode][n] as Hex)));

/**
 * The n-th series colour (from 0): the house's saved set's, or the palette's n-th. A colour of the palette's follows
 * it and the mode as drawn; a hex wears the set fitted to each mode, on the palette and the status colours of the look
 * (this person's, or the house's; a preview's while the settings show one), the default's where no look runs.
 */
function seriesColour(index: number, house: HouseCharts): SeriesPaint {
  const chosen = house.settings.series;
  const set =
    chosen === PALETTE_SERIES ? undefined : house.sets.find((saved) => saved.id === chosen);
  const n = index % SERIES_COUNT;
  const colour = set?.colours[n] ?? `graph-${n + 1}`;
  if (!set || isPaletteRef(colour)) return { className: '', style: `--tone-ink:${refInk(colour)}` };
  const worn = lookHandle()?.settings();
  const { light, dark } = fitSet(
    set.colours,
    worn?.look.palette ?? DEFAULT_PALETTE,
    worn?.statuses,
  );
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
 * card once fitted to it — two hues too close to tell apart, two of the palette's own that sit together, or two brought
 * together where one was lifted or deepened to read. Every colour reads on both cards by then: none is too faint.
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
