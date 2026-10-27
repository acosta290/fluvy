import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionFields,
  boolField,
  editorWord,
  entityField,
  fieldRow,
  formLabels,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import type { HelloCardConfig } from './hello-card.js';

/** The hello card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** The greeting names who it greets; its avatar answers a tap and a hold; its colour is its mark's. */
export const base: readonly BaseKey[] = ['name', 'tap_action', 'hold_action', 'color'];

export const keys = configKeys<HelloCardConfig>()([
  'person',
  'weather',
  'show_weather',
  'show_date',
  'show_avatar',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  show_avatar: true,
  show_weather: true,
  show_date: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      textField('name'),
      fieldRow(
        entityField(['person'], 'person', false),
        entityField(['weather'], 'weather', false),
      ),
      fieldRow(boolField('show_weather'), boolField('show_date')),
      boolField('show_avatar'),
      accentField(),
      actionFields(),
    ],
    ...formLabels({ person: 'editor.entity', weather: 'editor.weather' }),
    computeHelper: (schema) =>
      schema.name === 'person' ? editorWord('hello.person_helper') : undefined,
  };
}
