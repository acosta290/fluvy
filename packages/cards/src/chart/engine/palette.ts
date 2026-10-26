import { chartDefaults, PALETTE_SERIES, SERIES_COUNT, type HouseCharts } from '@fluvy/core';
import { contrastRatio, deltaE, GATES, type Hex } from '@fluvy/tokens/runtime';
import type { SeriesColour } from './model.js';

/**
 * The colours of a chart's series. A lone series wears its card's colour (`color`), its tone, or the palette's
 * accent, through the tone its wrapper carries. Several wear the palette's six derived series colours
 * (`--fluvy-graph-1 … 6`, pairwise ΔE2000 ≥ 8 and icon contrast on the card) unless the house's chart settings name
 * a saved set, or the card names a colour of its own per series. The fills, the soft copy and the bars derive
 * from the ink once, in the engine's sheet: a series only ever sets its ink.
 */

/** How a series' group is drawn: the tone class it wears, or its ink written on it. */
export interface SeriesPaint {
  readonly className: string;
  readonly ink?: string;
}

/** The ink of the n-th series (from 0): the house's saved set's colour, or the palette's n-th series colour. */
export function seriesInk(index: number, house: HouseCharts = chartDefaults()): string {
  const chosen = house.settings.series;
  const set =
    chosen === PALETTE_SERIES ? undefined : house.sets.find((saved) => saved.id === chosen);
  const n = (index % SERIES_COUNT) + 1;
  return set?.colours[n - 1] ?? `var(--fluvy-graph-${n})`;
}

/** How a series paints itself: a tone as its class, a series colour or a colour of its own as its ink; none: its wrapper's. */
export function seriesPaint(
  colour: SeriesColour | undefined,
  house: HouseCharts = chartDefaults(),
): SeriesPaint {
  if (colour === undefined) return { className: '' };
  if (colour.startsWith('#')) return { className: '', ink: colour };
  if (colour.startsWith('series-'))
    return { className: '', ink: seriesInk(Number(colour.slice('series-'.length)) - 1, house) };
  return { className: `fv-tone--${colour}` };
}

/** A warning the series editor shows: two colours too close to tell apart, or one too faint on the card. */
export type SeriesWarning =
  | { readonly kind: 'close'; readonly a: number; readonly b: number; readonly deltaE: number }
  | { readonly kind: 'faint'; readonly index: number; readonly contrast: number };

/**
 * The tokens' gates on a set of series colours: every pair at least `GATES.graphSeparation` apart (ΔE2000), and
 * each with the icon contrast on the card's surface (`GATES.icon`) — what the palette's own six are built to hold.
 */
export function seriesCheck(colours: readonly Hex[], card: Hex): SeriesWarning[] {
  const out: SeriesWarning[] = [];
  colours.forEach((colour, index) => {
    const contrast = contrastRatio(colour, card);
    if (contrast < GATES.icon) out.push({ kind: 'faint', index, contrast });
    for (let other = index + 1; other < colours.length; other++) {
      const distance = deltaE(colour, colours[other] as Hex);
      if (distance < GATES.graphSeparation)
        out.push({ kind: 'close', a: index, b: other, deltaE: distance });
    }
  });
  return out;
}
