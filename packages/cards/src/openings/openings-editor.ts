import { strings, type LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionField,
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  iconField,
  nameIconFields,
  numberField,
  onlyWhen,
  selectField,
  showIconField,
  sinceChoices,
  sinceField,
  textField,
  titleFields,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { OPENINGS_VARIANTS, type OpeningsCardConfig } from './openings-card.js';

/** The openings card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('openings');

/** The openings have no entity of their own: the head's icon, tone and colour are the base fields it honours. */
export const base: readonly BaseKey[] = [
  'entities',
  'icon',
  'tone',
  'color',
  'card_color',
  'tap_action',
  'hold_action',
  'show_icon',
];

export const keys = configKeys<OpeningsCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'variant',
  'max_rows',
  'show_count',
  'show_time',
  'since_pattern',
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    domains: ['binary_sensor', 'cover', 'lock'],
    keys: ['entity', 'name', 'icon', 'color', 'since', 'tap_action', 'hold_action'],
    schema: [
      entityField(['binary_sensor', 'cover', 'lock']),
      nameIconFields(),
      accentField(),
      sinceField(),
      fieldRow(actionField('tap_action'), actionField('hold_action')),
    ],
  },
];

/** A row's `since` offers the house's timestamp sensors. */
export const choices: EditorChoices = sinceChoices;

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rows',
  max_rows: 4,
  show_count: true,
  show_time: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', ['binary_sensor', 'cover', 'lock'], true),
      titleFields(),
      fieldRow(iconField(), showIconField()),
      ...colourFields(),
      fieldRow(selectField('variant', OPENINGS_VARIANTS), numberField('max_rows', 1, 20)),
      fieldRow(boolField('show_count'), boolField('show_time')),
      // where the rows read their last change from, for the rows that say nothing: while the times show
      onlyWhen(({ show_time, variant }) => show_time !== false && variant !== 'compact', {
        ...textField('since_pattern'),
        helper: 'editor.since_pattern_help',
      }),
      emptyFields(),
      actionFields(),
    ],
    ...editorLabels(s, { max_rows: 'editor.max_rows' }, {}),
  };
}
