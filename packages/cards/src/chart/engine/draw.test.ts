// @vitest-environment happy-dom
import { CHART_DEFAULTS } from '@fluvy/core';
import type { FluvyDial, FluvyRuler } from '@fluvy/ui';
import { render, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';

import { drawChart, plotOf, readAt, type ChartSpec } from './draw.js';
import { drawGauge } from './gauge.js';
import { resolveGauge, resolveStyle } from './presets.js';

const DAY = [18, 18.5, 19.4, 21, 23.2, 24.6, 24, 22.4, 20.8, 19.6, 19];
const frame = { width: 320, height: 120, headroom: 44 };
const caps = { now: true, bars: true, band: true, axis: true } as const;

const host = (template: TemplateResult): HTMLElement => {
  const element = document.createElement('div');
  render(template, element);
  return element;
};
const spec = (
  preset: Parameters<typeof resolveStyle>[0],
  more: Partial<ChartSpec> = {},
): ChartSpec => ({
  frame,
  series: [{ values: DAY }],
  style: resolveStyle(preset, {}, caps),
  id: 'c',
  ...more,
});

describe('every style', () => {
  it.each(['classic', 'soft', 'glow', 'minimal', 'step', 'bars', 'columns', 'band'] as const)(
    '%s: is a drawing for the measurer, every layer clipped to the plot',
    (preset) => {
      const drawing = host(
        drawChart(spec(preset, { now: 0.6, tick: String, measure: (t) => t.length * 7 })),
      );
      const svg = drawing.querySelector('svg') as SVGSVGElement;
      expect(svg.getAttribute('data-measure')).toBe('drawn');
      const clip = drawing.querySelector('clipPath rect') as Element;
      for (const layer of drawing.querySelectorAll('g[clip-path]'))
        expect(layer.getAttribute('clip-path')).toBe('url(#c-clip)');
      // the plot: after the scale's column, the line's half width either side for its round caps
      const left = plotOf(spec(preset, { tick: String, measure: (t) => t.length * 7 })).left;
      const line = resolveStyle(preset, {}, caps).line;
      expect(Number(clip.getAttribute('x'))).toBeCloseTo(left - line / 2, 2);
      expect(Number(clip.getAttribute('width'))).toBeCloseTo(320 - left + line, 2);
      // nothing that is a line, an area, a copy or a bar is drawn outside a clipped group
      for (const path of drawing.querySelectorAll('path'))
        expect(path.closest('g[clip-path]'), path.getAttribute('class') ?? '').not.toBeNull();
    },
  );
});

describe('the gridlines', () => {
  it.each(['classic', 'soft', 'glow', 'minimal'] as const)(
    '%s: draws the vertical ones, the horizontal ones at the ticks, or both, as the card asks',
    (preset) => {
      const lines = (show_grid: 'x' | 'y' | 'both'): { across: number; down: number } => {
        const drawing = host(
          drawChart({ ...spec(preset), style: resolveStyle(preset, { show_grid }, caps) }),
        );
        const grid = [...drawing.querySelectorAll('.fc-grid')];
        return {
          down: grid.filter((l) => l.getAttribute('x1') === l.getAttribute('x2')).length,
          across: grid.filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).length,
        };
      };
      const ticks = plotOf(spec(preset, { style: resolveStyle(preset, { show_grid: 'y' }, caps) }))
        .ticks?.ticks.length;
      expect(ticks).toBeGreaterThan(1);
      expect(lines('x')).toEqual({ down: 5, across: 0 });
      expect(lines('y')).toEqual({ down: 0, across: ticks });
      expect(lines('both')).toEqual({ down: 5, across: ticks });
    },
  );
});

