import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  actionField,
  entitiesField,
  fieldRow,
  formLabels,
  iconField,
  selectField,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import type { HeadingCardConfig } from './heading-card.js';

/** The heading card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A heading has no entity: its icon, the entities it counts and the tap its meta answers are the base fields it honours. */
export const base: readonly BaseKey[] = ['icon', 'entities', 'tap_action'];

export const keys = configKeys<HeadingCardConfig>()([
  'title',
  'subtitle',
  'path',
  'variant',
  'heading_style',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({ variant: 'bar', heading_style: 'subtitle' });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      fieldRow(textField('title'), iconField()),
      fieldRow(
        selectField('heading_style', ['title', 'subtitle']),
        selectField('variant', ['bar', 'plain']),
      ),
      fieldRow(textField('subtitle'), textField('path')),
      entitiesField('entities'),
      actionField(),
    ],
    ...formLabels({}),
  };
}
