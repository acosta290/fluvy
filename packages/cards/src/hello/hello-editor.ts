import type { LovelaceConfigForm, MessageKey } from '@fluvy/core';
import { quickStateFields, roundsList } from '../room/room-editor.js';
import { ACTIONS_BASE, type BaseKey } from '../shared/base.js';
import {
  accentField,
  actionField,
  actionFields,
  boolField,
  doubleTapField,
  editorWord,
  entityField,
  exactField,
  fieldRow,
  formLabels,
  listed,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import type { HelloCardConfig } from './hello-card.js';

/** The hello card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** The greeting names who it greets; its avatar answers a tap and a hold; its colour is its mark's, as named or not. */
export const base: readonly BaseKey[] = ['name', ...ACTIONS_BASE, 'color', 'exact_colors'];

/** The parts that answer of their own (#260), each by the word its actions' labels begin with. */
const PARTS: Readonly<Record<string, MessageKey>> = {
  weather: 'cards.weather',
  date: 'option.date',
};

export const keys = configKeys<HelloCardConfig>()([
  'person',
  'weather',
  'show_weather',
  'show_date',
  'show_avatar',
  'show_name',
  'weather_tap_action',
  'weather_hold_action',
  'weather_double_tap_action',
  'date_tap_action',
  'date_hold_action',
  'date_double_tap_action',
  'quick_actions',
  'show_quick_states',
  'quick_state_position',
]);

/** The quick actions under the greeting: entities' rounds, as a room's and a car's (`roundsList`). */
export const lists: readonly RowsListSpec[] = [
  roundsList('quick_actions', 'room-editor.quick_actions', undefined),
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  show_avatar: true,
  show_name: true,
  show_weather: true,
  show_date: true,
  show_quick_states: false,
  quick_state_position: 'under',
});

const labels = formLabels({
  person: 'editor.entity',
  weather: 'editor.weather',
  show_quick_states: 'room-editor.show_quick_states',
  quick_state_position: 'room-editor.quick_state_position',
  quick_actions: 'room-editor.quick_actions',
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
      fieldRow(boolField('show_avatar'), boolField('show_name')),
      accentField(),
      exactField(),
      // the list is edited row by row (the rows editor takes the field out of the form)
      { name: 'quick_actions', selector: { object: {} } },
      // what the quick actions say of their state, and where (as a room's), once the card lists some
      ...quickStateFields((form) => listed(form, 'quick_actions').length > 0),
      // its weather's and its date's own after the card's (#260), added as an interaction is: nothing until set
      actionFields({
        parts: Object.keys(PARTS).flatMap((part) => [
          actionField(`${part}_tap_action`, 'none'),
          actionField(`${part}_hold_action`, 'none'),
          doubleTapField(`${part}_double_tap_action`),
        ]),
      }),
    ],
    computeLabel: (schema, word) => {
      // a part's action by the part's word and the action's: "Weather · Tap action"
      const [, part = '', action] = /^(weather|date)_(\w+_action)$/.exec(schema.name) ?? [];
      const of = PARTS[part];
      return of
        ? `${editorWord(of)} · ${editorWord(`editor.${action}` as MessageKey)}`
        : labels.computeLabel(schema, word);
    },
    computeHelper: (schema) =>
      schema.name === 'person' ? editorWord('hello.person_helper') : undefined,
  };
}
