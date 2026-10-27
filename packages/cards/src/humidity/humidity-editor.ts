import { strings as words, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  numberField,
  selectField,
  showIconField,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { litRuler, type HumidityCardConfig } from './humidity-card.js';

/** The humidity card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const strings = words('humidity');

export const base = HEAD_BASE;

export const keys = configKeys<HumidityCardConfig>()([
  'subtitle',
  'low',
  'high',
  'temperature_entity',
  'hours',
  'show_trend',
  'humidifier_entity',
  'gauge',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  show_trend: true,
  gauge: litRuler(config) ? 'ruler' : 'ticks',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['sensor', 'number', 'input_number']),
      fieldRow(textField('name'), textField('subtitle')),
      fieldRow(iconField(), showIconField()),
      ...colourFields(),
      fieldRow(numberField('low', 0, 100), numberField('high', 0, 100)),
      // the ruler's two looks: its ticks with the marker (the classic one), or read lit with the knob
      selectField('gauge', ['ticks', 'ruler'], { words: { ticks: 'classic' } }),
      {
        name: 'temperature_entity',
        selector: { entity: { domain: ['sensor'], device_class: 'temperature' } },
      },
      {
        name: 'humidifier_entity',
        selector: { entity: { domain: ['humidifier', 'switch', 'fan', 'input_boolean'] } },
      },
      fieldRow(numberField('hours', 1, 48), boolField('show_trend')),
      actionFields(),
    ],
    ...editorLabels(
      strings,
      {
        low: 'low',
        high: 'high',
        temperature_entity: 'temperature_entity',
        humidifier_entity: 'humidifier_entity',
      },
      {},
    ),
  };
}
