// @vitest-environment happy-dom
import {
  setTintDefaults,
  type HaFormSchemaItem,
  type HassConnection,
  type HassEntity,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { LIT_FLOOR } from '@fluvy/tokens/runtime';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { catalogue, familiesDefined } from '../index.js';
import type { Card } from './base.js';
import { visibleFields } from './form.js';
import { itemHelper } from './rows-editor.js';
import type { ThresholdItem } from './thresholds.js';

/*
 * A reading past a threshold (1.22, #204): the Gauge, the Sensor card, a Readouts row, a stat tile and a tile take the
 * colour of the band it is in, its words and its icon, and a card asked for it (`tint`) wears it; a card that names
 * none draws as 1.21 did. A value may be a figure, an entity or a template; one that cannot be read is left out.
 */

beforeAll(() => familiesDefined);
afterEach(() => {
  document.body.replaceChildren();
  setTintDefaults({ tint: 'off', style: 'wash' });
});

const STAMP = '2026-09-17T19:00:00+00:00';
const sensor = (
  entity_id: string,
  state: string,
  unit: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: 'Grid voltage', unit_of_measurement: unit, ...attributes },
  last_changed: STAMP,
  last_updated: STAMP,
  context: { id: '', parent_id: null, user_id: null },
});

/** What the socket answers each template with; one it does not know is refused, as Home Assistant would a bad one. */
const ANSWERS: Record<string, string> = {
  "{{ states('sensor.max_voltage') | float(0) }}": '250',
};
const socket = {
  subscribeMessage: (callback: (event: unknown) => void, message: Record<string, unknown>) => {
    const answer = ANSWERS[String(message['template'])];
    if (answer === undefined) return Promise.reject(new Error('TemplateError'));
    setTimeout(() => callback({ result: answer }), 5);
    return Promise.resolve(() => undefined);
  },
} as unknown as HassConnection;

const house = (...states: HassEntity[]): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' }, time_zone: 'UTC' },
    states: Object.fromEntries(states.map((state) => [state.entity_id, state])),
    entities: {},
    devices: {},
    areas: {},
    themes: { darkMode: false },
    connection: socket,
    localize: (key: string) => key,
    formatEntityState: (state: { state: string }) => state.state,
    callWS: async () => ({}),
    callService: async () => undefined,
  }) as unknown as HomeAssistant;

type Drawn = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** A card of `tag` with `config`, drawn in `hass` at 360. */
const draw = async (tag: string, config: object, hass: HomeAssistant): Promise<Drawn> => {
  const card = document.createElement(tag) as Drawn;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  return card;
};
const root = (card: Drawn): Element => card.shadowRoot!.querySelector('[data-card]')!;
/** Lets a template's answer land and the card draw it. */
const settle = async (card: Drawn): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await card.updateComplete;
};

const VOLTAGE: ThresholdItem[] = [
  { value: 230, tone: 'warning', label: 'High' },
  { value: 250, tone: 'danger', label: 'Too high', icon: 'mdi:flash-alert' },
];
const GAUGE = 'fluvy-gauge-card';
const gauge = (state: string, more: object = {}) =>
  draw(
    GAUGE,
    { entity: 'sensor.grid_voltage', min: 200, max: 260, thresholds: VOLTAGE, ...more },
    house(sensor('sensor.grid_voltage', state, 'V', { device_class: 'voltage' })),
  );
const dial = (card: Drawn) =>
  card.shadowRoot!.querySelector('fluvy-dial') as HTMLElement & { tone: string };
const badge = (card: Drawn): string =>
  card.shadowRoot!.querySelector('.fv-badge')?.textContent?.trim() ?? '';
const circle = (card: Drawn): string =>
  [...(card.shadowRoot!.querySelector('.fv-card__head > .fv-ico')?.classList ?? [])].join(' ');

