import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { HaFormSchemaItem, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { drawn, GALLERY, layoutKey } from './gallery.js';
import type { OptionsCard, OptionsEditor } from './options.js';
import { toYaml } from './yaml.js';

// the cards and core read the DOM as they load
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
const { cardOptions, optionsOf, optionsYaml } = await import('./options.js');
const { HOUSE_KEYS, automatic, editorDefaults } =
  await import('../../../packages/cards/src/shared/rows-editor.js');
const { catalogue } = await import('@fluvy/cards');

/** Home Assistant's loader speaks YAML 1.1: a text is read back as it reads it. */
const read = (text: string): unknown => parse(text, { version: '1.1' });

const select = (name: string, options: readonly string[]): HaFormSchemaItem => ({
  name,
  selector: { select: { options: [...options] } },
});
const field = (name: string, kind = 'text'): HaFormSchemaItem => ({
  name,
  selector: { [kind]: {} },
});
const action = (name: string, fallback?: string): HaFormSchemaItem => ({
  name,
  selector: { ui_action: fallback ? { default_action: fallback } : {} },
});

/**
 * A lamp's editor: a layout whose grid has columns, a name on two lines elsewhere, a switch, a window that is the
 * house's, a number's unit, a list drawn with a field of the card's over its items (its field in the form under its
 * second name), another list that acts in the grid alone, colours by state under a key of their own, a line of words,
 * and its actions.
 */
const LAMP: OptionsEditor = {
  lists: [
    {
      key: 'rows',
      alias: 'entities',
      title: 'editor.readouts',
      schema: [field('entity', 'entity')],
      fields: ['row_style'],
    },
    {
      key: 'presets',
      title: 'editor.presets',
      schema: [field('name')],
      when: ({ variant }) => variant === 'grid',
    },
  ],
  defaults: (config, hass) => ({
    variant: 'full',
    // a grid of three across, where the card's other layout would lay two
    columns: config['variant'] === 'grid' ? '3' : '2',
    name_lines: '1',
    show_name: true,
    hours: 12,
    unit: 'auto',
    since: '',
    row_style: 'plain',
    // the lamp's own effect where the house has the lamp
    ...(hass ? { effect: 'rainbow' } : {}),
  }),
  getConfigForm: () => ({
    schema: [
      { ...field('entity', 'entity'), required: true },
      field('name'),
      {
        type: 'grid',
        name: '',
        flatten: true,
        schema: [
          select('variant', ['full', 'grid']),
          { ...select('columns', ['1', '2', '3']), when: ({ variant }) => variant === 'grid' },
          { ...select('name_lines', ['1', '2']), when: ({ variant }) => variant !== 'grid' },
        ],
      },
      field('show_name', 'boolean'),
      field('hours', 'number'),
      select('unit', ['auto', 'W', 'kW']),
      select('since', []),
      { ...select('effect', ['rainbow']), when: (_data, hass) => hass !== undefined },
      field('entities', 'entity'),
      { ...select('row_style', ['plain', 'tinted']), when: ({ rows }) => Array.isArray(rows) },
      {
        type: 'expandable',
        name: '',
        title: 'Colours',
        flatten: true,
        schema: [field('color'), field('card_opacity', 'number')],
      },
      { type: 'expandable', name: 'state_colors', schema: [field('on'), field('off')] },
      { type: 'constant', name: 'note', value: 'A line of words' },
      action('tap_action'),
      action('hold_action', 'more-info'),
    ],
  }),
};

const lamp = (config: Record<string, unknown> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-lamp-card',
  entity: 'light.desk',
  ...config,
});

