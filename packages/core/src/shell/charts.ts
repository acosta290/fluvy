/**
 * Home Assistant's charts (ECharts, drawn on a canvas) are out of any stylesheet's reach, and two things
 * in them ignored the theme:
 * - the font: HA builds the chart theme in JavaScript with Roboto written into it, so every history,
 *   statistics, energy and hardware chart kept Roboto axis labels beside Inter;
 * - the colour of series HA paints with its own default primary (a literal, because a canvas cannot read
 *   CSS variables): the Processor and Memory charts on Hardware stayed HA blue.
 * Both are fixed where HA hands the chart its theme and its series: the builder is wrapped once and takes
 * the body font the page computes; a series in HA's default primary takes the page's `--primary-color`
 * (its area fill keeps HA's alpha). Other themes get the same (their own primary), so nothing depends on
 * fluvy being active. If HA renames or reshapes either method, nothing is wrapped and the shell's report
 * says so.
 */
type ChartTheme = { textStyle?: { fontFamily?: string } } | undefined;
interface Series {
  readonly [option: string]: unknown;
  color?: unknown;
  areaStyle?: { color?: unknown };
}
interface ChartPrototype {
  _createTheme?: (style: CSSStyleDeclaration) => ChartTheme;
  _getSeries?: () => unknown;
  __fluvyFont?: true;
  __fluvySeries?: true;
}

/** HA's default primary as the frontend hard-codes it into series (2026.x, and the older light blue). */
const HA_PRIMARIES = ['#009ac7', '#03a9f4'];

async function chartPrototype(
  registry: CustomElementRegistry,
): Promise<ChartPrototype | undefined> {
  await registry.whenDefined('ha-chart-base');
  return registry.get('ha-chart-base')?.prototype as ChartPrototype | undefined;
}

export async function patchChartFont(registry: CustomElementRegistry): Promise<boolean> {
  const proto = await chartPrototype(registry);
  const original = proto?._createTheme;
  if (!proto || typeof original !== 'function') return false;
  if (proto.__fluvyFont) return true;
  proto._createTheme = function (this: unknown, style: CSSStyleDeclaration): ChartTheme {
    const theme = original.call(this, style);
    const font = style.getPropertyValue('--ha-font-family-body').trim();
    if (font && theme?.textStyle) theme.textStyle.fontFamily = font;
    return theme;
  };
  proto.__fluvyFont = true;
  return true;
}

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

export async function patchChartSeries(registry: CustomElementRegistry): Promise<boolean> {
  const proto = await chartPrototype(registry);
  const original = proto?._getSeries;
  if (!proto || typeof original !== 'function') return false;
  if (proto.__fluvySeries) return true;
  proto._getSeries = function (this: Element): unknown {
    const series = original.call(this);
    const primary = getComputedStyle(this).getPropertyValue('--primary-color').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(primary) || !Array.isArray(series)) return series;
    return series.map((item: unknown) =>
      item && typeof item === 'object' ? recolorSeries(item as Series, primary) : item,
    );
  };
  proto.__fluvySeries = true;
  return true;
}
