// @vitest-environment happy-dom
import { resolveEntity, type HassEntity, type HomeAssistant } from '@fluvy/core';
import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { roundsHeight } from '../rounds-family.js';
import { roundsList } from '../room/room-editor.js';
import { shownNames } from './fixtures/editor.js';
import { readFigure } from './own-values.js';
import { drawGauge, GAUGES, readGauge } from './round-gauge.js';
import {
  drawRound,
  gaugesLanding,
  roundOf,
  type GaugeCard,
  type RoundSpec,
  type RoundsHost,
} from './rounds.js';
import { thresholdsOf } from './thresholds.js';

/*
 * A round's gauge (1.26, #257): what it reads — its state or an attribute, in its decimals, with a real minus — where
 * it stands in its range (the range's defaults, either side of zero, past its ends), its band, what a reader hears,
 * and what the round draws of it.
 */

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: '',
    last_updated: '',
  }) as HassEntity;

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { unit_system: { temperature: '°C' } },
  states: Object.fromEntries(
    [
      state('sensor.drift', '-0.24', { friendly_name: 'Drift', unit_of_measurement: '°C/h' }),
      state('sensor.battery', '35', { unit_of_measurement: '%', device_class: 'battery' }),
      state('sensor.moisture', '140', { device_class: 'moisture' }),
      state('sensor.tank', '1350', { unit_of_measurement: 'L' }),
      state('sensor.power', '420', { unit_of_measurement: 'W' }),
      state('sensor.fuse', '2', { unit_of_measurement: 'kW' }),
      state('sensor.words', 'rinsing'),
      state('sensor.gone', 'unavailable', { unit_of_measurement: '%' }),
      state('input_number.volume', '7', { min: 2, max: 12 }),
      state('light.desk', 'on', { brightness: 153, supported_color_modes: ['brightness'] }),
      state('climate.lounge', 'heat', {
        current_temperature: -3.25,
        fan_mode: '',
        swing: true,
        target: '21.5',
      }),
    ].map((one) => [one.entity_id, one]),
  ),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  formatEntityAttributeValue: (_: unknown, name: string, value: unknown) =>
    name === 'current_temperature' ? `${String(value)} °C` : String(value),
  callService: () => Promise.resolve(),
} as unknown as HomeAssistant;

/** The card a gauge reads through: a figure of its own from the house, a band by an item's thresholds. */
const card: GaugeCard = {
  ownFigure: (raw, unit) =>
    readFigure(raw, unit, { entity: (id) => resolveEntity(hass, id), template: () => undefined }),
  band: (own, view, reading = view.number) => {
    const list = (own as RoundSpec | undefined)?.thresholds;
    return list
      ? thresholdsOf(list, view.unit, {
          accents: { item: () => undefined, ink: (source) => source },
          entity: (id) => resolveEntity(hass, id),
          template: () => undefined,
        }).band(reading)
      : undefined;
  },
  requestUpdate: () => undefined,
};

const host: RoundsHost = {
  hass,
  state: (view) => view.state,
  expect: () => undefined,
  call: () => undefined,
  run: () => undefined,
  tapper: (_of, _at, tap) => tap,
  accent: () => undefined,
  ruler: {
    width: (_cls, text) => text.length * 8,
    pill: (_cls, text, pad) => text.length * 8 + pad,
  },
  root: undefined,
  card,
};

const read = (item: RoundSpec) => readGauge(host, item, resolveEntity(hass, item.entity));
const round = (item: RoundSpec) => roundOf(host, { group: 'entity', ...item });
const DRIFT_BANDS = [
  { value: 0, below: true, tone: 'cool', label: 'Cooling', icon: 'mdi:arrow-down' },
  { value: 0, tone: 'heat', label: 'Heating' },
] as const;

// the gauges are a chunk of their own: a card's first frame waits for it (`Card.wearing`), as the tests do
beforeAll(() => gaugesLanding());
afterEach(() => document.body.replaceChildren());