describe('a card’s options', () => {
  it('writes, of a configuration, what a person has to: no default, no Automatic, no hook of the tests’', () => {
    const { minimal } = optionsOf(
      LAMP,
      lamp({
        name: 'Desk',
        variant: 'full',
        name_lines: 1,
        show_name: false,
        unit: 'auto',
        since: '',
        _now: '2026-09-17T19:50:00Z',
      }),
    );
    expect(minimal).toEqual(lamp({ name: 'Desk', show_name: false }));
    expect(Object.keys(minimal)).toEqual(['type', 'entity', 'name', 'show_name']);
  });

  it('keeps a key of the house’s that the configuration writes, whatever the house says now', () => {
    const { minimal, full, unset } = optionsOf(LAMP, lamp({ hours: 12, card_opacity: 100 }));
    expect(minimal).toEqual(lamp({ hours: 12, card_opacity: 100 }));
    expect(full).toMatchObject({ hours: 12, card_opacity: 100 });
    expect(unset.has('hours') || unset.has('card_opacity')).toBe(false);
  });

  it('leaves a default the house’s entities decide to them: it is not a new card’s in no house', () => {
    const house = { states: {} } as unknown as HomeAssistant;
    const { full, unset } = optionsOf(LAMP, lamp(), house);
    expect(full['effect']).toBe('rainbow');
    expect(unset.has('effect')).toBe(true);
    // written, it is the lamp's whatever the house says, and stays
    const pinned = optionsOf(LAMP, lamp({ effect: 'rainbow' }), house);
    expect(pinned.minimal).toEqual(lamp({ effect: 'rainbow' }));
    expect(pinned.unset.has('effect')).toBe(false);
    // without a house the editor shows no such field
    expect('effect' in optionsOf(LAMP, lamp()).full).toBe(false);
  });

  it('shows every option the editor shows, in its order, each with its value', () => {
    const { full, unset } = optionsOf(LAMP, lamp({ name: 'Desk' }));
    expect(Object.entries(full)).toEqual([
      ['type', 'custom:fluvy-lamp-card'],
      ['entity', 'light.desk'],
      ['name', 'Desk'],
      ['variant', 'full'],
      // a figure a select words is the figure
      ['name_lines', 1],
      ['show_name', true],
      ['hours', 12],
      ['unit', 'auto'],
      ['since', undefined],
      // the list where its field stands, under its own key; the field its section draws waits for its rows
      ['rows', undefined],
      ['color', undefined],
      ['card_opacity', 100],
      // a group that holds its own is one key
      ['state_colors', undefined],
      ['tap_action', undefined],
      ['hold_action', { action: 'more-info' }],
    ]);
    // said and not written: the house's, a number's Automatic, what has no default, an action's own
    expect([...unset]).toEqual([
      'hours',
      'unit',
      'since',
      'rows',
      'color',
      'card_opacity',
      'state_colors',
      'tap_action',
      'hold_action',
    ]);
  });

  it('shows the fields that can act on the configuration, and keeps what it writes beside them', () => {
    const { full, unset } = optionsOf(
      LAMP,
      lamp({
        variant: 'grid',
        name_lines: 2,
        entities: ['sensor.a'],
        presets: [{ name: 'Night' }],
      }),
    );
    expect(Object.keys(full)).toEqual([
      'type',
      'entity',
      'name',
      'variant',
      'columns',
      'show_name',
      'hours',
      'unit',
      'since',
      'rows',
      'row_style',
      'color',
      'card_opacity',
      'state_colors',
      'tap_action',
      'hold_action',
      // a list with no field in the form stands after it, while its section can act
      'presets',
      // what the configuration writes and its editor does not show now
      'name_lines',
    ]);
    expect(full).toMatchObject({
      columns: 3,
      rows: ['sensor.a'],
      row_style: 'plain',
      presets: [{ name: 'Night' }],
      name_lines: 2,
    });
    expect(unset.has('rows') || unset.has('row_style') || unset.has('presets')).toBe(false);
    // a default that follows the layout is not a new card's: said, and left to follow it
    expect(unset.has('columns')).toBe(true);
    // written, it is still what the card does without it: no line a person has to write
    expect(optionsOf(LAMP, lamp({ variant: 'grid', columns: 3 })).minimal).toEqual(
      lamp({ variant: 'grid' }),
    );
    expect(optionsOf(LAMP, lamp({ variant: 'grid', columns: 2 })).minimal).toEqual(
      lamp({ variant: 'grid', columns: 2 }),
    );
    // a list whose section cannot act is not shown
    expect('presets' in optionsOf(LAMP, lamp()).full).toBe(false);
  });

  it('says the unset keys as comments, which a loader reads past', () => {
    const options = optionsOf(LAMP, lamp({ name: 'Desk', rows: ['sensor.a'] }));
    const text = optionsYaml(options, true);
    expect(text).toBe(
      [
        'type: custom:fluvy-lamp-card',
        'entity: light.desk',
        'name: Desk',
        'variant: full',
        'name_lines: 1',
        'show_name: true',
        '# hours: 12',
        '# unit: auto',
        '# since:',
        'rows:',
        '  - sensor.a',
        'row_style: plain',
        '# color:',
        '# card_opacity: 100',
        '# state_colors:',
        '# tap_action:',
        '# hold_action:',
        '#   action: more-info',
      ].join('\n'),
    );
    expect(read(text)).toEqual({
      ...lamp({ name: 'Desk', rows: ['sensor.a'] }),
      variant: 'full',
      name_lines: 1,
      show_name: true,
      row_style: 'plain',
    });
    expect(optionsYaml(options, false)).toBe(toYaml(options.minimal));
  });

  it('reads a configuration in the card’s older names', async () => {
    const card: OptionsCard = {
      aliases: { keys: [{ from: 'style', to: 'variant' }] },
      editor: () => Promise.resolve(LAMP),
    };
    const { minimal, full } = await cardOptions(card, lamp({ style: 'grid', layout: 'full' }));
    // the card's own older name, then the ones every card shares: the newer key keeps what it was given first
    expect(minimal).toEqual(lamp({ variant: 'grid' }));
    expect(full).toMatchObject({ variant: 'grid', columns: 3 });
    expect('style' in full || 'layout' in full).toBe(false);
  });
});

