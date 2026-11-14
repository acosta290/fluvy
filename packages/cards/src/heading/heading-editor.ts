import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  actionField,
  sectionField,
  entitiesField,
  fieldRow,
  formLabels,
  iconField,
  onlyWhen,
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

/** A label is its words alone: its glyph, its meta and its tap are a title's and a subtitle's. */
const headed = ({ heading_style }: Readonly<Record<string, unknown>>): boolean =>
  heading_style !== 'label';

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      textField('title'),
      selectField('heading_style', ['title', 'subtitle', 'label']),
      onlyWhen(headed, fieldRow(iconField(), selectField('variant', ['bar', 'plain']))),
      onlyWhen(headed, fieldRow(textField('subtitle'), textField('path'))),
      onlyWhen(headed, entitiesField('entities')),
      // a tap alone, as Home Assistant's own heading: its path's where none is chosen
      onlyWhen(headed, sectionField('editor.interactions', [actionField()])),
    ],
    ...formLabels({}),
  };
}