describe('a gauge past a threshold: the reporter’s grid voltage', () => {
  it('draws as 1.21 did while the reading is past none, and where the card names none', async () => {
    for (const card of [await gauge('224'), await gauge('241', { thresholds: undefined })]) {
      expect(dial(card).tone).toBe('solar');
      expect(dial(card).hasAttribute('data-ink')).toBe(false);
      expect(root(card).getAttribute('data-surface')).toBeNull();
      expect(root(card).classList.contains('fv-tint')).toBe(false);
    }
  });

  it('the whole dial in the band’s tone, its figure in its ink, its circle and its badge saying it', async () => {
    const warm = await gauge('241');
    expect(dial(warm).tone).toBe('warning');
    expect(dial(warm).getAttribute('data-ink')).toBe('warning');
    expect(circle(warm)).toContain('fv-ico--warning');
    expect(badge(warm)).toBe('High');
    const hot = await gauge('252');
    expect(dial(hot).tone).toBe('danger');
    expect(badge(hot)).toBe('Too high');
    // the person's own badge stays theirs
    expect(badge(await gauge('252', { badge: 'Mains' }))).toBe('Mains');
  });

  it('the bar and the signed ring too', async () => {
    const bar = await gauge('252', { variant: 'bar' });
    expect(bar.shadowRoot!.querySelector('.fv-bar__fill')?.classList).toContain('fv-bar--danger');
    expect(bar.shadowRoot!.querySelector('.so-top .fv-readout')?.getAttribute('data-ink')).toBe(
      'danger',
    );
    const signed = await gauge('241', { variant: 'signed', min: -300, max: 300 });
    expect(signed.shadowRoot!.querySelector('.en-gauge')?.classList).toContain('fv-tone--warning');
    expect(signed.shadowRoot!.querySelector('.en-gauge__value')?.getAttribute('data-ink')).toBe(
      'warning',
    );
  });

  it('wears the band beyond its marks where asked: a wash, or its edge, and nothing past none', async () => {
    const LIT = `-${Math.round(LIT_FLOOR * 100)}`;
    const wash = root(await gauge('252', { tint: 'on' }));
    expect(wash.classList).toContain('is-glow');
    expect(wash.getAttribute('data-surface')).toBe(`danger${LIT}`);
    const edge = root(await gauge('252', { tint: 'on', tint_style: 'edge' }));
    expect(edge.getAttribute('data-edge')).toBe('danger');
    expect(edge.getAttribute('data-surface')).toBeNull();
    // `always` says the same; past none, the card eases back to its own surface
    expect(root(await gauge('252', { tint: 'always' })).getAttribute('data-surface')).toBe(
      `danger${LIT}`,
    );
    const calm = root(await gauge('224', { tint: 'on' }));
    expect(calm.classList).toContain('fv-tint');
    expect(calm.getAttribute('data-surface')).toBeNull();
    // the devices' house default is theirs: a reading's card says its own
    setTintDefaults({ tint: 'always', style: 'edge' });
    expect(root(await gauge('252')).getAttribute('data-edge')).toBeNull();
  });

  it('a colour of the person’s own is the accent inside it', async () => {
    const card = await gauge('241', { thresholds: [{ value: 230, color: '#8844ff' }] });
    expect(root(card).getAttribute('data-accent')).toBeTruthy();
    expect(dial(card).tone).toBe('accent');
  });

  it('a value read from an entity, live, and from a template; one that fails is left out', async () => {
    const limit = sensor('sensor.max_voltage', '245', 'V');
    const reading = sensor('sensor.grid_voltage', '246', 'V', { device_class: 'voltage' });
    const card = await draw(
      GAUGE,
      {
        entity: 'sensor.grid_voltage',
        min: 200,
        max: 260,
        thresholds: [
          { value: 230, tone: 'warning' },
          { value: 'sensor.max_voltage', tone: 'danger' },
        ],
      },
      house(reading, limit),
    );
    expect(dial(card).tone).toBe('danger');
    // the limit rises past the reading: the card draws again, back in the warning
    card.hass = house(reading, { ...limit, state: '248' });
    await card.updateComplete;
    expect(dial(card).tone).toBe('warning');

    const templated = await draw(
      GAUGE,
      {
        entity: 'sensor.grid_voltage',
        min: 200,
        max: 260,
        thresholds: [
          { value: 230, tone: 'warning' },
          { value: "{{ states('sensor.max_voltage') | float(0) }}", tone: 'danger' },
          { value: '{{ broken(', tone: 'ok' },
        ],
      },
      house(sensor('sensor.grid_voltage', '252', 'V')),
    );
    // until Home Assistant answers, the template is left out: the warning, never a colour without ground
    expect(dial(templated).tone).toBe('warning');
    await settle(templated);
    expect(dial(templated).tone).toBe('danger');
  });
});