const classes = new Map(
  (await catalogue()).map(([tag, card]) => [tag, card as unknown as OptionsCard]),
);
const examples = Object.entries(GALLERY).flatMap(([tag, example]) =>
  drawn(tag, example).map((shown) => ({
    name: shown.name,
    tag,
    config: shown.config,
    // the layout the editor shows on a new card, where the house decides the one the base is drawn in (`own`: a room
    // whose area has a picture is a photo): read without that house, the example that names it writes a default
    unhoused: example.own !== undefined && shown.layout !== undefined ? layoutKey(example) : '',
  })),
);

describe('the gallery’s options', () => {
  it('reads every card of the catalogue', () => {
    expect(examples.length).toBeGreaterThan(classes.size);
    for (const { tag } of examples) expect(classes.has(tag), tag).toBe(true);
  });

  it.each(examples)(
    '$name: what a person writes is the example',
    async ({ tag, config, unhoused }) => {
      const card = classes.get(tag) as OptionsCard;
      const { minimal } = await cardOptions(card, config);
      const editor = await card.editor();
      const fresh = editorDefaults(editor.getConfigForm(), editor.defaults as never)?.(
        { type: config.type },
        undefined,
      );
      const { [unhoused]: layout, ...rest } = config;
      expect(minimal).toEqual(unhoused && layout === fresh?.[unhoused] ? rest : config);
      expect(Object.keys(minimal)).toEqual(Object.keys(config).filter((key) => key in minimal));
    },
  );

  it.each(examples)(
    '$name: every option reads back as the example and defaults of the card’s own',
    async ({ tag, config }) => {
      const card = classes.get(tag) as OptionsCard;
      const editor = await card.editor();
      const { minimal, full, unset } = await cardOptions(card, config);
      const defaults =
        editorDefaults(editor.getConfigForm(), editor.defaults as never)?.(config, undefined) ?? {};

      expect(Object.keys(full)[0]).toBe('type');
      // what a loader reads of it: every key but the unset ones, as the configuration and the defaults hold them
      const loaded = read(optionsYaml({ minimal, full, unset }, true)) as Record<string, unknown>;
      expect(loaded).toEqual(
        Object.fromEntries(Object.entries(full).filter(([key]) => !unset.has(key))),
      );
      expect(loaded).toMatchObject(minimal);
      // beside the example, defaults of the card's own alone: never the house's, never a number's Automatic
      for (const key of Object.keys(loaded).filter((name) => !(name in minimal))) {
        expect(key in defaults, `${key} has a default`).toBe(true);
        expect(HOUSE_KEYS.has(key), `${key} is the house’s`).toBe(false);
        expect(automatic(key, defaults[key]), `${key} is Automatic`).toBe(false);
        expect(String(loaded[key]), key).toBe(String(defaults[key]));
      }
      // and every key the house decides is there to be read, unless the example writes it
      for (const key of Object.keys(full).filter((name) => HOUSE_KEYS.has(name)))
        expect(unset.has(key) || key in minimal, key).toBe(true);
    },
  );
});
