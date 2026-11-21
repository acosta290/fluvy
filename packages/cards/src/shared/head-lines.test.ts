// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import { nameWidth, type HeadFit } from '../energy/head.js';
import { expanderHeight } from '../expander-family.js';
import { houseHeightOf } from '../house-heights.js';
import { catalogue } from '../index.js';
import { visibleFields } from './form.js';
import { HEAD_LINE, headLines, hidesName } from './head-lines.js';

/*
 * A head's name in two lines (`name_lines: 2`, #191): one rule for what a card draws, what it declares and what its
 * editor offers — a head card's head a line taller whatever its name says, where its layout draws a head that names
 * it; nothing anywhere else, and nothing on a card whose `name_lines` is its tiles'.
 */

const CATALOGUE = await catalogue();
const config = (card: string, more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: `custom:fluvy-${card}-card`,
  name_lines: 2,
  ...more,
});

describe('a head’s name in two lines (#191)', () => {
  it('adds a line to a head card’s head where its config asks for two, in YAML’s figure or the editor’s word', () => {
    for (const card of ['energy', 'lock', 'light', 'thermostat', 'sensor', 'gauge', 'expander'])
      expect(headLines(config(card)), card).toBe(HEAD_LINE);
    expect(headLines(config('lock', { name_lines: '2' }))).toBe(24);
    expect(headLines(config('lock', { name_lines: 1 }))).toBe(0);
    expect(headLines({ type: 'custom:fluvy-lock-card' })).toBe(0);
    // a card of another maker is its own to count
    expect(headLines({ type: 'custom:mushroom-entity-card', name_lines: 2 })).toBe(0);
  });

  it('adds none where the name is a tile’s, or the card draws no head', () => {
    for (const card of ['tile', 'tiles', 'template', 'lights', 'room', 'scene', 'clock', 'media'])
      expect(headLines(config(card)), card).toBe(0);
  });

  it('adds none where a head card’s layout draws no head that names it, its default too', () => {
    const none: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['alerts', {}],
      ['alerts', { variant: 'banner' }],
      ['weather', {}],
      ['weather', { variant: 'compact', show_name: false }],
      ['chart', { variant: 'tile' }],
      ['chart', { show_head: false }],
      ['history-bars', { show_head: false }],
      ['sensor', { variant: 'tile' }],
      ['web', { variant: 'bare' }],
      ['printer', { variant: 'row' }],
      ['vehicle', { variant: 'mini' }],
      ['appliances', { variant: 'cards' }],
      // a kettle's card is a row where it asks for no layout
      ['appliance', { kind: 'kettle' }],
    ];
    for (const [card, more] of none) expect(headLines(config(card, more)), card).toBe(0);
    const some: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['alerts', { variant: 'rows' }],
      ['weather', { variant: 'compact' }],
      ['chart', { variant: 'compact' }],
      ['web', {}],
      ['appliance', { kind: 'washer' }],
      ['appliance', { kind: 'kettle', variant: 'compact' }],
    ];
    for (const [card, more] of some) expect(headLines(config(card, more)), card).toBe(24);
  });

  it('is declared where the automatic dashboard reads a card’s height, and for a card the Expander holds', () => {
    const lock = { type: 'custom:fluvy-lock-card', entity: 'lock.front_door', variant: 'compact' };
    expect(houseHeightOf({ ...lock, name_lines: 2 }, -1)).toBe(houseHeightOf(lock, -1) + 24);
    const hass = { states: {}, entities: {}, devices: {}, areas: {} } as unknown as HomeAssistant;
    expect(houseHeightOf({ ...lock, name_lines: 2 }, -1, hass)).toBe(
      houseHeightOf(lock, -1, hass) + 24,
    );
    // the tiles' own lines are their card's to count, once
    const tiles = { type: 'custom:fluvy-tiles-card', entities: ['light.a', 'light.b'] };
    expect(houseHeightOf({ ...tiles, name_lines: 2 }, -1)).toBe(houseHeightOf(tiles, -1) + 12);
    // the cards standing as an Expander's head, each by what it declares
    const held = (name_lines?: number) => ({
      type: 'custom:fluvy-expander-card',
      head_cards: [{ ...lock, ...(name_lines ? { name_lines } : {}) }],
    });
    expect(expanderHeight(held(2))).toBe(expanderHeight(held()) + 24);
  });

  it('marks the host of a card whose head takes two lines, and no other', async () => {
    const drawn = async (tag: string, more: Record<string, unknown>) => {
      const el = document.createElement(tag) as HTMLElement & {
        setConfig(config: LovelaceCardConfig): void;
        hass: HomeAssistant;
        updateComplete: Promise<boolean>;
      };
      el.setConfig({ type: `custom:${tag}`, ...more });
      el.hass = { states: {}, entities: {}, devices: {}, areas: {}, language: 'en' } as never;
      document.body.append(el);
      await el.updateComplete;
      const marked = el.hasAttribute('name-lines');
      el.remove();
      return marked;
    };
    expect(await drawn('fluvy-lock-card', { entity: 'lock.a', name_lines: 2 })).toBe(true);
    expect(await drawn('fluvy-lock-card', { entity: 'lock.a' })).toBe(false);
    // the room lights' name lines are their tiles'
    expect(await drawn('fluvy-lights-card', { lights: ['light.a'], name_lines: 2 })).toBe(false);
  });

  it('needs the room of the wider of its two lines where it breaks best: between words, between Han characters', () => {
    // ten pixels a character, a space too
    const width = (text: string): number => text.length * 10;
    expect(nameWidth('Inverter E1 North MPPT total power', 1, width)).toBe(340);
    // "Inverter E1 North" over "MPPT total power"
    expect(nameWidth('Inverter E1 North MPPT total power', 2, width)).toBe(170);
    // one word breaks nowhere: its whole width
    expect(nameWidth('Kühlschrankthermometer', 2, width)).toBe(220);
    // Chinese breaks between any two characters, a word of Latin letters in it as a word
    expect(nameWidth('逆变器E1北MPPT总功率W', 2, width)).toBe(80);
    // the reporter's: "逆变器 E1 北" over "MPPT 总功率W"
    expect(nameWidth('逆变器 E1 北 MPPT 总功率W', 2, width)).toBe(90);
  });
});

