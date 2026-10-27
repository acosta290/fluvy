// @vitest-environment happy-dom
import { CHART_DEFAULTS, type GaugePreset } from '@fluvy/core';
import { render, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';

import '../english.js';
import { drawGauge, type GaugeOptions } from './gauge.js';
import { GAUGE_PRESETS, movingFor, resolveGauge, type Reads } from './presets.js';
import {
  celsius,
  fitReading,
  meets,
  skyPlan,
  sunBox,
  waterline,
  waterPlan,
  weatherBoxes,
  weatherOf,
  type Room,
  type Weather,
} from './scenes.js';
import { chartStyles } from './styles.js';

const MOVING = ['liquid', 'thermo', 'tank', 'battery', 'pulse', 'air', 'sun'] as const;

/** The rooms the gauge card gives a moving gauge at 152, 172, 211 and 266, and at a section's 360 and wider. */
const ROOMS: readonly Room[] = [
  { w: 112, h: 140, small: true },
  { w: 132, h: 140, small: true },
  { w: 171, h: 160, small: false },
  { w: 226, h: 208, small: false },
  { w: 320, h: 224, small: false },
];

const host = (template: TemplateResult): HTMLElement => {
  const element = document.createElement('div');
  render(template, element);
  return element;
};

/** A reading the way a card writes one, a sensor of its kind, in a style of its own. */
const gauge = (preset: GaugePreset, more: Partial<GaugeOptions> = {}): GaugeOptions => ({
  style: resolveGauge(preset, {}),
  size: 224,
  height: 208,
  min: 0,
  max: 100,
  value: 52,
  format: (value) => String(Math.round(value * 10) / 10),
  unit: '%',
  label: 'Humidity',
  tone: 'water',
  ...more,
});

describe('the moving gauges, each where it reads the sensor', () => {
  it('offers each kind of sensor the gauges that read it', () => {
    const offered = (reads: Reads): GaugePreset[] => movingFor(reads);
    expect(offered({ deviceClass: 'humidity', unit: '%' })).toEqual(['liquid']);
    expect(offered({ unit: '%' })).toEqual(['liquid']);
    expect(offered({ deviceClass: 'battery', unit: '%' })).toEqual(['liquid', 'battery']);
    expect(offered({ deviceClass: 'temperature', unit: '°F' })).toEqual(['thermo']);
    expect(offered({ deviceClass: 'volume_storage', unit: 'L' })).toEqual(['tank']);
    expect(offered({ deviceClass: 'distance', unit: 'cm' })).toEqual(['tank']);
    expect(offered({ deviceClass: 'power', unit: 'W' })).toEqual(['pulse', 'sun']);
    expect(offered({ deviceClass: 'irradiance', unit: 'W/m²' })).toEqual(['sun']);
    expect(offered({ deviceClass: 'wind_speed', unit: 'km/h' })).toEqual(['air']);
    expect(offered({ deviceClass: 'pressure', unit: 'hPa' })).toEqual([]);
  });

  it('draws one that does not read the sensor as the ticks, and every control for anything', () => {
    const power = { deviceClass: 'power', unit: 'W' };
    expect(resolveGauge('thermo', {}, undefined, power).preset).toBe('ticks');
    expect(resolveGauge('pulse', {}, undefined, power).preset).toBe('pulse');
    expect(resolveGauge('ring', {}, undefined, power).preset).toBe('ring');
    // the house's moving gauge where it reads the sensor, its ticks elsewhere
    const house = { ...CHART_DEFAULTS, gauge: 'liquid' as const };
    expect(resolveGauge(undefined, {}, house, { deviceClass: 'humidity', unit: '%' }).preset).toBe(
      'liquid',
    );
    expect(resolveGauge(undefined, {}, house, power).preset).toBe('ticks');
  });

  it('moves where the card or the house says so, and only a style that has motion to show', () => {
    expect(MOVING.every((preset) => GAUGE_PRESETS[preset].motion)).toBe(true);
    expect(resolveGauge('liquid', {}).animate).toBe(true);
    expect(resolveGauge('liquid', { animate: false }).animate).toBe(false);
    expect(resolveGauge('liquid', {}, { ...CHART_DEFAULTS, animate: false }).animate).toBe(false);
    expect(resolveGauge('dial', { animate: true }).animate).toBe(false);
  });
});

describe('the water: the reading never crosses the line', () => {
  it('keeps the line off the floor and the brim', () => {
    expect(waterline(100, 0)).toBe(92);
    expect(waterline(100, 1)).toBe(8);
    expect(waterline(100, 0.5)).toBe(50);
  });

  it.each(ROOMS)(
    'in a $w × $h room, at every share, the reading clear of the waves and inside the box',
    (room) => {
      for (const amp of [4, 7, 10])
        for (let percent = 0; percent <= 100; percent++) {
          const share = percent / 100;
          const y = waterline(room.h, share);
          const read = fitReading(
            '100',
            '%',
            'Humidity',
            room.w - 24,
            Math.max(y, room.h - y) - amp - 20,
            room.small,
          );
          const plan = waterPlan(room, share, amp, read);
          const box = plan.reading!;
          const waves = { x: 0, y: plan.y - amp, w: room.w, h: 2 * amp };
          expect(meets(box, waves), `${percent} % at ${amp}`).toBe(false);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.h).toBeLessThanOrEqual(room.h);
          expect(box.y % 4).toBe(0);
          // in the larger part, and the bubbles never through a reading in the water
          expect(box.wet).toBe(room.h - plan.y >= plan.y);
          if (plan.bubbles && box.wet) expect(meets(plan.bubbles, box)).toBe(false);
          if (plan.bubbles) expect(plan.bubbles.y).toBeGreaterThanOrEqual(plan.y + amp);
        }
    },
  );
});

