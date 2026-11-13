import { lightDefaults, type LovelaceConfigForm } from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  emptyFields,
  entitiesField,
  fieldRow,
  formLabels,
  holdsLight,
  iconField,
  lightColourFields,
  numberField,
  onlyWhen,
  rowItems,
  selectField,
  showIconField,
  textField,
  titleFields,
  whenField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EntitiesCardConfig } from './entities-card.js';

/** The entities card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A card of rows has no entity of its own: its icon, tone and colour are the head's and the rows' default. */
export const base: readonly BaseKey[] = [
  'entities',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
  'show_icon',
  ...ACTIONS_BASE,
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<EntitiesCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'show_count',
  'variant',
  'light_colors',
  'light_whites',
  'more',
  'more_path',
  'show_rows_when',
  ...EMPTY_KEYS,
]);

/** The rows, with a section's label or a divider between them, each shown always or on a condition of its own. */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    sections: true,
    // the condition every row keeps to stands over the rows
    fields: ['show_rows_when'],
    ...rowItems(true, true),
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rows',
  show_count: false,
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      titleFields(),
      fieldRow(iconField(), selectField('variant', ['rows', 'compact'])),
      showIconField(),
      ...colourFields(),
      entitiesField('entities', undefined, true),
      whenField('show_rows_when'),
      boolField('show_count'),
      // a light's colours where the rows hold a light
      onlyWhen(holdsLight('rows', 'entities'), lightColourFields()),
      // a last row to where the rest of the list is
      fieldRow(numberField('more', 1, 999), textField('more_path')),
      emptyFields(),
      actionFields({ icon: true, many: true }),
    ],
    ...formLabels({}),
  };
}