/** Every card's editor form, as the base reads it. */
const forms = await Promise.all(
  CATALOGUE.map(async ([tag, element]) => ({
    tag,
    form: (
      await (element as unknown as { editor(): Promise<{ getConfigForm(): never }> }).editor()
    ).getConfigForm() as { schema: readonly Record<string, unknown>[] },
  })),
);

describe('the editors (#191)', () => {
  type Field = { name?: string; schema?: Field[] };
  const names = (schema: readonly Field[]): string[] =>
    schema.flatMap((item) => (item.schema ? names(item.schema) : item.name ? [item.name] : []));
  /** The rows a field stands in with its neighbours. */
  const rows = (schema: readonly Field[]): string[][] =>
    schema.flatMap((item) =>
      item.schema ? [names(item.schema), ...rows(item.schema)] : item.name ? [[item.name]] : [],
    );

  it.each(forms)(
    '$tag: offers its name’s lines beside its circle wherever it offers its circle',
    ({ tag, form }) => {
      const shown = names(form.schema as Field[]);
      if (!shown.includes('show_icon')) return;
      expect(shown).toContain('name_lines');
      // a room's and its lights' are their tiles', on a row of their own
      if (tag === 'fluvy-lights-card' || tag === 'fluvy-room-card') return;
      // the badge's switch between them where the head carries a badge of its own (#203)
      expect(rows(form.schema as Field[])).toContainEqual(
        shown.includes('show_badge')
          ? ['show_icon', 'show_badge', 'name_lines']
          : ['show_icon', 'name_lines'],
      );
    },
  );

  it('offers them only where the layout draws a head that names the card', () => {
    const offered = (tag: string, data: Record<string, unknown>): boolean => {
      const form = forms.find((f) => f.tag === tag)!.form;
      return names(
        visibleFields(form.schema as never, { type: `custom:${tag}`, ...data }) as Field[],
      ).includes('name_lines');
    };
    expect(offered('fluvy-alerts-card', {})).toBe(false);
    expect(offered('fluvy-alerts-card', { variant: 'rows' })).toBe(true);
    expect(offered('fluvy-sensor-card', { variant: 'tile' })).toBe(false);
    expect(offered('fluvy-sensor-card', {})).toBe(true);
    expect(offered('fluvy-weather-card', {})).toBe(false);
    expect(offered('fluvy-weather-card', { variant: 'compact' })).toBe(true);
    expect(offered('fluvy-printer-card', { variant: 'row' })).toBe(false);
    expect(offered('fluvy-lock-card', {})).toBe(true);
  });
});

/*
 * A head's name hidden (`name_lines: 0`, #237): the same heads, the same rule of where it acts; the head keeps its 44
 * (declared and drawn), its name needs no room, and the editor offers it on a head's dropdown alone.
 */
