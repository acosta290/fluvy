import type { HaFormSchemaItem, LovelaceConfigForm } from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsDevice,
  holdsDomain,
  iconField,
  isSelectRow,
  nameIconFields,
  namesField,
  onlyWhen,
  selectField,
  selectRowChoices,
  selectRowFields,
  headFields,
  sinceChoices,
  sinceField,
  sliderFields,
  textField,
  titleFields,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { HelpersCardConfig } from './helpers-card.js';

/** The helpers card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A card of many helpers has no entity of its own: its head's icon, tone and colour, its tap ("…") and its hold. */
export const base: readonly BaseKey[] = [
  'entities',
  'names',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'card_blur',
  'exact_colors',
  'unavailable',
  ...ACTIONS_BASE,
  'show_icon',
  'name_lines',
  ...ICON_ACTIONS_BASE,
  'slider_style',
  'slider_words',
];

export const keys = configKeys<HelpersCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'options_style',
  'number_entry',
  ...EMPTY_KEYS,
]);

/** What every row shows: its entity, name and icon, its line and where its last change is read from. */
const ROW = [entityField(), nameIconFields(), textField('secondary'), sinceField()];
/** A time's quick-set times. */
const PRESETS: HaFormSchemaItem = {
  name: 'presets',
  selector: { select: { multiple: true, custom_value: true, options: [] } },
};
/** A select's (#96): the options it offers in their order (of those it lists), chips or a dropdown, and its words. */
const [OPTIONS, LABELS] = selectRowFields();
const SELECT = [OPTIONS, selectField('display', ['auto', 'chips', 'dropdown']), LABELS];
const OTHER_ROW = [...ROW, PRESETS];
const SELECT_ROW = [...ROW, ...SELECT];

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    // how the rows that say no name are named stands over them
    fields: ['names'],
    keys: [
      'entity',
      'name',
      'icon',
      'secondary',
      'since',
      'presets',
      'options',
      'display',
      'labels',
    ],
    schema: [...ROW, PRESETS, ...SELECT],
    schemaOf: (item) => (isSelectRow(item) ? SELECT_ROW : OTHER_ROW),
    choices: selectRowChoices,
  },
];

/** A row's `since` offers the house's timestamp sensors. */
export const choices: EditorChoices = sinceChoices;

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({ options_style: 'full', number_entry: false });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      titleFields(),
      fieldRow(iconField(), selectField('options_style', ['full', 'chips'])),
      headFields(),
      // its numbers' rulers in a style
      ...sliderFields(),
      // a number's figure typed (#218): while the rows hold one that takes a figure (a counter is stepped)
      onlyWhen(holdsDomain(['input_number', 'number'], 'rows', 'entities'), {
        ...boolField('number_entry'),
        helper: 'editor.number_entry_helper',
      }),
      ...colourFields(),
      entitiesField('entities', undefined, true),
      onlyWhen(holdsDevice('rows', 'entities'), namesField()),
      emptyFields(),
      actionFields({ icon: true, many: true }),
    ],
    // a select row's `display` is the card's `options_style` said of one select: its options as chips or a dropdown
    ...formLabels({ options_style: 'editor.options_style', display: 'editor.options_style' }),
  };
}
