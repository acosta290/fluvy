// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ITEM_ALIASES } from './config.js';
import { cardForm, drawEditor, nextConfig, shownNames, type FormStub } from './fixtures/editor.js';
import {
  entityField,
  foldConditions,
  rowWhenField,
  SECTION_FORM,
  textField,
  unfoldConditions,
  whenField,
} from './form.js';
import {
  entryOf,
  itemsOf,
  listsEditor,
  type FluvyRowsEditor,
  type RowsListSpec,
} from './rows-editor.js';

/*
 * A list in parts and rows on a condition (#157), in the editor: a section and a divider are items of their own
 * kind among the rows, and a condition is one field of the config drawn as how it is asked and what that asks for.
 */

afterEach(() => document.body.replaceChildren());

const hass = {
  states: {
    'sensor.level': { entity_id: 'sensor.level', state: '18', attributes: {} },
    'input_select.mode': {
      entity_id: 'input_select.mode',
      state: 'home',
      attributes: { options: ['home', 'away'] },
    },
  },
  formatEntityState: (_state: unknown, value: string) => value.toUpperCase(),
} as unknown as HomeAssistant;

/** The editor in the page, the house in it. */
async function draw(editor: HTMLElement, config: LovelaceCardConfig): Promise<FluvyRowsEditor> {
  (editor as FluvyRowsEditor).hass = hass;
  return drawEditor(editor, config);
}

const items = (editor: FluvyRowsEditor): HTMLElement[] => [
  ...editor.shadowRoot!.querySelectorAll<HTMLElement>('.item'),
];
const formOf = (editor: FluvyRowsEditor, index: number): FormStub =>
  items(editor)[index]!.querySelector<FormStub>('ha-form')!;
/** The words a select of a form offers, in its order. */
const offered = (form: FormStub, name: string): string[] => {
  const field = (function find(schema: readonly HaFormSchemaItem[]): HaFormSchemaItem | undefined {
    for (const item of schema) {
      const found = item.schema ? find(item.schema) : item.name === name ? item : undefined;
      if (found) return found;
    }
    return undefined;
  })(form.schema);
  const select = field?.selector?.['select'] as { options: { label: string }[] } | undefined;
  return select?.options.map((option) => option.label) ?? [];
};