describe('a head’s name hidden (#237)', () => {
  it('hides it where a head names the card, in YAML’s figure or the editor’s word, and nowhere else', () => {
    for (const card of ['energy', 'lock', 'light', 'thermostat', 'sensor', 'gauge', 'entities'])
      expect(hidesName(config(card, { name_lines: 0 })), card).toBe(true);
    expect(hidesName(config('lock', { name_lines: '0' }))).toBe(true);
    expect(hidesName(config('lock', { name_lines: 1 }))).toBe(false);
    expect(hidesName({ type: 'custom:fluvy-lock-card' })).toBe(false);
    for (const card of ['tile', 'tiles', 'template', 'lights', 'room'])
      expect(hidesName(config(card, { name_lines: 0 })), card).toBe(false);
    expect(hidesName(config('chart', { name_lines: 0, show_head: false }))).toBe(false);
  });

  it('keeps the head’s height: one line’s, declared wherever a card’s height is read', () => {
    const lock = { type: 'custom:fluvy-lock-card', entity: 'lock.front_door', variant: 'compact' };
    expect(headLines({ ...lock, name_lines: 0 })).toBe(0);
    expect(houseHeightOf({ ...lock, name_lines: 0 }, -1)).toBe(houseHeightOf(lock, -1));
    const entities = { type: 'custom:fluvy-entities-card', title: 'Rooms', rows: ['lock.a'] };
    expect(houseHeightOf({ ...entities, name_lines: 0 }, -1)).toBe(houseHeightOf(entities, -1));
  });

  it('marks the host with none, two or nothing, as the head’s sheet reads them', async () => {
    const drawn = async (tag: string, more: Record<string, unknown>) => {
      const el = document.createElement(tag) as HTMLElement & {
        setConfig(config: LovelaceCardConfig): void;
        hass: HomeAssistant;
        updateComplete: Promise<boolean>;
      };
      el.setConfig({ type: `custom:${tag}`, ...more });
      el.hass = { states: {}, entities: {}, devices: {}, areas: {}, language: 'en' } as never;
      document.body.append(el);
      await el.updateComplete;
      const marked = el.getAttribute('name-lines');
      el.remove();
      return marked;
    };
    expect(await drawn('fluvy-lock-card', { entity: 'lock.a', name_lines: 0 })).toBe('0');
    expect(await drawn('fluvy-lock-card', { entity: 'lock.a', name_lines: 2 })).toBe('2');
    expect(await drawn('fluvy-lock-card', { entity: 'lock.a', name_lines: 1 })).toBeNull();
    expect(await drawn('fluvy-lights-card', { lights: ['light.a'], name_lines: 0 })).toBeNull();
  });

  it('needs no room for the name: the badge and the circle keep theirs beside a long one', async () => {
    expect(nameWidth('Inverter E1 North MPPT total power', 0, (text) => text.length * 10)).toBe(0);
    const head = async (name_lines: number) => {
      const el = document.createElement('fluvy-entities-card') as HTMLElement & {
        setConfig(config: LovelaceCardConfig): void;
        hass: HomeAssistant;
        width: number;
        updateComplete: Promise<boolean>;
        head: HeadFit;
      };
      vi.spyOn(el.head.ruler, 'width').mockImplementation((_cls, text) => text.length * 8);
      el.width = 212;
      el.setConfig({
        type: 'custom:fluvy-entities-card',
        title: 'Living room and the garden doors',
        show_count: true,
        rows: ['switch.a'],
        name_lines,
      });
      el.hass = {
        states: { 'switch.a': { entity_id: 'switch.a', state: 'on', attributes: {} } },
        entities: {},
        devices: {},
        areas: {},
        language: 'en',
      } as never;
      document.body.append(el);
      await el.updateComplete;
      const root = el.shadowRoot!;
      const kept = {
        badge: root.querySelector('.fv-card__head .fv-badge') !== null,
        circle: root.querySelector('.fv-card__head .fv-ico') !== null,
        // read aloud still
        title: root.querySelector('.fv-card__head .fv-card__title')?.textContent?.trim(),
      };
      el.remove();
      return kept;
    };
    expect(await head(1)).toMatchObject({ badge: false });
    expect(await head(0)).toEqual({
      badge: true,
      circle: true,
      title: 'Living room and the garden doors',
    });
  });

  it('is offered on a head’s dropdown, never on a tile’s', () => {
    type Field = {
      name?: string;
      schema?: Field[];
      selector?: { select?: { options: { value: string }[] } };
    };
    const field = (schema: readonly Field[]): Field | undefined =>
      schema
        .flatMap((item) => (item.schema ? item.schema : [item]))
        .find((item) => item.name === 'name_lines');
    const values = (tag: string) =>
      field(
        forms.find((f) => f.tag === tag)!.form.schema as Field[],
      )?.selector?.select?.options.map((option) => option.value);
    expect(values('fluvy-lock-card')).toEqual(['0', '1', '2']);
    expect(values('fluvy-entities-card')).toEqual(['0', '1', '2']);
    expect(values('fluvy-tile-card')).toEqual(['1', '2']);
  });
});