describe('the sky: the weather never across a word', () => {
  const WEATHERS: readonly Weather[] = ['cold', 'mild', 'warm', 'extreme', 'none'];
  const READINGS = ['2.4 °C', '21.5 °C', '−12.5 °F', '104.9 °F'];

  it('reads the weather a temperature feels like, in any unit', () => {
    expect([2.4, 15.9, 16, 23.9, 24, 34.9, 35].map(weatherOf)).toEqual([
      'cold',
      'cold',
      'mild',
      'mild',
      'warm',
      'warm',
      'extreme',
    ]);
    expect(weatherOf(null)).toBe('none');
    expect(celsius(95, '°F')).toBe(35);
    expect(celsius(273.15, 'K')).toBe(0);
  });

  it.each(ROOMS)(
    'in a $w × $h room, every weather clear of every reading, inside the room',
    (room) => {
      for (const weather of WEATHERS)
        for (const text of READINGS) {
          const [value, unit] = text.split(' ') as [string, string];
          const read = fitReading(
            value,
            unit,
            'Extreme heat',
            room.w - 2 * (room.small ? 12 : 16),
            room.h / 2,
            room.small,
          );
          const plan = skyPlan(room, weather, read);
          for (const part of weatherBoxes(plan))
            expect(meets(part, plan.reading), `${weather}, ${text}: ${JSON.stringify(part)}`).toBe(
              false,
            );
          expect(plan.reading.x + plan.reading.w).toBeLessThanOrEqual(room.w);
          if (plan.sun) {
            const sun = sunBox(plan.sun);
            expect(sun.x).toBeGreaterThanOrEqual(0);
            expect(sun.x + sun.w).toBeLessThanOrEqual(room.w);
            expect(sun.y + sun.h).toBeLessThan(plan.ground);
          }
          // a sun where the weather has one, snow when it is cold, a cloud when it is mild, cacti in the desert
          expect(plan.sun !== undefined).toBe(
            weather === 'mild' || weather === 'warm' || weather === 'extreme',
          );
          expect(plan.flakes.length > 0).toBe(weather === 'cold');
          expect(plan.cloud !== undefined).toBe(weather === 'mild');
          expect(plan.cacti.length > 0).toBe(weather === 'extreme');
        }
    },
  );
});

