import { strings, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  nameIconFields,
  selectField,
  showIconField,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import type { VacuumCardConfig } from './vacuum-card.js';

/** The vacuum card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const vacuumStrings = strings('vacuum');

export const base = HEAD_BASE;

export const keys = configKeys<VacuumCardConfig>()([
  'subtitle',
  'variant',
  'show_battery',
  'area_entity',
  'duration_entity',
  'remaining_entity',
  'battery_entity',
  'suction_style',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  suction_style: 'full',
  show_battery: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['vacuum', 'lawn_mower']),
      nameIconFields(),
      showIconField(),
      fieldRow(textField('subtitle'), selectField('variant', ['full', 'compact'])),
      fieldRow(boolField('show_battery'), entityField(['sensor'], 'battery_entity', false)),
      fieldRow(
        entityField(['sensor'], 'area_entity', false),
        entityField(['sensor'], 'duration_entity', false),
      ),
      fieldRow(
        entityField(['sensor'], 'remaining_entity', false),
        selectField('suction_style', ['full', 'chips']),
      ),
      ...colourFields(),
      actionFields(),
    ],
    ...editorLabels(
      vacuumStrings,
      { area_entity: 'area', duration_entity: 'elapsed' },
      {
        battery_entity: 'vacuum.battery',
        remaining_entity: 'timer.remaining',
        suction_style: 'editor.suction_style',
      },
    ),
  };
}
