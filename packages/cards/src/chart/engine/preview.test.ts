// @vitest-environment happy-dom
import { preloadLanguages, type HomeAssistant } from '@fluvy/core';
import { render, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';

import { previewChart, previewGauge, previewSeries, previewStyle } from './preview.js';

const host = (template: TemplateResult): HTMLElement => {
  const element = document.createElement('div');
  render(template, element);
  return element;
};
const preview = (settings: Parameters<typeof previewChart>[0]) =>
  host(previewChart(settings, { mode: 'dark', width: 200, format: String }));

describe('the settings panel’s drawings', () => {
  it('draws a style’s tile on the settings being chosen, in a wrapper its knobs sit on', () => {
    const soft = host(previewStyle('soft', { line: 'bold' }, 120, 56));
    const plot = soft.querySelector<HTMLElement>('.fc-plot')!;
    expect([plot.style.position, plot.style.width, plot.style.height]).toEqual([
      'relative',
      '120px',
      '56px',
    ]);
    expect(soft.querySelector('svg.fc-chart--soft .fc-line')?.getAttribute('stroke-width')).toBe(
      '3',
    );
    // now at two thirds: the knob on the line, the forecast beyond it
    expect(soft.querySelector('.fv-knob')).not.toBeNull();
    expect(soft.querySelector('.fc-future')).not.toBeNull();
    // the bars styles on the day's energy, a bar a slot
    expect(host(previewStyle('bars', {}, 120, 56)).querySelectorAll('.fc-bar').length).toBe(12);
    // ids apart, so eight tiles share one shadow root
    expect(soft.querySelector('clipPath')?.id).toBe('fc-tile-soft-clip');
  });

  it('draws a gauge’s tile in its style', () => {
    const ring = host(previewGauge('ring', {}, { size: 96, format: String, small: true }));
    expect(ring.querySelector('.fc-gauge__value b')?.textContent).toBe('62');
    // the ruler over its reading, as the dial and the ring hold theirs
    const ruler = host(previewGauge('ruler', {}, { size: 96, format: String, small: true }));
    expect(ruler.querySelector('.fc-gauge--ruler > fluvy-ruler + .fc-reading')).not.toBeNull();
    expect(ruler.querySelector('.fc-reading__figure')?.textContent?.replace(/\s+/g, '')).toBe(
      '62%',
    );
  });

  it('draws a moving gauge’s tile on a reading of its kind, moving, in its own tone', () => {
    const tile = (preset: 'thermo' | 'tank' | 'pulse') =>
      host(previewGauge(preset, {}, { size: 96, format: String, small: true })).querySelector(
        '.fc-scene',
      ) as HTMLElement;
    expect(tile('thermo').querySelector('.fc-reading b')?.textContent).toBe('21.5');
    expect(tile('thermo').classList.contains('fc-sky--mild')).toBe(true);
    expect(tile('tank').querySelectorAll('.fc-bubble').length).toBeGreaterThan(0);
    expect(tile('pulse').classList.contains('fv-tone--accent')).toBe(true);
    expect(tile('pulse').classList.contains('is-still')).toBe(false);
  });

  it('says a moving gauge’s words in the panel’s language', async () => {
    await preloadLanguages();
    const said = (preset: 'battery' | 'air', language: string) =>
      host(
        previewGauge(
          preset,
          {},
          {
            size: 120,
            format: String,
            small: true,
            hass: { language } as HomeAssistant,
          },
        ),
      ).querySelector('.fc-reading__word')?.textContent;
    expect([said('battery', 'en'), said('air', 'en')]).toEqual(['Charging', 'Breeze']);
    expect([said('battery', 'de'), said('air', 'de')]).toEqual(['Lädt', 'Brise']);
    expect([said('battery', 'ja'), said('air', 'ja')]).toEqual(['充電中', 'そよ風']);
    // and the preview's gauge with them
    const air = host(
      previewChart(
        { gauge: 'air' },
        { mode: 'light', width: 200, format: String, hass: { language: 'de' } as HomeAssistant },
      ),
    );
    expect(air.querySelector('.fc-preview__gauge .fc-reading__word')?.textContent).toBe('Brise');
  });

  it('previews a chart, its bars and the house’s gauge in one mode, the bubble where the style shows one', () => {
    const soft = preview({ style: 'soft', gauge: 'ring' });
    expect(soft.querySelector('.fc-preview')?.getAttribute('data-mode')).toBe('dark');
    expect(soft.querySelector('#fc-preview-dark-line-clip')).not.toBeNull();
    expect(soft.querySelectorAll('.fc-bar').length).toBe(12);
    // the soft style lights its highest bar, one that has happened: the rest quiet, the forecast hollow
    expect(soft.querySelectorAll('.fc-bar:not(.fc-bar--quiet):not(.fc-bar--hollow)')).toHaveLength(
      1,
    );
    expect(soft.querySelector('.fv-bubble.fv-bubble--tone')).toBeNull();
    expect(soft.querySelector('.fv-bubble b')?.textContent).toMatch(/^\d+(\.\d)?$/);
    expect(soft.querySelector('.fc-ring')).not.toBeNull();
    expect(preview({ style: 'soft', bubble: 'tone' }).querySelector('.fv-bubble--tone')).not.toBe(
      null,
    );
    // minimal shows no bubble at rest; bars over a temperature draw its line classic, its bars as bars
    expect(preview({ style: 'minimal' }).querySelector('.fv-bubble')).toBeNull();
    const bars = preview({ style: 'bars' });
    expect(
      bars.querySelector('svg.fc-chart:not([class*="fc-chart--"]) .curve-line'),
    ).not.toBeNull();
    expect(bars.querySelector('svg.fc-chart--bars')).not.toBeNull();
    // motion off: every drawing its resting frame
    expect(
      preview({ style: 'soft', animate: false }).querySelectorAll('svg:not(.is-still)'),
    ).toHaveLength(0);
  });

  it('draws a set of series colours as six lines, each in its own ink, nothing else between them and the card', () => {
    const six = ['#1d4ed8', '#b45309', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'];
    const lines = host(previewSeries(six, {}, { mode: 'light', width: 160, height: 64 }));
    const inks = [...lines.querySelectorAll<SVGGElement>('g[style]')].map((g) =>
      g.getAttribute('style'),
    );
    expect(inks).toEqual(six.map((colour) => `--tone-ink:${colour}`));
    expect(lines.querySelectorAll('.fc-line')).toHaveLength(6);
    expect(
      lines.querySelectorAll('.fc-area, .fc-glow, .fc-grid, .curve-dot, .fv-knob'),
    ).toHaveLength(0);
  });
});
