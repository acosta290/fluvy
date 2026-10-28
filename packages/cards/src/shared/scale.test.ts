import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import {
  fanPercentage,
  numberScale,
  PERCENT,
  readingOf,
  scaleText,
  setCall,
  ticksOf,
  type Scale,
} from './scale.js';

const OFFSET: Scale = { min: -2, max: 2, step: 0.5, unit: '°C', origin: 0 };
const hass = { language: 'en', locale: { language: 'en', number_format: 'language' } };
const view = (id: string, state: string, attributes: Record<string, unknown> = {}) =>
  resolveEntity(
    { states: { [id]: { entity_id: id, state, attributes } } } as unknown as HomeAssistant,
    id,
  );

describe('a scale (#77)', () => {
  it('ticks a step up to a ruler’s own count, its majors on the quarters, the halves or the ends', () => {
    expect(ticksOf(OFFSET, 20)).toEqual({ minor: 1 / 8, major: 1 / 4 });
    expect(ticksOf({ ...PERCENT, step: 5 }, 20)).toEqual({ minor: 1 / 20, major: 1 / 4 });
    expect(ticksOf({ ...PERCENT, max: 10 }, 20)).toEqual({ minor: 1 / 10, major: 1 / 2 });
    expect(ticksOf({ ...PERCENT, max: 5 }, 20)).toEqual({ minor: 1 / 5, major: 1 });
    // finer than the ruler's own ticks: the ruler's own, a card's or a tile's
    expect(ticksOf(PERCENT, 20)).toEqual({ minor: 1 / 20, major: 1 / 4 });
    expect(ticksOf({ ...PERCENT, step: 5 }, 12)).toEqual({ minor: 1 / 12, major: 1 / 4 });
    expect(ticksOf({ ...PERCENT, step: 3 }, 20)).toEqual({ minor: 1 / 20, major: 1 / 4 });
  });

  it('writes a signed figure with the typographic minus and a plus, its words briefly', () => {
    const h = hass as unknown as HomeAssistant;
    expect(scaleText(h, OFFSET, -1)).toBe('−1.0');
    expect(scaleText(h, OFFSET, 0.5)).toBe('+0.5');
    expect(scaleText(h, OFFSET, 0)).toBe('0.0');
    expect([-2, 0, 2].map((v) => scaleText(h, OFFSET, v, true))).toEqual(['−2', '0', '+2']);
    // a range that is not signed has no plus, and still the typographic minus
    expect(scaleText(h, { ...OFFSET, min: -20, max: -5, origin: Number.NaN }, -10)).toBe('−10.0');
    expect(scaleText(h, PERCENT, 30)).toBe('30');
  });

  it('reads a number’s range, step and unit, and a card’s own ends where they make a range', () => {
    const number = view('number.offset', '-1', {
      min: -2,
      max: 2,
      step: 0.5,
      unit_of_measurement: '°C',
    });
    expect(numberScale(number)).toEqual(OFFSET);
    expect(numberScale(number, { min: -1, max: 1 })).toMatchObject({ min: -1, max: 1 });
    expect(numberScale(number, { min: 3 })).toMatchObject({ min: -2, max: 2 });
    expect(numberScale(view('number.none', '4'))).toBeNull();
    // a step that does not fit the range: a hundredth of it
    expect(numberScale(view('input_number.x', '1', { min: 0, max: 1, step: 5 }))?.step).toBe(0.01);
  });

  it('reads where an entity stands and sets it with its own service', () => {
    const player = view('media_player.bar', 'on', { volume_level: 0.304 });
    expect(readingOf(player)).toBe(30);
    expect(setCall(player, 45)).toEqual(['media_player', 'volume_set', { volume_level: 0.45 }]);
    const fan = view('fan.f', 'on', { percentage: 66 });
    expect(readingOf(fan)).toBe(66);
    expect(setCall(fan, 200 / 3)).toEqual(['fan', 'set_percentage', { percentage: 66 }]);
    expect(fanPercentage(100)).toBe(100);
    const helper = view('input_number.pump', '65');
    expect(readingOf(helper)).toBe(65);
    expect(setCall(helper, 70)).toEqual(['input_number', 'set_value', { value: 70 }]);
  });
});