describe('a list in parts, in the editor (#157)', () => {
  const list: RowsListSpec = {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    sections: true,
    schema: [entityField(), textField('name')],
  };
  const ROWS = [
    { type: 'section', label: 'Downstairs' },
    'sensor.a',
    { type: 'divider' },
    { section: 'Loft', line: true },
    { entity: 'sensor.b', name: 'B' },
  ];

  it('reads a section and a divider as items of their own kind, where the list takes them', () => {
    expect(itemsOf({ type: 't', rows: [...ROWS, { type: 'section' }] }, list)).toEqual([
      { type: 'section', label: 'Downstairs', line: false },
      { entity: 'sensor.a' },
      { type: 'divider' },
      { type: 'section', label: 'Loft', line: true },
      { entity: 'sensor.b', name: 'B' },
      // one with no label yet is kept, to be given one
      { type: 'section', label: '', line: false },
    ]);
    // a list that draws none drops them, as every list did
    expect(itemsOf({ type: 't', rows: ROWS }, { ...list, sections: false })).toEqual([
      { entity: 'sensor.a' },
      { entity: 'sensor.b', name: 'B' },
    ]);
  });

  it('writes them back in the words Home Assistant’s entities card writes, as small as they are', () => {
    const write = (item: Record<string, unknown>): unknown => entryOf(item, list);
    expect(write({ type: 'section', label: 'Downstairs', line: false })).toEqual({
      type: 'section',
      label: 'Downstairs',
    });
    expect(write({ type: 'section', label: 'Loft', line: true })).toEqual({
      type: 'section',
      label: 'Loft',
      line: true,
    });
    expect(write({ type: 'section', label: '', line: false })).toEqual({ type: 'section' });
    expect(write({ type: 'divider' })).toEqual({ type: 'divider' });
    expect(write({ entity: 'sensor.a' })).toBe('sensor.a');
  });

  it('draws a section as its label and its hairline, a divider as its word, a row as its form', async () => {
    const editor = await draw(listsEditor({ schema: [] }, [list]), {
      type: 'custom:x',
      rows: ROWS,
    });
    expect(items(editor).length).toBe(5);
    const section = formOf(editor, 0);
    expect(section.schema).toBe(SECTION_FORM);
    expect(section.data).toMatchObject({ label: 'Downstairs', line: false });
    expect(shownNames(formOf(editor, 1).schema)).toEqual(['entity', 'name']);
    // a divider has nothing to edit; it is dragged and removed as any item is
    const divider = items(editor)[2]!;
    expect(divider.querySelector('ha-form')).toBeNull();
    expect(divider.querySelector('.item__divider')?.textContent).toBe('Divider');
    expect(divider.querySelector('.handle')).not.toBeNull();
    expect(divider.querySelector('ha-icon-button')).not.toBeNull();
    // the handle and the cross stand on a row's picker, and on a section's own field
    expect(items(editor).map((item) => item.classList.contains('item--entity'))).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
  });

  it('names a section’s fields in the editor’s own words', async () => {
    const editor = await draw(listsEditor({ schema: [] }, [list]), {
      type: 'custom:x',
      rows: ROWS,
    });
    const form = formOf(editor, 0) as FormStub & {
      computeLabel(schema: HaFormSchemaItem, localize: (key: string) => string): string;
    };
    const [label, line] = (SECTION_FORM[0]!.schema ?? []) as HaFormSchemaItem[];
    expect(form.computeLabel(label!, (key) => key)).toBe('Section');
    expect(form.computeLabel(line!, (key) => key)).toBe('Line above');
  });

  it('edits a section in place, and keeps one whose label is cleared', async () => {
    const editor = await draw(listsEditor({ schema: [] }, [list]), {
      type: 'custom:x',
      rows: ROWS,
    });
    let next = nextConfig(editor);
    formOf(editor, 0).change('label', 'Ground floor');
    expect((await next)['rows']).toEqual([
      { type: 'section', label: 'Ground floor' },
      'sensor.a',
      { type: 'divider' },
      // every entry is written as the editor writes it: the short form too
      { type: 'section', label: 'Loft', line: true },
      { entity: 'sensor.b', name: 'B' },
    ]);
    await editor.updateComplete;
    next = nextConfig(editor);
    formOf(editor, 0).change('line', true);
    expect(((await next)['rows'] as unknown[])[0]).toEqual({
      type: 'section',
      label: 'Ground floor',
      line: true,
    });
    await editor.updateComplete;
    // cleared to be typed again: the section stays where it is
    next = nextConfig(editor);
    formOf(editor, 0).change('label', '');
    expect(((await next)['rows'] as unknown[])[0]).toEqual({ type: 'section', line: true });
    await editor.updateComplete;
    expect(items(editor).length).toBe(5);
    expect(formOf(editor, 0).schema).toBe(SECTION_FORM);
  });

  it('adds a section and a divider at the list’s end, to be dragged into place with the rows', async () => {
    const editor = await draw(listsEditor({ schema: [] }, [list]), {
      type: 'custom:x',
      entities: ['sensor.a', 'sensor.b'],
    });
    const buttons = [...editor.shadowRoot!.querySelectorAll<HTMLButtonElement>('.more button')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Add section',
      'Add divider',
    ]);
    let next = nextConfig(editor);
    buttons[0]!.click();
    // written under the list's own key, as every change is
    expect(await next).toEqual({
      type: 'custom:x',
      rows: ['sensor.a', 'sensor.b', { type: 'section' }],
    });
    await editor.updateComplete;
    next = nextConfig(editor);
    buttons[1]!.click();
    expect((await next)['rows']).toEqual([
      'sensor.a',
      'sensor.b',
      { type: 'section' },
      { type: 'divider' },
    ]);
    await editor.updateComplete;
    // the new section is drawn, empty, to be named; dragged over the first row it is the list's first
    expect(formOf(editor, 2).schema).toBe(SECTION_FORM);
    next = nextConfig(editor);
    editor
      .shadowRoot!.querySelector('ha-sortable')!
      .dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 2, newIndex: 0 } }));
    expect((await next)['rows']).toEqual([
      { type: 'section' },
      'sensor.a',
      'sensor.b',
      { type: 'divider' },
    ]);
    await editor.updateComplete;
    // and removed by its cross
    next = nextConfig(editor);
    items(editor)[3]!.querySelector<HTMLElement>('ha-icon-button')!.click();
    expect((await next)['rows']).toEqual([{ type: 'section' }, 'sensor.a', 'sensor.b']);
  });

  it('offers neither on a list that draws no sections', async () => {
    const editor = await draw(listsEditor({ schema: [] }, [{ ...list, sections: false }]), {
      type: 'custom:x',
      rows: ROWS,
    });
    expect(editor.shadowRoot!.querySelector('.more')).toBeNull();
    expect(items(editor).length).toBe(2);
  });
});

