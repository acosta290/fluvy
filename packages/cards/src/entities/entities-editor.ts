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
import { SELECTS } from '../shared/dropdown.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import { READ_OUT, type EntitiesCardConfig } from './entities-card.js';

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
  'exact_colors',
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
  'state_display',
  'state_icons',
  'state_colors',
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

/** The domains whose rows end in their state's words (a select's opens its dropdown), which an icon may say (#234). */
const STATE_DOMAINS = ['sensor', ...READ_OUT].filter((domain) => !SELECTS.has(domain));

/** How the rows say their state (#234): in words, or as the icon their state names. */
const stateDisplayField = (): HaFormSchemaItem => selectField('state_display', ['text', 'icon']);

/** The states' icons and their icons' colours, by the state as Home Assistant writes it (#234). */
const STATE_ICON_FIELDS: readonly HaFormSchemaItem[] = [
  { name: 'state_icons', selector: { object: {} }, helper: 'editor.state_icons_helper' },
  { name: 'state_colors', selector: { object: {} }, helper: 'editor.state_icon_colors_helper' },
];

/** What a row's own say is shown with: empty until chosen, the card's then. */
const ROW_OWN = { helper: 'editor.item_show_switch_helper' } as const;

const ROWS = rowItems(true, true);
/** A row's fields with `fields` after where its time is read from. */
const afterSince = (
  schema: readonly HaFormSchemaItem[],
  fields: readonly HaFormSchemaItem[],
): HaFormSchemaItem[] => {
  const at = schema.findIndex((item) => item.name === 'since') + 1;
  return [...schema.slice(0, at), ...fields, ...schema.slice(at)];
};
const PLAIN = ROWS.schemaOf?.({}) ?? ROWS.schema;
/** A number's row: what every row shows, and how it ends. */
const NUMBER_ROW = afterSince(PLAIN, [{ ...numberControlField(), ...ROW_OWN }]);
/** A row that ends in its state: what every row shows, and how its state is said, with its icons where they are. */
const STATE_ROW = afterSince(PLAIN, [{ ...stateDisplayField(), ...ROW_OWN }]);
const STATE_ICON_ROW = afterSince(PLAIN, [
  { ...stateDisplayField(), ...ROW_OWN },
  ...STATE_ICON_FIELDS,
]);
const domainIn =
  (domains: readonly string[]) =>
  (item: Readonly<Record<string, unknown>>): boolean =>
    domains.includes(String(item['entity']).split('.')[0] ?? '');
const isNumberRow = domainIn(NUMBER_DOMAINS);
const isStateRow = domainIn(STATE_DOMAINS);
/** Whether a row says its state as an icon: its own say, else the card's. */
const iconic = (
  item: Readonly<Record<string, unknown>>,
  card: Readonly<Record<string, unknown>> | undefined,
): boolean => (item['state_display'] ?? card?.['state_display']) === 'icon';
/** Whether the card's rows hold one that ends in its state. */
const holdsState = holdsDomain(STATE_DOMAINS, 'rows', 'entities');

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
    keys: [...ROWS.keys!, 'number_control', 'state_display', 'state_icons', 'state_colors'],
    schema: afterSince(ROWS.schema, [
      { ...numberControlField(), ...ROW_OWN },
      { ...stateDisplayField(), ...ROW_OWN },
      ...STATE_ICON_FIELDS,
    ]),
    // a number's row says how it ends (#218), a row that ends in its state how it says it (#234)
    schemaOf: (item, card) =>
      isNumberRow(item)
        ? NUMBER_ROW
        : isStateRow(item)
          ? iconic(item, card)
            ? STATE_ICON_ROW
            : STATE_ROW
          : (ROWS.schemaOf?.(item) ?? ROWS.schema),
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'rows',
  show_count: false,
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
  number_control: 'value',
  state_display: 'text',
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
      // how the rows say their state (#234): while they hold one that ends in it; its icons once they say it so
      onlyWhen(holdsState, stateDisplayField()),
      ...STATE_ICON_FIELDS.map((field) =>
        onlyWhen((data) => holdsState(data) && iconic(data, undefined), field),
      ),
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
