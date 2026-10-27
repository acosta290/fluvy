import { CHART_DEFAULTS, paletteOf, type HouseCharts } from '@fluvy/core';
import { fromHex, hueDistance } from '@fluvy/tokens';
import { contrastRatio, PALETTE_NAMES, type Hex } from '@fluvy/tokens/runtime';
import { describe, expect, it } from 'vitest';

import { fitSet, seriesCheck, seriesPaint } from './palette.js';

const SET: Hex[] = ['#1d4ed8', '#b45309', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'];
const withSet: HouseCharts = {
  settings: { ...CHART_DEFAULTS, series: 'mine' },
  sets: [{ id: 'mine', name: 'Mine', colours: SET }],
};

describe('series colours', () => {
  it('are the palette’s six derived ones, round again after the sixth', () => {
    expect(seriesPaint('series-1')).toEqual({
      className: '',
      style: '--tone-ink:var(--fluvy-graph-1)',
    });
    expect(seriesPaint('series-6')).toEqual({
      className: '',
      style: '--tone-ink:var(--fluvy-graph-6)',
    });
  });

  it('are the house’s saved set fitted to each mode’s card where it names one, the palette’s when the set is gone', () => {
    // no look runs here: the set is worn on the default palette
    const { light, dark } = fitSet(SET, 'linen');
    expect(seriesPaint('series-2', withSet)).toEqual({
      className: 'fc-set',
      style: `--fc-light:${light[1]};--fc-dark:${dark[1]}`,
    });
    // six deep colours read on the light card as they were picked
    expect(light).toEqual(SET);
    expect(seriesPaint('series-2', { ...withSet, sets: [] })).toEqual({
      className: '',
      style: '--tone-ink:var(--fluvy-graph-2)',
    });
  });

  it('paint a series by its tone’s class, or a colour of its own as its ink, or not at all', () => {
    expect(seriesPaint('heat')).toEqual({ className: 'fv-tone--heat' });
    expect(seriesPaint('#123456')).toEqual({ className: '', style: '--tone-ink:#123456' });
    // the History page's graph colour of an entity, one of the palette's twelve
    expect(seriesPaint('var(--fluvy-graph-9)')).toEqual({
      className: '',
      style: '--tone-ink:var(--fluvy-graph-9)',
    });
    expect(seriesPaint(undefined)).toEqual({ className: '' });
  });
});

describe('a set of series colours fitted to each mode, and what fitting cannot fix', () => {
  it('never warns of the palette’s own six, from either mode, in either mode, in any of the fifteen palettes', () => {
    expect(PALETTE_NAMES).toHaveLength(15);
    for (const name of PALETTE_NAMES) {
      const palette = paletteOf(name);
      for (const from of ['light', 'dark'] as const) {
        const six = palette[from].graph.slice(0, 6);
        const fitted = fitSet(six, name);
        expect(seriesCheck(fitted), `${name}, its ${from} six`).toEqual([]);
        // the mode they were derived in wears them as they are
        expect(fitted[from]).toEqual(six);
      }
    }
  });

  it('lifts a dark navy in dark mode, at its hue, until it reads on the dark card; keeps it in light', () => {
    const navy = '#1e3a8a';
    const palette = paletteOf('linen');
    expect(contrastRatio(navy, palette.dark.surface.card)).toBeLessThan(3);
    const { light, dark } = fitSet([navy], 'linen');
    const lifted = dark[0] as Hex;
    expect(light).toEqual([navy]);
    expect(fromHex(lifted).l).toBeGreaterThan(fromHex(navy).l);
    expect(hueDistance(fromHex(lifted).h, fromHex(navy).h)).toBeLessThan(2);
    expect(contrastRatio(lifted, palette.dark.surface.card)).toBeGreaterThanOrEqual(3);
  });

  it('deepens a pale colour in light mode instead of warning it is faint', () => {
    const pale = '#f4e9d0';
    const palette = paletteOf('linen');
    const { light, dark } = fitSet([pale], 'linen');
    expect(contrastRatio(light[0] as Hex, palette.light.surface.card)).toBeGreaterThanOrEqual(3);
    expect(dark).toEqual([pale]);
    expect(seriesCheck(fitSet([...SET.slice(0, 5), pale], 'linen'))).toEqual([]);
  });

  it('still warns of two near hues, on both cards, and of two that fitting brings together on one', () => {
    expect(seriesCheck(fitSet(['#2563eb', '#2463ea', ...SET.slice(2)], 'linen'))).toEqual([
      { a: 0, b: 1 },
    ]);
    // two pale blues deepened to read on the light card meet there; on the dark card both read as they are, apart
    expect(seriesCheck(fitSet(['#93c5fd', '#60a5fa'], 'linen'))).toEqual([
      { a: 0, b: 1, mode: 'light' },
    ]);
  });
});
