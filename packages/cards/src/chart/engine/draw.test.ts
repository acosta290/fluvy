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
