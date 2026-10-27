import {
  MAX_SAVED_SERIES,
  PALETTE_SERIES,
  parseSavedSeriesSet,
  type SavedSeries,
} from '@fluvy/core';
import type { Hex } from '@fluvy/tokens/runtime';
import { slugOf } from './palettes.js';

/*
 * The house's own sets of six series colours (1.11), kept as its palettes are: made in the Charts tab, saved with a
 * name (twelve at most), renamed, removed, and chosen like a palette — by the charts' `series`, a set's id.
 */

/** A set being made or changed in the Charts tab: its id when it is one of the house's. */
export interface SeriesDraft {
  readonly id?: string;
  readonly name: string;
  readonly colours: readonly Hex[];
}

/** The longest name a set keeps. */
export const SET_NAME_MAX = 24;

/**
 * An id for a new set from its name, apart from every set the house keeps (`warm`, then `warm-2`) and from the
 * palette's own word (a set named "Palette" is `palette-2`).
 */
export function setIdOf(name: string, sets: readonly SavedSeries[]): string {
  const base = slugOf(name, 'set');
  const taken = (id: string): boolean => id === PALETTE_SERIES || sets.some((set) => set.id === id);
  let id = base;
  for (let n = 2; taken(id); n++) id = `${base}-${n}`;
  return id;
}

/** The set a draft saves as, when it is whole (a name, six colours): an edited one keeps its id. */
export const setOf = (draft: SeriesDraft, sets: readonly SavedSeries[]): SavedSeries | undefined =>
  parseSavedSeriesSet({ ...draft, id: draft.id ?? setIdOf(draft.name, sets) });

/** Whether the house can keep this set: one it already keeps changes in its place, a new one needs room. */
export const roomForSet = (sets: readonly SavedSeries[], id?: string): boolean =>
  sets.some((set) => set.id === id) || sets.length < MAX_SAVED_SERIES;

/** The house's sets with this one saved: in its place when it is one of them, else after them. */
export const withSet = (sets: readonly SavedSeries[], set: SavedSeries): readonly SavedSeries[] =>
  sets.some((own) => own.id === set.id)
    ? sets.map((own) => (own.id === set.id ? set : own))
    : [...sets, set];

export const withoutSet = (sets: readonly SavedSeries[], id: string): readonly SavedSeries[] =>
  sets.filter((own) => own.id !== id);

/** The saved set the charts' `series` names, when it names one the house still keeps. */
export const chosenSet = (sets: readonly SavedSeries[], series: string): SavedSeries | undefined =>
  series === PALETTE_SERIES ? undefined : sets.find((set) => set.id === series);