describe('a moving gauge drawn', () => {
  const scenes: [GaugePreset, Partial<GaugeOptions>][] = [
    ['liquid', {}],
    ['thermo', { value: 21.5, unit: '°C', reads: { deviceClass: 'temperature', unit: '°C' } }],
    ['tank', { value: 580, max: 1000, unit: 'L', rise: 240 }],
    ['battery', { value: 62, rise: 18, reads: { deviceClass: 'battery', unit: '%' } }],
    ['pulse', { value: 1800, max: 8000, unit: 'kW', reads: { deviceClass: 'power', unit: 'W' } }],
    [
      'air',
      { value: 18, max: 60, unit: 'km/h', reads: { deviceClass: 'wind_speed', unit: 'km/h' } },
    ],
    ['sun', { value: 2600, max: 6000, unit: 'kW', reads: { deviceClass: 'power', unit: 'W' } }],
  ];

  it.each(scenes)(
    '%s: a drawing in its room, its reading by rule, no filter, moving',
    (preset, more) => {
      const scene = host(drawGauge(gauge(preset, more))).querySelector('.fc-scene') as HTMLElement;
      expect(scene.getAttribute('data-measure')).toBe('drawn');
      expect([scene.style.width, scene.style.height]).toEqual(['224px', '208px']);
      expect(scene.classList.contains('is-still')).toBe(false);
      expect(scene.querySelector('filter, [filter]')).toBeNull();
      expect(scene.querySelector('.fc-reading b')?.textContent).not.toBe('—');
    },
  );

  it.each(scenes)('%s: told not to move, its first frame', (preset, more) => {
    const still = { ...gauge(preset, more), style: resolveGauge(preset, { animate: false }) };
    expect(host(drawGauge(still)).querySelector('.fc-scene')?.classList.contains('is-still')).toBe(
      true,
    );
  });

  it.each(scenes)(
    '%s: without a reading, its room and its anatomy, still and grey, "—"',
    (preset, more) => {
      const scene = host(drawGauge(gauge(preset, { ...more, value: null }))).querySelector(
        '.fc-scene',
      ) as HTMLElement;
      expect([scene.style.width, scene.style.height]).toEqual(['224px', '208px']);
      expect(scene.querySelector('.fc-reading b')?.textContent).toBe('—');
      expect(scene.querySelector('.fc-bubble, .fc-pulse__ring, .fc-snow')).toBeNull();
      expect(
        scene.classList.contains('fv-tone--neutral') || scene.classList.contains('fc-sky--none'),
      ).toBe(true);
    },
  );

  it('bubbles a tank only while it fills, a battery only while it charges, with the bolt', () => {
    const count = (o: GaugeOptions, selector: string): number =>
      host(drawGauge(o)).querySelectorAll(selector).length;
    expect(count(gauge('tank', { value: 580, max: 1000, rise: 0 }), '.fc-bubble')).toBe(0);
    expect(
      count(gauge('tank', { value: 580, max: 1000, rise: 240 }), '.fc-bubble'),
    ).toBeGreaterThan(0);
    // filling faster, more of them
    expect(
      count(gauge('tank', { value: 580, max: 1000, rise: 720 }), '.fc-bubble'),
    ).toBeGreaterThan(count(gauge('tank', { value: 580, max: 1000, rise: 240 }), '.fc-bubble'));
    expect(count(gauge('battery', { value: 96, rise: 0 }), '.fc-bubble, .fc-bolt')).toBe(0);
    expect(count(gauge('battery', { value: 62, rise: 18 }), '.fc-bolt')).toBe(1);
  });

  it('beats a pulse faster with more power, and none at rest', () => {
    const beat = (watts: number): string | undefined =>
      (
        host(
          drawGauge(
            gauge('pulse', { value: watts, max: 8000, reads: { deviceClass: 'power', unit: 'W' } }),
          ),
        ).querySelector('.fc-pulse__ring') as SVGElement | null
      )?.style.getPropertyValue('--d');
    expect([beat(200), beat(1800), beat(6400)]).toEqual(['3.2s', '1.8s', '0.95s']);
    expect(beat(0)).toBeUndefined();
  });

  it('says the comfort under a temperature, and the wind under its speed', () => {
    const word = (o: GaugeOptions): string | undefined =>
      host(drawGauge(o)).querySelector('.fc-reading__word')?.textContent ?? undefined;
    const temperature = (value: number) =>
      gauge('thermo', { value, unit: '°C', reads: { deviceClass: 'temperature', unit: '°C' } });
    expect([2.4, 12, 21.5, 26, 32, 38.6].map((value) => word(temperature(value)))).toEqual([
      'Cold',
      'Cool',
      'Comfortable',
      'Warm',
      'Hot',
      'Extreme heat',
    ]);
    const wind = (value: number) =>
      gauge('air', {
        value,
        max: 60,
        unit: 'km/h',
        reads: { deviceClass: 'wind_speed', unit: 'km/h' },
      });
    expect([4, 18, 46].map((value) => word(wind(value)))).toEqual([
      'Calm',
      'Breeze',
      'Strong wind',
    ]);
  });
});

describe('the motion, in the engine’s sheet', () => {
  const css = chartStyles.cssText;
  const frames = [...css.matchAll(/@keyframes (fc-[\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)];

  it('moves only transform, opacity and the dash offset, one keyframe set', () => {
    const moving = frames.filter(([, name]) => name !== 'fv-draw');
    expect(moving.map(([, name]) => name).sort()).toEqual(
      [
        'fc-breath',
        'fc-bubble',
        'fc-dash',
        'fc-drift',
        'fc-glow',
        'fc-haze',
        'fc-pulse',
        'fc-snow',
        'fc-spin',
        'fc-wave',
      ].sort(),
    );
    for (const [, name, body] of moving)
      for (const [, property] of (body as string).matchAll(/([\w-]+)\s*:/g))
        expect(['transform', 'opacity', 'stroke-dashoffset'], `${name}: ${property}`).toContain(
          property,
        );
  });

  it('rests every scene on its first frame told not to move, under reduced motion, or the house’s reduced motion', () => {
    expect(css).toMatch(/\.fc-scene\.is-still \*\s*\{\s*animation: none !important;/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.fc-scene \*\s*\{\s*animation: none !important;/,
    );
    expect(css).toMatch(
      /:host\(\[reduced-motion\]\) \.fc-scene \*\s*\{\s*animation: none !important;/,
    );
    // what exists only moving starts unseen: at rest, there is none
    for (const part of ['fc-bubble', 'fc-pulse__ring', 'fc-snow'])
      expect(css).toMatch(new RegExp(`\\.${part}\\s*\\{[^}]*opacity: 0;`));
  });
});