describe('a round’s gauge reads its range', () => {
  it('0 to 100 for a share: a percentage, a battery, a humidity or a moisture by their class', () => {
    expect(read({ entity: 'sensor.battery', gauge: 'arc' }).fraction).toBe(0.35);
    // past its end it stands on it
    expect(read({ entity: 'sensor.moisture', gauge: 'fill' }).fraction).toBe(1);
  });

  it('the entity’s own `min` and `max`, a number’s; its own keys before them', () => {
    expect(read({ entity: 'input_number.volume', gauge: 'arc' }).fraction).toBe(0.5);
    expect(read({ entity: 'input_number.volume', gauge: 'arc', min: 0, max: 14 }).fraction).toBe(
      0.5,
    );
    expect(read({ entity: 'input_number.volume', gauge: 'arc', max: 4 }).fraction).toBe(1);
  });

  it('a range as the card reads a figure of its own: a number, words that are one, an entity in the reading’s unit', () => {
    expect(read({ entity: 'sensor.tank', gauge: 'fill', max: 2700 }).fraction).toBe(0.5);
    expect(read({ entity: 'sensor.tank', gauge: 'fill', max: '2700' }).fraction).toBe(0.5);
    // the house's fuse, read in kW, is the range of a reading in W
    expect(read({ entity: 'sensor.power', gauge: 'fill', max: 'sensor.fuse' }).fraction).toBe(0.21);
  });

  it('no range known, no number or a range that is none: no share, its track alone', () => {
    expect(read({ entity: 'sensor.tank', gauge: 'arc' }).fraction).toBeUndefined();
    expect(read({ entity: 'sensor.tank', gauge: 'zero' }).fraction).toBeUndefined();
    expect(read({ entity: 'sensor.words', gauge: 'arc', max: 100 }).fraction).toBeUndefined();
    expect(read({ entity: 'sensor.tank', gauge: 'arc', min: 5, max: 5 }).fraction).toBeUndefined();
  });

  it('from zero: `min` is `max` below it, each side its own scale, a reading past an end on it', () => {
    const drift = { entity: 'sensor.drift', gauge: 'zero' } as const;
    expect(read({ ...drift, max: 2 }).fraction).toBeCloseTo(-0.12);
    expect(read({ ...drift, min: -1, max: 5 }).fraction).toBeCloseTo(-0.24);
    expect(read({ ...drift, max: 0.1 }).fraction).toBe(-1);
    expect(read({ entity: 'sensor.battery', gauge: 'zero' }).fraction).toBe(0.35);
    expect(read({ entity: 'sensor.battery', gauge: 'zero', max: 20 }).fraction).toBe(1);
  });

  it('an attribute in its state’s place, its unit as Home Assistant writes it', () => {
    const desk = read({ entity: 'light.desk', gauge: 'arc', attribute: 'brightness', max: 255 });
    expect(desk.fraction).toBe(0.6);
    expect(desk.said).toEqual(['153']);
    const lounge = read({
      entity: 'climate.lounge',
      gauge: 'zero',
      attribute: 'current_temperature',
      max: 10,
      decimals: 1,
    });
    expect(lounge.fraction).toBeCloseTo(-0.325);
    // one decimal, a real minus, and the degree alone as its shorter form
    expect(lounge.said).toEqual(['−3.3 °C', '−3.3°']);
    // an attribute the entity has not, or one that is no number (no words, a flag): no share; words that write one are
    const attribute = (name: string) =>
      read({ entity: 'climate.lounge', gauge: 'arc', attribute: name, max: 43 }).fraction;
    expect(['nope', 'fan_mode', 'swing', 'target'].map(attribute)).toEqual([
      undefined,
      undefined,
      undefined,
      0.5,
    ]);
  });

  it('its decimals word its reading, with a real minus; none said, the round’s own words stand', () => {
    expect(read({ entity: 'sensor.drift', gauge: 'zero', max: 2, decimals: 2 }).said).toEqual([
      '−0.24 °C/h',
    ]);
    // a reading rounded to nothing has no sign, and its decimals are exact
    expect(read({ entity: 'sensor.drift', gauge: 'zero', max: 2, decimals: 0 }).said).toEqual([
      '0 °C/h',
    ]);
    expect(read({ entity: 'sensor.drift', gauge: 'zero', max: 2, decimals: 3 }).said).toEqual([
      '−0.240 °C/h',
    ]);
    expect(read({ entity: 'sensor.drift', gauge: 'zero', max: 2 }).said).toBeUndefined();
  });
});

