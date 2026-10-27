import { CHART_DEFAULTS, type ChartPreset, type ChartSettings } from '@fluvy/core';
import { describe, expect, it } from 'vitest';

import {
  CHART_PRESETS,
  GAUGE_PRESETS,
  HOUSE_ACTS,
  resolveGauge,
  resolveStyle,
  type HouseKey,
  type ResolvedStyle,
} from './presets.js';

const house = (settings: Partial<ChartSettings>): ChartSettings => ({
  ...CHART_DEFAULTS,
  ...settings,
});
const LINE = { bars: true, axis: true } as const;

describe('a card’s chart style', () => {
  it('is the house’s where the card says none: classic from the factory, so nothing changes on upgrade', () => {
    expect(resolveStyle(undefined, {}, LINE).preset).toBe('classic');
    expect(resolveStyle(undefined, {}, LINE, house({ style: 'soft' })).preset).toBe('soft');
  });

  it('is the card’s own where it says one, whatever the house says', () => {
    expect(resolveStyle('classic', {}, LINE, house({ style: 'glow' })).preset).toBe('classic');
    expect(resolveStyle('step', {}, LINE, house({ style: 'soft' })).preset).toBe('step');
  });

  it('is classic where the card cannot draw the one asked (bars over several sensors, a band without one)', () => {
    expect(resolveStyle('bars', {}, { several: true }).preset).toBe('classic');
    expect(resolveStyle(undefined, {}, {}, house({ style: 'band' })).preset).toBe('classic');
    expect(resolveStyle('band', {}, { band: true }).preset).toBe('band');
  });
});

describe('a style’s settings: the card’s key › the house’s › the style’s own', () => {
  it('takes the house’s fine settings in a style, and the card’s over them', () => {
    const soft = resolveStyle('soft', {}, LINE, house({ line: 'bold', fill: 24, endpoint: 'dot' }));
    expect([soft.line, soft.fillOpacity, soft.end]).toEqual([3, 0.24, 'dot']);
    const own = resolveStyle(
      'soft',
      { line_width: 'thin', glow: false },
      LINE,
      house({ line: 'bold' }),
    );
    expect([own.line, own.glow.kind]).toEqual([1.5, 'none']);
  });

  it('keeps classic as 1.10 drew it, whatever the house says but motion', () => {
    const style = resolveStyle(
      'classic',
      {},
      LINE,
      house({
        line: 'bold',
        fill: 12,
        grid: 'dashed',
        endpoint: 'knob',
        caps: 'both',
        animate: false,
      }),
    );
    expect(style).toMatchObject({
      line: 2.5,
      fillOpacity: 0.28,
      end: 'dot',
      grid: { axes: 'none', kind: 'hairline' },
      caps: 'top',
      bubble: 'dark',
      cursor: 'dashed',
      label: true,
      animate: false,
    });
  });

  it('ignores a fine key the style does not act on, and one the card cannot draw', () => {
    // a step has no soft shadow; the sensor's window ends at now, so it has no now to mark
    expect(resolveStyle('step', { glow: true }, LINE).glow.kind).toBe('none');
    expect(resolveStyle('soft', { show_now: true }, LINE).now).toBe('none');
    expect(resolveStyle('soft', { show_now: true }, { now: true }).now).toBe('knob');
    expect(resolveStyle('soft', { highlight: 'max' }, { several: true }).highlight).toBe('none');
  });

  it('gives a soft shadow to a style without one when the card asks, and none when it says no', () => {
    expect(resolveStyle('minimal', { glow: true }, LINE).glow.kind).toBe('none');
    expect(resolveStyle('soft', {}, LINE).glow).toEqual({ kind: 'soft', offset: 5, opacity: 0.35 });
    expect(resolveStyle('glow', {}, LINE).glow).toEqual({ kind: 'blur', offset: 5, opacity: 0.45 });
  });

  it('marks now with the house’s knob or line where the window runs past it', () => {
    expect(resolveStyle('soft', {}, { now: true }, house({ now: 'line' })).now).toBe('line');
    expect(resolveStyle('minimal', {}, { now: true }).now).toBe('none');
  });

  it('puts the styles with a horizontal grid and the bars on a nice scale, the rest on the series’ own ends', () => {
    expect(
      ['step', 'band', 'bars', 'columns'].map(
        (p) => resolveStyle(p as 'step', {}, { bars: true, band: true }).scale,
      ),
    ).toEqual(['nice', 'nice', 'nice', 'nice']);
    expect(resolveStyle('soft', {}, LINE).scale).toBe('tight');
  });

  it('turns the gridlines off with the house, or the card’s choice', () => {
    expect(resolveStyle('soft', {}, LINE, house({ grid: 'none' })).grid.axes).toBe('none');
    expect(resolveStyle('soft', { show_grid: 'both' }, LINE).grid.axes).toBe('both');
    expect(resolveStyle('soft', { show_grid: false }, LINE).grid.axes).toBe('none');
  });

  it('is still where the card or the house says so', () => {
    expect(resolveStyle('soft', {}, LINE, house({ animate: false })).animate).toBe(false);
    expect(resolveStyle('soft', { animate: true }, LINE, house({ animate: false })).animate).toBe(
      true,
    );
  });

  it('names every style the settings know', () => {
    expect(Object.keys(CHART_PRESETS)).toEqual([
      'classic',
      'soft',
      'glow',
      'minimal',
      'step',
      'bars',
      'columns',
      'band',
    ]);
  });
});

