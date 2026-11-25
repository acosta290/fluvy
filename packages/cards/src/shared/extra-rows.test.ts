// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { thermostatHeight } from '../climate-family.js';
import { coverHeight } from '../cover-family.js';
import { FluvyCoverCard } from '../cover/cover-card.js';
import { fanHeight, FluvyFanCard } from '../fan/fan-card.js';
import { FluvyHumidityCard } from '../humidity/humidity-card.js';
import { familiesDefined } from '../index.js';
import { FluvyLightCard, lightHeight } from '../light/light-card.js';
import { mediaHeight } from '../media-family.js';
import { FluvyMediaCard } from '../media/media-card.js';
import { FluvyThermostatCard } from '../thermostat/thermostat-card.js';
import type { CardEditor } from './base.js';
import { cardForm, drawEditor, listTitles, nextConfig, shownNames } from './fixtures/editor.js';
import type { RowsListSpec } from './rows-editor.js';

// the cover's, the thermostat's and the player's families land with the index
await familiesDefined;

/*
 * Discussion #262: the cards of one device take a lock's rows (`rows`, `show_rows`) under their own controls — the
 * same item, the same engine, the same editor field — and a card that lists none is the card it was.
 */

const CHANGED = new Date(Date.now() - 5 * 60_000).toISOString();
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: CHANGED,
    last_updated: CHANGED,
  }) as HassEntity;

const STATES = [
  state('light.sofa_strip', 'on', { supported_color_modes: ['xy'], brightness: 180 }),
  state('fan.bedroom', 'on', { supported_features: 1 + 16 + 32, percentage: 50 }),
  state('cover.blind', 'open', { supported_features: 15, current_position: 40 }),
  state('climate.hallway', 'heat', {
    hvac_modes: ['off', 'heat'],
    temperature: 20.5,
    current_temperature: 19.5,
    min_temp: 5,
    max_temp: 30,
  }),
  state('media_player.soundbar', 'playing', { supported_features: 1 + 4 + 16384 }),
  state('sensor.bathroom_humidity', '68', { unit_of_measurement: '%', device_class: 'humidity' }),
  state('select.strip_scene', 'Golden pond', {
    options: ['Savanna sunset', 'Golden pond', 'Ocean dawn'],
  }),
  state('switch.oscillation', 'on'),
  state('sensor.light_level', '182', { unit_of_measurement: 'lx', device_class: 'illuminance' }),
];

const callService = vi.fn(() => Promise.resolve());

const house = (states: readonly HassEntity[] = STATES) =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { time_zone: 'UTC', unit_system: { temperature: '°C', length: 'km' } },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService,
    hassUrl: (path: string) => path,
    callWS: () => new Promise(() => undefined),
    connection: { subscribeMessage: () => Promise.resolve(() => undefined) },
  }) as unknown as HomeAssistant;

/** Each card of one device, its own entity, and the variant that draws no rows (none: every one draws them). */
const CARDS = [
  { tag: 'fluvy-light-card', entity: 'light.sofa_strip', bare: 'compact' },
  { tag: 'fluvy-fan-card', entity: 'fan.bedroom', bare: 'compact' },
  { tag: 'fluvy-cover-card', entity: 'cover.blind', bare: 'compact' },
  { tag: 'fluvy-thermostat-card', entity: 'climate.hallway' },
  { tag: 'fluvy-media-card', entity: 'media_player.soundbar', bare: 'mini' },
  { tag: 'fluvy-humidity-card', entity: 'sensor.bathroom_humidity' },
] as const;