describe('a condition, in the editor (#157)', () => {
  const list: RowsListSpec = {
    key: 'rows',
    title: 'editor.rows',
    fields: ['show_rows_when'],
    schema: [entityField(), textField('name'), rowWhenField()],
  };
  const form = { schema: [textField('title'), whenField('show_rows_when')] };
  const editorOf = (config: Record<string, unknown>): Promise<FluvyRowsEditor> =>
    draw(listsEditor(form, [list]), { type: 'custom:x', ...config });
  /** The row's form after `change`, and what the editor wrote. */
  async function edit(
    editor: FluvyRowsEditor,
    name: string,
    value: unknown,
    index = 0,
  ): Promise<unknown> {
    const next = nextConfig(editor);
    formOf(editor, index).change(name, value);
    const config = await next;
    await editor.updateComplete;
    return (config['rows'] as unknown[])[index];
  }

  it('is one choice while the row always shows, and only the fields its choice can act on', async () => {
    const editor = await editorOf({
      rows: [
        'sensor.a',
        { entity: 'sensor.b', show_when: { below: 30 } },
        { entity: 'sensor.c', show_when: { above: 20, below: 80 } },
        { entity: 'sensor.d', show_when: { state: 'on' } },
        { entity: 'sensor.e', show_when: { entity: 'sensor.level', state_not: ['off', 'idle'] } },
      ],
    });
    const shown = (index: number): string[] => shownNames(formOf(editor, index).schema);
    expect(shown(0)).toEqual(['entity', 'name', 'show_when']);
    expect(formOf(editor, 0).data['show_when']).toBe('always');
    expect(offered(formOf(editor, 0), 'show_when')).toEqual([
      'Always',
      'Above',
      'Below',
      'Between',
      'State is',
      'State is not',
    ]);
    expect(shown(1)).toEqual(['entity', 'name', 'show_when', 'when_below', 'when_entity']);
    expect(formOf(editor, 1).data).toMatchObject({ show_when: 'below', when_below: 30 });
    expect(shown(2)).toEqual([
      'entity',
      'name',
      'show_when',
      'when_above',
      'when_below',
      'when_entity',
    ]);
    expect(formOf(editor, 2).data).toMatchObject({
      show_when: 'between',
      when_above: 20,
      when_below: 80,
    });
    expect(shown(3)).toEqual(['entity', 'name', 'show_when', 'when_state', 'when_entity']);
    expect(formOf(editor, 3).data).toMatchObject({ show_when: 'state', when_state: ['on'] });
    expect(formOf(editor, 4).data).toMatchObject({
      show_when: 'state_not',
      when_state: ['off', 'idle'],
      when_entity: 'sensor.level',
    });
    // a form is never handed a function, nor the field as the card's form declares it
    for (const index of [0, 1, 2, 3, 4])
      expect(JSON.stringify(formOf(editor, index).schema)).not.toContain('"condition"');
  });

  it('writes the condition its fields say, a bound keeping its place until it is typed', async () => {
    const editor = await editorOf({ rows: ['sensor.a'] });
    expect(await edit(editor, 'show_when', 'below')).toEqual({
      entity: 'sensor.a',
      show_when: { below: null },
    });
    // the choice stays while its figure is empty
    expect(formOf(editor, 0).data['show_when']).toBe('below');
    expect(await edit(editor, 'when_below', 30)).toEqual({
      entity: 'sensor.a',
      show_when: { below: 30 },
    });
    // the figure follows its bound from below to above
    expect(await edit(editor, 'show_when', 'above')).toEqual({
      entity: 'sensor.a',
      show_when: { above: 30 },
    });
    expect(await edit(editor, 'show_when', 'between')).toEqual({
      entity: 'sensor.a',
      show_when: { above: 30, below: null },
    });
    expect(await edit(editor, 'when_below', 80)).toEqual({
      entity: 'sensor.a',
      show_when: { above: 30, below: 80 },
    });
    // a figure cleared to be typed again keeps the row's choice
    expect(await edit(editor, 'when_above', undefined)).toEqual({
      entity: 'sensor.a',
      show_when: { above: null, below: 80 },
    });
    expect(formOf(editor, 0).data['show_when']).toBe('between');
  });

  it('writes one state as a word and several as a list, of another entity where one is named', async () => {
    const editor = await editorOf({ rows: ['sensor.a'] });
    expect(await edit(editor, 'show_when', 'state')).toEqual({
      entity: 'sensor.a',
      show_when: { state: [] },
    });
    expect(await edit(editor, 'when_state', ['on'])).toEqual({
      entity: 'sensor.a',
      show_when: { state: 'on' },
    });
    expect(await edit(editor, 'when_state', ['open', 'opening'])).toEqual({
      entity: 'sensor.a',
      show_when: { state: ['open', 'opening'] },
    });
    expect(await edit(editor, 'show_when', 'state_not')).toEqual({
      entity: 'sensor.a',
      show_when: { state_not: ['open', 'opening'] },
    });
    expect(await edit(editor, 'when_entity', 'input_select.mode')).toEqual({
      entity: 'sensor.a',
      show_when: { entity: 'input_select.mode', state_not: ['open', 'opening'] },
    });
    // always: nothing of it is left, and the row is its bare id again
    expect(await edit(editor, 'show_when', 'always')).toBe('sensor.a');
  });

  it('offers the states the entity read lists and says now, in Home Assistant’s words', async () => {
    const editor = await editorOf({
      rows: [
        { entity: 'sensor.level', show_when: { state: 'charging' } },
        { entity: 'sensor.a', show_when: { entity: 'input_select.mode', state: 'away' } },
      ],
    });
    const states = (index: number): unknown =>
      (
        formOf(editor, index).schema.flatMap((item) => item.schema ?? [item])[3]?.selector?.[
          'select'
        ] as { options: unknown }
      ).options;
    // its own state, out of reach, and what the row names already; any other is typed
    expect(states(0)).toEqual([
      { value: '18', label: '18' },
      { value: 'unavailable', label: 'UNAVAILABLE' },
      { value: 'charging', label: 'CHARGING' },
    ]);
    // the other entity's, where the condition reads one: a select's options first
    expect(states(1)).toEqual([
      { value: 'home', label: 'HOME' },
      { value: 'away', label: 'AWAY' },
      { value: 'unavailable', label: 'UNAVAILABLE' },
    ]);
  });

  it('leaves a condition written by hand as it was while another field changes', async () => {
    const mixed = { below: '30', state_not: 'unavailable' };
    const editor = await editorOf({ rows: [{ entity: 'sensor.a', show_when: mixed }] });
    expect(await edit(editor, 'name', 'Remote')).toEqual({
      entity: 'sensor.a',
      name: 'Remote',
      show_when: mixed,
    });
    // a section's form holds no condition to write
    const parts = await draw(listsEditor(form, [{ ...list, sections: true }]), {
      type: 'custom:x',
      rows: [{ type: 'section', label: 'A' }, 'sensor.a'],
    });
    const next = nextConfig(parts);
    formOf(parts, 0).change('label', 'B');
    expect((await next)['rows']).toEqual([{ type: 'section', label: 'B' }, 'sensor.a']);
  });

  it('edits the card’s condition for every row over the rows, and a row then says it keeps to it', async () => {
    const editor = await editorOf({ title: 'Batteries', rows: ['sensor.a'] });
    // out of the card's form, at the head of the rows
    expect(shownNames(cardForm(editor).schema)).toEqual(['title']);
    const head = (): FormStub => editor.shadowRoot!.querySelector<FormStub>('.list__fields')!;
    expect(shownNames(head().schema)).toEqual(['show_rows_when']);
    expect(offered(formOf(editor, 0), 'show_when')[0]).toBe('Always');
    let next = nextConfig(editor);
    head().change('show_rows_when', 'below');
    expect(await next).toEqual({
      type: 'custom:x',
      title: 'Batteries',
      show_rows_when: { below: null },
      rows: ['sensor.a'],
    });
    await editor.updateComplete;
    expect(shownNames(head().schema)).toEqual(['show_rows_when', 'when_below', 'when_entity']);
    next = nextConfig(editor);
    head().change('when_below', 30);
    expect((await next)['show_rows_when']).toEqual({ below: 30 });
    await editor.updateComplete;
    // a row with none of its own keeps to the card's, and its first choice says so
    expect(offered(formOf(editor, 0), 'show_when')[0]).toBe('As every row');
    expect(formOf(editor, 0).data['show_when']).toBe('always');
    // the card's other fields leave it as it is
    next = nextConfig(editor);
    cardForm(editor).change('title', 'Low batteries');
    expect(await next).toEqual({
      type: 'custom:x',
      title: 'Low batteries',
      show_rows_when: { below: 30 },
      rows: ['sensor.a'],
    });
    await editor.updateComplete;
    next = nextConfig(editor);
    head().change('show_rows_when', 'always');
    expect(await next).toEqual({ type: 'custom:x', title: 'Low batteries', rows: ['sensor.a'] });
  });

  it('hands a form the same schema while its condition stands as it did', async () => {
    const editor = await editorOf({
      rows: [
        { entity: 'sensor.a', show_when: { below: 30 } },
        { entity: 'sensor.b', show_when: { below: 50 } },
      ],
    });
    const first = formOf(editor, 0).schema;
    // two rows asked the same way share one form, whatever their figures
    expect(formOf(editor, 1).schema).toBe(first);
    editor.requestUpdate();
    await editor.updateComplete;
    expect(formOf(editor, 0).schema).toBe(first);
  });
});