describe('the other cards past a threshold', () => {
  const BATTERY: ThresholdItem[] = [
    { value: 20, below: true, tone: 'danger', label: 'Low', icon: 'mdi:battery-alert' },
  ];
  const battery = (state: string) =>
    sensor('sensor.phone_battery', state, '%', {
      friendly_name: 'Phone',
      device_class: 'battery',
    });

  it('the sensor tile: its figure, its circle and its spark, its words after its name', async () => {
    const card = await draw(
      'fluvy-sensor-card',
      { entity: 'sensor.phone_battery', variant: 'tile', thresholds: BATTERY },
      house(battery('12')),
    );
    const tile = root(card);
    expect(tile.querySelector('.fv-readout')?.getAttribute('data-ink')).toBe('danger');
    expect(tile.querySelector('.fv-readout__label')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Phone · Low',
    );
    expect(tile.querySelector('.fv-tile__head > .fv-ico')?.classList).toContain('fv-ico--danger');
    const calm = await draw(
      'fluvy-sensor-card',
      { entity: 'sensor.phone_battery', variant: 'tile', thresholds: BATTERY },
      house(battery('64')),
    );
    expect(root(calm).querySelector('[data-ink]')).toBeNull();
  });

  it('the sensor chart: its circle, and its words lead its line', async () => {
    const card = await draw(
      'fluvy-sensor-card',
      { entity: 'sensor.grid_voltage', thresholds: VOLTAGE },
      house(sensor('sensor.grid_voltage', '241', 'V', { device_class: 'voltage' })),
    );
    expect(card.shadowRoot!.querySelector('.fv-card__sub')?.textContent).toMatch(/^High · /);
    expect(circle(card)).toContain('fv-ico--warning');
  });

  it('a Readouts row: its figure in the band’s ink, its icon and words beside its name, said to a reader', async () => {
    const card = await draw(
      'fluvy-readouts-card',
      {
        rows: [{ entity: 'sensor.phone_battery', thresholds: BATTERY }, 'sensor.grid_voltage'],
      },
      house(battery('12'), sensor('sensor.grid_voltage', '241', 'V')),
    );
    const [low, plain] = [...card.shadowRoot!.querySelectorAll('.hm-stat')];
    expect(low?.getAttribute('data-ink')).toBe('danger');
    expect(low?.querySelector('.fv-banded__icon')).not.toBeNull();
    expect(low?.querySelector('.fv-banded__words')?.textContent).toBe(' · Low');
    expect(low?.getAttribute('aria-label')).toBe('Phone: 12 %, Low');
    expect(plain?.hasAttribute('data-ink')).toBe(false);
    expect(plain?.querySelector('.fv-banded')).toBeNull();
  });

  it('a stat tile: its figure and glyph, and filled in the band where the card asks', async () => {
    const config = { tiles: [{ entity: 'sensor.phone_battery', thresholds: BATTERY }] };
    const tile = async (more: object) =>
      (
        await draw('fluvy-stat-tiles-card', { ...config, ...more }, house(battery('12')))
      ).shadowRoot!.querySelector('.fv-option')!;
    const marked = await tile({});
    expect(marked.getAttribute('data-ink')).toBe('danger');
    expect(marked.classList.contains('is-active')).toBe(false);
    expect(marked.querySelector('.fv-banded__words')?.textContent).toBe(' · Low');
    expect((await tile({ tint: 'on' })).classList).toContain('fv-option--danger');
  });

  it('a tile: lit in the band’s tone as a leak’s tile is, its words leading its line', async () => {
    const card = await draw(
      'fluvy-tile-card',
      { entity: 'sensor.grid_voltage', size: 'compact', thresholds: VOLTAGE },
      house(sensor('sensor.grid_voltage', '241', 'V')),
    );
    const tile = root(card);
    expect([...tile.classList]).toEqual(expect.arrayContaining(['fv-tile--warning', 'is-on']));
    expect(tile.querySelector('.fv-tile__state')?.textContent).toMatch(/^High · /);
    const calm = await draw(
      'fluvy-tile-card',
      { entity: 'sensor.grid_voltage', size: 'compact', thresholds: VOLTAGE },
      house(sensor('sensor.grid_voltage', '224', 'V')),
    );
    expect(root(calm).classList.contains('is-on')).toBe(false);
  });
});

