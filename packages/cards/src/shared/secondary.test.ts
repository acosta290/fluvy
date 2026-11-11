import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { stateSkin } from './domain.js';
import { ownLine, secondaryText } from './secondary.js';
import type { TemplateTexts } from './templates.js';

const now = new Date(); // relativeTime reads the clock
const hass = {
  language: 'en',
  states: {
    'light.desk': {
      entity_id: 'light.desk',
      state: 'on',
      attributes: {
        friendly_name: 'Desk',
        brightness: 128,
        // the real last change, as an epoch in seconds (#67)
        switched_at: Math.round((now.getTime() - 3 * 3600_000) / 1000),
      },
      last_changed: new Date(now.getTime() - 5 * 60_000).toISOString(),
    },
    'sensor.desk_real_last_changed': {
      entity_id: 'sensor.desk_real_last_changed',
      state: new Date(now.getTime() - 4 * 3600_000).toISOString(),
      attributes: { device_class: 'timestamp' },
      last_changed: now.toISOString(),
    },
    'sensor.gone': {
      entity_id: 'sensor.gone',
      state: 'unavailable',
      attributes: {},
      last_changed: now.toISOString(),
    },
    'sensor.blank': {
      entity_id: 'sensor.blank',
      state: 'unknown',
      attributes: {},
      last_changed: now.toISOString(),
    },
  },
  entities: { 'light.desk': { entity_id: 'light.desk', area_id: 'study' } },
  areas: { study: { area_id: 'study', name: 'Study' } },
} as unknown as HomeAssistant;
const view = (id: string) => resolveEntity(hass, id);
/** The card's texts, as the row sees them: a template's line, for that row's entity. */
const texts = {
  line: (template: string, entityId?: string) => `${entityId}: ${template}`,
} as unknown as TemplateTexts;

describe('secondaryText', () => {
  it('says the area when the row has one, else when it last changed', () => {
    expect(secondaryText(hass, view('light.desk'), undefined)).toBe('Study');
    expect(secondaryText(hass, view('light.desk'), 'last-changed')).toMatch(/5 min/);
    expect(secondaryText(hass, view('sensor.blank'), 'area')).toBe('Unknown');
  });

  it('says the state, or the area when the row already shows the state', () => {
    expect(secondaryText(hass, view('light.desk'), 'state')).toBe('On');
    expect(secondaryText(hass, view('light.desk'), 'state', true)).toBe('Study');
  });

  it('says nothing for none, and an attribute by its name', () => {
    expect(secondaryText(hass, view('light.desk'), 'none')).toBe('');
    expect(secondaryText(hass, view('light.desk'), 'brightness')).toBe('128');
    expect(secondaryText(hass, view('light.desk'), 'color_temp')).toBe('');
  });

  it('says a state that cannot be read as such, whatever was asked', () => {
    expect(secondaryText(hass, view('sensor.gone'), 'none')).toBe('');
    expect(secondaryText(hass, view('sensor.gone'), 'area')).toBe('Unavailable');
    expect(secondaryText(hass, view('sensor.missing'), 'state')).toBe('Entity not found');
  });

  it('reads the time from the row’s since — a timestamp sensor, an attribute — and falls back where it does not read (#67)', () => {
    const since = (name: string, mode = 'last-changed'): string =>
      secondaryText(hass, view('light.desk'), mode, false, undefined, false, name);
    expect(since('sensor.desk_real_last_changed')).toMatch(/4 h/);
    expect(since('attribute:switched_at')).toMatch(/3 h/);
    expect(since('sensor.gone')).toMatch(/5 min/);
    expect(since('attribute:brightness')).not.toMatch(/5 min/); // 128 reads as an epoch: a moment, however odd
    expect(since('sensor.missing')).toMatch(/5 min/);
    // the time a state's or an area's line falls back to is the row's since too
    expect(since('sensor.desk_real_last_changed', 'state')).toBe('On');
    expect(
      secondaryText(
        hass,
        view('light.desk'),
        'state',
        true,
        undefined,
        false,
        'sensor.desk_real_last_changed',
      ),
    ).toBe('Study');
  });

  it('hands a template to the card’s texts, and says nothing without them — never the template', () => {
    const template = "{{ states('sensor.x') }} %";
    expect(secondaryText(hass, view('light.desk'), template, false, texts)).toBe(
      `light.desk: ${template}`,
    );
    expect(secondaryText(hass, view('light.desk'), template)).toBe('');
    expect(secondaryText(hass, view('sensor.gone'), template, false, texts)).toBe('Unavailable');
    // an unknown state is the template's to read (a button never pressed, #92); a line of the house's says it
    expect(secondaryText(hass, view('sensor.blank'), template, false, texts)).toBe(
      `sensor.blank: ${template}`,
    );
    expect(secondaryText(hass, view('sensor.blank'), 'last-changed')).toBe('Unknown');
  });
});