describe('a condition’s fields and the config', () => {
  const fields = [whenField('show_when')];

  it('unfolds a condition into how it is asked and its parts, and folds it back', () => {
    const item = { entity: 'sensor.a', show_when: { entity: 'sensor.b', above: 2, below: 8 } };
    const data = unfoldConditions(item, fields);
    expect(data).toEqual({
      entity: 'sensor.a',
      show_when: 'between',
      when_above: 2,
      when_below: 8,
      when_state: [],
      when_entity: 'sensor.b',
    });
    // untouched, it comes back as the config wrote it
    expect(foldConditions(data, item, fields)).toEqual(item);
    expect(foldConditions({ ...data, when_below: 9 }, item, fields)).toEqual({
      entity: 'sensor.a',
      show_when: { entity: 'sensor.b', above: 2, below: 9 },
    });
  });

  it('reads a YAML dashboard’s on and off as the words, and leaves a form without a condition alone', () => {
    expect(unfoldConditions({ show_when: { state: true } }, fields)['when_state']).toEqual(['on']);
    const data = { entity: 'sensor.a' };
    expect(unfoldConditions(data, [])).toBe(data);
    expect(foldConditions(data, data, [])).toEqual(data);
  });

  it('never writes how it is asked as the condition, whatever the form says', () => {
    expect(foldConditions({ show_when: 'always' }, {}, fields)).toEqual({});
    expect(foldConditions({ show_when: 'whenever' }, { show_when: { below: 3 } }, fields)).toEqual(
      {},
    );
    expect(foldConditions({ show_when: undefined }, { show_when: { below: 3 } }, fields)).toEqual(
      {},
    );
  });
});

