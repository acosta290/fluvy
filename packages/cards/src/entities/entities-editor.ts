import { lightDefaults, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import { ACTIONS_BASE, ICON_ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  emptyFields,
  entitiesField,
  fieldRow,
  formLabels,
  holdsDevice,
  holdsDomain,
  holdsLight,
  iconField,
  lightColourFields,
  namesField,
  numberField,
  onlyWhen,
  rowItems,
  selectField,
  headFields,
  textField,
  titleFields,
  whenField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EntitiesCardConfig } from './entities-card.js';

/** The entities card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A card of rows has no entity of its own: its icon, tone and colour are the head's and the rows' default. */
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
  'unavailable',
  'show_icon',
  'name_lines',
  ...ACTIONS_BASE,
  ...ICON_ACTIONS_BASE,
];

export const keys = configKeys<EntitiesCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'show_count',
  'variant',
  'light_colors',
  'light_whites',
  'more',
  'more_path',
  'show_rows_when',
  'number_control',
  ...EMPTY_KEYS,
]);

/** The domains of a number a row may set (#218). */
const NUMBER_DOMAINS = ['input_number', 'number', 'counter'] as const;

/** How a number's row ends (#218): its value, the value between − and +, or a value typed. */
const numberControlField = (): HaFormSchemaItem =>
  choiceField('number_control', [
    ['value', 'editor.number_value'],
    ['stepper', 'editor.number_stepper'],
    ['entry', 'editor.number_typed'],
  ]);

const ROWS = rowItems(true, true);
/** A row's fields with its number's control after where its time is read from: empty until chosen, the card's then. */
const withControl = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] => {
  const at = schema.findIndex((item) => item.name === 'since') + 1;
  return [
    ...schema.slice(0, at),
    { ...numberControlField(), helper: 'editor.item_show_switch_helper' },
    ...schema.slice(at),
  ];
};
/** A number's row: what every row shows, and how it ends. */
const NUMBER_ROW = withControl(ROWS.schemaOf?.({}) ?? ROWS.schema);
const isNumberRow = (item: Readonly<Record<string, unknown>>): boolean =>
  (NUMBER_DOMAINS as readonly string[]).includes(String(item['entity']).split('.')[0] ?? '');

/** The rows, with a section's label or a divider between them, each shown always or on a condition of its own. */
export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    sections: true,
    // the condition every row keeps to stands over the rows, and how those that say no name are named
    fields: ['show_rows_when', 'names'],
    ...ROWS,
    keys: [...ROWS.keys!, 'number_control'],
    schema: withControl(ROWS.schema),
    // a number's row says how it ends (#218)
    schemaOf: (item) => (isNumberRow(item) ? NUMBER_ROW : (ROWS.schemaOf?.(item) ?? ROWS.schema)),
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rows',
  show_count: false,
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
  number_control: 'value',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      titleFields(),
      fieldRow(iconField(), selectField('variant', ['rows', 'compact'])),
      headFields(),
      ...colourFields(),
      entitiesField('entities', undefined, true),
      whenField('show_rows_when'),
      onlyWhen(holdsDevice('rows', 'entities'), namesField()),
      boolField('show_count'),
      // how the numbers' rows end (#218): while the rows hold a number
      onlyWhen(holdsDomain(NUMBER_DOMAINS, 'rows', 'entities'), {
        ...numberControlField(),
        helper: 'editor.number_control_helper',
      }),
      // a light's colours where the rows hold a light
      onlyWhen(holdsLight('rows', 'entities'), lightColourFields()),
      // a last row to where the rest of the list is
      fieldRow(numberField('more', 1, 999), textField('more_path')),
      emptyFields(),
      actionFields({ icon: true, many: true }),
    ],
    ...formLabels({}),
  };
}