describe('the end of a line and now', () => {
  it('is Fluvy’s knob on the line’s end in the soft style, the classic dot in classic and minimal', () => {
    const soft = host(drawChart(spec('soft')));
    const knob = soft.querySelector('.fv-knob.fc-knob') as HTMLElement;
    expect(knob).not.toBeNull();
    // 16 across, centred on the end of the line (320, the last reading's y)
    expect(knob.style.width).toBe('16px');
    expect(parseFloat(knob.style.left) + 8).toBeCloseTo(320, 2);
    expect(soft.querySelector('circle')).toBeNull();
    for (const preset of ['classic', 'minimal'] as const) {
      const drawing = host(drawChart(spec(preset)));
      expect(drawing.querySelectorAll('.curve-dot').length).toBe(1);
      expect(drawing.querySelector('.fv-knob')).toBeNull();
    }
  });

  it('is the dot in the soft style where the house says so', () => {
    const style = resolveStyle('soft', {}, caps, { ...CHART_DEFAULTS, endpoint: 'dot' });
    const drawing = host(drawChart({ ...spec('soft'), style }));
    expect(drawing.querySelector('.fv-knob')).toBeNull();
    expect(drawing.querySelectorAll('.curve-dot').length).toBe(1);
  });

  it('marks now with a hairline and one knob where the past ends, the forecast dashed beyond it', () => {
    const drawing = host(drawChart(spec('soft', { now: 0.6 })));
    const knobs = drawing.querySelectorAll('.fv-knob');
    expect(knobs.length).toBe(1);
    const now = drawing.querySelector('.fc-now') as Element;
    const x = Number(now.getAttribute('x1'));
    expect(x).toBeCloseTo(192, 2); // the sixth of ten intervals
    expect(parseFloat((knobs[0] as HTMLElement).style.left) + 8).toBeCloseTo(x, 2);
    const future = drawing.querySelector('.fc-future') as Element;
    expect(future.getAttribute('d')?.startsWith('M192.00,')).toBe(true);
  });

  it('ends what has happened of a line at its own times on its last reading at or before now, not half way (#158)', () => {
    // a line through time over a day to 12:29: its round times, then now, off them; its length says nothing of now
    const at = [0, 0.125, 0.25, 0.375, 0.5, 0.52];
    const values = [18, 18.5, 19.4, 21, 23.2, 24.6];
    const line = (more: Partial<ChartSpec> = {}): ChartSpec =>
      spec('soft', { series: [{ values, at }], now: 0.52, ...more });
    const end = 0.52 * 320;
    const soft = host(drawChart(line()));
    expect(soft.querySelector('.fc-future')).toBeNull();
    expect(Number(soft.querySelector('.fc-now')?.getAttribute('x1'))).toBeCloseTo(end, 2);
    const knobs = soft.querySelectorAll('.fv-knob');
    expect(knobs.length).toBe(1);
    expect(parseFloat((knobs[0] as HTMLElement).style.left) + 8).toBeCloseTo(end, 2);
    expect(readAt(line(), null).x).toBeCloseTo(end, 2);
    // classic marks no now: its curve whole, its dot on the line's end
    const classic = host(drawChart(line({ style: resolveStyle('classic', {}, caps) })));
    expect(classic.querySelector('.fc-future')).toBeNull();
    expect(Number(classic.querySelector('.curve-dot')?.getAttribute('cx'))).toBeCloseTo(end, 2);
    // a reading past now is to come: dashed from the last one before it, where now's knob stands
    const ahead = host(drawChart(line({ series: [{ values, at: [...at.slice(0, -1), 0.75] }] })));
    expect(ahead.querySelector('.fc-future')?.getAttribute('d')?.startsWith('M160.00,')).toBe(true);
    expect(Number(ahead.querySelector('.fc-now')?.getAttribute('x1'))).toBeCloseTo(160, 2);
  });

  it('reads where the cursor is: the knob there, the hairline across, the bubble’s x', () => {
    const read = spec('soft', { cursor: 0.25 });
    const drawing = host(drawChart(read));
    expect(drawing.querySelector('.fc-cursor')?.getAttribute('x1')).toBe('80.00');
    expect(readAt(read, 0.25).x).toBe(80);
    expect(readAt(read, null).x).toBe(320);
  });
});

