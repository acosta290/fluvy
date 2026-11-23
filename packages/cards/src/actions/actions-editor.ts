import type { LovelaceConfigForm } from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  actionFields,
  colourFields,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsDevice,
  iconField,
  nameIconFields,
  namesField,
  numberField,
  headFields,
  onlyWhen,
  textField,
  titleFields,
} from '../shared/form.js';
import type { RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import { ACTION_DOMAINS, type ActionsCardConfig } from './actions-card.js';

/** The actions card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A card of many actions has no entity of its own: its head's icon, tone and colour, its tap ("…") and its hold. */
export const base: readonly BaseKey[] = [
  'entities',
  'names',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'card_blur',
  'exact_colors',
  'unavailable',
  ...ACTIONS_BASE,
  'show_icon',
  'name_lines',
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<ActionsCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'columns',
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    domains: ACTION_DOMAINS,
    // how the rows that say no name are named stands over them
    fields: ['names'],
    keys: ['entity', 'name', 'icon', 'secondary'],
    schema: [entityField(ACTION_DOMAINS), nameIconFields(), textField('secondary')],
  },
];

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      titleFields(),
      fieldRow(iconField(), numberField('columns', 1, 3)),
      headFields(),
      ...colourFields(),
      entitiesField('entities', ACTION_DOMAINS, true),
      onlyWhen(holdsDevice('rows', 'entities'), namesField()),
      emptyFields(),
      actionFields({ icon: true, many: true }),
    ],
    ...formLabels({}),
  };
}
