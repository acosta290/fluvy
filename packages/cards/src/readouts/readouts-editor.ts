import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionFields,
  cardSurfaceFields,
  unavailableField,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsDevice,
  nameField,
  namesField,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  onlyWhen,
  selectField,
  thresholdsField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { ReadoutsCardConfig } from './readouts-card.js';

/** The readouts card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const DOMAINS: readonly string[] = ['sensor', 'number', 'input_number', 'counter'];

/** A strip of readouts has no entity of its own; its colour is its figures' accent. */
export const base: readonly BaseKey[] = [
  'entities',
  'names',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'card_blur',
  'exact_colors',
  'unavailable',
];

export const keys = configKeys<ReadoutsCardConfig>()([
  'rows',
  'hours',
  'variant',
  'unit',
  'decimals',
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    domains: DOMAINS,
    // how the readouts that say no name are named stands over them
    fields: ['names'],
    keys: [
      'entity',
      'name',
      'unit',
      'decimals',
      'thresholds',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    // a readout's figure past a threshold takes its colour (1.22, #204)
    schema: [entityField(DOMAINS), nameField(), numberFields(), thresholdsField(), actionFields()],
  },
];

export const defaults: EditorDefaults = () => ({
  variant: 'grid',
  hours: 6,
  ...NUMBER_DEFAULTS,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', DOMAINS, true),
      onlyWhen(holdsDevice('rows', 'entities'), namesField()),
      fieldRow(numberField('hours', 1, 48), selectField('variant', ['grid', 'row'])),
      accentField(),
      accentField('card_color', { none: true }),
      ...cardSurfaceFields(),
      unavailableField(),
      emptyFields(),
      numberFields(),
    ],
    ...formLabels({}),
  };
}