describe('the editors (#204)', () => {
  /** Every card's editor whose lists or whose lists' items take thresholds. */
  const editors = async () =>
    Promise.all(
      (await catalogue()).map(async ([tag, element]) => ({
        tag,
        editor: await (element as unknown as typeof Card).editor(),
      })),
    );
  /** The words under each field, by its name, through a form's rows. */
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));

  it('a threshold’s fields say their own words, never the card’s for a field of the same name (the sensor’s `label`)', async () => {
    const taken: string[] = [];
    for (const { tag, editor } of await editors()) {
      const list = editor.lists?.find(({ key }) => key === 'thresholds');
      if (!list) continue;
      taken.push(tag);
      const helper = itemHelper(list, editor.getConfigForm().computeHelper);
      expect(
        Object.fromEntries(
          fields(list.schema).map((field) => [field.name, helper(field, (key) => key)]),
        ),
        tag,
      ).toEqual({
        tone: undefined,
        value: 'A figure, an entity or a template',
        below: 'Off: from the value up',
        color: 'Empty: the colour the card gives it',
        label: undefined,
        icon: undefined,
      });
    }
    expect(taken.sort()).toEqual([
      'fluvy-chart-card',
      'fluvy-compass-card',
      GAUGE,
      'fluvy-sensor-card',
      'fluvy-tile-card',
    ]);
  });

  it('inside a row, a threshold’s fields are named as a threshold’s and say nothing of the card’s', async () => {
    const taken: string[] = [];
    for (const { tag, editor } of await editors())
      for (const list of editor.lists ?? []) {
        const inner = fields(list.schema).find(({ name }) => name === 'thresholds');
        if (!inner) continue;
        taken.push(`${tag} ${list.key}`);
        const own = (
          inner.selector as {
            object: { fields: Record<string, { label: string; helper?: string }> };
          }
        ).object.fields;
        expect(
          Object.fromEntries(Object.entries(own).map(([name, field]) => [name, field.label])),
          tag,
        ).toEqual({
          tone: 'Tone',
          value: 'Value',
          below: 'Under the value',
          color: 'Colour',
          label: 'Label',
          icon: 'Icon',
        });
        for (const field of Object.values(own)) expect(field.helper).toBeUndefined();
      }
    expect(taken.sort()).toEqual([
      'fluvy-chart-card series',
      'fluvy-readouts-card rows',
      'fluvy-room-card tiles',
      'fluvy-stat-tiles-card rows',
      'fluvy-stat-tiles-card tiles',
      'fluvy-tiles-card tiles',
    ]);
  });

  it('a row’s thresholds in Home Assistant’s list of objects, read and written back as they are', async () => {
    const [{ lists }, { entryOf, itemOf }] = await Promise.all([
      import('../tiles/tiles-editor.js'),
      import('./rows-editor.js'),
    ]);
    const list = lists[0]!;
    const raw = {
      entity: 'sensor.grid_voltage',
      thresholds: [
        { value: 230, tone: 'warning' },
        { value: 'sensor.max_voltage', below: true, color: '#ff8800', label: 'High' },
      ],
    };
    const item = itemOf(raw, list)!;
    expect(item['thresholds']).toEqual(raw.thresholds);
    expect(entryOf(item, list)).toEqual(raw);
  });

  it('a gauge’s and a sensor’s: the list, and over it the tint while one is named, its style while it shows', async () => {
    for (const tag of [GAUGE, 'fluvy-sensor-card']) {
      const editor = await (
        customElements.get(tag) as unknown as {
          editor(): Promise<{
            lists?: ReadonlyArray<{ key: string; fields?: readonly string[] }>;
            getConfigForm(): { schema: readonly HaFormSchemaItem[] };
          }>;
        }
      ).editor();
      const list = editor.lists?.find(({ key }) => key === 'thresholds');
      expect(list?.fields, tag).toEqual(['tint', 'tint_style']);
      const shown = (data: Record<string, unknown>) =>
        JSON.stringify(visibleFields(editor.getConfigForm().schema, data)).match(
          /"name":"tint(_style)?"/g,
        ) ?? [];
      expect(shown({ entity: 'sensor.x' })).toEqual([]);
      expect(shown({ thresholds: [{ value: 1, tone: 'ok' }], tint: 'off' })).toEqual([
        '"name":"tint"',
      ]);
      expect(shown({ thresholds: [{ value: 1, tone: 'ok' }], tint: 'on' })).toHaveLength(2);
    }
  });
});
