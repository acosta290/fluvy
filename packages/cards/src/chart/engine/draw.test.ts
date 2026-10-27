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
