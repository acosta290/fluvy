import { chartDefaults, type GaugePreset, type HaFormSchemaItem } from '@fluvy/core';
import {
  acts,
  CHART_KEYS,
  presetsFor,
  type ChartCaps,
  type ChartKeys,
  type ChartPreset,
  type FineKey,
} from './chart-config.js';
import { boolField, fieldRow, onlyWhen, sectionField, selectField } from './form.js';

/**
 * The editor's "Chart" section, one for every card that draws a chart: the style, then the fine keys the chosen
 * style acts on and the card can draw (`acts`) — a key that cannot act in a style is not shown in it, and one the
 * card can never draw is not in its form at all. The style the rules read while the card says none is the house's,
 * as the card draws then. A card whose series may be one or several (the sensor and the sensors beside it) says
 * which its config holds: several are never bars, and a highlight would claim to be every one of them.
 */

type Data = Readonly<Record<string, unknown>>;

const styleOf = (data: Data): ChartPreset =>
  (data['chart'] as ChartPreset | undefined) ?? chartDefaults().settings.style;

/** The chart keys a card offers: every one its caps let act in one of its styles, alone or several. */
export function chartKeysFor(caps: ChartCaps): ReadonlyArray<keyof ChartKeys> {
  return CHART_KEYS.filter(
    (key) => key === 'chart' || presetsFor(caps).some((preset) => acts(key, preset, caps)),
  );
}

/**
 * The Chart section: the style, the curve and the fill, the line and its soft shadow, the points and the grid, the
 * scale and now, the highlight and the motion. `several` says when the config holds several series.
 */
export function chartSection(caps: ChartCaps, several?: (data: Data) => boolean): HaFormSchemaItem {
  const capsOf = (data: Data): ChartCaps =>
    several?.(data) ? { ...caps, several: true, bars: false } : caps;
  const offered = new Set(chartKeysFor(caps));
  const fine = (key: FineKey, item: HaFormSchemaItem): HaFormSchemaItem[] =>
    offered.has(key) ? [onlyWhen((data) => acts(key, styleOf(data), capsOf(data)), item)] : [];
  const row = (...items: HaFormSchemaItem[][]): HaFormSchemaItem[] => {
    const kept = items.flat();
    return kept.length > 1 ? [fieldRow(...kept)] : kept;
  };
  // the styles the card can draw: with several series beside it, the lines only
  const styles = several
    ? [
        onlyWhen((data) => !several(data), selectField('chart', presetsFor(caps))),
        onlyWhen(
          several,
          selectField('chart', presetsFor({ ...caps, several: true, bars: false })),
        ),
      ]
    : [selectField('chart', presetsFor(caps))];
  return sectionField('editor.chart', [
    ...styles,
    ...row(
      fine('curve', selectField('curve', ['smooth', 'straight', 'step'])),
      fine('fill', selectField('fill', ['gradient', 'flat', 'none'])),
    ),
    ...row(
      fine('line_width', selectField('line_width', ['thin', 'regular', 'bold'])),
      fine('glow', boolField('glow')),
    ),
    ...row(
      fine('show_points', selectField('show_points', ['none', 'end', 'all'])),
      fine(
        'show_grid',
        selectField('show_grid', ['auto', 'none', 'x', 'y', 'both'], {
          words: { both: 'both_axes' },
        }),
      ),
    ),
    ...row(fine('show_axis', boolField('show_axis')), fine('show_now', boolField('show_now'))),
    ...row(
      fine(
        'highlight',
        selectField('highlight', ['none', 'min', 'max', 'both', 'current'], {
          words: { both: 'min_max' },
        }),
      ),
      [boolField('animate')],
    ),
  ]);
}

/**
 * What the Chart section shows while the config says nothing: the house's style, and what that style (or the one
 * chosen) draws on its own — the card's drawing, field by field, for the keys the card offers.
 */
export function chartDefaultsFor(config: Data, caps: ChartCaps): Record<string, unknown> {
  const house = chartDefaults().settings;
  const preset = styleOf(config);
  const offered = new Set<string>(chartKeysFor(caps));
  const all: Record<string, unknown> = {
    chart: house.style,
    curve: preset === 'step' ? 'step' : preset === 'band' ? 'straight' : 'smooth',
    fill:
      preset === 'glow' || preset === 'minimal' ? 'none' : preset === 'step' ? 'flat' : 'gradient',
    line_width: preset === 'classic' ? 'regular' : house.line,
    glow: preset === 'soft' || preset === 'glow',
    show_points: preset === 'step' || preset === 'bars' || preset === 'columns' ? 'none' : 'end',
    show_grid: 'auto',
    show_axis: true,
    show_now: preset !== 'classic' && preset !== 'minimal',
    highlight: preset === 'step' ? 'both' : 'none',
    animate: house.animate,
  };
  return Object.fromEntries(Object.entries(all).filter(([key]) => offered.has(key)));
}

/** A gauge's style, among those the card can draw. */
export const gaugeField = (options: readonly GaugePreset[]): HaFormSchemaItem =>
  selectField('gauge', options);