describe('the Bars and the Entities cards’ editors (#157)', () => {
  type Labelled = FormStub & {
    computeLabel(schema: HaFormSchemaItem, localize: (key: string) => string): string | undefined;
    computeHelper(schema: HaFormSchemaItem, localize: (key: string) => string): string | undefined;
  };
  const leaves = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? leaves(item.schema) : [item]));
  const ROWS = [
    { type: 'section', label: 'Downstairs' },
    { entity: 'sensor.level', show_when: { above: 1, below: 30 } },
    { entity: 'sensor.level', show_when: { entity: 'input_select.mode', state_not: 'away' } },
    { type: 'divider' },
    'sensor.level',
  ];

  it.each([
    ['bars', () => import('../bars/bars-editor.js')],
    ['entities', () => import('../entities/entities-editor.js')],
  ] as const)(
    '%s: takes sections, shows a row on a condition, and says every field it draws in words',
    async (name, load) => {
      const { getConfigForm, lists, defaults } = await load();
      const editor = await draw(listsEditor(getConfigForm(), lists, defaults), {
        type: `custom:fluvy-${name}-card`,
        show_rows_when: { below: 50 },
        rows: ROWS,
      });
      expect(lists[0]?.sections).toBe(true);
      expect(items(editor).length).toBe(5);
      const forms = [
        ...editor.shadowRoot!.querySelectorAll<Labelled>('.list__fields, .item ha-form'),
      ];
      // the card's condition over the rows, the section, and the three rows
      expect(forms.length).toBe(5);
      const words = forms.flatMap((form) =>
        leaves(form.schema).map((field) => [field.name, form.computeLabel(field, (key) => key)]),
      );
      for (const [field, word] of words) {
        expect(word, String(field)).toBeTruthy();
        expect(word, String(field)).not.toBe(field);
      }
      const said = Object.fromEntries(words) as Record<string, string>;
      expect(said).toMatchObject({
        show_rows_when: 'Show every row',
        show_when: 'Show',
        when_above: 'Above',
        when_below: 'Below',
        when_state: 'State',
        when_entity: 'Read from',
        label: 'Section',
        line: 'Line above',
      });
      // the entity a condition reads says what it is while none is named
      const row = forms[2]!;
      const other = leaves(row.schema).find((field) => field.name === 'when_entity')!;
      expect(row.computeHelper(other, (key) => key)).toBe('Empty: the row’s own entity');
      // a row with no condition of its own keeps to the card's
      expect(offered(forms[4]!, 'show_when')[0]).toBe('As every row');
    },
  );

  it('keeps a section’s `label` through the rows’ older names, which read a row’s label as its name', async () => {
    const { getConfigForm, lists, defaults } = await import('../bars/bars-editor.js');
    // as the card's editor is built: with the names its rows once carried
    const editor = await draw(
      listsEditor(getConfigForm(), lists, defaults, [{ items: { rows: ITEM_ALIASES } }]),
      {
        type: 'custom:fluvy-bars-card',
        rows: [
          { type: 'section', label: 'Downstairs' },
          { entity: 'sensor.level', label: 'Remote' },
        ],
      },
    );
    expect(formOf(editor, 0).data).toMatchObject({ label: 'Downstairs' });
    expect(formOf(editor, 1).data).toMatchObject({ name: 'Remote' });
    const next = nextConfig(editor);
    formOf(editor, 0).change('line', true);
    expect((await next)['rows']).toEqual([
      { type: 'section', label: 'Downstairs', line: true },
      { entity: 'sensor.level', name: 'Remote' },
    ]);
  });
});
