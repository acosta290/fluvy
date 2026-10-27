// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { FluvyLightCard, lightHeight, type BulbDoes, type LightCardConfig } from './light-card.js';
import * as lightEditor from './light-editor.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);

const list = lightEditor.lists[0]!;
const names = (schema: ReadonlyArray<{ name: string; schema?: readonly unknown[] }>): string[] =>
  schema.flatMap((item) =>
    item.schema ? names(item.schema as ReadonlyArray<{ name: string }>) : [item.name],
  );

/** A house with one bulb, reporting the colour modes given. */
const house = (modes: readonly string[]): HomeAssistant =>
  ({
    states: {
      'light.lamp': {
        entity_id: 'light.lamp',
        state: 'on',
        attributes: { supported_color_modes: modes },
      },
    },
  }) as unknown as HomeAssistant;

describe('the light card’s quick colours in the editor', () => {
  it('edits the list row by row: a colour first, the well and a name', () => {
    expect(list.key).toBe('colors');
    expect(list.idKey).toBe('color');
    expect(names(list.schema)).toEqual(['color', 'name', 'rgb']);
    expect(list.picker?.name).toBe('color');
    const options = (
      list.picker?.selector?.['select'] as { options: { value: string; label: string }[] }
    ).options;
    expect(options.map((o) => o.value)).toEqual([
      'warm',
      'cool',
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'purple',
      'pink',
      'picker',
      'custom',
    ]);
    expect(options.at(-1)?.label).toBe('Custom colour');
  });

  it('shows the well only while a row is Custom, and the same form for the same answer', () => {
    expect(names(list.schemaOf!({ color: 'custom' }))).toEqual(['color', 'name', 'rgb']);
    expect(names(list.schemaOf!({ color: 'warm' }))).toEqual(['color', 'name']);
    expect(names(list.schemaOf!({ color: 'blue', rgb: [1, 2, 3] }))).toEqual(['color', 'name']);
    expect(list.schemaOf!({ color: 'custom' })).toBe(
      list.schemaOf!({ color: 'custom', name: 'x' }),
    );
    expect(list.schemaOf!({ color: 'red' })).toBe(list.schemaOf!({ color: 'amber' }));
    expect(list.schemaOf!({ color: 'custom' })).toBe(list.schema);
  });

  it('says what the fields mean: how to pick a colour, what the name is for', () => {
    const t = (key: string): string => key;
    expect(list.computeHelper?.({ name: 'color' }, t)).toMatch(/Custom colour/);
    expect(list.computeHelper?.({ name: 'name' }, t)).toMatch(/round/);
    // the well carries no floating label (Home Assistant's colour input paints its whole box): its word is the helper
    expect(list.computeLabel?.({ name: 'rgb' }, t)).toBe('');
    expect(list.computeHelper?.({ name: 'rgb' }, t)).toMatch(/colour/i);
  });

  it('shows the bulb’s own default six as rows: whites first with a temperature, colours alone without', () => {
    const colours = (hass: HomeAssistant | undefined): unknown =>
      lightEditor.defaults({ type: 'custom:fluvy-light-card', entity: 'light.lamp' }, hass)[
        'colors'
      ];
    expect(colours(house(['hs', 'color_temp']))).toEqual([
      'warm',
      'cool',
      'red',
      'orange',
      'green',
      'blue',
    ]);
    expect(colours(house(['rgb']))).toEqual(['red', 'orange', 'green', 'blue', 'purple', 'pink']);
    expect(colours(undefined)).toEqual(['red', 'orange', 'green', 'blue', 'purple', 'pink']);
  });
});

describe('the light card’s height follows the count of its quick colours', () => {
  const height = (colors?: LightCardConfig['colors']): number =>
    FluvyLightCard.layoutHeight({
      type: 'custom:fluvy-light-card',
      entity: 'light.lamp',
      ...(colors ? { colors } : {}),
    });
  const six = height();

  it('counts six by default, a named entry as one, and wraps by six a row', () => {
    expect(six).toBe(268 + 100 + 8 + 52);
    expect(height(['warm', { color: '#ff2d55', name: 'Lila' }, [0, 128, 128]])).toBe(six); // one short row
    expect(height(Array.from({ length: 12 }, () => 'red'))).toBe(six + 52); // two rows
    expect(height(Array.from({ length: 13 }, () => 'red'))).toBe(six + 104); // and a third
  });

  it('draws no row for a list of none, and stays on the 4 px grid', () => {
    expect(height([])).toBe(268 + 100);
    for (const n of [0, 1, 3, 6, 7, 12, 25])
      expect(height(Array.from({ length: n }, () => 'red')) % 4).toBe(0);
  });
});

/*
 * #65: a bulb that only switches (`supported_color_modes: ['onoff']`) is its head alone — the circle, the name, the
 * state line, the switch — in every style, 84 tall, and its editor offers only what the bulb does.
 */
