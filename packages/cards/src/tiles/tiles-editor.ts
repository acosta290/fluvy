import { lightDefaults, type LovelaceConfigForm } from '@fluvy/core';
import {
  accentField,
  actionFields,
  colourFields,
  drawsSwitch,
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
  switchStyleField,
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
  'switch_style',
  'readouts',
  'tiles',
  'columns',
  'tint',
  'light_colors',
  'light_whites',
  ...EMPTY_KEYS,
]);

/**
 * A tile's fields: every one; those of a compact tile, whose switch has a style and no place of its own to hide; those
 * of a large tile that shows no switch; and those of a tile with no switch at all.
 */
const TILE_FIELDS = [
  entityField(),
  nameIconFields(),
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  entitiesField('readouts', ['sensor']),
  sinceField(),
  unavailableField({ item: true }),
  showSwitchField({ item: true }),
  switchStyleField({ item: true }),
  // a small tile's tap toggles what toggles, a large one's opens; its circle may be its switch
  actionFields({ icon: true, tap: null, iconTap: null }),
];
const without = (...names: readonly string[]) =>
  TILE_FIELDS.filter((field) => !names.includes(field.name));
const TILE_FIELDS_STYLE = without('show_switch');
const TILE_FIELDS_NO_STYLE = without('switch_style');
const TILE_FIELDS_NO_SWITCH = without('show_switch', 'switch_style');

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
      'switch_style',
      'tap_action',
      'hold_action',
      'double_tap_action',
      'icon_tap_action',
      'icon_hold_action',
      'icon_double_tap_action',
    ],
    schema: TILE_FIELDS,
    // a tile's own switch where it has one, of an entity that switches: a large tile's, with its style while it
    // shows; a compact tile's style, its rocker at its row's end
    schemaOf: (item, card) => {
      const size = card?.['size'];
      if (!card || size === 'mini' || !switches(item['entity'])) return TILE_FIELDS_NO_SWITCH;
      if (size !== 'large') return TILE_FIELDS_STYLE;
      return drawsSwitch(size, item['show_switch'] ?? card['show_switch'])
        ? TILE_FIELDS
        : TILE_FIELDS_NO_STYLE;
    },
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
  switch_style: 'toggle',
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
      // their switches' style where they draw one: large tiles that show them, compact ones' at their rows' ends
      onlyWhen(
        (data) =>
          drawsSwitch(data['size'], data['show_switch']) && holdsSwitch('tiles', 'entities')(data),
        switchStyleField(),
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