describe('a scale', () => {
  it('draws its nice ticks right-aligned on one column 8 before the plot, the zero line strong', () => {
    const measure = (text: string): number => text.length * 7;
    const drawing = host(drawChart(spec('step', { tick: String, measure })));
    const ticks = [...drawing.querySelectorAll('.fc-tick')];
    // a measurement keeps to its own range (18 … 24.6): zero is no tick of it
    expect(ticks.map((t) => t.textContent)).toEqual(['18', '20', '22', '24', '26']);
    const left = plotOf(spec('step', { tick: String, measure })).left;
    // its widest label (14) and the gap of 8, on the 4 grid
    expect(left).toBe(24);
    for (const tick of ticks) {
      expect(tick.getAttribute('x')).toBe(String(left - 8));
      expect(tick.getAttribute('text-anchor')).toBe('end');
    }
    expect(drawing.querySelectorAll('.fc-grid--zero').length).toBe(0);
    // a quantity that starts at zero holds it, its zero line strong
    const power = host(drawChart(spec('step', { tick: String, measure, zero: true })));
    expect([...power.querySelectorAll('.fc-tick')].map((t) => t.textContent)).toEqual([
      '0',
      '10',
      '20',
      '30',
    ]);
    expect(power.querySelectorAll('.fc-grid--zero').length).toBe(1);
  });

  it('draws no column without words to write in it', () => {
    expect(plotOf(spec('step')).left).toBe(0);
  });
});

describe('what the scale and the marks read', () => {
  const band = { low: DAY.map((v) => v - 6), high: DAY.map((v) => v + 6) };

  it('holds a band only where the style draws it', () => {
    const ticks = (preset: 'step' | 'band') =>
      [
        ...host(
          drawChart(
            spec(preset, {
              series: [{ values: DAY, band }],
              tick: String,
              measure: (t) => t.length * 7,
            }),
          ),
        ).querySelectorAll('.fc-tick'),
      ].map((t) => t.textContent);
    expect(ticks('step')).toEqual(['18', '20', '22', '24', '26']);
    expect(ticks('band')).toEqual(['10', '20', '30', '40']);
  });

  it('marks the lowest and the highest of what has happened, never a forecast’s', () => {
    // the lowest reading is the last one, in the forecast: no mark there
    const values = [20, 22, 25, 23, 21, 19, 17];
    const drawing = host(drawChart(spec('step', { series: [{ values }], now: 0.5 })));
    const marks = [...drawing.querySelectorAll('.curve-dot')];
    const nowX = Number(drawing.querySelector('.fc-now')?.getAttribute('x1'));
    expect(marks.length).toBe(2);
    for (const mark of marks) expect(Number(mark.getAttribute('cx'))).toBeLessThanOrEqual(nowX);
  });
});

describe('bars', () => {
  it('hold a slot each, the forecast hollow, read at their slot’s middle', () => {
    const bars = spec('bars', { now: 0.5 });
    const drawing = host(drawChart(bars));
    expect(drawing.querySelectorAll('.fc-bar').length).toBe(DAY.length);
    // now in the sixth slot: the five after it are forecast
    expect(drawing.querySelectorAll('.fc-bar--hollow').length).toBe(5);
    const slot = 320 / DAY.length;
    expect(readAt(bars, 0.01).x).toBeCloseTo(slot / 2, 9);
    expect(readAt(bars, 0.01).index).toBe(0);
  });

  it('keep now without its hairline where a card marks it on lines over them: those to come hollow, now’s lit', () => {
    const style = { ...resolveStyle('soft', { highlight: 'current' }, caps), now: 'none' as const };
    const drawing = host(drawChart({ ...spec('soft'), style, kind: 'bars', now: 0.5 }));
    expect(drawing.querySelector('.fc-now')).toBeNull();
    const bars = [...drawing.querySelectorAll('.fc-bar')].map((bar) =>
      bar.classList.contains('fc-bar--hollow')
        ? 'hollow'
        : bar.classList.contains('fc-bar--quiet')
          ? 'quiet'
          : 'lit',
    );
    // now in the sixth slot: lit, the five before it quiet, the five after it to come
    expect(bars).toEqual([...Array(5).fill('quiet'), 'lit', ...Array(5).fill('hollow')]);
  });

  it('are all to come where now stands before them (a day still ahead): every one hollow, no now marked', () => {
    for (const preset of ['bars', 'soft'] as const) {
      const drawing = host(drawChart({ ...spec(preset), kind: 'bars', now: -1 }));
      expect(drawing.querySelectorAll('.fc-bar--hollow').length).toBe(DAY.length);
      expect(drawing.querySelector('.fc-now')).toBeNull();
    }
    // at the series' very start the first slot is the one running, as it was
    const started = host(drawChart(spec('bars', { now: 0 })));
    expect(started.querySelectorAll('.fc-bar--hollow').length).toBe(DAY.length - 1);
  });

  it('light the highest in the soft style and quiet the rest, its value over it', () => {
    const style = resolveStyle('soft', {}, caps);
    const drawing = host(
      drawChart({ ...spec('soft'), style, kind: 'bars', value: String, maxWord: 'MAX' }),
    );
    expect(drawing.querySelectorAll('.fc-bar--quiet').length).toBe(DAY.length - 1);
    expect([...drawing.querySelectorAll('.fc-value')].map((t) => t.textContent)).toEqual(['24.6']);
    expect(drawing.querySelector('.fc-max__word')?.textContent).toBe('MAX');
  });

  it('stack by sign in columns, a hanging part saying so, on a scale that reaches what the card draws beside them', () => {
    const columns = spec('columns', {
      series: [{ values: [2, 3] }, { values: [1, 0] }, { values: [-1.5, -0.5] }],
      kind: 'bars',
    });
    const drawing = host(drawChart(columns));
    expect(drawing.querySelectorAll('.fc-bar').length).toBe(5);
    expect(drawing.querySelectorAll('.fc-bar--hanging').length).toBe(2);
    // the stacks reach 3 and −1.5: −2 … 4 by 2; the period before beside them reaches 7 and −3: −5 … 10 by 5
    expect(plotOf(columns).ticks?.ticks).toEqual([-2, 0, 2, 4]);
    expect(plotOf({ ...columns, reach: [7, -3] }).ticks?.ticks).toEqual([-5, 0, 5, 10]);
    // a scale the card lays itself is drawn as given
    const given = { min: -2, max: 4, step: 2, ticks: [-2, 0, 2, 4], decimals: 0 };
    expect(plotOf({ ...columns, ticks: given }).ticks).toBe(given);
  });
});

