import { wrap } from './patches.js';

/**
 * Home Assistant's charts (ECharts, drawn on a canvas) are out of any stylesheet's reach, and two things
 * in them ignored the theme:
 * - the font: HA builds the chart theme in JavaScript with Roboto written into it, so every history,
 *   statistics, energy and hardware chart kept Roboto axis labels beside Inter;
 * - the colour of series HA paints with its own default primary (a literal, because a canvas cannot read
 *   CSS variables): the Processor and Memory charts on Hardware stayed HA blue.
 * Both are fixed where HA hands the chart its theme and its series, after HA built them and only while
 * Fluvy is in use on the page (`patches.ts`): the theme takes the body font the page computes; a series in
 * HA's default primary takes the page's `--primary-color` (its area fill keeps HA's alpha). On a page that
 * does not wear Fluvy the chart is HA's alone. If HA renames or reshapes either method, nothing is wrapped
 * and the shell's report says so.
 */
type ChartTheme = { textStyle?: { fontFamily?: string } } | undefined;
interface Series {
  readonly [option: string]: unknown;
  color?: unknown;
  areaStyle?: { color?: unknown };
}

/** HA's default primary as the frontend hard-codes it into series (2026.x, and the older light blue). */
const HA_PRIMARIES = ['#009ac7', '#03a9f4'];

async function chartPrototype(registry: CustomElementRegistry): Promise<object | undefined> {
  await registry.whenDefined('ha-chart-base');
  return registry.get('ha-chart-base')?.prototype as object | undefined;
}

export const patchChartFont = async (registry: CustomElementRegistry): Promise<boolean> =>
  wrap(
    await chartPrototype(registry),
    '_createTheme',
    'chartFont',
    (_chart, theme: ChartTheme, [style]: [CSSStyleDeclaration]) => {
      const font = style.getPropertyValue('--ha-font-family-body').trim();
      if (font && theme?.textStyle) theme.textStyle.fontFamily = font;
    },
  );

/** `color` in HA's default primary → `primary`; an area fill in that colour plus an alpha keeps the alpha. */
export function recolorSeries(series: Series, primary: string): Series {
  const swap = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    const lower = value.toLowerCase();
    const base = HA_PRIMARIES.find((hex) => lower.startsWith(hex));
    return base ? primary + lower.slice(base.length) : value;
  };
  const color = swap(series.color);
  const area = series.areaStyle && swap(series.areaStyle.color);
  if (color === series.color && area === series.areaStyle?.color) return series;
  return {
    ...series,
    color,
    ...(series.areaStyle ? { areaStyle: { ...series.areaStyle, color: area } } : {}),
  };
}

export const patchChartSeries = async (registry: CustomElementRegistry): Promise<boolean> =>
  wrap(await chartPrototype(registry), '_getSeries', 'chartSeries', (chart, series: unknown) => {
    if (!Array.isArray(series)) return undefined;
    const primary = getComputedStyle(chart)
      .getPropertyValue('--primary-color')
      .trim()
      .toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(primary)) return undefined;
    return series.map((item: unknown) =>
      item && typeof item === 'object' ? recolorSeries(item as Series, primary) : item,
    );
  });
