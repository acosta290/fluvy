import { lightDefaults, type LovelaceConfigForm } from '@fluvy/core';
import {
  accentField,
  actionFields,
  colourFields,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsLight,
  holdsSwitch,
  lightColourFields,
  nameIconFields,
  nameLinesField,
  onlyWhen,
  selectField,
  showSwitchField,
  sinceChoices,
  sinceField,
  sliderFields,
  switches,
  tintField,
  toneField,
  unavailableField,
} from '../shared/form.js';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import { SIZES, type TilesCardConfig } from './tiles-card.js';

/** The tiles card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const COLUMNS = ['1', '2', '3', '4', 'auto'] as const;

/** The group has no entity of its own: its tone and colour are its tiles' default. */
export const base: readonly BaseKey[] = [
  'entities',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
  'slider_style',
  'slider_words',
];

export const keys = configKeys<TilesCardConfig>()([
  'size',
  'name_lines',
  'show_switch',
  'readouts',
  'tiles',
  'columns',
  'tint',
  'light_colors',
  'light_whites',
  ...EMPTY_KEYS,
]);

/** A tile's fields: every one, and those of a tile with no switch of its own to show or hide. */
const TILE_FIELDS = [
  entityField(),
  nameIconFields(),
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  entitiesField('readouts', ['sensor']),
  sinceField(),
  unavailableField({ item: true }),
  showSwitchField({ item: true }),
  actionFields(),
];
const TILE_FIELDS_NO_SWITCH = TILE_FIELDS.filter((field) => field.name !== 'show_switch');

export const lists: readonly RowsListSpec[] = [
  {
    key: 'tiles',
    alias: 'entities',
    title: 'editor.tiles',
    keys: [
      'entity',
      'name',
      'icon',
      'tone',
      'color',
      'readouts',
      'since',
      'unavailable',
      'show_switch',
      'tap_action',
      'hold_action',
    ],
    schema: TILE_FIELDS,
    // a tile's own switch where it has one: a large tile's, of an entity that switches
    schemaOf: (item, card) =>
      card?.['size'] === 'large' && switches(item['entity']) ? TILE_FIELDS : TILE_FIELDS_NO_SWITCH,
  },
];

/** A tile's `since` offers the house's timestamp sensors. */
export const choices: EditorChoices = sinceChoices;

// the columns a group takes when it names none: three minis a row, else two
export const defaults: EditorDefaults = (config) => ({
  size: 'compact',
  name_lines: '1',
  columns: config['size'] === 'mini' ? '3' : '2',
  show_switch: true,
  tint: 'on',
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', undefined, true),
      fieldRow(selectField('size', SIZES), selectField('columns', COLUMNS)),
      // a small tile's name may take two lines; a large one's switch may give way to its circle, where a tile has one
      onlyWhen(({ size }) => size !== 'large', nameLinesField()),
      onlyWhen(
        (data) => data['size'] === 'large' && holdsSwitch('tiles', 'entities')(data),
        showSwitchField(),
      ),
      ...colourFields(),
      tintField(),
      // a light's colours where the group holds a light; its large tiles' sliders in a style (the fill is theirs)
      onlyWhen(holdsLight('tiles', 'entities'), lightColourFields()),
      ...sliderFields(true).map((row) => onlyWhen(({ size }) => size === 'large', row)),
      entitiesField('readouts', ['sensor']),
      emptyFields(),
    ],
    ...formLabels({ readouts: 'editor.readouts' }),
  };
}