describe('a chart of its series’ own (the Chart card’s)', () => {
  const PRICES = [0.1, 0.12, 0.3, 0.32, 0.18, 0.08];
  const scaled = (preset: Parameters<typeof resolveStyle>[0], more: Partial<ChartSpec> = {}) =>
    spec(preset, { series: [{ values: PRICES }], scale: { min: 0, max: 0.4 }, ...more });

  it('draws a line again in each threshold’s ink, clipped from its value up to the next one’s', () => {
    const thresholds = [
      { value: 0.25, colour: 'danger' as const },
      { value: 0.15, colour: 'warning' as const },
    ];
    const drawing = host(drawChart(scaled('soft', { thresholds })));
    const line = drawing.querySelector('.fc-line:not(.fc-run)')?.getAttribute('d');
    const runs = [...drawing.querySelectorAll('g[clip-path] > .fc-run')];
    expect(runs.map((run) => run.parentElement?.getAttribute('class'))).toEqual([
      'fv-tone--warning',
      'fv-tone--danger',
    ]);
    // the very line, split where it crosses: the warning's stretch from 0.25 down to 0.15, the danger's above
    for (const run of runs) expect(run.getAttribute('d')).toBe(line);
    const rect = (id: string) => drawing.querySelector(`clipPath#${id} rect`) as Element;
    const y = (v: number): number => 44 + (1 - v / 0.4) * (120 - 44 - 8);
    expect(Number(rect('c-run-0-0').getAttribute('y'))).toBeCloseTo(y(0.25), 2);
    expect(Number(rect('c-run-0-0').getAttribute('height'))).toBeCloseTo(y(0.15) - y(0.25), 2);
    expect(Number(rect('c-run-0-1').getAttribute('y'))).toBe(0);
    expect(Number(rect('c-run-0-1').getAttribute('height'))).toBeCloseTo(y(0.25), 2);
    // every run inside the plot's clip too
    for (const run of runs) expect(run.closest(`g[clip-path="url(#c-clip)"]`)).not.toBeNull();
  });

  it('keeps a bar over a threshold in its ink, the rest in the series’', () => {
    const drawing = host(
      drawChart(scaled('bars', { thresholds: [{ value: 0.25, colour: 'danger' }] })),
    );
    const tones = [...drawing.querySelectorAll('.fc-bar')].map(
      (bar) => bar.parentElement?.getAttribute('class') ?? '',
    );
    expect(tones.filter((tone) => tone === 'fv-tone--danger').length).toBe(2);
  });

  it('marks a stretch of the plot behind every layer, clipped to it, from its fractions', () => {
    const drawing = host(
      drawChart(scaled('classic', { stretches: [{ from: 0.5, to: 0.75, colour: 'ok' }] })),
    );
    const stretch = drawing.querySelector('.fc-stretch') as Element;
    expect(stretch.parentElement?.getAttribute('class')).toBe('fv-tone--ok');
    expect(stretch.closest('g[clip-path="url(#c-clip)"]')).not.toBeNull();
    expect(Number(stretch.getAttribute('x'))).toBe(160);
    expect(Number(stretch.getAttribute('width'))).toBe(80);
    // drawn first: everything else lies over it
    const svg = drawing.querySelector('svg') as SVGSVGElement;
    expect(svg.querySelector('g[clip-path]')?.contains(stretch)).toBe(true);
  });

  it('holds a stepped series across its own slots beside a smooth one', () => {
    const drawing = host(
      drawChart(
        spec('soft', {
          series: [
            { values: [1, 2, 3, 4], curve: 'step' },
            { values: [1, 2, 3, 4, 5], fill: 'none' },
          ],
        }),
      ),
    );
    const [stepped, smooth] = [...drawing.querySelectorAll('.fc-line')].map(
      (line) => line.getAttribute('d') ?? '',
    );
    // four slots of 80: held across each, to the plot's end
    expect(stepped).toMatch(
      /^M0\.00,[\d.]+ H80\.00 V[\d.]+ H160\.00 V[\d.]+ H240\.00 V[\d.]+ H320\.00 V[\d.]+$/,
    );
    expect(smooth).toMatch(/^M0\.00,[\d.]+ C/);
    // the smooth one draws no fill of its own
    expect(drawing.querySelectorAll('.fc-area').length).toBe(1);
  });

  it('draws a classic curve without its area where its series says none', () => {
    const drawing = host(drawChart(spec('classic', { series: [{ values: DAY, fill: 'none' }] })));
    expect(drawing.querySelector('.curve-line')).not.toBeNull();
    expect(drawing.querySelector('.curve-area')).toBeNull();
  });

  it('reaches the readings of lines drawn over its bars on the same nice scale', () => {
    const ticks = (reach?: number[]) =>
      plotOf(spec('bars', { series: [{ values: [1, 2, 3] }], ...(reach ? { reach } : {}) })).ticks
        ?.ticks;
    expect(ticks()).toEqual([0, 1, 2, 3]);
    expect(ticks([9])).toEqual([0, 2.5, 5, 7.5, 10]);
  });
});

