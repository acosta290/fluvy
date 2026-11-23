import type { HaFormSchemaItem, LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionFields,
  boolField,
  choiceField,
  emptyFields,
  entityField,
  exactField,
  fieldRow,
  formLabels,
  iconField,
  itemToggleField,
  textField,
  tintField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { ChipsCardConfig } from './chips-card.js';

/** The chips card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** The row's accessible name is the base's `name`, its tabs' colours as named the base's too; the tabs are its own. */
export const base: readonly BaseKey[] = ['name', 'exact_colors'];

export const keys = configKeys<ChipsCardConfig>()([
  'chips',
  'tint',
  'style',
  'show_name',
  ...EMPTY_KEYS,
]);

/** A tab's look (#241): its pill, or plain on the page. */
const styleField = (): HaFormSchemaItem =>
  choiceField('style', [
    ['pill', 'option.standard'],
    ['plain', 'option.plain'],
  ]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'chips',
    idKey: 'name',
    title: 'editor.tabs',
    keys: [
      'name',
      'icon',
      'path',
      'entity',
      'color',
      'style',
      'show_name',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    schema: [
      // its words, or a template rendered live (a count, a state); its icon and colour take one in YAML
      { ...textField('name'), helper: 'editor.template_helper' },
      fieldRow(iconField(), textField('path')),
      entityField(undefined, 'entity', false),
      accentField('color', { item: 'card' }),
      // its own look and whether it says its name: the card's until chosen
      fieldRow(
        { ...styleField(), helper: 'editor.item_switch_style_helper' },
        itemToggleField('show_name'),
      ),
      // its path or its entity's details where it names no tap of its own; a hold nothing until set
      actionFields({ tap: null, hold: 'none' }),
    ],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({ tint: 'on', style: 'pill', show_name: true });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      textField('name'),
      { name: 'chips', required: true, selector: { object: {} } },
      fieldRow(styleField(), boolField('show_name')),
      tintField(),
      exactField(),
      emptyFields(),
    ],
    ...formLabels({ chips: 'editor.tabs', style: 'editor.variant' }),
  };
}
