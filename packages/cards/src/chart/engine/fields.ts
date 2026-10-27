import {
  chartDefaults,
  type GaugePreset,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import {
  type ChartCaps,
  type ChartKeys,
  type ChartPreset,
  type FineKey,
} from '../../shared/chart-config.js';
import { boolField, fieldRow, onlyWhen, sectionField, selectField } from '../../shared/form.js';
import { acts, CHART_KEYS, presetsFor, resolveStyle } from './presets.js';

/**
 * The editor's "Chart" section, one for every card that draws a chart — the engine's, so every editor opens once it
 * has landed (`Card.getConfigElement` waits for it; it is fetched as the bundle starts): the style, then the fine keys the chosen
 * style acts on and the card can draw (`acts`) — a key that cannot act in a style is not shown in it, and one the
 * card can never draw is not in its form at all. The style the rules read while the card says none is the house's,
 * as the card draws then. A card whose abilities follow its config says what a config allows (`capsOf`): the sensor
 * draws bars only alone and where its readings add up, and a highlight over several would claim to be every one.
 */

type Data = Readonly<Record<string, unknown>>;

/** The style a config draws: its own, else the house's — classic where the card cannot draw it. */
const styleOf = (data: Data, caps: ChartCaps): ChartPreset => {
  const wanted = (data['chart'] as ChartPreset | undefined) ?? chartDefaults().settings.style;
  return presetsFor(caps).includes(wanted) ? wanted : 'classic';
};

/** The chart keys a card offers: every one its caps let act in one of its styles, alone or several. */
export function chartKeysFor(caps: ChartCaps): ReadonlyArray<keyof ChartKeys> {
  return CHART_KEYS.filter(
    (key) => key === 'chart' || presetsFor(caps).some((preset) => acts(key, preset, caps)),
  );
}

/** What a card can draw with a config (and the house it shows): its caps, narrowed by what the config holds. */
export type CapsOf = (data: Data, hass?: HomeAssistant) => ChartCaps;

const isList = (caps: ChartCaps | readonly ChartCaps[]): caps is readonly ChartCaps[] =>
  Array.isArray(caps);

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * The Chart section: the style, the curve and the fill, the line and its soft shadow, the points and the grid, the
 * scale and now, the highlight and the motion. `caps` is all a card may draw — or, for a card whose variants draw
 * apart (the energy card's line and its stacked charts), what each of them may; `capsOf`, what a config allows.
 * Where the styles offered differ with it (bars, a band, a variant), the style is one select for each list, shown in
 * turn.
 */
export function chartSection(
  caps: ChartCaps | readonly ChartCaps[],
  capsOf?: CapsOf,
): HaFormSchemaItem {
  // every caps a config may leave: the variants', or all of them without bars, without a band, without either
  const every: readonly ChartCaps[] = isList(caps)
    ? caps
    : capsOf
      ? [
          caps,
          { ...caps, bars: false },
          { ...caps, band: false },
          { ...caps, bars: false, band: false },
        ]
      : [caps];
  const allowed = (data: Data, hass?: HomeAssistant): ChartCaps =>
    capsOf?.(data, hass) ?? (every[0] as ChartCaps);
  const offered = new Set(every.flatMap(chartKeysFor));
  const fine = (key: FineKey, item: HaFormSchemaItem): HaFormSchemaItem[] =>
    offered.has(key)
      ? [
          onlyWhen((data, hass) => {
            const can = allowed(data, hass);
            return acts(key, styleOf(data, can), can);
          }, item),
        ]
      : [];
  const row = (...items: HaFormSchemaItem[][]): HaFormSchemaItem[] => {
    const kept = items.flat();
    return kept.length > 1 ? [fieldRow(...kept)] : kept;
  };
  const lists = every
    .map(presetsFor)
    .filter((list, index, all) => all.findIndex((other) => same(other, list)) === index);
  const styles =
    lists.length > 1
      ? lists.map((list) =>
          onlyWhen(
            (data, hass) => same(presetsFor(allowed(data, hass)), list),
            selectField('chart', list),
          ),
        )
      : lists.map((list) => selectField('chart', list));
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
      fine('animate', boolField('animate')),
    ),
  ]);
}

/**
 * What the Chart section shows while the config says nothing: the house's style (classic where the card cannot draw
 * it), and what the style the card draws (its own, else the house's) draws on its own — resolved by the one rule the
 * card is drawn with, so the editor says what the card draws, for the keys the card offers.
 */
export function chartDefaultsFor(config: Data, caps: ChartCaps): Record<string, unknown> {
  const house = chartDefaults().settings;
  const style = resolveStyle(config['chart'] as ChartPreset | undefined, {}, caps);
  const offered = new Set<string>(chartKeysFor(caps));
  const all: Record<string, unknown> = {
    chart: style.preset,
    curve: style.curve,
    fill: style.fill,
    line_width: style.preset === 'classic' ? 'regular' : house.line,
    glow: style.glow.kind !== 'none',
    show_points: style.points,
    show_grid: 'auto',
    show_axis: style.axis,
    show_now: style.now !== 'none',
    highlight: style.highlight,
    animate: style.animate,
  };
  return Object.fromEntries(Object.entries(all).filter(([key]) => offered.has(key)));
}

/** A gauge's style, among those the card can draw. */
export const gaugeField = (options: readonly GaugePreset[]): HaFormSchemaItem =>
  selectField('gauge', options);
