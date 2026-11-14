import { lightDefaults, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import {
  accentField,
  actionFields,
  acts,
  colourFields,
  drawsSwitch,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsActing,
  holdsLight,
  holdsSwitch,
  lightColourFields,
  nameIconFields,
  nameLinesField,
  onlyWhen,
  selectField,
  showActionField,
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
  'show_action',
  'readouts',
  'tiles',
  'columns',
  'tint',
  'light_colors',
  'light_whites',
  ...EMPTY_KEYS,
]);

/** A tile's fields: every one a tile may show; what an item shows of them is its entity's and its group's to say. */
const TILE_FIELDS = [
  entityField(),
  nameIconFields(),
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  entitiesField('readouts', ['sensor']),
  sinceField(),
  unavailableField({ item: true }),
  showSwitchField({ item: true }),
  switchStyleField({ item: true }),
  showActionField({ item: true }),
  // a small tile's tap toggles what toggles, a large one's opens; its circle may be its switch
  actionFields({ icon: true, tap: null, iconTap: null }),
];
/** The fields without those named: one form a set of names, so an item's form is the same one while it stays its kind. */
const FORMS = new Map<string, readonly HaFormSchemaItem[]>();
const without = (names: readonly string[]): readonly HaFormSchemaItem[] => {
  const key = names.join();
  let form = FORMS.get(key);
  if (!form) FORMS.set(key, (form = TILE_FIELDS.filter((field) => !names.includes(field.name))));
  return form;
};

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
      'show_action',
      'tap_action',
      'hold_action',
      'double_tap_action',
      'icon_tap_action',
      'icon_hold_action',
      'icon_double_tap_action',
    ],
    schema: TILE_FIELDS,
    // a tile's own switch where it has one, of an entity that switches: a large tile's, with its style while it
    // shows; a compact tile's style, its rocker at its row's end; and what it is doing, a climate's or a humidifier's
    schemaOf: (item, card) => {
      const size = card?.['size'];
      const entity = item['entity'];
      return without([
        ...(!card || size === 'mini' || !switches(entity)
          ? ['show_switch', 'switch_style']
          : size !== 'large'
            ? ['show_switch']
            : drawsSwitch(size, item['show_switch'] ?? card['show_switch'])
              ? []
              : ['switch_style']),
        ...(acts(entity) ? [] : ['show_action']),
      ]);
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
  show_action: false,
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
      // its thermostats say what they are doing and what they are set to, where they said their mode
      onlyWhen(holdsActing('tiles', 'entities'), showActionField()),
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
