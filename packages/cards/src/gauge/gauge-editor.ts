import { strings as words, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  hasLadder,
  iconField,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  onlyWhen,
  selectField,
  showIconField,
  textField,
  unitChoicesOf,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { DIALS, dialOf, GAUGE_VARIANTS, type GaugeCardConfig } from './gauge-card.js';

/** The gauge card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const strings = words('gauge');

export const base = HEAD_BASE;

export const keys = configKeys<GaugeCardConfig>()([
  'subtitle',
  'variant',
  'min',
  'max',
  'max_entity',
  'label',
  'hours',
  'badge',
  'unit',
  'decimals',
  'gauge',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  variant: 'ring',
  gauge: dialOf(config),
  ...NUMBER_DEFAULTS,
});

/** The units the editor offers are the sensor's class's. */
export const choices = unitChoicesOf;

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['sensor', 'number', 'input_number', 'counter']),
      fieldRow(textField('name'), textField('subtitle')),
      fieldRow(iconField(), selectField('variant', GAUGE_VARIANTS)),
      // the ring's style: a bar and a signed ring have one look each
      onlyWhen((data) => (data['variant'] ?? 'ring') === 'ring', selectField('gauge', DIALS)),
      showIconField(),
      ...colourFields(),
      fieldRow(
        numberField('min', -1_000_000, 1_000_000, 0.1),
        numberField('max', -1_000_000, 1_000_000, 0.1),
      ),
      {
        name: 'max_entity',
        selector: { entity: { domain: ['sensor', 'number', 'input_number'] } },
      },
      fieldRow(textField('label'), textField('badge')),
      numberField('hours', 1, 168),
      numberFields({ when: hasLadder }),
      actionFields(),
    ],
    ...editorLabels(strings, { max_entity: 'max_entity', label: 'label', badge: 'badge' }, {}),
  };
}
