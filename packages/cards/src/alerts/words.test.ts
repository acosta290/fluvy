import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { PENDING_LINE, type TemplateTexts } from '../shared/templates.js';
import { AlertEngine, type AlertResult } from './engine.js';
import { house, KIOSK, NOW } from './fixture.js';
import {
  alertIcon,
  alertName,
  culpritText,
  culprits,
  groupsOf,
  messageOf,
  rowGlyph,
  rowName,
  type LookContext,
} from './look.js';
import { definitionOf, type AlertConfig } from './model.js';
import { attributeOf, CulpritWords, fromEntity, TEMPLATE_ROWS } from './words.js';

const KIOSK_HOUSE = house(KIOSK);
const NOTICES: AlertConfig = { id: 'kiosk', entity_id: 'binary_sensor.kiosk_*', state: 'on' };

/** The alert's results in this house now. */
const results = (alert: AlertConfig, hass: HomeAssistant = KIOSK_HOUSE): readonly AlertResult[] =>
  new AlertEngine([definitionOf(alert, 0, 'card')], { now: () => NOW }).evaluate(hass).alerts;

/** Home Assistant's templates as a card's `texts` holds them: each pair asked, answered from a table or pending. */
function texts(answers: Readonly<Record<string, string>>): TemplateTexts & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    line(template: string, entity?: string) {
      calls.push(`${entity ?? ''} ${template}`);
      return answers[`${entity ?? ''} ${template}`] ?? PENDING_LINE;
    },
  } as unknown as TemplateTexts & { calls: string[] };
}

const context = (words: CulpritWords, hass: HomeAssistant = KIOSK_HOUSE): LookContext => ({
  hass,
  now: NOW,
  words,
});

describe('what an alert reads off its entities (#184)', () => {
  it('knows a word read off each entity from the person’s own', () => {
    expect(
      ['attribute:title', "{{ state_attr(entity, 'title') }}", '{% if x %}y{% endif %}'].map(
        fromEntity,
      ),
    ).toEqual([true, true, true]);
    expect(['Kiosk', 'mdi:bell', undefined, 7].map(fromEntity)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(attributeOf('attribute: message ')).toBe('message');
  });

  it('names a split alert’s tile, its glyph and its line by its entity’s attributes', () => {
    const alerts = results({
      ...NOTICES,
      split: true,
      name: 'attribute:title',
      icon: 'attribute:icon',
      secondary: 'attribute:message',
    });
    const said = context(new CulpritWords(KIOSK_HOUSE, undefined, alerts));
    expect(
      alerts.map((alert) => [
        alertName(said, alert),
        alertIcon(said, alert),
        messageOf(said, alert, alert.entity),
      ]),
    ).toEqual([
      ['Aquarium in the nursery', 'mdi:fishbowl', 'Replace the biochemical filter.'],
      ['Monstera', 'mdi:flower', 'Water me.'],
      ['Backup', 'mdi:check', 'Done.'],
      // an entity that says nothing keeps its own name and the alert's glyph, and has no message
      ['kiosk_bare', 'warn', ''],
    ]);
  });

  it('names an alert’s rows and its culprits by an attribute, its own name staying the alert’s', () => {
    const [kiosk] = results({
      ...NOTICES,
      name: 'Kiosk',
      name_by: 'attribute:title',
      icon: 'attribute:icon',
    });
    const said = context(new CulpritWords(KIOSK_HOUSE, undefined, [kiosk!]));
    expect(alertName(said, kiosk!)).toBe('Kiosk');
    expect(alertIcon(said, kiosk!)).toBe('warn');
    expect(groupsOf(kiosk!).map((group) => rowName(said, kiosk!, group))).toEqual([
      'Aquarium in the nursery',
      'Monstera',
      'Backup',
      'kiosk_bare',
    ]);
    expect(culprits(said, kiosk!).map((one) => culpritText(said, one))).toEqual([
      'Aquarium in the nursery',
      'Monstera',
      'Backup',
      'kiosk_bare',
    ]);
    expect(kiosk!.rows.map((row) => rowGlyph(said, kiosk!, row))).toEqual([
      'mdi:fishbowl',
      'mdi:flower',
      'mdi:check',
      // the entity's own glyph where it names none
      expect.any(String),
    ]);
  });

  it('renders a template for each entity, holds its line while it is pending, and falls back where it says nothing', () => {
    const name = "{{ state_attr(entity, 'title') }}";
    const secondary = "{{ state_attr(entity, 'message') }}";
    const [kiosk] = results({
      ...NOTICES,
      name: 'Kiosk',
      name_by: 'entity',
      secondary,
      split: false,
    });
    const [split] = results({ ...NOTICES, name, secondary, split: true });
    const feed = texts({
      [`binary_sensor.kiosk_fish ${name}`]: 'Aquarium',
      [`binary_sensor.kiosk_fish ${secondary}`]: 'Replace the filter.',
      [`binary_sensor.kiosk_plant ${secondary}`]: '',
    });
    const said = context(new CulpritWords(KIOSK_HOUSE, feed, [kiosk!, split!]));
    // asked once each, for every entity of every alert, while the card renders
    expect(feed.calls).toHaveLength(4 + 1 * 2);
    expect(kiosk!.rows.map((row) => messageOf(said, kiosk!, row.id))).toEqual([
      'Replace the filter.',
      // answered nothing: no message
      '',
      // not answered yet: none yet, the time alone meanwhile
      '',
      '',
    ]);
    // a pending name is a blank, never the entity's id flashing first
    expect(alertName(said, split!)).toBe('Aquarium');
    const pending = results({
      ...NOTICES,
      entity_id: 'binary_sensor.kiosk_plant',
      name,
      split: true,
    });
    expect(alertName(context(new CulpritWords(KIOSK_HOUSE, feed, pending)), pending[0]!)).toBe(
      PENDING_LINE,
    );
    expect(feed.calls.length).toBe(7);
  });

  it('renders templates for an alert’s first entities only; an attribute is read for every one', () => {
    const seeds = Object.fromEntries(
      Array.from({ length: TEMPLATE_ROWS + 5 }, (_, i) => [
        `binary_sensor.kiosk_${String(i).padStart(3, '0')}`,
        { state: 'on', attributes: { title: `Notice ${i}` }, changed: NOW - (i + 1) * 60_000 },
      ]),
    );
    const many = house(seeds);
    const template = "{{ state_attr(entity, 'title') }}";
    const [kiosk] = results({ ...NOTICES, name: 'Kiosk', secondary: template }, many);
    const feed = texts({});
    const words = new CulpritWords(many, feed, [kiosk!]);
    expect(feed.calls).toHaveLength(TEMPLATE_ROWS);
    const last = kiosk!.rows.at(-1)!;
    expect(words.of(kiosk!, last.id, 'secondary')).toBeUndefined();
    const [named] = results({ ...NOTICES, name: 'Kiosk', name_by: 'attribute:title' }, many);
    expect(new CulpritWords(many, feed, [named!]).of(named!, last.id, 'name')).toBe('Notice 0');
  });
});
