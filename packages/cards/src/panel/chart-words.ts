import {
  BAR_CAPS,
  BUBBLE_LOOKS,
  CHART_ENDPOINTS,
  CHART_FILLS,
  CHART_GRIDS,
  CHART_LINES,
  GLOW_OFFSETS,
  GLOW_OPACITIES,
  localize,
  NOW_MARKERS,
  WAVE_HEIGHTS,
  type ChartSettings,
  type SavedSeries,
} from '@fluvy/core';
import type { HouseKey } from '../chart/engine/index.js';
import type { PanelContext, StringKey } from './model.js';
import { chosenSet } from './series.js';

/*
 * The house's chart settings in words: what the Charts tab's fine rows offer, each value as its chip says it, and the
 * apply bar's line for every setting that changed. One table, so a chip and the bar never name a value two ways.
 */

/** A value of a fine setting: its key as the chip carries it, and its words. */
interface Choice {
  readonly key: string;
  readonly word: (ctx: PanelContext) => string;
}

/** A fine setting as a row of chips: the style must act on it (`HOUSE_ACTS`), or a gauge must move (the waves). */
export interface FineRow {
  readonly acts: HouseKey | 'wave';
  readonly label: StringKey;
  readonly choices: readonly Choice[];
  /** The chip chosen for these settings. */
  chosen(charts: ChartSettings): string;
  /** The settings a chip asks for. */
  patch(charts: ChartSettings, key: string): Partial<ChartSettings>;
}

const panelWord =
  (key: StringKey, values?: Record<string, string | number>) =>
  (ctx: PanelContext): string =>
    ctx.t(key, values);
const percent = (count: number) => panelWord('wall.percent', { count: Math.round(count * 100) });

/** A row over one flat setting, its values in the order the settings list them. */
function flat<K extends 'line' | 'fill' | 'grid' | 'endpoint' | 'now' | 'caps' | 'bubble' | 'wave'>(
  key: K,
  acts: FineRow['acts'],
  label: StringKey,
  values: readonly ChartSettings[K][],
  word: (value: ChartSettings[K]) => Choice['word'],
): FineRow {
  return {
    acts,
    label,
    choices: values.map((value) => ({ key: String(value), word: word(value) })),
    chosen: (charts) => String(charts[key]),
    patch: (_charts, chosen) =>
      ({ [key]: values.find((value) => String(value) === chosen) }) as Partial<ChartSettings>,
  };
}

/** The fine settings in the order the Details card lists them (each shown only where the style acts on it). */
export const FINE_ROWS: readonly FineRow[] = [
  flat(
    'line',
    'line',
    'charts.line',
    CHART_LINES,
    (value) => (ctx) => localize(ctx.hass, `option.${value}`),
  ),
  {
    acts: 'glow',
    label: 'charts.glow',
    choices: GLOW_OFFSETS.map((n) => ({ key: String(n), word: panelWord('charts.px', { n }) })),
    chosen: (charts) => String(charts.glow.offset),
    patch: (charts, chosen) => ({
      glow: {
        ...charts.glow,
        offset: GLOW_OFFSETS.find((n) => String(n) === chosen) ?? charts.glow.offset,
      },
    }),
  },
  {
    acts: 'glow',
    label: 'charts.glow_opacity',
    choices: GLOW_OPACITIES.map((n) => ({ key: String(n), word: percent(n) })),
    chosen: (charts) => String(charts.glow.opacity),
    patch: (charts, chosen) => ({
      glow: {
        ...charts.glow,
        opacity: GLOW_OPACITIES.find((n) => String(n) === chosen) ?? charts.glow.opacity,
      },
    }),
  },
  flat('fill', 'fill', 'charts.fill', CHART_FILLS, (value) => percent(value / 100)),
  flat('grid', 'grid', 'charts.grid', CHART_GRIDS, (value) => panelWord(`charts.grid_${value}`)),
  flat('endpoint', 'endpoint', 'charts.endpoint', CHART_ENDPOINTS, (value) =>
    panelWord(`charts.${value}`),
  ),
  flat('now', 'now', 'charts.now', NOW_MARKERS, (value) =>
    panelWord(value === 'line' ? 'charts.now_line' : 'charts.knob'),
  ),
  flat('caps', 'caps', 'charts.caps', BAR_CAPS, (value) => panelWord(`charts.caps_${value}`)),
  flat('bubble', 'bubble', 'charts.bubble', BUBBLE_LOOKS, (value) =>
    panelWord(`charts.bubble_${value}`),
  ),
  flat('wave', 'wave', 'charts.wave', WAVE_HEIGHTS, (value) => panelWord(`charts.wave_${value}`)),
];

/** The series colours chosen, by name: a saved set's, else the palette's (a set removed elsewhere is the palette's). */
export const seriesName = (
  ctx: PanelContext,
  series: string,
  sets: readonly SavedSeries[],
): string => chosenSet(sets, series)?.name ?? ctx.t('charts.palette');

/** Every chart setting that differs from what is saved, as a line of the apply bar ("Charts · Style · Soft"). */
export function chartLines(ctx: PanelContext): string[] {
  const edited = ctx.houseEdit.charts;
  if (!edited) return [];
  const saved = ctx.settings.charts;
  const line = (label: StringKey, value: string): string =>
    `${ctx.t('tab.charts')} · ${ctx.t(label)} · ${value}`;
  const lines: string[] = [];
  if (edited.style !== saved.style)
    lines.push(line('charts.style', localize(ctx.hass, `option.${edited.style}`)));
  if (edited.gauge !== saved.gauge)
    lines.push(line('charts.gauge', localize(ctx.hass, `option.${edited.gauge}`)));
  for (const row of FINE_ROWS) {
    const chosen = row.chosen(edited);
    if (chosen !== row.chosen(saved))
      lines.push(line(row.label, row.choices.find((c) => c.key === chosen)?.word(ctx) ?? chosen));
  }
  if (edited.series !== saved.series)
    lines.push(line('charts.series', seriesName(ctx, edited.series, ctx.settings.chartSets)));
  if (edited.animate !== saved.animate)
    lines.push(line('charts.motion', ctx.t(edited.animate ? 'change.on' : 'change.off')));
  return lines;
}
