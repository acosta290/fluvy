// @vitest-environment happy-dom
import { ensureLanguage, resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { visibleFields } from '../shared/form.js';
import { compassHeight } from '../weather-family.js';
import {
  bearingOf,
  degreesOf,
  degreesText,
  directionOf,
  FluvyCompassCard,
  pointOf,
  pointWord,
  type CompassCardConfig,
} from './compass-card.js';
import * as compassEditor from './compass-editor.js';

await familiesDefined;

type Attributes = Record<string, unknown>;

/** A house of `states` (id → state and attributes), in `language`. */
const house = (
  states: Record<string, readonly [string, Attributes?]>,
  language = 'en',
): HomeAssistant =>
  ({
    language,
    locale: { language, number_format: 'language', time_format: '24' },
    states: Object.fromEntries(
      Object.entries(states).map(([id, [state, attributes = {}]]) => [
        id,
        { entity_id: id, state, attributes, last_changed: '', last_updated: '' },
      ]),
    ),
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

/** A weather station's wind, its 10-minute average, a weather entity, the sun and a car. */
const STATION = house({
  'sensor.wind_speed': ['14.2', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.wind_bearing': ['248', { unit_of_measurement: '°', device_class: 'wind_direction' }],
  'sensor.wind_average': ['236', { unit_of_measurement: '°', device_class: 'wind_direction' }],
  'sensor.wind_gust': ['23.8', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.wind_letters': ['wsw'],
  'sensor.wind_gone': ['unavailable', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.bearing_gone': ['unavailable', { device_class: 'wind_direction' }],
  'weather.home': ['sunny', { wind_speed: 12, wind_speed_unit: 'km/h', wind_bearing: 315 }],
  'weather.terrace': ['cloudy', { wind_speed: 9, wind_speed_unit: 'km/h', wind_bearing: 'ssw' }],
  'sun.sun': ['above_horizon', { azimuth: 291.4, elevation: 12 }],
  'device_tracker.car': ['not_home', { heading: 47 }],
});

type CardElement = FluvyCompassCard & { updateComplete: Promise<boolean> };

async function mount(
  config: Partial<CompassCardConfig>,
  hass: HomeAssistant = STATION,
): Promise<CardElement> {
  const card = document.createElement('fluvy-compass-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-compass-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const text = (card: CardElement, selector: string): string =>
  card.shadowRoot?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('a bearing as the Compass card reads it', () => {
  it('reads degrees, as a figure or as words, wrapped into one turn', () => {
    expect(bearingOf(248)).toBe(248);
    expect(bearingOf('248')).toBe(248);
    expect(bearingOf(' 12.5 ')).toBe(12.5);
    expect(bearingOf(-10)).toBe(350);
    expect(bearingOf(370)).toBe(10);
    expect(bearingOf(Number.NaN)).toBeNull();
  });

  it('reads the sixteen points in English’s letters, in any case, and nothing else', () => {
    expect(['N', 'NNE', 'ENE', 'E', 'SSW', 'WSW', 'W', 'NNW'].map(bearingOf)).toEqual([
      0, 22.5, 67.5, 90, 202.5, 247.5, 270, 337.5,
    ]);
    expect(bearingOf('wsw')).toBe(247.5);
    expect(bearingOf('Ssw')).toBe(202.5);
    // German's O is East, Spanish's West: a letter of another language is never guessed at
    expect(['O', 'NO', 'SO', 'ONO', 'OSO', 'NORTH', ''].map(bearingOf)).toEqual(
      Array(7).fill(null),
    );
  });

  it('says its point of the sixteen in the page’s language, a point between two as the language joins them', async () => {
    expect(pointOf(248)).toBe(11);
    expect(pointOf(354)).toBe(0);
    const en = STATION;
    expect([0, 1, 3, 5, 11, 15].map((point) => pointWord(en, point))).toEqual([
      'N',
      'NNE',
      'ENE',
      'ESE',
      'WSW',
      'NNW',
    ]);
    for (const code of ['es', 'ja', 'pl'] as const) await ensureLanguage(code);
    // Spanish's W is O; Japanese joins without a space; Polish with a hyphen
    expect(pointWord(house({}, 'es'), 11)).toBe('OSO');
    expect(pointWord(house({}, 'ja'), 1)).toBe('北北東');
    expect(pointWord(house({}, 'pl'), 1)).toBe('Pn-Pn-Wsch');
  });

  it('writes whole degrees: 359.6 is 0°, never 360°', () => {
    expect(degreesOf(359.6)).toBe(0);
    expect(degreesOf(247.5)).toBe(248);
    expect(degreesText(STATION, 359.6)).toBe('0°');
  });

  it('reads the sun’s azimuth, a weather entity’s wind bearing and any attribute named; a state otherwise', () => {
    const view = (id: string) => resolveEntity(STATION, id);
    expect(directionOf(view('sun.sun'))).toBe(291.4);
    expect(directionOf(view('weather.home'))).toBe(315);
    expect(directionOf(view('weather.terrace'))).toBe(202.5);
    expect(directionOf(view('device_tracker.car'), 'heading')).toBe(47);
    expect(directionOf(view('sensor.wind_bearing'))).toBe(248);
    expect(directionOf(view('sensor.wind_letters'))).toBe(247.5);
    expect(directionOf(view('sensor.bearing_gone'))).toBeNull();
    expect(directionOf(view('sensor.nowhere'))).toBeNull();
  });
});

describe('the Compass card', () => {
  it('reads its sensor in the ring, the point and the degrees under it, the second bearing beside the first', async () => {
    const card = await mount({
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
    });
    expect(text(card, '.fv-dial__label-in')).toBe('Speed');
    expect(text(card, '.fv-dial__value')).toBe('14.2km/h');
    expect(text(card, '.fv-dial__sub')).toBe('WSW · 248°');
    // the bearing's knob in the card's colour, the second's dot in the secondary ink
    expect(card.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(1);
    expect(card.shadowRoot?.querySelector('.fv-knob')?.classList.contains('fv-knob--accent')).toBe(
      true,
    );
    expect(card.shadowRoot?.querySelectorAll('circle.dl-current')).toHaveLength(1);
    // the direction is said once, in the ring: no badge, no line under the name of the card's own
    expect(card.shadowRoot?.querySelector('.fv-badge')).toBeNull();
    expect(text(card, '.fv-card__sub')).toBe('');
  });

  it('reads a weather entity’s wind as its figure, and the bearing itself where there is no figure', async () => {
    const weather = await mount({ direction_entity: 'weather.home' });
    expect(text(weather, '.fv-dial__value')).toBe('12km/h');
    expect(text(weather, '.fv-dial__sub')).toBe('NW · 315°');
    const sun = await mount({ direction_entity: 'sun.sun', label: 'Azimuth' });
    expect(text(sun, '.fv-dial__label-in')).toBe('Azimuth');
    expect(text(sun, '.fv-dial__value')).toBe('291°');
    expect(text(sun, '.fv-dial__sub')).toBe('WNW');
    const car = await mount({
      direction_entity: 'device_tracker.car',
      direction_attribute: 'heading',
    });
    expect(text(car, '.fv-dial__label-in')).toBe('Direction');
    expect(text(car, '.fv-dial__value')).toBe('47°');
    // a sensor alone is the bearing: its degrees in the ring, its class's word over them
    const alone = await mount({ entity: 'sensor.wind_bearing' });
    expect(text(alone, '.fv-dial__label-in')).toBe('Wind direction');
    expect(text(alone, '.fv-dial__value')).toBe('248°');
    expect(text(alone, '.fv-dial__sub')).toBe('WSW');
  });

  it('marks the bearing as asked: the knob, the ticks lit across its sixteenth, or the dot', async () => {
    const lit = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'ticks' });
    expect(lit.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(0);
    // 240, 245, 250 and 255: the ticks within 11.25° of 248
    expect(lit.shadowRoot?.querySelectorAll('line.tk-on')).toHaveLength(4);
    const dot = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'dot' });
    expect(dot.shadowRoot?.querySelectorAll('circle.cp-dot')).toHaveLength(1);
    expect(dot.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(0);
  });

  it('turns north to `north_offset`, its cardinal points upright in their ticks’ place', async () => {
    const points = async (north_offset?: number) => {
      const card = await mount({
        direction_entity: 'sensor.wind_bearing',
        ...(north_offset === undefined ? {} : { north_offset }),
      });
      const centre = Number(card.shadowRoot?.querySelector('svg')?.getAttribute('width')) / 2;
      return [...(card.shadowRoot?.querySelectorAll('text.cp-point') ?? [])].map((t) => ({
        word: t.textContent,
        dx: Math.round(Number(t.getAttribute('x')) - centre),
        dy: Math.round(Number(t.getAttribute('y')) - centre),
        turned: t.hasAttribute('transform'),
      }));
    };
    // R 96 at a 360 column: the points stand at 102, in the ticks' band
    expect((await points()).map(({ word, dx, dy }) => [word, dx, dy])).toEqual([
      ['N', 0, -102],
      ['E', 102, 0],
      ['S', 0, 102],
      ['W', -102, 0],
    ]);
    // a balcony facing east: north on the left, east at the top, every letter upright
    const east = await points(-90);
    expect(east.map(({ word, dx, dy }) => [word, dx, dy])).toEqual([
      ['N', -102, 0],
      ['E', 0, -102],
      ['S', 102, 0],
      ['W', 0, 102],
    ]);
    expect(east.every(({ turned }) => !turned)).toBe(true);
    // −180 to 180: further is held there
    expect((await points(540)).map(({ dx, dy }) => [dx, dy])[0]).toEqual([0, 102]);
  });

  it('keeps its anatomy out of reach: the ring, its points and its readouts, "—" for what cannot be read', async () => {
    const card = await mount({
      entity: 'sensor.wind_gone',
      direction_entity: 'sensor.bearing_gone',
      stats: ['sensor.wind_gone', 'sensor.wind_gust'],
    });
    expect(card.shadowRoot?.querySelector('.fv-card')?.classList.contains('is-unavailable')).toBe(
      true,
    );
    expect(text(card, '.fv-dial__value')).toBe('—');
    expect(text(card, '.fv-dial__sub')).toBe('—');
    expect(card.shadowRoot?.querySelectorAll('text.cp-point')).toHaveLength(4);
    expect(card.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(0);
    expect(
      [...(card.shadowRoot?.querySelectorAll('.so-cols .fv-readout__value') ?? [])].map((v) =>
        v.textContent?.replace(/\s+/g, ''),
      ),
    ).toEqual(['—', '23.8km/h']);
    expect(text(card, '.fv-badge')).toBe('Unavailable');
  });

  it('says the band its figure is in: its tone, its words in the badge', async () => {
    const card = await mount({
      entity: 'sensor.wind_gust',
      direction_entity: 'sensor.wind_bearing',
      thresholds: [{ value: 20, tone: 'warning', label: 'Breezy' }],
    });
    // the thresholds' reader is fetched by the first card that names one: the card draws again as it lands
    await new Promise((resolve) => setTimeout(resolve, 50));
    await card.updateComplete;
    expect(text(card, '.fv-badge')).toBe('Breezy');
    expect(card.shadowRoot?.querySelector('.cp-dial')?.classList.contains('fv-dial--warning')).toBe(
      true,
    );
  });

  it('declares its height from its config: the head, the ring, the readouts’ row while one is listed', () => {
    const config = { type: 'custom:fluvy-compass-card', direction_entity: 'sun.sun' };
    expect(compassHeight(config)).toBe(340);
    expect(compassHeight({ ...config, stats: ['sensor.wind_gust'] })).toBe(400);
    expect(compassHeight({ ...config, stats: ['sensor.wind_gust'], show_stats: false })).toBe(340);
    expect(compassHeight({ ...config, stats: [] })).toBe(340);
  });

  it('asks for a bearing or a figure, and offers the house’s wind, never its speed as a direction', () => {
    expect(() => new FluvyCompassCard().setConfig({ type: 'custom:fluvy-compass-card' })).toThrow(
      /"entity" or "direction_entity"/,
    );
    const states = {
      'sensor.wind_speed': { attributes: { device_class: 'wind_speed' } },
      'sensor.wind_bearing': { attributes: { device_class: 'wind_direction' } },
    };
    expect(
      FluvyCompassCard.getStubConfig({ states }, ['sensor.wind_speed', 'sensor.wind_bearing']),
    ).toEqual({
      type: 'custom:fluvy-compass-card',
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
    });
    // a speed with no bearing beside it: the sun, never the speed
    expect(FluvyCompassCard.getStubConfig({ states }, ['sensor.wind_speed'])).toEqual({
      type: 'custom:fluvy-compass-card',
      entity: 'sensor.wind_speed',
      direction_entity: 'sun.sun',
    });
    // a weather entity's wind is its own figure
    expect(
      FluvyCompassCard.getStubConfig({ states }, ['weather.home', 'sensor.wind_speed']),
    ).toEqual({ type: 'custom:fluvy-compass-card', direction_entity: 'weather.home' });
  });
});

describe('the Compass card’s editor', () => {
  const shown = (data: Record<string, unknown>): string[] =>
    JSON.stringify(visibleFields(compassEditor.getConfigForm().schema, data))
      .match(/"name":"[a-z_]+"/g)!
      .map((name) => name.slice(8, -1));

  it('shows only what can act: a second pointer with a second bearing, an attribute with its entity', () => {
    const bare = shown({ direction_entity: 'sensor.wind_bearing' });
    expect(bare).toContain('direction_attribute');
    expect(bare).not.toContain('secondary_indicator');
    expect(bare).not.toContain('secondary_direction_attribute');
    expect(shown({ secondary_direction_entity: 'sensor.wind_average' })).toEqual(
      expect.arrayContaining(['secondary_indicator', 'secondary_direction_attribute']),
    );
  });

  it('shows the unit, the decimals and the thresholds where there is a figure to read: a sensor’s, a weather’s wind', () => {
    // the sun, or a sensor alone, is the bearing: the ring reads its degrees
    for (const data of [{ direction_entity: 'sun.sun' }, { entity: 'sensor.wind_bearing' }])
      for (const key of ['unit', 'decimals', 'thresholds']) expect(shown(data)).not.toContain(key);
    expect(shown({ entity: 'sensor.wind_speed', direction_entity: 'sensor.wind_bearing' })).toEqual(
      expect.arrayContaining(['unit', 'decimals', 'thresholds']),
    );
    // a weather entity's wind is in its own unit: its decimals and its thresholds
    for (const data of [{ direction_entity: 'weather.home' }, { entity: 'weather.home' }]) {
      expect(shown(data)).toEqual(expect.arrayContaining(['decimals', 'thresholds']));
      expect(shown(data)).not.toContain('unit');
    }
    const sun = shown({ direction_entity: 'sun.sun' });
    // the label names whatever the ring reads, the bearing too
    expect(sun).toContain('label');
  });

  it('shows the badge while the head shows one, and show_stats while a readout is listed', () => {
    expect(shown({})).toContain('badge');
    expect(shown({ show_badge: false })).not.toContain('badge');
    expect(shown({})).not.toContain('show_stats');
    expect(shown({ stats: ['sensor.wind_gust'] })).toContain('show_stats');
  });
});
