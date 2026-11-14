import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionField,
  actionFields,
  doubleTapField,
  optionalActions,
  sectionField,
  cardSurfaceFields,
  unavailableField,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  groupFields,
  nameIconFields,
  onlyWhen,
  selectField,
  textField,
  tintField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS, GROUP_KEYS } from '../shared/lists.js';
import type { ScenesCardConfig } from './scenes-card.js';

/** The scenes card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const DOMAINS: readonly string[] = ['scene', 'script', 'button', 'input_button', 'automation'];

/**
 * A grid of scenes has no entity of its own: its colour is the lit tile's; a hold and a double tap on a tile are the
 * base's where the tile names none.
 */
export const base: readonly BaseKey[] = [
  'entities',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
  'hold_action',
  'double_tap_action',
];

export const keys = configKeys<ScenesCardConfig>()([
  'title',
  'scenes',
  'variant',
  'columns',
  'tint',
  ...GROUP_KEYS,
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'scenes',
    alias: 'entities',
    title: 'editor.scenes',
    domains: DOMAINS,
    // a label among the scenes opens a group of them (#189)
    sections: 'labels',
    keys: [
      'entity',
      'name',
      'icon',
      'subtitle',
      'color',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    schema: [
      entityField(DOMAINS),
      nameIconFields(),
      textField('subtitle'),
      accentField('color', { item: 'card' }),
      // a tap runs the scene where none is chosen; a hold and a double tap the card's
      actionFields({ tap: null, hold: null }),
    ],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'tiles',
  columns: 'auto',
  tint: 'on',
  group_by: 'none',
  group_order: 'auto',
  short_names: true,
});

/** What is a tile's alone: how many stand in a row, and its colour at rest; a chip has neither. */
const tiles = ({ variant }: Readonly<Record<string, unknown>>): boolean => variant !== 'chips';

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      fieldRow(textField('title'), selectField('variant', ['tiles', 'chips'])),
      onlyWhen(tiles, selectField('columns', ['auto', '1', '2'])),
      entitiesField('entities', DOMAINS, true),
      ...groupFields('scenes', 'entities'),
      fieldRow(accentField(), accentField('card_color', { none: true })),
      ...cardSurfaceFields(),
      unavailableField(),
      onlyWhen(tiles, tintField()),
      emptyFields(),
      // what a tile answers where it names none: a still press, its details; two taps, nothing until set
      sectionField('editor.interactions', [
        actionField('hold_action', 'more-info'),
        optionalActions(doubleTapField()),
      ]),
    ],
    ...formLabels({}),
  };
}
