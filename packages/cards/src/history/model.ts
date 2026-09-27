/**
 * What the History page draws, worked out from the window it read: one chart per measure (everything in the same
 * unit), the state lines under them, and what had to be left out. The page itself keeps no data of its own.
 */
import type { HistoryWindow, Line, Track } from '@fluvy/core/history';
import { byActivity, byRange } from '@fluvy/core/history';
import type { HomeAssistant } from '@fluvy/core';
import type { GlyphName } from '@fluvy/ui';
import { glyphForClass } from '../shared/domain.js';
import type { HistoryString } from './strings.js';

/** How many series one chart draws before the rest are counted as "+N more". */
export const SERIES_LIMIT = 6;
/** The palette's graph colours: a chart never draws more series than it has colours to tell them apart. */
export const GRAPH_COLOURS = 12;
/** How many state lines a page draws before the rest are counted. */
export const LINES_LIMIT = 12;

/** A chart of the page: everything measured in one unit, ready to draw. */
export interface Chart {
  readonly key: string;
  readonly unit: string;
  readonly deviceClass: string;
  /** What it measures, in words ("Temperature"), or its unit when Home Assistant has no word for it. */
  readonly title: string;
  readonly glyph: GlyphName;
  readonly tracks: readonly Track[];
  /** The palette's graph colour each of them takes (1 … 12), by entity — never by rank. */
  readonly colours: readonly number[];
  /** How many series did not fit. */
  readonly hidden: number;
  /** The recorder's statistics, not its states (a window wider than two days). */
  readonly summarised: boolean;
}

/**
 * What a chart measures, in words: Home Assistant's own name for the device class when it has one, else ours, else
 * the unit itself ("Temperature", "Power", "kWh").
 */
export function measureTitle(
  hass: HomeAssistant | undefined,
  t: (key: HistoryString) => string,
  unit: string,
  deviceClass: string,
): string {
  if (!deviceClass) return unit || '—';
  const key = `component.sensor.entity_component.${deviceClass}.name`;
  const word = hass?.localize?.(key);
  if (word && word !== key) return word;
  const own = t(`class.${deviceClass}` as HistoryString);
  return own && !own.startsWith('class.') ? own : unit || '—';
}

/** Where a colour starts from: the entity's own id, and nothing about the chart it is drawn on. */
function hashOf(entityId: string): number {
  // FNV-1a: the ids of one house differ in their last characters, and this spreads them
  let hash = 0x811c9dc5;
  for (let i = 0; i < entityId.length; i++) {
    hash ^= entityId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % GRAPH_COLOURS;
}

/**
 * The colour each measure of one group keeps. It starts at the entity's own hash and, when two of them want the
 * same, it is settled over **the group's whole list in id order** — a list a search, a "+N more" or a reordering
 * never touches. So a room's line keeps its hue through all of them, and no two series of one chart are ever
 * drawn in one colour.
 */
export function coloursOf(tracks: readonly Track[]): Map<string, number> {
  const order = [...tracks].sort((a, b) => a.entityId.localeCompare(b.entityId));
  const taken = new Set<number>();
  const colours = new Map<string, number>();
  for (const track of order) {
    let colour = hashOf(track.entityId);
    for (let step = 0; step < GRAPH_COLOURS && taken.has(colour); step++)
      colour = (colour + 1) % GRAPH_COLOURS;
    taken.add(colour);
    colours.set(track.entityId, colour + 1);
  }
  return colours;
}

const matches = (text: string, search: string): boolean =>
  !search ||
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .includes(search);

const fold = (search: string): string =>
  search
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export interface ShownOptions {
  readonly search?: string;
  readonly limit?: number;
  readonly lineLimit?: number;
  /** The charts whose legend was opened: they draw every series they have. */
  readonly expanded?: readonly string[];
}

/** The charts the page draws: the series that move the most first, the rest counted. */
export function chartsOf(
  hass: HomeAssistant | undefined,
  t: (key: HistoryString) => string,
  window: HistoryWindow,
  o: ShownOptions = {},
): Chart[] {
  const search = fold(o.search ?? '');
  const limit = o.limit ?? SERIES_LIMIT;
  const charts: Chart[] = [];
  for (const group of window.groups) {
    const kept = group.tracks.filter((track) => matches(track.name, search));
    if (!kept.length) continue;
    const sorted = [...kept].sort(byRange);
    const key = `${group.unit}|${group.deviceClass}`;
    // opened, a chart draws every series it has a colour for: a thirteenth would repeat one and the legend
    // could no longer tell them apart
    const shown = o.expanded?.includes(key) ? Math.min(sorted.length, GRAPH_COLOURS) : limit;
    const tracks = sorted.slice(0, shown);
    // the colours are the group's, not the chart's: what is filtered out still holds its place in the ladder
    const colours = coloursOf(group.tracks);
    charts.push({
      key,
      unit: group.unit,
      deviceClass: group.deviceClass,
      // a house's own sensor often has no device class: one of them is named by its own name, several by the
      // unit they share ("€/kWh" tells a reader nothing; "Electricity price" does)
      title:
        !group.deviceClass && tracks.length === 1
          ? (tracks[0]?.name ?? group.unit)
          : measureTitle(hass, t, group.unit, group.deviceClass),
      glyph: glyphForClass('sensor', group.deviceClass),
      tracks,
      colours: tracks.map((track) => colours.get(track.entityId) ?? 1),
      hidden: Math.max(0, sorted.length - shown),
      summarised: sorted.some((track) => track.summarised),
    });
  }
  return charts;
}

/** The state lines the page draws: the busiest first, the rest counted. */
export function linesOf(
  window: HistoryWindow,
  o: ShownOptions = {},
): { readonly lines: readonly Line[]; readonly hidden: number } {
  const search = fold(o.search ?? '');
  const limit = o.lineLimit ?? LINES_LIMIT;
  const kept = window.lines.filter((line) => matches(line.name, search)).sort(byActivity);
  return { lines: kept.slice(0, limit), hidden: Math.max(0, kept.length - limit) };
}

/** What the page draws, once: the head counts exactly what the body has. */
export interface Shown {
  readonly charts: readonly Chart[];
  readonly lines: readonly Line[];
  /** How many state lines did not fit. */
  readonly hidden: number;
  /** How many measures are drawn, counting the series a legend still keeps folded. */
  readonly tracks: number;
}

/** The charts and the state lines a window leaves once the search has had its say. */
export function shownOf(
  hass: HomeAssistant | undefined,
  t: (key: HistoryString) => string,
  window: HistoryWindow,
  o: ShownOptions = {},
): Shown {
  const charts = chartsOf(hass, t, window, o);
  const { lines, hidden } = linesOf(window, o);
  return {
    charts,
    lines,
    hidden,
    tracks: charts.reduce((count, chart) => count + chart.tracks.length + chart.hidden, 0),
  };
}