describe('the house’s settings each style draws with', () => {
  /** Each house setting moved off the factory's, and what of the resolved style it moves. */
  const MOVED: Record<HouseKey, [Partial<ChartSettings>, (style: ResolvedStyle) => unknown]> = {
    line: [{ line: 'bold' }, (s) => s.line],
    // a style without a soft shadow draws none, whatever its offset says
    glow: [
      { glow: { offset: 7, opacity: 0.45 } },
      (s) => (s.glow.kind === 'none' ? 'none' : s.glow),
    ],
    fill: [{ fill: 24 }, (s) => s.fillOpacity],
    grid: [{ grid: 'dashed' }, (s) => s.grid],
    endpoint: [{ endpoint: 'dot' }, (s) => s.end],
    now: [{ now: 'line' }, (s) => s.now],
    caps: [{ caps: 'top' }, (s) => s.caps],
    bubble: [{ bubble: 'tone' }, (s) => s.bubble],
  };
  const ALL = { now: true, bars: true, band: true, axis: true } as const;

  it.each(Object.keys(CHART_PRESETS) as ChartPreset[])(
    '%s: offers what moves its drawing, and classic nothing',
    (preset) => {
      for (const [key, [moved, read]] of Object.entries(MOVED) as [
        HouseKey,
        (typeof MOVED)[HouseKey],
      ][]) {
        const before = read(resolveStyle(preset, {}, ALL));
        const after = read(resolveStyle(preset, {}, ALL, house(moved)));
        if (HOUSE_ACTS[preset].includes(key)) expect(after, key).not.toEqual(before);
        if (preset === 'classic') expect(after, key).toEqual(before);
      }
    },
  );
});

describe('a card’s gauge style', () => {
  it('is the card’s own › the house’s (ticks from the factory): Fluvy’s controls, and the gauges that move', () => {
    expect(resolveGauge(undefined, {}).preset).toBe('ticks');
    expect(resolveGauge(undefined, {}, house({ gauge: 'ring' })).preset).toBe('ring');
    expect(resolveGauge('dial', {}, house({ gauge: 'ring' })).preset).toBe('dial');
    expect(Object.keys(GAUGE_PRESETS)).toEqual([
      'ticks',
      'dial',
      'ring',
      'ruler',
      'liquid',
      'thermo',
      'tank',
      'battery',
      'pulse',
      'air',
      'sun',
    ]);
    expect(resolveGauge('ruler', { animate: true }).animate).toBe(false);
    expect(resolveGauge(undefined, {}, house({ wave: 'high' })).wave).toBe(10);
  });
});
