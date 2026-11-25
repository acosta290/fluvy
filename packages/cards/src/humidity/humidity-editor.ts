import { chartDefaults, strings as words, type LovelaceConfigForm } from '@fluvy/core';
import { BADGE_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  nameField,
  numberField,
  onlyWhen,
  ownTextField,
  rowsFields,
  rowsList,
  selectField,
  headFields,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { bandOf, type HumidityCardConfig } from './humidity-card.js';

/** The humidity card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const strings = words('humidity');

export const base = BADGE_BASE;

export const keys = configKeys<HumidityCardConfig>()([
  'subtitle',
  'low',
  'high',
  'temperature_entity',
  'hours',
  'show_trend',
  'humidifier_entity',
  'gauge',
  'animate',
  'rows',
  'show_rows',
]);

/** The rows it lists under its own (#262). */
export const lists: readonly RowsListSpec[] = [rowsList()];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  show_trend: true,
  gauge: bandOf(config),
  animate: chartDefaults().settings.animate,
  show_rows: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['sensor', 'number', 'input_number']),
      fieldRow(nameField(), ownTextField('subtitle')),
      iconField(),
      headFields({ badge: true }),
      ...colourFields(),
      fieldRow(numberField('low', 0, 100), numberField('high', 0, 100)),
      // the band's three looks: the ruler's ticks with the marker (the classic one), the ruler read lit with the knob,
      // or the liquid; the liquid moves, or rests on its first frame
      fieldRow(
        selectField('gauge', ['ticks', 'ruler', 'liquid'], { words: { ticks: 'classic' } }),
        onlyWhen((data) => bandOf(data) === 'liquid', boolField('animate')),
      ),
      {
        name: 'temperature_entity',
        selector: { entity: { domain: ['sensor'], device_class: 'temperature' } },
      },
      {
        name: 'humidifier_entity',
        selector: { entity: { domain: ['humidifier', 'switch', 'fan', 'input_boolean'] } },
      },
      fieldRow(numberField('hours', 1, 48), boolField('show_trend')),
      ...rowsFields(),
      actionFields({ icon: true }),
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
