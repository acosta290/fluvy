// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { patchChartFont, patchChartSeries, recolorSeries } from '../shell/charts.js';

describe('recolorSeries', () => {
  it('turns HA’s default primary into the page’s primary, keeping an area fill’s alpha', () => {
    const series = { type: 'line', color: '#009ac7', areaStyle: { color: '#009AC72B' } };
    expect(recolorSeries(series, '#856529')).toEqual({
      type: 'line',
      color: '#856529',
      areaStyle: { color: '#8565292b' },
    });
  });

  it('knows the older light blue too', () => {
    expect(recolorSeries({ color: '#03a9f4' }, '#856529')).toEqual({ color: '#856529' });
  });

  it('leaves series in any other colour untouched (same object)', () => {
    const series = { color: '#ff9800', areaStyle: { color: '#ff98002b' } };
    expect(recolorSeries(series, '#856529')).toBe(series);
    const plain = { data: [1, 2] };
    expect(recolorSeries(plain, '#856529')).toBe(plain);
  });
});

describe('the charts’ wraps', () => {
  /** `ha-chart-base`, as far as its theme and its series go. */
  class Chart extends HTMLElement {
    /** The styles Home Assistant built a theme from. */
    themes: CSSStyleDeclaration[] = [];
    series = 0;
    _createTheme(style: CSSStyleDeclaration): { textStyle: { fontFamily: string } } {
      this.themes.push(style);
      return { textStyle: { fontFamily: 'Roboto, sans-serif' } };
    }
    _getSeries(): { type: string; color: string }[] {
      this.series += 1;
      return [{ type: 'line', color: '#009ac7' }];
    }
  }
  /** The style Home Assistant hands the builder: the page's body font, or a style that throws when read. */
  const style = (font: () => string) =>
    ({ getPropertyValue: font }) as unknown as CSSStyleDeclaration;

  it('leave the chart Home Assistant’s where Fluvy is not in use, take the page’s font and primary where it is, and step aside when they throw', async () => {
    customElements.define('ha-chart-base', Chart);
    expect(await patchChartFont(customElements)).toBe(true);
    expect(await patchChartSeries(customElements)).toBe(true);
    const chart = document.body.appendChild(new Chart());
    chart.style.setProperty('--primary-color', '#856529');
    const inter = style(() => 'Inter, sans-serif');

    // another theme: Home Assistant's font and blue, nothing read
    expect(chart._createTheme(inter).textStyle.fontFamily).toBe('Roboto, sans-serif');
    expect(chart._getSeries()[0]?.color).toBe('#009ac7');

    // the page wears Fluvy
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    expect(chart._createTheme(inter).textStyle.fontFamily).toBe('Inter, sans-serif');
    expect(chart._getSeries()[0]?.color).toBe('#856529');
    expect([chart.themes.length, chart.series]).toEqual([2, 2]);

    // a style that is not what the wrap knew: Home Assistant's theme, and the wrap steps aside
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const read = vi.fn((): string => {
      throw new TypeError('not a style');
    });
    expect(chart._createTheme(style(read)).textStyle.fontFamily).toBe('Roboto, sans-serif');
    expect(chart._createTheme(style(read)).textStyle.fontFamily).toBe('Roboto, sans-serif');
    expect(chart.themes).toHaveLength(4);
    expect(read).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[fluvy\] chartFont stepped aside: TypeError/);
    // the series' wrap is its own patch: it goes on
    expect(chart._getSeries()[0]?.color).toBe('#856529');
  });
});