const ROWS = ['select.strip_scene', 'switch.oscillation', 'sensor.light_level'];

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** The card drawn at 360: its first frame, nothing after it. */
async function draw(tag: string, config: Record<string, unknown>, hass = house()) {
  const card = document.createElement(tag) as CardElement;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

/** The rows the config lists, as the card draws them: the last of what its article holds. */
const listed = (card: CardElement) => {
  const article = card.shadowRoot!.querySelector('article')!;
  const rows = [...article.querySelectorAll(':scope > .dv-rows')].at(-1);
  return rows === article.lastElementChild
    ? [...rows.querySelectorAll('.fv-row')].map((row) => ({
        title: row.querySelector('.fv-row__title')?.textContent?.trim(),
        end: row.querySelector('.in-value')
          ? 'menu'
          : row.querySelector('[role="switch"]')
            ? 'switch'
            : row.querySelector('.fv-row__value')
              ? 'value'
              : 'chevron',
        out: row.classList.contains('is-unavailable'),
      }))
    : [];
};

afterEach(() => {
  document.body.replaceChildren();
  callService.mockClear();
});

describe('the rows a card of one device lists (#262)', () => {
  it('stand at its foot from its first frame: a dropdown, a switch, a reading', async () => {
    for (const { tag, entity } of CARDS) {
      const card = await draw(tag, { entity, rows: ROWS });
      expect(listed(card), tag).toEqual([
        { title: 'strip scene', end: 'menu', out: false },
        { title: 'oscillation', end: 'switch', out: false },
        { title: 'light level', end: 'value', out: false },
      ]);
    }
  });

  it('are none where the config lists none or hides them, and none on a card too small for them', async () => {
    for (const { tag, entity, ...rest } of CARDS) {
      expect(listed(await draw(tag, { entity })), tag).toEqual([]);
      expect(listed(await draw(tag, { entity, rows: ROWS, show_rows: false })), tag).toEqual([]);
      if ('bare' in rest)
        expect(listed(await draw(tag, { entity, rows: ROWS, variant: rest.bare })), tag).toEqual(
          [],
        );
    }
  });

  it('keep the place of a row out of reach and of one whose entity is gone', async () => {
    const card = await draw('fluvy-light-card', {
      entity: 'light.sofa_strip',
      rows: ['select.strip_scene', 'sensor.gone'],
    });
    expect(listed(card).map((row) => row.out)).toEqual([false, true]);
  });

  it('choose with select_option, flip a switch, and draw again as a row’s entity changes', async () => {
    const hass = house();
    const card = await draw('fluvy-light-card', { entity: 'light.sofa_strip', rows: ROWS }, hass);
    card
      .shadowRoot!.querySelector('.dv-rows fluvy-select')!
      .dispatchEvent(new CustomEvent('fluvy-change', { detail: { value: 'Ocean dawn' } }));
    card.shadowRoot!.querySelector<HTMLElement>('.dv-rows [role="switch"]')!.click();
    expect(callService.mock.calls).toEqual([
      ['select', 'select_option', { option: 'Ocean dawn' }, { entity_id: 'select.strip_scene' }],
      ['switch', 'turn_off', {}, { entity_id: 'switch.oscillation' }],
    ]);
    // a row's entity is followed: its new state draws the card again, whatever the card watches of its own
    const level = state('sensor.light_level', '240', { unit_of_measurement: 'lx' });
    card.hass = { ...hass, states: { ...hass.states, [level.entity_id]: level } };
    await card.updateComplete;
    expect(
      card.shadowRoot!.querySelector('.dv-rows .fv-row:last-child .fv-row__value')?.textContent,
    ).toContain('240');
  });
});

/*
 * A state in words of prose's length (Home Assistant's Dutch "Niet gedetecteerd") is weighed as the rows draw it: a
 * row of any other list caps prose at 55 % of its row, which the rows lift, and a ruler that weighed it outside them
 * found half its longest word, left it beside the name and squeezed the name to nothing at half a section.
 */
describe('a row’s state in many words in a narrow column', () => {
  it('goes under the name where its longest word, weighed in the rows, would leave the name under its floor', async () => {
    const card = document.createElement('fluvy-light-card') as CardElement & {
      head: { ruler: unknown };
    };
    // the browser's widths: 8 a letter, prose held to 55 % where no row lifts its cap
    Object.assign(card.head, {
      ruler: {
        width: (cls: string, text: string) =>
          cls.includes('fv-row__value--text') && !cls.startsWith('dv-rows > ')
            ? Math.round(text.length * 8 * 0.55)
            : text.length * 8,
        pill: (_cls: string, text: string, sides: number) => text.length * 8 + sides,
        clear() {},
      },
    });
    card.setConfig({
      type: 'custom:fluvy-light-card',
      entity: 'light.sofa_strip',
      rows: ['binary_sensor.porch_motion'],
    });
    const motion = state('binary_sensor.porch_motion', 'off', { device_class: 'motion' });
    card.hass = {
      ...house([...STATES, motion]),
      formatEntityState: (s: { entity_id?: string; state: string }) =>
        s.entity_id === motion.entity_id ? 'Niet gedetecteerd' : s.state,
    } as unknown as HomeAssistant;
    card.width = 154;
    document.body.append(card);
    await card.updateComplete;
    const row = card.shadowRoot!.querySelector('.dv-rows .fv-row')!;
    expect(row.classList.contains('fv-row--stack')).toBe(true);
    expect(row.querySelector('.fv-row__value')?.textContent?.trim()).toBe('Niet gedetecteerd');
  });
});

describe('a card’s declared height with its rows (#262)', () => {
  const config = (more: Record<string, unknown> = {}): LovelaceCardConfig => ({
    type: 'custom:x',
    ...more,
  });
  const HEIGHTS: ReadonlyArray<readonly [string, (config: LovelaceCardConfig) => number]> = [
    ['light', (c) => lightHeight(c)],
    ['fan', (c) => fanHeight(c)],
    ['cover', (c) => coverHeight(c)],
    ['thermostat', (c) => thermostatHeight({ entity: 'climate.x', ...c })],
    ['media', (c) => mediaHeight(c)],
    ['humidity', (c) => FluvyHumidityCard.layoutHeight({ entity: 'sensor.x', ...c })],
  ];

  it('adds 16 and a row of 60 each, from its config alone, none while they are hidden', () => {
    for (const [name, height] of HEIGHTS) {
      const bare = height(config());
      expect(height(config({ rows: [] })), name).toBe(bare);
      expect(height(config({ rows: ['sensor.a'] })), name).toBe(bare + 76);
      expect(height(config({ rows: ['sensor.a', 'switch.b', { entity: 'select.c' }] })), name).toBe(
        bare + 196,
      );
      expect(height(config({ rows: ['sensor.a'], show_rows: false })), name).toBe(bare);
    }
  });

  it('adds none to the compact light, fan and cover, nor to the mini player; a bulb that only switches adds them under its head', () => {
    expect(lightHeight(config({ variant: 'compact', rows: ['sensor.a'] }))).toBe(188);
    expect(fanHeight(config({ variant: 'compact', rows: ['sensor.a'] }))).toBe(144);
    expect(coverHeight(config({ variant: 'compact', rows: ['sensor.a'] }))).toBe(144);
    expect(mediaHeight(config({ variant: 'mini', rows: ['sensor.a'] }))).toBe(76);
    expect(mediaHeight(config({ variant: 'hero', rows: ['sensor.a'] }))).toBe(676);
    const switches = { colour: false, temperature: false, dimmable: false };
    expect(lightHeight(config({ rows: ['sensor.a', 'sensor.b'] }), switches)).toBe(84 + 136);
  });
});

describe('the rows in a card’s editor (#262)', () => {
  /** A card's class, as its editor is asked of it. */
  interface Edited {
    readonly name: string;
    getConfigElement(): Promise<HTMLElement>;
    editor(): Promise<CardEditor>;
  }
  const CLASSES: ReadonlyArray<readonly [Edited, string, string?]> = [
    [FluvyLightCard, 'light.sofa_strip', 'compact'],
    [FluvyFanCard, 'fan.bedroom', 'compact'],
    [FluvyCoverCard, 'cover.blind', 'compact'],
    [FluvyThermostatCard, 'climate.hallway'],
    [FluvyMediaCard, 'media_player.soundbar', 'mini'],
    [FluvyHumidityCard, 'sensor.bathroom_humidity'],
  ];
  const change = (value: Record<string, unknown>) =>
    new CustomEvent('value-changed', { detail: { value } });
  type Adds = { onAdd(list: RowsListSpec, event: CustomEvent): void };

  it('lists them item by item where the card draws them, and writes the list as it grows', async () => {
    for (const [card, entity, bare] of CLASSES) {
      const editor = await drawEditor(await card.getConfigElement(), {
        type: 'custom:x',
        entity,
      });
      expect(listTitles(editor), card.name).toContain('Rows');
      expect(shownNames(cardForm(editor).schema), card.name).toContain('show_rows');
      const list = (await card.editor()).lists?.find((one) => one.key === 'rows');
      expect(list?.keys, card.name).toContain('options');
      const next = nextConfig(editor);
      (editor as unknown as Adds).onAdd(list!, change({ entity: 'select.strip_scene' }));
      expect((await next)['rows'], card.name).toEqual(['select.strip_scene']);
      editor.remove();
      if (!bare) continue;
      const small = await drawEditor(await card.getConfigElement(), {
        type: 'custom:x',
        entity,
        variant: bare,
      });
      expect(listTitles(small), card.name).not.toContain('Rows');
      expect(shownNames(cardForm(small).schema), card.name).not.toContain('show_rows');
      small.remove();
    }
  });
});
