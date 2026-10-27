import { CHART_DEFAULTS, type HouseCharts } from '@fluvy/core';
import { describe, expect, it } from 'vitest';

import { seriesCheck, seriesInk, seriesPaint } from './palette.js';

const SET = ['#1d4ed8', '#b45309', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'] as const;
const withSet: HouseCharts = {
  settings: { ...CHART_DEFAULTS, series: 'mine' },
  sets: [{ id: 'mine', name: 'Mine', colours: SET }],
};

describe('series colours', () => {
  it('are the palette’s six derived ones, round again after the sixth', () => {
    expect(seriesInk(0)).toBe('var(--fluvy-graph-1)');
    expect(seriesInk(6)).toBe('var(--fluvy-graph-1)');
  });

  it('are the house’s saved set when it names one, the palette’s when the set is gone', () => {
    expect(seriesInk(1, withSet)).toBe('#b45309');
    expect(seriesInk(1, { ...withSet, sets: [] })).toBe('var(--fluvy-graph-2)');
  });

  it('paint a series by its tone’s class, a series colour or a colour of its own as its ink, or not at all', () => {
    expect(seriesPaint('heat')).toEqual({ className: 'fv-tone--heat' });
    expect(seriesPaint('series-3', withSet)).toEqual({ className: '', ink: '#15803d' });
    expect(seriesPaint('#123456')).toEqual({ className: '', ink: '#123456' });
    // the History page's graph colour of an entity, one of the palette's twelve
    expect(seriesPaint('var(--fluvy-graph-9)')).toEqual({
      className: '',
      ink: 'var(--fluvy-graph-9)',
    });
    expect(seriesPaint(undefined)).toEqual({ className: '' });
  });
});

describe('a set of series colours checked against the tokens’ gates', () => {
  it('passes six colours apart and strong enough on the card', () => {
    expect(seriesCheck([...SET], '#ffffff')).toEqual([]);
  });

  it('warns of two too close to tell apart, and of one too faint on the card', () => {
    const warnings = seriesCheck(['#1d4ed8', '#1d4fd9', '#f4f4f4'], '#ffffff');
    expect(warnings.map((w) => w.kind).sort()).toEqual(['close', 'faint']);
    expect(warnings.find((w) => w.kind === 'close')).toMatchObject({ a: 0, b: 1 });
    expect(warnings.find((w) => w.kind === 'faint')).toMatchObject({ index: 2 });
  });
});