describe('series in several units', () => {
  const PRICE = [0.05, 0.12, 0.3, 0.35, 0.18, 0.08];
  const ROOM = [18.2, 18.9, 20.4, 23.6, 22.1, 19.5];
  const extras = { tick: String, measure: (t: string) => t.length * 7, now: 0.6 };
  /** How much of the plot's height (44 … 112) a path's points take. */
  const height = (d: string | null | undefined): number => {
    const ys = [...(d ?? '').matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    return (Math.max(...ys) - Math.min(...ys)) / (112 - 44);
  };

  it('one unit: the very drawing it was without one, in every style', () => {
    const thresholds = [{ value: 20, colour: 'danger' as const }];
    for (const preset of [
      'classic',
      'soft',
      'glow',
      'minimal',
      'step',
      'bars',
      'columns',
      'band',
    ] as const) {
      const series = [
        { values: ROOM, band: { low: ROOM.map((v) => v - 1), high: ROOM.map((v) => v + 1) } },
        { values: DAY },
      ];
      // the chart's zero and its thresholds as they were, against each series' unit and zero
      const bare = spec(preset, { ...extras, zero: true, thresholds, series });
      const named = spec(preset, {
        ...extras,
        thresholds: thresholds.map((t) => ({ ...t, unit: '°C' })),
        series: series.map((s) => ({ ...s, unit: '°C', zero: true })),
      });
      expect(host(drawChart(named)).innerHTML, preset).toBe(host(drawChart(bare)).innerHTML);
    }
  });

  it('two units: each takes the plot’s height on a scale of its own, the ticks the first one’s alone', () => {
    const style = resolveStyle('soft', { show_grid: 'y' }, caps);
    const lines = (series: ChartSpec['series']) => {
      const drawing = host(drawChart(spec('soft', { ...extras, style, series })));
      return {
        ticks: [...drawing.querySelectorAll('.fc-tick')].map((t) => Number(t.textContent)),
        heights: [...drawing.querySelectorAll('.fc-line:not(.fc-run)')].map((l) =>
          height(l.getAttribute('d')),
        ),
      };
    };
    // on one scale, the price is a flat line along the temperature's floor
    const one = lines([{ values: PRICE, zero: true }, { values: ROOM }]);
    expect(one.heights[0]).toBeLessThan(0.05);
    // in their units, each its height; the ticks the price's, from its zero (a temperature's would never start there)
    const two = lines([
      { values: PRICE, unit: '€/kWh', zero: true },
      { values: ROOM, unit: '°C' },
    ]);
    expect(two.ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    for (const share of two.heights) expect(share).toBeGreaterThan(0.7);
  });

  it('colours the series of its thresholds’ unit alone, and stands each unit’s bars on its own scale', () => {
    const series = [
      { values: PRICE, unit: '€/kWh', zero: true },
      { values: ROOM, unit: '°C' },
    ];
    const lines = host(
      drawChart(
        spec('soft', { series, thresholds: [{ value: 0.25, colour: 'danger', unit: '€/kWh' }] }),
      ),
    );
    expect(lines.querySelector('#c-run-0-0')).not.toBeNull();
    expect(lines.querySelector('#c-run-1-0')).toBeNull();
    // stacked columns stack within a unit: each unit's from the zero line, its tallest reaching the plot's top
    const reached = (series: ChartSpec['series']): number[] => {
      const bars = [
        ...host(drawChart(spec('columns', { series, kind: 'bars' }))).querySelectorAll('.fc-bar'),
      ];
      // a bar's path starts at its top (and its corner's radius under it): how far up the plot the tallest reaches
      const tops = bars.map((bar) =>
        Number(/^M[\d.]+,([\d.]+)/.exec(bar.getAttribute('d') ?? '')?.[1]),
      );
      return [0, 1].map(
        (k) => (112 - Math.min(...tops.filter((_y, i) => i % 2 === k))) / (112 - 44),
      );
    };
    const [price, room] = reached(series);
    expect(price).toBeGreaterThan(0.7);
    expect(room).toBeGreaterThan(0.7);
    // on one scale, the price's columns are stubs on the floor under the temperature's
    expect(reached(series.map(({ values }) => ({ values })))[0]).toBeLessThan(0.1);
  });
});

describe('the gauges, each one of Fluvy’s controls read-only', () => {
  const gauge = (preset: Parameters<typeof resolveGauge>[0], value: number | null = 62) =>
    host(
      drawGauge({
        style: resolveGauge(preset, {}),
        size: 176,
        min: 0,
        max: 100,
        value,
        format: String,
        unit: '%',
        tone: 'accent',
      }),
    );

  it('draws the dial’s ticks (the gauge card’s ring) and the thermostat’s dial read', () => {
    const ticks = gauge('ticks').querySelector('fluvy-dial') as FluvyDial;
    expect([ticks.gauge, ticks.readonly, ticks.fill]).toEqual([true, false, 0.62]);
    const dial = gauge('dial').querySelector('fluvy-dial') as FluvyDial;
    expect([dial.gauge, dial.readonly, dial.stepper, dial.value]).toEqual([false, true, false, 62]);
  });

  it('lights a ring to the value with Fluvy’s knob at its end, the reading in its middle', () => {
    const ring = gauge('ring');
    expect(ring.querySelector('.fc-ring__lit')?.getAttribute('stroke-dasharray')).toMatch(/^\d/);
    const knob = ring.querySelector('.fv-knob') as HTMLElement;
    expect(knob.style.width).toBe('24px');
    expect(ring.querySelector('.fc-gauge__value b')?.textContent).toBe('62');
    // nothing to read: nothing lit, no knob, a dash
    const none = gauge('ring', null);
    expect(none.querySelector('.fc-ring__lit')).toBeNull();
    expect(none.querySelector('.fv-knob')).toBeNull();
    expect(none.querySelector('.fc-gauge__value b')?.textContent).toBe('—');
  });

  it('draws the ruler read, its knob whole on the value (the thermostat’s ball, not the marker)', () => {
    const ruler = gauge('ruler').querySelector('fluvy-ruler') as FluvyRuler;
    expect([ruler.readonly, ruler.marker, ruler.value, ruler.length]).toEqual([
      true,
      false,
      62,
      176,
    ]);
  });
});