describe('stateSkin', () => {
  it('draws an on entity in its tone, usable', () => {
    expect(stateSkin(view('light.desk'))).toEqual({
      usable: true,
      tone: 'light',
      value: undefined,
      className: '',
    });
  });

  it('keeps an unknown entity live and usable, neutral, showing a dash', () => {
    expect(stateSkin(view('sensor.blank'), 'solar')).toEqual({
      usable: true,
      tone: 'neutral',
      value: '—',
      className: '',
    });
  });

  it('gives an unavailable or missing entity the dashed off skin', () => {
    const off = { usable: false, tone: 'off', value: '—', className: 'is-unavailable is-off' };
    expect(stateSkin(view('sensor.gone'))).toEqual(off);
    expect(stateSkin(view('sensor.missing'))).toEqual(off);
  });
});

describe('a card’s own text (ownLine, Discussion #156)', () => {
  const reading = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({
    entity_id,
    state,
    attributes,
    last_changed: now.toISOString(),
  });
  /** A house that writes a state as Home Assistant does: its figure and its unit, a moment as its date and time. */
  const house = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.battery_energy': reading('sensor.battery_energy', '7.4', {
        unit_of_measurement: 'kWh',
      }),
      'sensor.queries': reading('sensor.queries', '51234', { unit_of_measurement: 'queries' }),
      'sensor.next_alarm': reading(
        'sensor.next_alarm',
        new Date(now.getTime() + 3 * 3600_000).toISOString(),
        { device_class: 'timestamp' },
      ),
      'sensor.runtime': reading('sensor.runtime', 'unavailable', { unit_of_measurement: 'min' }),
    },
    entities: {},
    devices: {},
    areas: {},
    formatEntityState: (s: { state: string; attributes: Record<string, unknown> }) =>
      s.attributes['device_class'] === 'timestamp'
        ? 'November 11, 2026 at 18:20'
        : `${s.state} ${String(s.attributes['unit_of_measurement'] ?? '')}`.trim(),
  } as unknown as HomeAssistant;
  /** The card's feed: what a template rendered to, or the blank line it holds until Home Assistant answers. */
  const feed = {
    line: (template: string, entityId?: string) => `${entityId}: ${template}`,
    text: () => '',
  } as unknown as TemplateTexts;

  it('is nothing where the config says none, and words as written, a figure among them', () => {
    expect(ownLine(house, undefined, feed)).toBeUndefined();
    expect(ownLine(house, null, feed)).toBeUndefined();
    expect(ownLine(house, 'South roof · 5.4 kWp', feed)).toEqual({
      text: 'South roof · 5.4 kWp',
      shorter: [],
    });
    expect(ownLine(house, '', feed)).toEqual({ text: '', shorter: [] });
    expect(ownLine(house, 7, feed)).toEqual({ text: '7', shorter: [] });
  });

  it('says an entity of the house as Home Assistant says its state, its unit with it, and never cuts it', () => {
    // a value too long for its column says itself shorter, then goes
    expect(ownLine(house, 'sensor.battery_energy', feed)).toEqual({
      text: '7.4 kWh',
      shorter: ['7.4', ''],
    });
    expect(ownLine(house, 'sensor.queries', feed)).toEqual({
      text: '51234 queries',
      shorter: ['51K queries', '51K', ''],
    });
    // a moment as its date and time, then as long from now as it is
    const alarm = ownLine(house, 'sensor.next_alarm', feed);
    expect(alarm?.text).toBe('November 11, 2026 at 18:20');
    expect(alarm?.shorter.at(0)).toBe('in 3 h');
    expect(alarm?.shorter.at(-1)).toBe('');
    // out of reach, a value's dash
    expect(ownLine(house, 'sensor.runtime', feed)).toEqual({ text: '—', shorter: [] });
  });

  it('keeps a word that only looks like an entity’s id as written', () => {
    expect(ownLine(house, 'sensor.nowhere', feed)).toEqual({ text: 'sensor.nowhere', shorter: [] });
    expect(ownLine(house, 'e.g', feed)).toEqual({ text: 'e.g', shorter: [] });
  });

  it('hands a template to the card’s feed for its entity: a held line, or nothing yet for a badge, never the template', () => {
    const template = "{{ states('sensor.runtime') }} left";
    expect(ownLine(house, template, feed, 'sensor.battery')).toEqual({
      text: `sensor.battery: ${template}`,
      shorter: [],
    });
    expect(ownLine(house, template, feed, 'sensor.battery', false)).toEqual({
      text: '',
      shorter: [],
    });
    expect(ownLine(house, template, undefined)?.text).toBe('');
  });
});