describe('the card of a bulb that only switches (#65)', () => {
  const SWITCH: BulbDoes = { colour: false, temperature: false, dimmable: false };
  const config = (more: Record<string, unknown> = {}): LightCardConfig => ({
    type: 'custom:fluvy-light-card',
    entity: 'light.lamp',
    ...more,
  });
  const STAMP = '2026-10-26T08:00:00+00:00';
  /** A house with one lamp in the state given, with the attributes given (none: a light the house has not described). */
  const house = (state: string, attributes?: Record<string, unknown>): HomeAssistant =>
    ({
      language: 'en',
      locale: { language: 'en', number_format: 'language', time_format: '24' },
      states: {
        'light.lamp': {
          entity_id: 'light.lamp',
          state,
          attributes: { friendly_name: 'Pantry', ...attributes },
          last_changed: STAMP,
          last_updated: STAMP,
        },
      },
      entities: {},
      devices: {},
      areas: {},
      localize: (key: string) => key,
      formatEntityState: (s: { state: string }) => s.state,
      callService: () => Promise.resolve(),
    }) as unknown as HomeAssistant;
  const ONOFF = { supported_color_modes: ['onoff'] };

  type CardElement = HTMLElement & {
    setConfig(config: LovelaceCardConfig): void;
    hass: HomeAssistant;
    updateComplete: Promise<boolean>;
  };
  /** The card drawn for the lamp: its article's classes and what it holds. */
  async function drawn(more: Record<string, unknown>, hass: HomeAssistant) {
    const card = document.createElement('fluvy-light-card') as CardElement;
    card.setConfig(config(more));
    card.hass = hass;
    document.body.append(card);
    await card.updateComplete;
    const root = card.shadowRoot!;
    return {
      classes: [...root.querySelector('article')!.classList],
      rulers: root.querySelectorAll('fluvy-ruler').length,
      level: root.querySelectorAll('.sl-value').length,
      switches: root.querySelectorAll('.fv-switch').length,
    };
  }
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('declares 84 in every style, whatever its config asks', () => {
    for (const variant of ['auto', 'full', 'compact'] as const) {
      expect(lightHeight(config({ variant }), SWITCH)).toBe(84);
      expect(lightHeight(config({ variant, colors: ['red', 'blue'] }), SWITCH)).toBe(84);
    }
    expect(lightHeight(config({ variant: 'compact' }), { ...SWITCH, dimmable: true })).toBe(188);
  });

  it('draws its head alone — no level, no ruler — with its switch, in the full and the compact style alike', async () => {
    const full = await drawn({}, house('on', ONOFF));
    expect(full.classes).toContain('sl-card--switch');
    expect(full.classes).not.toContain('sl-card--compact');
    expect([full.rulers, full.level, full.switches]).toEqual([0, 0, 1]);
    const compact = await drawn({ variant: 'compact' }, house('off', ONOFF));
    expect(compact.classes).toContain('sl-card--switch');
    expect(compact.classes).not.toContain('sl-card--compact');
    expect([compact.rulers, compact.level]).toEqual([0, 0]);
  });

  it('keeps the on/off anatomy while it cannot be read, as a light the house has not described keeps the dimmer’s', async () => {
    const kept = await drawn({}, house('unavailable', ONOFF));
    expect(kept.classes).toContain('sl-card--switch');
    expect(kept.classes).toContain('is-unavailable');
    expect(kept.rulers).toBe(0);
    const gone = await drawn({}, house('unavailable'));
    expect(gone.classes).not.toContain('sl-card--switch');
    expect([gone.rulers, gone.level]).toEqual([1, 1]);
  });

  it('takes two rows of a masonry layout, where a dimmer takes four', () => {
    const card = document.createElement('fluvy-light-card') as CardElement & {
      getCardSize(): number;
    };
    card.setConfig(config());
    card.hass = house('on', ONOFF);
    expect(card.getCardSize()).toBe(2);
    card.hass = house('on', { supported_color_modes: ['brightness'] });
    expect(card.getCardSize()).toBe(4);
  });

  describe('its editor offers what the bulb does', () => {
    const DIMMER = ['variant', 'show_stepper', 'live_update'];
    const WHITE = ['show_temperature', 'temperature_tint'];
    const shown = async (
      hass: HomeAssistant | undefined,
    ): Promise<{ fields: string[]; lists: string[] }> => {
      const editor = await FluvyLightCard.getConfigElement();
      if (hass) (editor as HTMLElement & { hass: HomeAssistant }).hass = hass;
      const drawnEditor = await drawEditor(editor, config());
      return { fields: shownNames(cardForm(drawnEditor).schema), lists: listTitles(drawnEditor) };
    };

    it('a bulb that only switches: none of the dimmer’s, the white’s or the colours’ options, no quick colours', async () => {
      const { fields, lists } = await shown(house('on', ONOFF));
      for (const name of [...DIMMER, ...WHITE, 'show_color', 'light_whites'])
        expect(fields, name).not.toContain(name);
      expect(fields).toContain('tint');
      expect(lists).toEqual([]);
    });

    it('a dimmer: its layout, stepper and live update, nothing of a white or a colour', async () => {
      const { fields, lists } = await shown(house('on', { supported_color_modes: ['brightness'] }));
      for (const name of DIMMER) expect(fields, name).toContain(name);
      for (const name of [...WHITE, 'show_color', 'light_whites'])
        expect(fields, name).not.toContain(name);
      expect(lists).toEqual([]);
    });

    it('a white: the temperature ruler’s options and how whites show, no colours', async () => {
      const { fields, lists } = await shown(house('on', { supported_color_modes: ['color_temp'] }));
      for (const name of [...DIMMER, ...WHITE, 'light_whites'])
        expect(fields, name).toContain(name);
      expect(fields).not.toContain('show_color');
      expect(lists).toEqual([]);
    });

    it('a colour bulb, and a bulb the house has not described: everything', async () => {
      for (const hass of [
        house('on', { supported_color_modes: ['hs', 'color_temp'] }),
        undefined,
      ]) {
        const { fields, lists } = await shown(hass);
        for (const name of [...DIMMER, ...WHITE, 'show_color', 'light_whites'])
          expect(fields, name).toContain(name);
        expect(lists.length).toBe(1);
      }
    });
  });
});