describe('a round with a gauge', () => {
  it('says its reading and its band’s name to a reader, said under it or not; its band’s tone and icon are the round’s', () => {
    const drift = round({
      entity: 'sensor.drift',
      gauge: 'zero',
      max: 2,
      decimals: 2,
      thresholds: DRIFT_BANDS,
    });
    expect(drift.said).toBeUndefined();
    expect(drift.heard).toBe('−0.24 °C/h, Cooling');
    expect([drift.tone, drift.glyph, drift.on]).toEqual(['cool', 'mdi:arrow-down', false]);
    const box = document.createElement('div');
    render(drawRound(host, drift, undefined, true), box);
    const button = box.querySelector('.lt-bulb')!;
    expect(button.getAttribute('aria-label')).toBe('Drift, −0.24 °C/h, Cooling');
    // the round rests; its gauge is the first thing in it, in its band's tone, at its share
    expect(button.classList.contains('fv-ico--neutral')).toBe(true);
    const layer = button.firstElementChild as HTMLElement;
    expect(layer.className).toBe('rg rg--zero fv-tone--cool');
    expect(layer.style.getPropertyValue('--fv-gauge')).toBe('-0.120');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('.lt-ring')).toBeNull();
  });

  it('says its state as ever where it is asked to, in the gauge’s own decimals', () => {
    const said = round({ entity: 'sensor.battery', gauge: 'fill', show_state: true });
    expect(said.said).toEqual(['35 %']);
    expect(said.heard).toBe('35 %');
    const drift = round({
      entity: 'sensor.drift',
      gauge: 'zero',
      max: 2,
      decimals: 1,
      show_state: true,
    });
    expect(drift.said).toEqual(['−0.2 °C/h']);
  });

  it('a reading that names its own tone is not lit by it: its gauge wears it, the round at rest', () => {
    const plain = round({ entity: 'sensor.battery', tone: 'water', show_state: true });
    expect(plain.on).toBe(true);
    const gauged = round({
      entity: 'sensor.battery',
      tone: 'water',
      show_state: true,
      gauge: 'arc',
    });
    expect([gauged.on, gauged.tone]).toEqual([false, 'water']);
  });

  it('lit, it keeps its fill and draws its gauge in its ring’s place', () => {
    const desk = round({ entity: 'light.desk', gauge: 'arc', attribute: 'brightness', max: 255 });
    expect(desk.on).toBe(true);
    const box = document.createElement('div');
    render(drawRound(host, desk, undefined, true), box);
    expect(box.querySelector('.lt-bulb.is-on > .rg--arc')).not.toBeNull();
    expect(box.querySelector('.lt-ring')).toBeNull();
  });

  it('out of reach it draws none: its dashed ring alone; nor a set, nor a style there is none of', () => {
    expect(round({ entity: 'sensor.gone', gauge: 'arc' }).gauge).toBeUndefined();
    expect(round({ entity: 'sensor.battery', gauge: 'ring' as never }).gauge).toBeUndefined();
    expect(roundOf(host, { group: 'lights', gauge: 'arc' }).gauge).toBeUndefined();
  });

  it('draws a layer a style, its share to three places, its track alone where it has none', () => {
    for (const style of GAUGES) {
      const box = document.createElement('div');
      render(drawGauge(style, undefined, 'accent', '#123456'), box);
      const layer = box.firstElementChild as HTMLElement;
      expect(layer.className).toBe(`rg rg--${style} fv-tone--accent`);
      expect(layer.getAttribute('data-accent')).toBe('#123456');
      expect(layer.style.getPropertyValue('--fv-gauge')).toBe('0.000');
    }
  });
});

describe('a gauge changes no size', () => {
  it('the Rounds card declares the same height with gauges as without, in every layout', () => {
    const plain = ['sensor.battery', 'sensor.drift', 'sensor.tank'];
    const gauged = plain.map((entity) => ({ entity, gauge: 'arc', max: 100, decimals: 1 }));
    for (const variant of ['rounds', 'labels', 'row'])
      for (const extra of [{}, { title: 'Quick picks' }, { show_names: true }]) {
        const config = { type: 'custom:fluvy-rounds-card', variant, ...extra };
        expect(roundsHeight({ ...config, items: gauged }), variant).toBe(
          roundsHeight({ ...config, items: plain }),
        );
      }
  });
});

describe('a round’s form', () => {
  const names = shownNames;
  const OWN = ['min', 'max', 'attribute', 'decimals', 'thresholds'];

  it('shows a gauge’s range, attribute, decimals and thresholds once a gauge is chosen, never before', () => {
    const list = roundsList('items', 'rounds.rounds', undefined);
    const plain = names(list.schemaOf!({ entity: 'sensor.battery' }));
    expect(plain).toContain('gauge');
    expect(plain.filter((name) => OWN.includes(name))).toEqual([]);
    expect(names(list.schemaOf!({ entity: 'sensor.battery', gauge: '' }))).toEqual(plain);
    const gauged = names(list.schemaOf!({ entity: 'sensor.battery', gauge: 'fill' }));
    expect(gauged.filter((name) => OWN.includes(name))).toEqual(OWN);
    // every field a round may show is one of its keys
    expect(names(list.schema).filter((name) => !list.keys!.includes(name))).toEqual([]);
  });

  it('a room’s set has no gauge; its entity’s round has', () => {
    const list = roundsList('quick_actions', 'room-editor.quick_actions', undefined, true);
    expect(names(list.schemaOf!({ group: 'lights' }))).not.toContain('gauge');
    expect(names(list.schemaOf!({ group: 'entity', entity: 'sensor.battery' }))).toContain('gauge');
    expect(
      names(list.schemaOf!({ group: 'entity', entity: 'sensor.battery', gauge: 'arc' })),
    ).toContain('thresholds');
  });

  it('its styles are tiles with a drawing each, None first; the range it needs is said once one is chosen', () => {
    const list = roundsList('items', 'rounds.rounds', undefined);
    const field = list.schema.find(({ name }) => name === 'gauge')!;
    const { select } = field.selector as {
      select: { mode: string; options: { value: string; label: string; image: string }[] };
    };
    expect(select.mode).toBe('box');
    expect(select.options.map(({ value, label }) => [value, label])).toEqual([
      ['', 'None'],
      ['arc', 'Arc'],
      ['zero', 'From zero'],
      ['sector', 'Sector'],
      ['fill', 'Fill'],
    ]);
    expect(select.options.every(({ image }) => image.startsWith('data:image/svg+xml,'))).toBe(true);
    const say = (item: Record<string, unknown>) => list.computeHelper?.(field, (key) => key, item);
    expect(say({ entity: 'sensor.battery' })).toBeUndefined();
    expect(say({ entity: 'sensor.battery', gauge: 'arc' })).toBe(
      'Needs a range: the entity’s own, 0 to 100 for a percentage, or the minimum and maximum below',
    );
  });
});
