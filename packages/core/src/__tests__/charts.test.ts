import { describe, expect, it } from 'vitest';
import { recolorSeries } from '../shell/charts.js';

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
